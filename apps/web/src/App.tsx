import { GameScreen } from "./features/game/GameScreen";
import { RoomGameScreen } from "./features/game/RoomGameScreen";
import { SeedIssueAdminScreen } from "./features/admin/SeedIssueAdminScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import { RoomInviteScreen } from "./features/room/RoomInviteScreen";
import { getMapSummaries } from "@kr-geo-guess/shared";
import {
  createFriendRoom,
  createRoomRematch,
  getFriendRoom,
  getGameMaps,
  getLeaderboard,
  hasConfiguredApiBaseUrl,
  joinFriendRoom,
  joinRoomRematch,
  leaveFriendRoom,
  recordSharedSoloScore,
  submitFeedback,
  type ApiMatch,
  type ApiRoom,
  type DailyChallenge,
  type GameDifficultyMode,
  type GameMapSummary,
  type LeaderboardEntry,
} from "./features/api/gameApi";
import {
  createStaticDailyMatch,
  createStaticSoloMatch,
  getStaticDailyChallenge,
  getStaticGameMaps,
} from "./features/api/staticGameApi";
import {
  loadLocalSoloLeaderboard,
  recordLocalSoloScore,
  type LocalSoloLeaderboardEntry,
} from "./features/leaderboard/localSoloLeaderboard";
import {
  loadPlayerProgress,
  recordCompletedSoloMatch,
  type CompletedSoloRecordOptions,
  type PlayerProgressState,
} from "./features/progress/localPlayerProgress";
import {
  getDailyChallengeStatus,
  prepareDailyAttempt,
  recordDailyAttemptCompletion,
  recordDailyAttemptStart,
  type DailyChallengeStatus,
} from "./features/daily/localDailyChallenge";
import { useEffect, useState } from "react";

const initialInviteRoomCode =
  new URLSearchParams(window.location.search).get("room") ?? "";
const initialAdminMode =
  new URLSearchParams(window.location.search).get("admin") === "seed-issues";
const apiConfigured = hasConfiguredApiBaseUrl();
const LAST_SELECTED_MAP_STORAGE_KEY = "kr-geo-guess:last-map-id:v1";

export function App() {
  const [nickname, setNickname] = useState("");
  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [roomSession, setRoomSession] = useState<{
    playerId: string;
    room: ApiRoom;
  } | null>(null);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyChallengeStatus>(() =>
    getDailyChallengeStatus(),
  );
  const [maps, setMaps] = useState<GameMapSummary[]>(() => getMapSummaries());
  const [selectedMapId, setSelectedMapId] = useState(() => getLastSelectedMapId());
  const [difficultyMode, setDifficultyMode] = useState<GameDifficultyMode>("normal");
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [leaderboardDifficulty, setLeaderboardDifficulty] =
    useState<GameDifficultyMode>("normal");
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("all");
  const [soloLeaderboard, setSoloLeaderboard] = useState<
    LocalSoloLeaderboardEntry[]
  >(() => loadLocalSoloLeaderboard());
  const [playerProgress, setPlayerProgress] = useState<PlayerProgressState>(() =>
    loadPlayerProgress(),
  );
  const [sharedSoloLeaderboard, setSharedSoloLeaderboard] = useState<
    LocalSoloLeaderboardEntry[]
  >([]);
  const [roomCode, setRoomCode] = useState(initialInviteRoomCode);
  const [inviteMode, setInviteMode] = useState(
    Boolean(initialInviteRoomCode) && !initialAdminMode,
  );
  const [adminMode, setAdminMode] = useState(initialAdminMode);
  const [inviteRoomPreview, setInviteRoomPreview] = useState<ApiRoom | null>(null);
  const [apiAvailable, setApiAvailable] = useState(() => apiConfigured);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSelectedMapId = getActiveSelectedMapId(selectedMapId, maps);

  useEffect(() => {
    let cancelled = false;

    function loadStaticHomeData() {
      void getStaticGameMaps()
        .then((staticMaps) => {
          if (!cancelled) {
            setMaps(staticMaps);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMaps(getMapSummaries());
          }
        });
      void getStaticDailyChallenge()
        .then((staticDaily) => {
          if (!cancelled) {
            setDaily(staticDaily);
            setDailyStatus(getDailyChallengeStatus(staticDaily.date));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDaily(null);
          }
        });
    }

    loadStaticHomeData();

    if (!apiConfigured) {
      setApiAvailable(false);
      return () => {
        cancelled = true;
      };
    }

    Promise.all([getGameMaps(), getLeaderboard()])
      .then(([mapResponse, leaderboardResponse]) => {
        if (cancelled) {
          return;
        }

        setMaps(mapResponse.maps);
        setSharedSoloLeaderboard(
          toLocalSoloLeaderboardEntries(leaderboardResponse.entries),
        );
        setApiAvailable(true);
      })
      .catch(() => {
        if (!cancelled) {
          setApiAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!inviteMode || !apiConfigured || roomSession || !roomCode.trim()) {
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getFriendRoom(roomCode)
      .then((response) => {
        if (!cancelled) {
          setInviteRoomPreview(response.room);
          setApiAvailable(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInviteRoomPreview(null);
          setError("방을 찾지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inviteMode, roomCode, roomSession]);

  useEffect(() => {
    function syncRouteModeFromLocation() {
      const params = new URLSearchParams(window.location.search);
      const nextAdminMode = params.get("admin") === "seed-issues";
      setAdminMode(nextAdminMode);

      if (nextAdminMode) {
        setMatch(null);
        setRoomSession(null);
        setInviteMode(false);
        setInviteRoomPreview(null);
        setRoomCode("");
        setError(null);
        return;
      }

      if (!roomSession) {
        const nextRoomCode = params.get("room") ?? "";
        setRoomCode(nextRoomCode);
        setInviteMode(Boolean(nextRoomCode));
        setInviteRoomPreview(null);
        setError(null);
      }
    }

    window.addEventListener("popstate", syncRouteModeFromLocation);
    return () => window.removeEventListener("popstate", syncRouteModeFromLocation);
  }, [roomSession]);

  async function startSolo() {
    setLoading(true);
    setError(null);

    try {
      const created = await createStaticSoloMatch(
        nickname,
        activeSelectedMapId,
        difficultyMode,
        timerSeconds,
      );
      setMatch(created);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "게임을 시작하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function startDailyChallenge() {
    setLoading(true);
    setError(null);

    try {
      const dailyDate = daily?.date;
      const attempt = prepareDailyAttempt(dailyDate);
      const created = await createStaticDailyMatch(nickname, attempt.date, attempt);
      setDailyStatus(
        recordDailyAttemptStart({
          date: attempt.date,
        }),
      );
      setMatch(created);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "오늘의 챌린지를 시작하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function restartSoloSameSettings(completedMatch: ApiMatch) {
    setLoading(true);
    setError(null);

    try {
      const created = await createStaticSoloMatch(
        completedMatch.player.nickname,
        completedMatch.mapId,
        completedMatch.difficultyMode,
        completedMatch.timerSeconds,
      );
      setMatch(created);
    } catch (restartError) {
      setMatch(null);
      setError(
        restartError instanceof Error
          ? restartError.message
          : "같은 설정으로 다시 시작하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function restartSoloHarder(completedMatch: ApiMatch) {
    setLoading(true);
    setError(null);

    try {
      const created = await createStaticSoloMatch(
        completedMatch.player.nickname,
        completedMatch.mapId,
        getHarderDifficulty(completedMatch.difficultyMode),
        completedMatch.timerSeconds,
      );
      setMatch(created);
    } catch (restartError) {
      setMatch(null);
      setError(
        restartError instanceof Error
          ? restartError.message
          : "더 어려운 설정으로 다시 시작하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function restartSoloDifferentMap(completedMatch: ApiMatch) {
    setLoading(true);
    setError(null);

    try {
      const created = await createStaticSoloMatch(
        completedMatch.player.nickname,
        getNextPlayableMapId(maps, completedMatch.mapId),
        completedMatch.difficultyMode === "mixed"
          ? "normal"
          : completedMatch.difficultyMode,
        completedMatch.timerSeconds,
      );
      setMatch(created);
    } catch (restartError) {
      setMatch(null);
      setError(
        restartError instanceof Error
          ? restartError.message
          : "다른 지역으로 다시 시작하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSoloComplete(completedMatch: ApiMatch) {
    const isDailyMatch = Boolean(completedMatch.daily);
    let isOfficialDaily = false;

    if (isDailyMatch) {
      const completion = recordDailyAttemptCompletion(completedMatch);
      isOfficialDaily = completion.officialRecorded;
      setDailyStatus(completion.status);
    }

    const progressOptions: CompletedSoloRecordOptions = {
      officialDaily: isOfficialDaily,
    };
    setPlayerProgress(recordCompletedSoloMatch(completedMatch, progressOptions));

    if (!isDailyMatch || isOfficialDaily) {
      setSoloLeaderboard(
        recordLocalSoloScore({
          nickname: completedMatch.player.nickname,
          totalScore: completedMatch.totalScore,
          difficultyMode: completedMatch.difficultyMode,
          mapName: completedMatch.mapName,
          gameMode: isOfficialDaily ? "daily" : "solo",
          dailyDate: isOfficialDaily ? completedMatch.daily?.date : undefined,
        }),
      );
    }

    if (!apiAvailable || isDailyMatch) {
      return;
    }

    void recordSharedSoloScore({
      nickname: completedMatch.player.nickname,
      totalScore: completedMatch.totalScore,
      totalDistanceMeters: getTotalDistanceMeters(completedMatch),
      totalTimeSeconds: getTotalTimeSeconds(completedMatch),
      difficultyMode: completedMatch.difficultyMode,
      mapName: completedMatch.mapName,
    })
      .then((response) => {
        setSharedSoloLeaderboard(
          toLocalSoloLeaderboardEntries(response.entries),
        );
      })
      .catch(() => undefined);
  }

  function refreshSharedLeaderboard() {
    if (!apiAvailable) {
      return;
    }

    void getLeaderboard()
      .then((leaderboardResponse) => {
        setSharedSoloLeaderboard(
          toLocalSoloLeaderboardEntries(leaderboardResponse.entries),
        );
      })
      .catch(() => undefined);
  }

  function handleMapChange(mapId: string) {
    setSelectedMapId(mapId);
    saveLastSelectedMapId(mapId);
  }

  async function createRoom() {
    if (!apiConfigured) {
      setError("친구방은 서버 배포 후 사용할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await createFriendRoom(
        nickname,
        activeSelectedMapId,
        difficultyMode,
        timerSeconds,
      );
      setApiAvailable(true);
      setRoomSession(created);
      setRoomCode(created.room.roomCode);
      setInviteMode(false);
      setInviteRoomPreview(null);
      window.history.pushState(
        { roomCode: created.room.roomCode },
        "",
        `?room=${created.room.roomCode}`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "방을 만들지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createRematchRoom(completedRoom: ApiRoom) {
    if (!apiConfigured) {
      setError("친구방은 서버 배포 후 사용할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!roomSession) {
        throw new Error("리매치할 방 세션이 없습니다.");
      }

      const created = await createRoomRematch({
        roomCode: completedRoom.roomCode,
        playerId: roomSession.playerId,
      });
      setApiAvailable(true);
      setRoomSession(created);
      setRoomCode(created.room.roomCode);
      setInviteMode(false);
      setInviteRoomPreview(null);
      window.history.replaceState(
        { roomCode: created.room.roomCode },
        "",
        `?room=${created.room.roomCode}`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "같은 설정의 새 방을 만들지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function joinRematchRoom(completedRoom: ApiRoom) {
    if (!apiConfigured) {
      setError("친구방은 서버 배포 후 사용할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!roomSession) {
        throw new Error("리매치할 방 세션이 없습니다.");
      }

      const joined = await joinRoomRematch({
        roomCode: completedRoom.rematch?.roomCode ?? completedRoom.roomCode,
        playerId: roomSession.playerId,
      });
      setApiAvailable(true);
      setRoomSession(joined);
      setRoomCode(joined.room.roomCode);
      setInviteMode(false);
      setInviteRoomPreview(null);
      window.history.replaceState(
        { roomCode: joined.room.roomCode },
        "",
        `?room=${joined.room.roomCode}`,
      );
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "리매치 방에 들어가지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (!apiConfigured) {
      setError("친구방은 서버 배포 후 사용할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const joined = await joinFriendRoom(roomCode, nickname);
      setApiAvailable(true);
      setRoomSession(joined);
      setRoomCode(joined.room.roomCode);
      setInviteMode(false);
      setInviteRoomPreview(null);
      window.history.pushState(
        { roomCode: joined.room.roomCode },
        "",
        `?room=${joined.room.roomCode}`,
      );
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "방에 들어가지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedbackSubmit(message: string) {
    if (!apiConfigured) {
      throw new Error("제보함은 서버 연결 후 사용할 수 있습니다.");
    }

    await submitFeedback({
      nickname,
      message,
      pagePath: `${window.location.pathname}${window.location.search}`,
      userAgent: window.navigator.userAgent,
    });
    setApiAvailable(true);
  }

  function exitRoom() {
    if (roomSession && apiAvailable) {
      void leaveFriendRoom({
        roomCode: roomSession.room.roomCode,
        playerId: roomSession.playerId,
      }).catch(() => undefined);
    }

    setRoomSession(null);
    setInviteMode(false);
    setInviteRoomPreview(null);
    setRoomCode("");
    window.history.replaceState(null, "", window.location.pathname);
  }

  useEffect(() => {
    if (!roomSession) {
      return undefined;
    }

    function handlePopState() {
      if (roomSession && apiAvailable) {
        void leaveFriendRoom({
          roomCode: roomSession.room.roomCode,
          playerId: roomSession.playerId,
        }).catch(() => undefined);
      }

      const urlRoomCode =
        new URLSearchParams(window.location.search).get("room") ?? "";
      setRoomSession(null);
      setRoomCode(urlRoomCode);
      setInviteMode(Boolean(urlRoomCode));
      setInviteRoomPreview(null);
      setError(null);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [apiAvailable, roomSession]);

  function exitInvite() {
    setInviteMode(false);
    setInviteRoomPreview(null);
    setRoomCode("");
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  function exitAdmin() {
    setAdminMode(false);
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (adminMode) {
    return (
      <SeedIssueAdminScreen
        apiConfigured={apiConfigured}
        onExit={exitAdmin}
      />
    );
  }

  if (match) {
    return (
      <GameScreen
        initialMatch={match}
        onSoloComplete={handleSoloComplete}
        onExit={() => setMatch(null)}
        onRestartSameSettings={restartSoloSameSettings}
        onRestartHarder={restartSoloHarder}
        onRestartDifferentMap={restartSoloDifferentMap}
        progress={playerProgress}
      />
    );
  }

  if (roomSession) {
    return (
      <RoomGameScreen
        key={roomSession.room.roomCode}
        initialSession={roomSession}
        onRoomComplete={refreshSharedLeaderboard}
        onCreateRematchRoom={createRematchRoom}
        onJoinRematchRoom={joinRematchRoom}
        onExit={exitRoom}
      />
    );
  }

  if (inviteMode) {
    return (
      <RoomInviteScreen
        roomCode={roomCode}
        nickname={nickname}
        room={inviteRoomPreview}
        apiAvailable={apiAvailable}
        apiConfigured={apiConfigured}
        loading={loading}
        error={error}
        onNicknameChange={setNickname}
        onJoinRoom={joinRoom}
        onExit={exitInvite}
      />
    );
  }

  return (
    <HomeScreen
      nickname={nickname}
      daily={daily}
      dailyStatus={dailyStatus}
      maps={maps}
      selectedMapId={activeSelectedMapId}
      difficultyMode={difficultyMode}
      timerSeconds={timerSeconds}
      leaderboardDifficulty={leaderboardDifficulty}
      leaderboardMode={leaderboardMode}
      soloLeaderboard={
        getVisibleLeaderboardEntries(sharedSoloLeaderboard, soloLeaderboard)
      }
      personalLeaderboard={soloLeaderboard}
      playerProgress={playerProgress}
      roomCode={roomCode}
      apiAvailable={apiAvailable}
      apiConfigured={apiConfigured}
      loading={loading}
      error={error}
      onNicknameChange={setNickname}
      onMapChange={handleMapChange}
      onDifficultyChange={setDifficultyMode}
      onTimerSecondsChange={setTimerSeconds}
      onLeaderboardDifficultyChange={setLeaderboardDifficulty}
      onLeaderboardModeChange={setLeaderboardMode}
      onRoomCodeChange={setRoomCode}
      onStartSolo={startSolo}
      onStartDailyChallenge={startDailyChallenge}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      onSubmitFeedback={handleFeedbackSubmit}
    />
  );
}

type LeaderboardMode = "all" | "solo" | "room" | "daily";

function getLastSelectedMapId() {
  try {
    return window.localStorage.getItem(LAST_SELECTED_MAP_STORAGE_KEY) || "kr-all";
  } catch {
    return "kr-all";
  }
}

function saveLastSelectedMapId(mapId: string) {
  try {
    window.localStorage.setItem(LAST_SELECTED_MAP_STORAGE_KEY, mapId);
  } catch {
    // Ignore storage failures; the selected map still works for this session.
  }
}

function getActiveSelectedMapId(
  selectedMapId: string,
  maps: readonly GameMapSummary[],
) {
  if (maps.some((gameMap) => gameMap.id === selectedMapId)) {
    return selectedMapId;
  }

  return "kr-all";
}

function getVisibleLeaderboardEntries(
  sharedEntries: readonly LocalSoloLeaderboardEntry[],
  localEntries: readonly LocalSoloLeaderboardEntry[],
): LocalSoloLeaderboardEntry[] {
  if (sharedEntries.length === 0) {
    return [...localEntries];
  }

  const byScoreKey = new Set<string>();
  const entries: LocalSoloLeaderboardEntry[] = [];

  for (const entry of [...sharedEntries, ...localEntries]) {
    const key = [
      entry.gameMode ?? "solo",
      entry.nickname,
      entry.totalScore,
      entry.difficultyMode,
      entry.mapName,
      entry.dailyDate ?? "",
    ].join("|");

    if (byScoreKey.has(key)) {
      continue;
    }

    byScoreKey.add(key);
    entries.push(entry);
  }

  return entries.sort(compareLeaderboardEntries);
}

function compareLeaderboardEntries(
  left: LocalSoloLeaderboardEntry,
  right: LocalSoloLeaderboardEntry,
) {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }

  return left.completedAt.localeCompare(right.completedAt);
}

function getHarderDifficulty(
  difficultyMode: GameDifficultyMode,
): GameDifficultyMode {
  switch (difficultyMode) {
    case "easy":
      return "normal";
    case "normal":
    case "mixed":
      return "hard";
    case "hard":
      return "hard";
  }
}

function getNextPlayableMapId(
  maps: readonly GameMapSummary[],
  currentMapId: string,
) {
  const playableMaps = maps.filter((gameMap) => gameMap.playable !== false);
  if (playableMaps.length === 0) {
    return "kr-all";
  }

  const currentIndex = playableMaps.findIndex(
    (gameMap) => gameMap.id === currentMapId,
  );
  return playableMaps[(currentIndex + 1 + playableMaps.length) % playableMaps.length]?.id ??
    playableMaps[0]!.id;
}

function toLocalSoloLeaderboardEntries(
  entries: readonly LeaderboardEntry[],
): LocalSoloLeaderboardEntry[] {
  return entries.map((entry) => ({
    id: `shared-${entry.playerId}`,
    nickname: entry.nickname,
    totalScore: entry.totalScore,
    difficultyMode: entry.difficultyMode,
    mapName: entry.mapName,
    completedAt: "",
    gameMode: entry.gameMode ?? "solo",
  }));
}

function getTotalDistanceMeters(match: ApiMatch) {
  return Math.round(
    match.results.reduce(
      (sum, result) => sum + (result.distanceMeters ?? 0),
      0,
    ),
  );
}

function getTotalTimeSeconds(match: ApiMatch) {
  return match.results.reduce(
    (sum, result) =>
      sum + (match.timerSeconds - (result.timeRemainingSeconds ?? 0)),
    0,
  );
}
