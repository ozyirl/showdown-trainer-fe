"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boxButtonClass } from "@/components/battle/panel";
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
import { cn } from "@/lib/utils";

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

  // The mutation object changes with its status, so the effect below depends on
  // the stable mutateAsync alone; otherwise every save restarts it and the finished
  // save never matches the latest edit version, which re-saves forever.
  const { mutateAsync: patchTeam } = useMutation({
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
        const saved = await patchTeam({
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
  }, [draft, isDirty, patchTeam, queryClient]);

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

  const saveStatus: { label: string; tone: string } = (() => {
    if (selectedTeamQuery.isFetching && !draft)
      return { label: "Loading", tone: "bg-white/30" };
    if (saveState === "saving")
      return { label: "Saving", tone: "bg-[#3b5bff] animate-pulse" };
    if (saveState === "error")
      return { label: "Save failed", tone: "bg-red-400" };
    if (isDirty) return { label: "Unsaved", tone: "bg-amber-300" };
    if (saveState === "saved") return { label: "Saved", tone: "bg-emerald-400" };
    return { label: draft ? "Up to date" : "Ready", tone: "bg-white/30" };
  })();

  const teams = teamsQuery.data ?? [];
  const loadError = teamsQuery.isError
    ? `Failed to load teams: ${statusFromError(teamsQuery.error)}`
    : selectedTeamQuery.isError
      ? `Failed to load selected team: ${statusFromError(selectedTeamQuery.error)}`
      : null;
  const banner = loadError
    ? { type: "error" as const, text: loadError }
    : statusBanner;

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white lg:h-dvh lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-3 p-3 sm:p-4 lg:min-h-0 lg:px-6">
        <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-[5px] border border-white/10 bg-[#0a0a0b] px-3 py-2">
          <Link href="/" className={cn(boxButtonClass, "h-7")}>
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <span aria-hidden className="h-6 w-px bg-white/10" />
          <div className="min-w-0">
            <h1 className="text-[14px] font-medium leading-5 tracking-tight text-white">
              Teambuilder
            </h1>
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
              {draft ? (
                <>
                  {draft.name || "Untitled"}
                  <span className="px-1 text-white/20">·</span>
                  {draft.format || "custom"}
                  <span className="px-1 text-white/20">·</span>
                  {draft.slots.filter((slot) => slot.species.trim()).length}/6
                </>
              ) : (
                "Showdown-style team editor"
              )}
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            {banner && (
              <div
                className={cn(
                  "hidden min-w-0 items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11.5px] md:flex",
                  banner.type === "error"
                    ? "border-red-400/25 bg-red-500/[0.06] text-red-200"
                    : banner.type === "success"
                      ? "border-emerald-400/20 bg-emerald-500/[0.05] text-emerald-200"
                      : "border-white/10 bg-white/[0.03] text-white/65",
                )}
                role="status"
              >
                <span className="max-w-[360px] truncate" title={banner.text}>
                  {banner.text}
                </span>
                {!loadError && (
                  <button
                    type="button"
                    onClick={() => setStatusBanner(null)}
                    aria-label="Dismiss"
                    className="text-current opacity-60 hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}
            <span
              className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55"
              aria-live="polite"
            >
              <span className={cn("size-1.5", saveStatus.tone)} />
              {saveStatus.label}
            </span>
            <span aria-hidden className="h-6 w-px bg-white/10" />
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[208px_minmax(0,1fr)_280px] xl:grid-cols-[224px_minmax(0,1fr)_300px] min-[1400px]:grid-cols-[240px_minmax(0,1fr)_340px]">
          <TeamList
            className="max-h-[360px] lg:max-h-none"
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

          <main className="flex min-w-0 flex-col gap-3 lg:min-h-0">
            {banner && (
              <div
                className={cn(
                  "rounded-[4px] border px-3 py-2 text-[12px] md:hidden",
                  banner.type === "error"
                    ? "border-red-400/25 bg-red-500/[0.06] text-red-200"
                    : "border-white/10 bg-white/[0.03] text-white/65",
                )}
              >
                {banner.text}
              </div>
            )}
            <TeamEditor
              team={draft}
              selectedSlotIndex={selectedSlotIndex}
              onSelectSlot={setSelectedSlotIndex}
              onTeamChange={handleTeamChange}
              loading={selectedTeamQuery.isFetching}
            />
          </main>

          <TeambuilderChat
            className="h-[520px] lg:h-auto"
            team={draft}
            onSlotsUpdated={handleChatSlotsUpdated}
            chatFn={(params) => api.chat(params)}
          />
        </div>
      </div>
    </div>
  );
}
