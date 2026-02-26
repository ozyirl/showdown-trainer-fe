import type { Team, TeamCreateInput, TeamPatchInput, ApiErrorPayload } from "@/lib/teambuilder/types";
import { coerceTeamListResponse, normalizeTeam, sanitizeTeamForSave } from "@/lib/teambuilder/types";

export type TokenGetter = () => Promise<string | null>;

export class ApiClientError extends Error {
  status: number;
  payload?: ApiErrorPayload;

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5200/api";
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") {
    const err = payload as ApiErrorPayload;
    if (Array.isArray(err.message)) return err.message.join(", ");
    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
  }
  return fallback;
}

export function createTeambuilderApiClient(getToken: TokenGetter) {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers,
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      throw new ApiClientError(
        getErrorMessage(payload, `Request failed (${response.status})`),
        response.status,
        typeof payload === "object" && payload ? (payload as ApiErrorPayload) : undefined,
      );
    }
    return payload as T;
  };

  return {
    async getTeams(): Promise<Team[]> {
      const data = await request<unknown>("/teams");
      return coerceTeamListResponse(data);
    },
    async getTeam(id: string): Promise<Team> {
      const data = await request<unknown>(`/teams/${id}`);
      return normalizeTeam(data as Partial<Team>);
    },
    async createTeam(input: TeamCreateInput): Promise<Team> {
      const normalized = normalizeTeam(input as Partial<Team>);
      const data = await request<unknown>("/teams", {
        method: "POST",
        body: JSON.stringify(sanitizeTeamForSave({ ...normalized, id: "" })),
      });
      return normalizeTeam(data as Partial<Team>);
    },
    async patchTeam(id: string, input: TeamPatchInput): Promise<Team> {
      const normalized = normalizeTeam({ ...(input as Partial<Team>), id });
      const data = await request<unknown>(`/teams/${id}`, {
        method: "PATCH",
        body: JSON.stringify(sanitizeTeamForSave(normalized)),
      });
      return normalizeTeam(data as Partial<Team>);
    },
    async putTeam(id: string, input: Omit<Team, "id">): Promise<Team> {
      const data = await request<unknown>(`/teams/${id}`, {
        method: "PUT",
        body: JSON.stringify(sanitizeTeamForSave({ ...(input as Team), id })),
      });
      return normalizeTeam(data as Partial<Team>);
    },
    async deleteTeam(id: string): Promise<void> {
      await request<unknown>(`/teams/${id}`, { method: "DELETE" });
    },
  };
}
