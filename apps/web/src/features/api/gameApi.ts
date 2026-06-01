import type { LatLng, PublicRound, RoundGuessResult } from "@kr-geo-guess/shared";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:2567";

export type ApiMatch = {
  matchId: string;
  roomCode: string;
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

export type GameMapSummary = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  scope: "national" | "province" | "city";
  regions: string[];
  featured?: boolean;
  seedCount: number;
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
};

export type ApiRoomPlayer = {
  playerId: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  hasGuessed: boolean;
};

export type ApiRoomRevealGuess = {
  playerId: string;
  nickname: string;
  guess: LatLng | null;
  distanceMeters: number | null;
  score: number;
  totalScore: number;
};

export type ApiRoom = {
  roomCode: string;
  phase: "lobby" | "round_active" | "round_reveal" | "finished";
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  roundIndex: number;
  roundCount: number;
  timerSeconds: number;
  players: ApiRoomPlayer[];
  currentRound: PublicRound | null;
  revealed: null | {
    roundNumber: number;
    target: RoundGuessResult["target"];
    guesses: ApiRoomRevealGuess[];
  };
};

export async function getDailyChallenge(): Promise<DailyChallenge> {
  return requestJson("/api/daily");
}

export async function getLeaderboard(): Promise<{ entries: LeaderboardEntry[] }> {
  return requestJson("/api/leaderboard");
}

export async function getGameMaps(): Promise<{ maps: GameMapSummary[] }> {
  return requestJson("/api/maps");
}

export async function createSoloMatch(
  nickname: string,
  mapId: string,
  difficultyMode: GameDifficultyMode,
): Promise<ApiMatch> {
  return requestJson("/api/solo-matches", {
    method: "POST",
    body: JSON.stringify({ nickname, mapId, difficultyMode }),
  });
}

export async function createFriendRoom(
  nickname: string,
  mapId: string,
  difficultyMode: GameDifficultyMode,
): Promise<{ playerId: string; room: ApiRoom }> {
  return requestJson("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ nickname, mapId, difficultyMode }),
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
}: {
  roomCode: string;
  playerId: string;
}): Promise<{ room: ApiRoom }> {
  return requestJson(`/api/rooms/${encodeURIComponent(roomCode)}/start`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
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
