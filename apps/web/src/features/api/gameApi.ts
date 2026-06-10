import type {
  LatLng,
  PublicRound,
  RoundGuessResult,
  SeedIssueReason,
} from "@kr-geo-guess/shared";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

export function hasConfiguredApiBaseUrl() {
  return API_BASE_URL.length > 0;
}

export type ApiMatch = {
  matchId: string;
  roomCode: string;
  daily?: {
    date: string;
    official: boolean;
    attemptNumber: number;
  };
  player: {
    id: string;
    nickname: string;
  };
  phase: "active" | "reveal" | "finished";
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  roundIndex: number;
  roundCount: number;
  timerSeconds: number;
  totalScore: number;
  currentRound: PublicRound | null;
  results: RoundGuessResult[];
};

export type GameDifficultyMode = "easy" | "normal" | "hard" | "mixed";

export type LeaderboardGameMode = "solo" | "room";

export type GameMapSummary = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  scope: "national" | "province" | "city";
  regions: readonly string[];
  featured?: boolean;
  seedCount: number;
  minimumSeedCount?: number;
  playable?: boolean;
};

export type DailyChallenge = {
  id: string;
  date: string;
  roundCount: number;
  timerSeconds: number;
  rounds: PublicRound[];
};

export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  nickname: string;
  totalScore: number;
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  difficultyMode: GameDifficultyMode;
  mapName: string;
  gameMode?: LeaderboardGameMode;
};

export type SharedSoloScoreInput = {
  nickname: string;
  totalScore: number;
  totalDistanceMeters: number;
  totalTimeSeconds: number;
  difficultyMode: GameDifficultyMode;
  mapName: string;
};

export type FeedbackInput = {
  nickname: string;
  message: string;
  pagePath: string;
  userAgent: string;
};

export type ApiRoomPlayer = {
  playerId: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  color: string;
  hasGuessed: boolean;
};

export type ApiRoomRevealGuess = {
  rank: number;
  playerId: string;
  nickname: string;
  color: string;
  guess: LatLng | null;
  distanceMeters: number | null;
  score: number;
  totalScore: number;
};

export type ApiRoomRoundHistory = {
  roundNumber: number;
  target: RoundGuessResult["target"];
  guesses: ApiRoomRevealGuess[];
};

export type ApiRoomRematch = {
  roomCode: string;
  createdAt: number;
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  timerSeconds: number;
  status: "lobby" | "started";
  joinable: boolean;
};

export type ApiRoom = {
  roomCode: string;
  phase:
    | "lobby"
    | "round_active"
    | "round_reveal_countdown"
    | "round_reveal"
    | "finished";
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  roundIndex: number;
  roundCount: number;
  timerSeconds: number;
  serverTime: number;
  revealCountdownEndsAt: number | null;
  rematchOnly: boolean;
  players: ApiRoomPlayer[];
  currentRound: PublicRound | null;
  rematch: ApiRoomRematch | null;
  revealed: null | {
    roundNumber: number;
    target: RoundGuessResult["target"];
    guesses: ApiRoomRevealGuess[];
  };
  roundHistory?: ApiRoomRoundHistory[];
};

export type SeedIssueSummary = {
  total: number;
  byReason: Array<{
    reason: SeedIssueReason;
    count: number;
  }>;
  byMap: Array<{
    mapId: string;
    mapName: string;
    count: number;
    byReason: Array<{
      reason: SeedIssueReason;
      count: number;
    }>;
  }>;
};

export type SeedIssueListItem = {
  seedId: string;
  reason: SeedIssueReason;
  source: "solo" | "room";
  mapId: string;
  mapName: string;
  roundNumber: number;
  region1: string;
  region2: string;
  difficulty: string;
  reportedAt: string;
};

export type SeedIssueList = {
  total: number;
  issues: SeedIssueListItem[];
};

export async function getDailyChallenge(): Promise<DailyChallenge> {
  return requestJson("/api/daily");
}

export async function getLeaderboard(): Promise<{ entries: LeaderboardEntry[] }> {
  return requestJson("/api/leaderboard");
}

export async function recordSharedSoloScore(
  input: SharedSoloScoreInput,
): Promise<{ entry: LeaderboardEntry; entries: LeaderboardEntry[] }> {
  return requestJson("/api/leaderboard", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getGameMaps(): Promise<{ maps: GameMapSummary[] }> {
  return requestJson("/api/maps");
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<{ feedback: { id: string; createdAt: string } }> {
  return requestJson("/api/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createSoloMatch(
  nickname: string,
  mapId: string,
  difficultyMode: GameDifficultyMode,
  timerSeconds = 30,
): Promise<ApiMatch> {
  return requestJson("/api/solo-matches", {
    method: "POST",
    body: JSON.stringify({ nickname, mapId, difficultyMode, timerSeconds }),
  });
}

export async function createFriendRoom(
  nickname: string,
  mapId: string,
  difficultyMode: GameDifficultyMode,
  timerSeconds = 30,
): Promise<{ playerId: string; room: ApiRoom }> {
  return requestJson("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ nickname, mapId, difficultyMode, timerSeconds }),
  });
}

export async function createRoomRematch({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}): Promise<{ playerId: string; room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/rematch`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export async function joinRoomRematch({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}): Promise<{ playerId: string; room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/rematch/join`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export async function joinFriendRoom(
  roomCode: string,
  nickname: string,
): Promise<{ playerId: string; room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

export async function getFriendRoom(roomCode: string): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}`);
}

export async function startFriendRoom({
  roomCode,
  playerId,
  allowMissingRematchPlayers = false,
}: {
  roomCode: string;
  playerId: string;
  allowMissingRematchPlayers?: boolean;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/start`, {
    method: "POST",
    body: JSON.stringify({ playerId, allowMissingRematchPlayers }),
  });
}

export async function submitRoomGuess({
  roomCode,
  playerId,
  roundIndex,
  guess,
}: {
  roomCode: string;
  playerId: string;
  roundIndex: number;
  guess: LatLng | null;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/guess`, {
    method: "POST",
    body: JSON.stringify({ playerId, roundIndex, guess }),
  });
}

export async function reportRoomSeedIssue({
  roomCode,
  playerId,
  roundIndex,
  seedId,
  reason,
}: {
  roomCode: string;
  playerId: string;
  roundIndex: number;
  seedId: string;
  reason: SeedIssueReason;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/seed-issues`, {
    method: "POST",
    body: JSON.stringify({ playerId, roundIndex, seedId, reason }),
  });
}

export async function revealRoom({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/reveal`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export async function setRoomPlayerColor({
  roomCode,
  playerId,
  color,
}: {
  roomCode: string;
  playerId: string;
  color: string;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/color`, {
    method: "POST",
    body: JSON.stringify({ playerId, color }),
  });
}

export async function nextRoomRound({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/next`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export async function leaveFriendRoom({
  roomCode,
  playerId,
}: {
  roomCode: string;
  playerId: string;
}): Promise<{ room: ApiRoom | null }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/leave`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}

export async function getSeedIssueSummary(): Promise<SeedIssueSummary> {
  return requestJson("/api/seed-issues/summary");
}

export async function getSeedIssueList(
  adminToken: string,
): Promise<SeedIssueList> {
  return requestJson("/api/seed-issues", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
}

export async function submitGuess({
  matchId,
  roundIndex,
  guess,
}: {
  matchId: string;
  roundIndex: number;
  guess: LatLng | null;
}): Promise<{
  matchId: string;
  phase: "reveal";
  result: RoundGuessResult;
  totalScore: number;
  nextRoundAvailable: boolean;
}> {
  return requestJson(`/api/solo-matches/${matchId}/guess`, {
    method: "POST",
    body: JSON.stringify({ roundIndex, guess }),
  });
}

export async function reportSoloSeedIssue({
  matchId,
  roundIndex,
  seedId,
  reason,
}: {
  matchId: string;
  roundIndex: number;
  seedId: string;
  reason: SeedIssueReason;
}): Promise<ApiMatch> {
  return requestJson(`/api/solo-matches/${matchId}/seed-issues`, {
    method: "POST",
    body: JSON.stringify({ roundIndex, seedId, reason }),
  });
}

export async function advanceRound(matchId: string): Promise<ApiMatch> {
  return requestJson(`/api/solo-matches/${matchId}/next`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function requestJson<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}
