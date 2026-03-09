"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TeamEditor } from "@/components/teambuilder/TeamEditor";
import { TeambuilderChat } from "@/components/teambuilder/TeambuilderChat";
import { TeamList } from "@/components/teambuilder/TeamList";
import {
  createTeambuilderApiClient,
  ApiClientError,
} from "@/lib/teambuilder/api-client";
import {
  createEmptySlot,
  createEmptyTeam,
  normalizeTeam,
  type Team,
} from "@/lib/teambuilder/types";

const TEAMS_KEY = ["teambuilder", "teams"] as const;

function localDraftKey(teamId: string) {
  return `teambuilder-draft:${teamId}`;
}

function statusFromError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export default function TeambuilderClient() {
  const { getToken, isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => createTeambuilderApiClient(() => getToken()),
    [getToken],
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Team | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [statusBanner, setStatusBanner] = useState<{
    type: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const editVersionRef = useRef(0);
  const hydratedTeamRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const teamsQuery = useQuery({
    queryKey: TEAMS_KEY,
    queryFn: () => api.getTeams(),
    enabled: isLoaded && !!userId,
  });

  const selectedTeamQuery = useQuery({
    queryKey: ["teambuilder", "team", selectedTeamId],
    queryFn: () => api.getTeam(selectedTeamId as string),
    enabled: isLoaded && !!userId && !!selectedTeamId,
  });

  useEffect(() => {
    if (!selectedTeamId && teamsQuery.data?.length) {
      setSelectedTeamId(teamsQuery.data[0].id);
    }
  }, [selectedTeamId, teamsQuery.data]);

  useEffect(() => {
    if (!selectedTeamQuery.data) return;
    const team = normalizeTeam(selectedTeamQuery.data);
    const sourceId = `${team.id}:${team.updatedAt ?? ""}`;
    if (hydratedTeamRef.current === sourceId && isDirty) return;

    const fallback =
      typeof window !== "undefined"
        ? localStorage.getItem(localDraftKey(team.id))
        : null;
    if (fallback) {
      try {
        const parsed = JSON.parse(fallback) as Team;
        setDraft(normalizeTeam(parsed));
        setIsDirty(true);
        setStatusBanner({
          type: "info",
          text: "Recovered local draft after a previous save failure.",
        });
      } catch {
        setDraft(team);
        setIsDirty(false);
      }
    } else {
      setDraft(team);
      setIsDirty(false);
    }
    hydratedTeamRef.current = sourceId;
    setSaveState("idle");
  }, [selectedTeamQuery.data, isDirty]);

  useEffect(() => {
    if (!draft?.id) return;
    if (!isDirty) {
      localStorage.removeItem(localDraftKey(draft.id));
      return;
    }
    localStorage.setItem(localDraftKey(draft.id), JSON.stringify(draft));
  }, [draft, isDirty]);

  const patchMutation = useMutation({
    mutationFn: ({ id, team }: { id: string; team: Team }) =>
      api.patchTeam(id, {
        name: team.name,
        format: team.format,
        notes: team.notes,
        slots: team.slots,
      }),
  });

  useEffect(() => {
    if (!draft?.id || !isDirty) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    const version = ++editVersionRef.current;

    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setSaveState("saving");
        const saved = await patchMutation.mutateAsync({
          id: draft.id,
          team: draft,
        });
        queryClient.setQueryData(["teambuilder", "team", saved.id], saved);
        queryClient.setQueryData<Team[] | undefined>(TEAMS_KEY, (prev) =>
          (prev ?? []).map((team) => (team.id === saved.id ? saved : team)),
        );
        if (editVersionRef.current === version) {
          setDraft(saved);
          setIsDirty(false);
          setSaveState("saved");
          localStorage.removeItem(localDraftKey(saved.id));
        }
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 400) {
          // Backend may reject partial/in-progress edits (e.g. typing incomplete names). Keep local draft and avoid a hard-failure UX.
          setSaveState("idle");
          setStatusBanner({
            type: "info",
            text: "Draft not saved yet (backend rejected an incomplete/invalid edit). Keep typing or choose a valid value.",
          });
        } else {
          setSaveState("error");
          setStatusBanner({
            type: "error",
            text: `Autosave failed: ${statusFromError(error)}`,
          });
        }
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current)
        window.clearTimeout(autosaveTimerRef.current);
    };
  }, [draft, isDirty, patchMutation, queryClient, api]);

  const createTeam = async () => {
    setBusyAction("create");
    setStatusBanner(null);
    try {
      const created = await api.createTeam({
        name: `Untitled Team ${Math.floor(Math.random() * 1000)}`,
        format: "gen9ou",
        notes: "",
        slots: [createEmptySlot()],
      });
      queryClient.setQueryData<Team[] | undefined>(TEAMS_KEY, (prev) => [
        created,
        ...(prev ?? []),
      ]);
      queryClient.setQueryData(["teambuilder", "team", created.id], created);
      setSelectedTeamId(created.id);
      setSelectedSlotIndex(0);
      setDraft(created);
      setIsDirty(false);
      setSaveState("saved");
      setStatusBanner({ type: "success", text: "Team created." });
    } catch (error) {
      setStatusBanner({
        type: "error",
        text: `Create failed: ${statusFromError(error)}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const deleteTeam = async () => {
    if (!selectedTeamId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this team?"))
      return;
    setBusyAction("delete");
    setStatusBanner(null);
    try {
      const deletingId = selectedTeamId;
      await api.deleteTeam(deletingId);
      queryClient.setQueryData<Team[] | undefined>(TEAMS_KEY, (prev) =>
        (prev ?? []).filter((team) => team.id !== deletingId),
      );
      queryClient.removeQueries({
        queryKey: ["teambuilder", "team", deletingId],
      });
      if (draft?.id === deletingId) {
        setDraft(null);
        setIsDirty(false);
      }
      const remaining = (
        queryClient.getQueryData<Team[]>(TEAMS_KEY) ?? []
      ).filter((t) => t.id !== deletingId);
      setSelectedTeamId(remaining[0]?.id ?? null);
      setStatusBanner({ type: "success", text: "Team deleted." });
    } catch (error) {
      setStatusBanner({
        type: "error",
        text: `Delete failed: ${statusFromError(error)}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const duplicateTeam = async () => {
    if (!draft) return;
    setBusyAction("duplicate");
    setStatusBanner(null);
    try {
      const copy = await api.createTeam({
        name: `${draft.name} Copy`,
        format: draft.format,
        notes: draft.notes,
        slots: draft.slots,
      });
      queryClient.setQueryData<Team[] | undefined>(TEAMS_KEY, (prev) => [
        copy,
        ...(prev ?? []),
      ]);
      queryClient.setQueryData(["teambuilder", "team", copy.id], copy);
      setSelectedTeamId(copy.id);
      setSelectedSlotIndex(0);
      setDraft(copy);
      setIsDirty(false);
      setStatusBanner({ type: "success", text: "Team duplicated." });
    } catch (error) {
      setStatusBanner({
        type: "error",
        text: `Duplicate failed: ${statusFromError(error)}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTeamChange = (next: Team) => {
    setDraft(next);
    setIsDirty(true);
    setSaveState("idle");
  };

  const handleAddSlot = () => {
    if (!draft) return;
    if (draft.slots.length >= 6) return;
    handleTeamChange({ ...draft, slots: [...draft.slots, createEmptySlot()] });
    setSelectedSlotIndex(draft.slots.length);
  };

  const handleChatSlotsUpdated = (
    incomingSlots: typeof draft extends null
      ? never
      : NonNullable<typeof draft>["slots"],
  ) => {
    if (!draft) return;
    const nextSlots = [...draft.slots];
    for (const incoming of incomingSlots) {
      const slotNum = (incoming as { slot?: number }).slot;
      const targetIdx =
        typeof slotNum === "number" && slotNum >= 1 && slotNum <= 6
          ? slotNum - 1
          : nextSlots.length < 6
            ? nextSlots.length
            : nextSlots.findIndex((s) => !s.species.trim());
      if (targetIdx < 0 || targetIdx >= 6) continue;
      while (nextSlots.length <= targetIdx) nextSlots.push(createEmptySlot());
      nextSlots[targetIdx] = {
        ...incoming,
        species: incoming.species || nextSlots[targetIdx].species,
      };
    }
    handleTeamChange({ ...draft, slots: nextSlots.slice(0, 6) });
    if (incomingSlots.length > 0) {
      const lastSlotNum = (
        incomingSlots[incomingSlots.length - 1] as { slot?: number }
      ).slot;
      if (
        typeof lastSlotNum === "number" &&
        lastSlotNum >= 1 &&
        lastSlotNum <= 6
      ) {
        setSelectedSlotIndex(lastSlotNum - 1);
      }
    }
  };

  const headerStatus = (() => {
    if (selectedTeamQuery.isFetching && !draft) return "Loading team...";
    if (saveState === "saving") return "Autosaving changes";
    if (isDirty) return "Unsaved changes";
    if (saveState === "saved") return "All changes saved";
    return "Ready";
  })();

  const teams = teamsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(0,21,255,0.16),transparent_40%),radial-gradient(circle_at_85%_15%,rgba(0,21,255,0.12),transparent_46%),radial-gradient(circle_at_50%_85%,rgba(0,21,255,0.07),transparent_44%)]" />
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/3 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.03]"
            >
              ← Home
            </Link>
            <div>
              <div className="text-xs tracking-[0.18em] text-white/40">
                POKEMON SHOWDOWN-STYLE TEAMBUILDER
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
          <div className="flex flex-col gap-4">
            <TeamList
              teams={teams}
              selectedTeamId={selectedTeamId}
              search={search}
              onSearchChange={setSearch}
              onSelect={(id) => {
                setSelectedTeamId(id);
                setSelectedSlotIndex(0);
                setStatusBanner(null);
              }}
              onCreate={createTeam}
              onDuplicate={duplicateTeam}
              onDelete={deleteTeam}
              loading={teamsQuery.isLoading}
              busyAction={busyAction}
            />
            <div className="h-[520px]">
              <TeambuilderChat
                team={draft}
                onSlotsUpdated={handleChatSlotsUpdated}
                chatFn={(params) => api.chat(params)}
              />
            </div>
          </div>

          <div className="space-y-4">
            {(teamsQuery.isError || selectedTeamQuery.isError) && (
              <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-sm text-red-200">
                {teamsQuery.isError
                  ? `Failed to load teams: ${statusFromError(teamsQuery.error)}`
                  : `Failed to load selected team: ${statusFromError(selectedTeamQuery.error)}`}
              </div>
            )}

            <TeamEditor
              team={draft}
              selectedSlotIndex={selectedSlotIndex}
              onSelectSlot={setSelectedSlotIndex}
              onTeamChange={handleTeamChange}
              onAddSlot={handleAddSlot}
              statusText={
                selectedTeamId
                  ? `Editing team ${selectedTeamId}`
                  : "No team selected"
              }
              saveState={saveState}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
