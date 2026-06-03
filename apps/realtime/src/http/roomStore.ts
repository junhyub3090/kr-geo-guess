import {
  createMatchPlan,
  createPublicRound,
  createRoomCode,
  getGameMap,
  getCurrentRound,
  getNextRoundIndex,
  getSeedsForMapFromCatalog,
  normalizeNickname,
  submitRoundGuess,
  type GameDifficultyMode,
  type LatLng,
  type MatchPlan,
  type RoundGuessResult,
  type SeedLocation,
} from "@kr-geo-guess/shared";

type RoomPhase = "lobby" | "round_active" | "round_reveal" | "finished";

type RoomPlayer = {
  playerId: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
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
  plan: MatchPlan;
  players: RoomPlayer[];
  guesses: Map<string, RoomGuessSubmission>;
  resultsByRound: Map<number, RoomRoundResult[]>;
  createdAt: number;
};

type RoomGuessSubmission = {
  guess: LatLng | null;
  submittedAt: number;
};

type RoomRoundResult = RoundGuessResult & {
  playerId: string;
  totalScoreAfterRound: number;
};

export type FriendRoomStore = ReturnType<typeof createFriendRoomStore>;

const AUTO_SUBMIT_GRACE_MS = 1_500;

export class RoomNotFoundError extends Error {
  constructor(roomCode: string) {
    super(`Room not found: ${roomCode}`);
  }
}

export class RoomConflictError extends Error {}

export function createFriendRoomStore(options: {
  seedCatalog: readonly SeedLocation[];
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
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
    const gameMap = getGameMap(rawMapId);
    const difficultyMode = normalizeDifficultyMode(rawDifficultyMode);
    const timerSeconds = normalizeTimerSeconds(rawTimerSeconds);
    const mapSeeds = getSeedsForMapFromCatalog(options.seedCatalog, gameMap.id);
    const idSeed = `room-${createdAt}-${sequence}-${gameMap.id}-${difficultyMode}`;
    const plan = createMatchPlan(mapSeeds, {
      roundCount: 5,
      timerSeconds,
      idSeed,
      mapId: gameMap.id,
      difficultyMode,
    });
    const roomCode = createUniqueRoomCode(idSeed);
    const player = createPlayer(rawNickname, true);
    const room: FriendRoom = {
      roomCode,
      phase: "lobby",
      mapId: gameMap.id,
      mapName: gameMap.name,
      difficultyMode,
      roundIndex: 0,
      roundStartedAt: null,
      plan,
      players: [player],
      guesses: new Map(),
      resultsByRound: new Map(),
      createdAt,
    };

    rooms.set(roomCode, room);

    return {
      playerId: player.playerId,
      room: serializeRoom(room),
    };
  }

  function joinRoom(roomCode: string, rawNickname: string) {
    const room = getRoomOrThrow(roomCode);
    syncRoom(room, now());

    const player = createPlayer(rawNickname, false);
    room.players.push(player);

    return {
      playerId: player.playerId,
      room: serializeRoom(room),
    };
  }

  function getRoom(roomCode: string) {
    const room = getRoomOrThrow(roomCode);
    syncRoom(room, now());
    return serializeRoom(room);
  }

  function startRoom(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);

    if (!isHost(room, playerId)) {
      throw new RoomConflictError("Only the host can start this room");
    }

    if (room.phase !== "lobby") {
      throw new RoomConflictError("Room has already started");
    }

    room.phase = "round_active";
    room.roundIndex = 0;
    room.roundStartedAt = now();
    room.guesses.clear();
    resetRoundGuesses(room);

    return serializeRoom(room);
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

    if (room.guesses.size >= room.players.length || isPastTimer(room, currentTime, 0)) {
      revealRound(room);
    }

    return serializeRoom(room);
  }

  function reveal(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);
    syncRoom(room, now());

    if (!isHost(room, playerId)) {
      throw new RoomConflictError("Only the host can reveal this room");
    }

    if (room.phase !== "round_active") {
      throw new RoomConflictError("Current round cannot be revealed");
    }

    revealRound(room);
    return serializeRoom(room);
  }

  function nextRound(roomCode: string, playerId: string) {
    const room = getRoomOrThrow(roomCode);

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
      room.guesses.clear();
      return serializeRoom(room);
    }

    room.phase = "round_active";
    room.roundIndex = nextIndex;
    room.roundStartedAt = now();
    room.guesses.clear();
    resetRoundGuesses(room);

    return serializeRoom(room);
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

  function createPlayer(rawNickname: string, isHost: boolean): RoomPlayer {
    const idPart = `${sequence.toString(36)}-${now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    return {
      playerId: `player-${idPart}`,
      nickname: normalizeNickname(rawNickname),
      score: 0,
      connected: true,
      isHost,
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
    nextRound,
  };
}

function serializeRoom(room: FriendRoom) {
  const currentRound = getCurrentRound(room.plan, room.roundIndex);
  const timerEndsAt =
    room.phase === "round_active" && room.roundStartedAt !== null
      ? room.roundStartedAt + room.plan.timerSeconds * 1000
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
    players: room.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      score: player.score,
      connected: player.connected,
      isHost: player.isHost,
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
}

function syncRoom(room: FriendRoom, currentTime: number, graceMs = 0) {
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
