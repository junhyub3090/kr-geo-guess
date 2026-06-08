import {
  MIN_PLAYABLE_SEED_COUNT,
  createMatchPlan,
  createRoomCode,
  getGameMap,
  getCurrentRound,
  getNextRoundIndex,
  isRoomPlayerColor,
  normalizeNickname,
  replaceCurrentRoundSeed,
  ROOM_PLAYER_COLORS,
  type LatLng,
  type SeedIssueReason,
  type SeedLocation,
} from "@kr-geo-guess/shared";
import type { SharedLeaderboardStore } from "./leaderboardStore.js";
import { RoomConflictError, RoomNotFoundError } from "./roomErrors.js";
import {
  AUTO_SUBMIT_GRACE_MS,
  allConnectedPlayersGuessed,
  getNextAvailableColor,
  getPlayableSeedSelection,
  getPlayerOrThrow,
  isHost,
  isPastTimer,
  normalizeDifficultyMode,
  normalizeRoomCode,
  normalizeTimerSeconds,
  recordRoomLeaderboard,
  resetRoundGuesses,
  revealRound,
  serializeRoom,
  syncRoom,
  transferHost,
} from "./roomStoreUtils.js";
import type { FriendRoom, RoomPlayer } from "./roomTypes.js";
import type { SharedSeedIssueStore } from "./seedIssueStore.js";

export { RoomConflictError, RoomNotFoundError };

export type FriendRoomStore = ReturnType<typeof createFriendRoomStore>;

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
