import {
  MIN_PLAYABLE_SEED_COUNT,
  ROOM_PLAYER_COLORS,
  createPublicRound,
  getCurrentRound,
  getGameMap,
  getSeedsForMapFromCatalog,
  submitRoundGuess,
  type GameDifficultyMode,
  type LeaderboardInput,
  type RoomPlayerColor,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import { RoomConflictError } from "./roomErrors.js";
import type { SharedLeaderboardStore } from "./leaderboardStore.js";
import type { FriendRoom, RoomPlayer, RoomRoundResult } from "./roomTypes.js";

export const AUTO_SUBMIT_GRACE_MS = 1_500;
export const REVEAL_COUNTDOWN_MS = 3_000;

export function serializeRoom(room: FriendRoom, serverTime: number) {
  const currentRound = getCurrentRound(room.plan, room.roundIndex);
  const timerEndsAt =
    room.phase === "round_active" && room.roundStartedAt !== null
      ? room.roundStartedAt + room.plan.timerSeconds * 1000
      : null;
  const revealCountdownEndsAt =
    room.phase === "round_reveal_countdown" &&
    room.revealCountdownStartedAt !== null
      ? room.revealCountdownStartedAt + REVEAL_COUNTDOWN_MS
      : null;

  return {
    roomCode: room.roomCode,
    phase: room.phase,
    mapId: room.mapId,
    mapName: room.mapName,
    difficultyMode: room.difficultyMode,
    roundIndex: room.roundIndex,
    roundCount: room.plan.rounds.length,
    timerSeconds: room.plan.timerSeconds,
    serverTime,
    revealCountdownEndsAt,
    rematchOnly: Boolean(room.rematchSourceRoomCode),
    rematch: room.rematch
      ? {
          roomCode: room.rematch.roomCode,
          createdAt: room.rematch.createdAt,
          mapId: room.mapId,
          mapName: room.mapName,
          difficultyMode: room.difficultyMode,
          timerSeconds: room.plan.timerSeconds,
          status: room.rematch.status,
          joinable: room.rematch.status === "lobby",
        }
      : null,
    players: room.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      score: player.score,
      connected: player.connected,
      isHost: player.isHost,
      color: player.color,
      hasGuessed: player.guessedRound === room.roundIndex,
    })),
    currentRound:
      currentRound && room.phase !== "finished"
        ? createPublicRound(currentRound.seed, currentRound.roundNumber, timerEndsAt, {
            id: room.mapId,
            name: room.mapName,
          })
        : null,
    revealed: serializeReveal(room),
    roundHistory: serializeRoundHistory(room),
  };
}

export function serializeReveal(room: FriendRoom) {
  if (room.phase !== "round_reveal" && room.phase !== "finished") {
    return null;
  }

  const round = room.plan.rounds[room.roundIndex];
  if (!round) {
    return null;
  }

  return {
    roundNumber: round.roundNumber,
    target: round.seed,
    guesses: serializeRoundGuesses(room, round.roundNumber),
  };
}

export function serializeRoundHistory(room: FriendRoom) {
  return room.plan.rounds
    .filter((round) => room.resultsByRound.has(round.roundNumber))
    .map((round) => ({
      roundNumber: round.roundNumber,
      target: round.seed,
      guesses: serializeRoundGuesses(room, round.roundNumber),
    }));
}

export function serializeRoundGuesses(room: FriendRoom, roundNumber: number) {
  const results = room.resultsByRound.get(roundNumber) ?? [];
  const rankedResults = [...results].sort(compareRoundResults);

  return rankedResults.map((result, index) => {
    const player = room.players.find((candidate) => candidate.playerId === result.playerId);
    return {
      rank: index + 1,
      playerId: result.playerId,
      nickname: player?.nickname ?? "게스트",
      color: player?.color ?? ROOM_PLAYER_COLORS[0],
      guess: result.guess,
      distanceMeters: result.distanceMeters,
      score: result.score,
      totalScore: result.totalScoreAfterRound,
    };
  });
}

export function compareRoundResults(left: RoomRoundResult, right: RoomRoundResult) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.distanceMeters === null && right.distanceMeters === null) {
    return (right.timeRemainingSeconds ?? 0) - (left.timeRemainingSeconds ?? 0);
  }

  if (left.distanceMeters === null) {
    return 1;
  }

  if (right.distanceMeters === null) {
    return -1;
  }

  if (left.distanceMeters !== right.distanceMeters) {
    return left.distanceMeters - right.distanceMeters;
  }

  return (right.timeRemainingSeconds ?? 0) - (left.timeRemainingSeconds ?? 0);
}

export function revealRound(room: FriendRoom) {
  const round = room.plan.rounds[room.roundIndex];
  if (!round) {
    return;
  }

  if (room.resultsByRound.has(round.roundNumber)) {
    room.phase = "round_reveal";
    room.roundStartedAt = null;
    room.revealCountdownStartedAt = null;
    return;
  }

  const results: RoomRoundResult[] = [];
  for (const player of room.players) {
    const submission = room.guesses.get(player.playerId);

    const result = {
      ...submitRoundGuess({
        roundNumber: round.roundNumber,
        target: round.seed,
        guess: submission?.guess ?? null,
        scope: room.mapId === "kr-all" ? "national" : getGameMap(room.mapId).scope,
        timeRemainingSeconds: submission
          ? getRemainingSeconds(room, submission.submittedAt)
          : 0,
        timerSeconds: room.plan.timerSeconds,
      }),
      playerId: player.playerId,
    };

    player.score += result.score;
    results.push({
      ...result,
      totalScoreAfterRound: player.score,
    });
  }

  room.resultsByRound.set(round.roundNumber, results);
  room.phase = "round_reveal";
  room.roundStartedAt = null;
  room.revealCountdownStartedAt = null;
}

export function syncRoom(room: FriendRoom, currentTime: number, graceMs = 0) {
  if (room.phase === "round_reveal_countdown") {
    if (
      room.revealCountdownStartedAt !== null &&
      currentTime >= room.revealCountdownStartedAt + REVEAL_COUNTDOWN_MS
    ) {
      revealRound(room);
    }
    return;
  }

  if (room.phase !== "round_active" || room.roundStartedAt === null) {
    return;
  }

  if (isPastTimer(room, currentTime, graceMs)) {
    revealRound(room);
  }
}

export function isPastTimer(room: FriendRoom, currentTime: number, graceMs: number) {
  if (room.roundStartedAt === null) {
    return false;
  }

  return currentTime >= room.roundStartedAt + room.plan.timerSeconds * 1000 + graceMs;
}

export function getRemainingSeconds(room: FriendRoom, currentTime: number): number {
  if (room.roundStartedAt === null) {
    return 0;
  }

  const timerEndsAt = room.roundStartedAt + room.plan.timerSeconds * 1000;
  return Math.max(0, Math.ceil((timerEndsAt - currentTime) / 1000));
}

export function resetRoundGuesses(room: FriendRoom) {
  for (const player of room.players) {
    player.guessedRound = null;
  }
}

export function getPlayerOrThrow(room: FriendRoom, playerId: string) {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    throw new RoomConflictError("Player is not in this room");
  }
  return player;
}

export function isHost(room: FriendRoom, playerId: string) {
  return room.players.some(
    (player) => player.playerId === playerId && player.isHost,
  );
}

export function allConnectedPlayersGuessed(room: FriendRoom) {
  const connectedPlayers = room.players.filter((player) => player.connected);

  return (
    connectedPlayers.length > 0 &&
    connectedPlayers.every((player) => player.guessedRound === room.roundIndex)
  );
}

export function transferHost(room: FriendRoom) {
  for (const player of room.players) {
    player.isHost = false;
  }

  const nextHost =
    room.players.find((player) => player.connected) ?? room.players[0] ?? null;

  if (nextHost) {
    nextHost.isHost = true;
  }
}

export function recordRoomLeaderboard(
  room: FriendRoom,
  leaderboardStore: SharedLeaderboardStore | undefined,
) {
  if (!leaderboardStore || room.leaderboardRecorded) {
    return;
  }

  for (const player of room.players) {
    leaderboardStore.addScore(createRoomLeaderboardEntry(room, player));
  }

  room.leaderboardRecorded = true;
}

export function createRoomLeaderboardEntry(
  room: FriendRoom,
  player: RoomPlayer,
): LeaderboardInput {
  const playerResults = [...room.resultsByRound.values()]
    .flat()
    .filter((result) => result.playerId === player.playerId);

  return {
    playerId: player.playerId,
    nickname: player.nickname,
    totalScore: player.score,
    totalDistanceMeters: playerResults.reduce(
      (sum, result) => sum + (result.distanceMeters ?? 0),
      0,
    ),
    totalTimeSeconds: playerResults.reduce(
      (sum, result) =>
        sum + (room.plan.timerSeconds - (result.timeRemainingSeconds ?? 0)),
      0,
    ),
    difficultyMode: room.difficultyMode,
    mapName: room.mapName,
    gameMode: "room",
  };
}

export function getNextAvailableColor(players: readonly RoomPlayer[]): RoomPlayerColor {
  const usedColors = new Set(players.map((player) => player.color));
  return (
    ROOM_PLAYER_COLORS.find((color) => !usedColors.has(color)) ??
    ROOM_PLAYER_COLORS[0]
  );
}

export function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

export function normalizeDifficultyMode(value: string | undefined): GameDifficultyMode {
  if (
    value === "easy" ||
    value === "normal" ||
    value === "hard" ||
    value === "mixed"
  ) {
    return value;
  }

  return "normal";
}

export function normalizeTimerSeconds(value: unknown) {
  if (value === 45 || value === 60 || value === 90) {
    return value;
  }

  return 30;
}

export function getSelectableSeedsForMap(
  seedCatalog: readonly SeedLocation[],
  mapId: string,
  excludedSeedIds: Set<string>,
) {
  return getSeedsForMapFromCatalog(seedCatalog, mapId).filter(
    (seed) => !excludedSeedIds.has(seed.id),
  );
}

export function getPlayableSeedSelection(
  seedCatalog: readonly SeedLocation[],
  requestedMapId: string,
  excludedSeedIds: Set<string>,
) {
  const requestedGameMap = getGameMap(requestedMapId);
  const requestedSeeds = getSelectableSeedsForMap(
    seedCatalog,
    requestedGameMap.id,
    excludedSeedIds,
  );

  if (requestedSeeds.length >= MIN_PLAYABLE_SEED_COUNT) {
    return {
      gameMap: requestedGameMap,
      mapSeeds: requestedSeeds,
    };
  }

  return null;
}
