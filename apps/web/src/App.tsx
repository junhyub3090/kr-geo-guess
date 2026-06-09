import { GameScreen } from "./features/game/GameScreen";
import { RoomGameScreen } from "./features/game/RoomGameScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import { RoomInviteScreen } from "./features/room/RoomInviteScreen";
import { getMapSummaries } from "@kr-geo-guess/shared";
import {
  createFriendRoom,
  getFriendRoom,
  getGameMaps,
  getLeaderboard,
  hasConfiguredApiBaseUrl,
  joinFriendRoom,
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
import { useEffect, useState } from "react";

const initialInviteRoomCode =
  new URLSearchParams(window.location.search).get("room") ?? "";
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
  const [sharedSoloLeaderboard, setSharedSoloLeaderboard] = useState<
    LocalSoloLeaderboardEntry[]
  >([]);
  const [roomCode, setRoomCode] = useState(initialInviteRoomCode);
  const [inviteMode, setInviteMode] = useState(Boolean(initialInviteRoomCode));
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
      const created = await createStaticDailyMatch(nickname, daily?.date);
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

  function handleSoloComplete(completedMatch: ApiMatch) {
    setSoloLeaderboard(
      recordLocalSoloScore({
        nickname: completedMatch.player.nickname,
        totalScore: completedMatch.totalScore,
        difficultyMode: completedMatch.difficultyMode,
        mapName: completedMatch.mapName,
      }),
    );

    if (!apiAvailable) {
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

  if (match) {
    return (
      <GameScreen
        initialMatch={match}
        onSoloComplete={handleSoloComplete}
        onExit={() => setMatch(null)}
        onRestartSameSettings={restartSoloSameSettings}
      />
    );
  }

  if (roomSession) {
    return (
      <RoomGameScreen
        initialSession={roomSession}
        onRoomComplete={refreshSharedLeaderboard}
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

type LeaderboardMode = "all" | "solo" | "room";

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
