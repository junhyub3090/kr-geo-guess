import {
  MIN_PLAYABLE_SEED_COUNT,
  createMatchPlan,
  createPublicRound,
  createRoomCode,
  getGameMap,
  getCurrentRound,
  getNextRoundIndex,
  getSeedsForMapFromCatalog,
  isRoomPlayerColor,
  normalizeNickname,
  replaceCurrentRoundSeed,
  ROOM_PLAYER_COLORS,
  submitRoundGuess,
  type GameDifficultyMode,
  type LatLng,
  type LeaderboardInput,
  type MatchPlan,
  type RoomPlayerColor,
  type RoundGuessResult,
  type SeedIssueReason,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import type { SharedLeaderboardStore } from "./leaderboardStore.js";
import type { SharedSeedIssueStore } from "./seedIssueStore.js";

type RoomPhase =
  | "lobby"
  | "round_active"
  | "round_reveal_countdown"
  | "round_reveal"
  | "finished";

type RoomPlayer = {
  playerId: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  color: RoomPlayerColor;
  guessedRound: number | null;
};

type FriendRoom = {
  roomCode: string;
  phase: RoomPhase;
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  roundIndex: number;
  roundStartedAt: number | null;
  revealCountdownStartedAt: number | null;
  plan: MatchPlan;
  players: RoomPlayer[];
  guesses: Map<string, RoomGuessSubmission>;
  resultsByRound: Map<number, RoomRoundResult[]>;
  createdAt: number;
  leaderboardRecorded: boolean;
  excludedSeedIds: Set<string>;
  seedIssueReports: SeedIssueReport[];
};

type RoomGuessSubmission = {
  guess: LatLng | null;
  submittedAt: number;
};

type RoomRoundResult = RoundGuessResult & {
  playerId: string;
  totalScoreAfterRound: number;
};

type SeedIssueReport = {
  seedId: string;
  roundNumber: number;
  playerId: string;
  reason: SeedIssueReason;
  reportedAt: number;
};

export type FriendRoomStore = ReturnType<typeof createFriendRoomStore>;

const AUTO_SUBMIT_GRACE_MS = 1_500;
const REVEAL_COUNTDOWN_MS = 3_000;

export class RoomNotFoundError extends Error {
  constructor(roomCode: string) {
    super(`Room not found: ${roomCode}`);
  }
}

export class RoomConflictError extends Error {}

export function createFriendRoomStore(options: {
  seedCatalog: readonly SeedLocation[];
  now?: () => number;
  leaderboardStore?: SharedLeaderboardStore;
  excludedSeedIds?: Set<string>;
  seedIssueStore?: SharedSeedIssueStore;
}) {
  const now = options.now ?? Date.now;
  const leaderboardStore = options.leaderboardStore;
  const seedIssueStore = options.seedIssueStore;
  const excludedSeedIds = options.excludedSeedIds ?? new Set<string>();
  const rooms = new Map<string, FriendRoom>();
  let sequence = 0;

  function createRoom(
    rawNickname: string,
    rawMapId?: string,
    rawDifficultyMode?: string,
    rawTimerSeconds?: unknown,
  ) {
    sequence += 1;
    const createdAt = now();
    const requestedGameMap = getGameMap(rawMapId);
    const difficultyMode = normalizeDifficultyMode(rawDifficultyMode);
    const timerSeconds = normalizeTimerSeconds(rawTimerSeconds);
    const seedSelection = getPlayableSeedSelection(
      options.seedCatalog,
      requestedGameMap.id,
      excludedSeedIds,
    );
    if (!seedSelection) {
      throw new RoomConflictError("플레이 가능한 위치가 부족합니다. 잠시 후 다시 시도해 주세요.");
    }

    const { gameMap, mapSeeds } = seedSelection;
    const idSeed = `room-${createdAt}-${sequence}-${gameMap.id}-${difficultyMode}`;
    const plan = createMatchPlan(mapSeeds, {
      roundCount: MIN_PLAYABLE_SEED_COUNT,
      timerSeconds,
      idSeed,
      mapId: gameMap.id,
      difficultyMode,
    });
    const roomCode = createUniqueRoomCode(idSeed);
    const player = createPlayer(rawNickname, true, []);
    const room: FriendRoom = {
      roomCode,
      phase: "lobby",
      mapId: gameMap.id,
      mapName: gameMap.name,
      difficultyMode,
      roundIndex: 0,
      roundStartedAt: null,
      revealCountdownStartedAt: null,
      plan,
      players: [player],
      guesses: new Map(),
      resultsByRound: new Map(),
      createdAt,
      leaderboardRecorded: false,
      excludedSeedIds: new Set(),
      seedIssueReports: [],
    };

    rooms.set(roomCode, room);

    return {
      playerId: player.playerId,
      room: serializeRoom(room, createdAt),
    };
  }

  function joinRoom(roomCode: string, rawNickname: string) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);

    if (room.phase !== "lobby") {
      throw new RoomConflictError("Room has already started");
    }

    if (room.players.length >= ROOM_PLAYER_COLORS.length) {
      throw new RoomConflictError("Room is full");
    }

    const player = createPlayer(rawNickname, false, room.players);
    room.players.push(player);

    return {
      playerId: player.playerId,
      room: serializeRoom(room, currentTime),
    };
  }

  function getRoom(roomCode: string) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);
    return serializeRoom(room, currentTime);
  }

  function startRoom(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();

    if (!isHost(room, playerId)) {
      throw new RoomConflictError("Only the host can start this room");
    }

    if (room.phase !== "lobby") {
      throw new RoomConflictError("Room has already started");
    }

    room.phase = "round_active";
    room.roundIndex = 0;
    room.roundStartedAt = currentTime;
    room.revealCountdownStartedAt = null;
    room.guesses.clear();
    resetRoundGuesses(room);

    return serializeRoom(room, currentTime);
  }

  function submitGuess(roomCode: string, playerId: string, roundIndex: number, guess: LatLng | null) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime, AUTO_SUBMIT_GRACE_MS);

    if (room.phase !== "round_active") {
      throw new RoomConflictError("Current round is not accepting guesses");
    }

    if (roundIndex !== room.roundIndex) {
      throw new RoomConflictError("Guess round does not match current round");
    }

    const player = getPlayerOrThrow(room, playerId);
    if (player.guessedRound === room.roundIndex) {
      throw new RoomConflictError("Round already has a submitted guess");
    }

    room.guesses.set(playerId, { guess, submittedAt: currentTime });
    player.guessedRound = room.roundIndex;

    if (isPastTimer(room, currentTime, 0)) {
      revealRound(room);
    }

    return serializeRoom(room, currentTime);
  }

  function reveal(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);

    if (!isHost(room, playerId)) {
      throw new RoomConflictError("Only the host can reveal this room");
    }

    if (room.phase === "round_reveal" || room.phase === "finished") {
      return serializeRoom(room, currentTime);
    }

    if (room.phase === "round_reveal_countdown") {
      return serializeRoom(room, currentTime);
    }

    if (room.phase !== "round_active") {
      throw new RoomConflictError("Current round cannot be revealed");
    }

    if (!allConnectedPlayersGuessed(room)) {
      throw new RoomConflictError("All active players must submit before early reveal");
    }

    room.phase = "round_reveal_countdown";
    room.revealCountdownStartedAt = currentTime;
    return serializeRoom(room, currentTime);
  }

  function setPlayerColor(roomCode: string, playerId: string, color: unknown) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);

    if (room.phase !== "lobby") {
      throw new RoomConflictError("Player colors can be changed only in the lobby");
    }

    if (!isRoomPlayerColor(color)) {
      throw new RoomConflictError("Unsupported player color");
    }

    const player = getPlayerOrThrow(room, playerId);
    const colorTaken = room.players.some(
      (candidate) =>
        candidate.playerId !== playerId &&
        candidate.color.toLowerCase() === color.toLowerCase(),
    );

    if (colorTaken) {
      throw new RoomConflictError("Player color is already taken");
    }

    player.color = color;
    return serializeRoom(room, currentTime);
  }

  function reportSeedIssue(
    roomCode: string,
    playerId: string,
    roundIndex: number,
    seedId: string,
    reason: SeedIssueReason,
  ) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);
    const player = getPlayerOrThrow(room, playerId);
    if (!player.connected) {
      throw new RoomConflictError("Disconnected players cannot report seed issues");
    }

    if (room.phase !== "round_active" || roundIndex !== room.roundIndex) {
      return serializeRoom(room, currentTime);
    }

    const currentRound = getCurrentRound(room.plan, room.roundIndex);
    if (!currentRound || currentRound.seed.id !== seedId) {
      return serializeRoom(room, currentTime);
    }

    excludedSeedIds.add(seedId);
    room.excludedSeedIds.add(seedId);
    seedIssueStore?.addIssue({
      seedId,
      reason,
      source: "room",
      sourceId: room.roomCode,
      playerId,
      mapId: room.mapId,
      mapName: room.mapName,
      roundNumber: currentRound.roundNumber,
      region1: currentRound.seed.region1,
      region2: currentRound.seed.region2,
      difficulty: currentRound.seed.difficulty,
      reportedAt: new Date(currentTime).toISOString(),
    });
    room.seedIssueReports.push({
      seedId,
      roundNumber: currentRound.roundNumber,
      playerId,
      reason,
      reportedAt: currentTime,
    });

    const replacementRound = replaceCurrentRoundSeed({
      plan: room.plan,
      roundIndex: room.roundIndex,
      seedCatalog: options.seedCatalog,
      excludedSeedIds: new Set([...excludedSeedIds, ...room.excludedSeedIds]),
      reason,
    });

    if (!replacementRound) {
      throw new RoomConflictError("No replacement seed is available");
    }

    room.roundStartedAt = currentTime;
    room.revealCountdownStartedAt = null;
    room.guesses.clear();
    resetRoundGuesses(room);

    return serializeRoom(room, currentTime);
  }

  function nextRound(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);

    if (!isHost(room, playerId)) {
      throw new RoomConflictError("Only the host can advance this room");
    }

    if (room.phase !== "round_reveal") {
      throw new RoomConflictError("Room can advance only after reveal");
    }

    const nextIndex = getNextRoundIndex(room.plan, room.roundIndex);
    if (nextIndex === null) {
      room.phase = "finished";
      room.roundStartedAt = null;
      room.revealCountdownStartedAt = null;
      room.guesses.clear();
      recordRoomLeaderboard(room, leaderboardStore);
      return serializeRoom(room, currentTime);
    }

    room.phase = "round_active";
    room.roundIndex = nextIndex;
    room.roundStartedAt = currentTime;
    room.revealCountdownStartedAt = null;
    room.guesses.clear();
    resetRoundGuesses(room);

    return serializeRoom(room, currentTime);
  }

  function leaveRoom(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);
    const currentTime = now();
    syncRoom(room, currentTime);

    const player = getPlayerOrThrow(room, playerId);

    if (room.phase === "lobby") {
      room.players = room.players.filter((candidate) => candidate.playerId !== playerId);
    } else {
      player.connected = false;
    }

    if (
      room.players.length === 0 ||
      (room.phase !== "lobby" && !room.players.some((candidate) => candidate.connected))
    ) {
      rooms.delete(room.roomCode);
      return null;
    }

    if (player.isHost) {
      transferHost(room);
    }

    return serializeRoom(room, currentTime);
  }

  function getRoomOrThrow(roomCode: string) {
    const room = rooms.get(normalizeRoomCode(roomCode));
    if (!room) {
      throw new RoomNotFoundError(roomCode);
    }
    return room;
  }

  function createUniqueRoomCode(seed: string) {
    let code = createRoomCode(seed);
    let attempt = 0;

    while (rooms.has(code)) {
      attempt += 1;
      code = createRoomCode(`${seed}-${attempt}`);
    }

    return code;
  }

  function createPlayer(
    rawNickname: string,
    isHost: boolean,
    existingPlayers: readonly RoomPlayer[],
  ): RoomPlayer {
    const idPart = `${sequence.toString(36)}-${now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    return {
      playerId: `player-${idPart}`,
      nickname: normalizeNickname(rawNickname),
      score: 0,
      connected: true,
      isHost,
      color: getNextAvailableColor(existingPlayers),
      guessedRound: null,
    };
  }

  return {
    createRoom,
    joinRoom,
    getRoom,
    startRoom,
    submitGuess,
    reveal,
    setPlayerColor,
    reportSeedIssue,
    nextRound,
    leaveRoom,
  };
}

function serializeRoom(room: FriendRoom, serverTime: number) {
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

function serializeReveal(room: FriendRoom) {
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

function serializeRoundHistory(room: FriendRoom) {
  return room.plan.rounds
    .filter((round) => room.resultsByRound.has(round.roundNumber))
    .map((round) => ({
      roundNumber: round.roundNumber,
      target: round.seed,
      guesses: serializeRoundGuesses(room, round.roundNumber),
    }));
}

function serializeRoundGuesses(room: FriendRoom, roundNumber: number) {
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

function compareRoundResults(left: RoomRoundResult, right: RoomRoundResult) {
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

function revealRound(room: FriendRoom) {
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

function syncRoom(room: FriendRoom, currentTime: number, graceMs = 0) {
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

function isPastTimer(room: FriendRoom, currentTime: number, graceMs: number) {
  if (room.roundStartedAt === null) {
    return false;
  }

  return currentTime >= room.roundStartedAt + room.plan.timerSeconds * 1000 + graceMs;
}

function getRemainingSeconds(room: FriendRoom, currentTime: number): number {
  if (room.roundStartedAt === null) {
    return 0;
  }

  const timerEndsAt = room.roundStartedAt + room.plan.timerSeconds * 1000;
  return Math.max(0, Math.ceil((timerEndsAt - currentTime) / 1000));
}

function resetRoundGuesses(room: FriendRoom) {
  for (const player of room.players) {
    player.guessedRound = null;
  }
}

function getPlayerOrThrow(room: FriendRoom, playerId: string) {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) {
    throw new RoomConflictError("Player is not in this room");
  }
  return player;
}

function isHost(room: FriendRoom, playerId: string) {
  return room.players.some(
    (player) => player.playerId === playerId && player.isHost,
  );
}

function allConnectedPlayersGuessed(room: FriendRoom) {
  const connectedPlayers = room.players.filter((player) => player.connected);

  return (
    connectedPlayers.length > 0 &&
    connectedPlayers.every((player) => player.guessedRound === room.roundIndex)
  );
}

function transferHost(room: FriendRoom) {
  for (const player of room.players) {
    player.isHost = false;
  }

  const nextHost =
    room.players.find((player) => player.connected) ?? room.players[0] ?? null;

  if (nextHost) {
    nextHost.isHost = true;
  }
}

function recordRoomLeaderboard(
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

function createRoomLeaderboardEntry(
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

function getNextAvailableColor(players: readonly RoomPlayer[]): RoomPlayerColor {
  const usedColors = new Set(players.map((player) => player.color));
  return (
    ROOM_PLAYER_COLORS.find((color) => !usedColors.has(color)) ??
    ROOM_PLAYER_COLORS[0]
  );
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

function normalizeDifficultyMode(value: string | undefined): GameDifficultyMode {
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

function normalizeTimerSeconds(value: unknown) {
  if (value === 45 || value === 60 || value === 90) {
    return value;
  }

  return 30;
}

function getSelectableSeedsForMap(
  seedCatalog: readonly SeedLocation[],
  mapId: string,
  excludedSeedIds: Set<string>,
) {
  return getSeedsForMapFromCatalog(seedCatalog, mapId).filter(
    (seed) => !excludedSeedIds.has(seed.id),
  );
}

function getPlayableSeedSelection(
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

  if (requestedGameMap.id === "kr-all") {
    return null;
  }

  const fallbackGameMap = getGameMap("kr-all");
  const fallbackSeeds = getSelectableSeedsForMap(
    seedCatalog,
    fallbackGameMap.id,
    excludedSeedIds,
  );

  if (fallbackSeeds.length < MIN_PLAYABLE_SEED_COUNT) {
    return null;
  }

  return {
    gameMap: fallbackGameMap,
    mapSeeds: fallbackSeeds,
  };
}
