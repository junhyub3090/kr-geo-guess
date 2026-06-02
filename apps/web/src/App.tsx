import { GameScreen } from "./features/game/GameScreen";
import { RoomGameScreen } from "./features/game/RoomGameScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import { getMapSummaries } from "@kr-geo-guess/shared";
import {
  createFriendRoom,
  getDailyChallenge,
  getGameMaps,
  getLeaderboard,
  hasConfiguredApiBaseUrl,
  joinFriendRoom,
  recordSharedSoloScore,
  type ApiMatch,
  type ApiRoom,
  type DailyChallenge,
  type GameDifficultyMode,
  type GameMapSummary,
  type LeaderboardEntry,
} from "./features/api/gameApi";
import { createStaticSoloMatch } from "./features/api/staticGameApi";
import {
  loadLocalSoloLeaderboard,
  recordLocalSoloScore,
  type LocalSoloLeaderboardEntry,
} from "./features/leaderboard/localSoloLeaderboard";
import { useEffect, useState } from "react";

export function App() {
  const [nickname, setNickname] = useState("");
  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [roomSession, setRoomSession] = useState<{
    playerId: string;
    room: ApiRoom;
  } | null>(null);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [maps, setMaps] = useState<GameMapSummary[]>(() => getMapSummaries());
  const [selectedMapId, setSelectedMapId] = useState("kr-all");
  const [difficultyMode, setDifficultyMode] = useState<GameDifficultyMode>("normal");
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [leaderboardDifficulty, setLeaderboardDifficulty] =
    useState<GameDifficultyMode>("normal");
  const [soloLeaderboard, setSoloLeaderboard] = useState<
    LocalSoloLeaderboardEntry[]
  >(() => loadLocalSoloLeaderboard());
  const [sharedSoloLeaderboard, setSharedSoloLeaderboard] = useState<
    LocalSoloLeaderboardEntry[]
  >([]);
  const [roomCode, setRoomCode] = useState(() =>
    new URLSearchParams(window.location.search).get("room") ?? "",
  );
  const [apiAvailable, setApiAvailable] = useState(() => hasConfiguredApiBaseUrl());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasConfiguredApiBaseUrl()) {
      setMaps(getMapSummaries());
      setApiAvailable(false);
      return undefined;
    }

    let cancelled = false;

    Promise.all([getDailyChallenge(), getGameMaps(), getLeaderboard()])
      .then(([dailyChallenge, mapResponse, leaderboardResponse]) => {
        if (cancelled) {
          return;
        }

        setDaily(dailyChallenge);
        setMaps(mapResponse.maps);
        setSharedSoloLeaderboard(
          toLocalSoloLeaderboardEntries(leaderboardResponse.entries),
        );
        setApiAvailable(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMaps(getMapSummaries());
          setApiAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function startSolo() {
    setLoading(true);
    setError(null);

    try {
      const created = await createStaticSoloMatch(
        nickname,
        selectedMapId,
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

  async function createRoom() {
    if (!apiAvailable) {
      setError("친구방은 서버 배포 후 사용할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await createFriendRoom(
        nickname,
        selectedMapId,
        difficultyMode,
        timerSeconds,
      );
      setRoomSession(created);
      setRoomCode(created.room.roomCode);
      window.history.replaceState(null, "", `?room=${created.room.roomCode}`);
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
    if (!apiAvailable) {
      setError("친구방은 서버 배포 후 사용할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const joined = await joinFriendRoom(roomCode, nickname);
      setRoomSession(joined);
      setRoomCode(joined.room.roomCode);
      window.history.replaceState(null, "", `?room=${joined.room.roomCode}`);
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

  function exitRoom() {
    setRoomSession(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (match) {
    return (
      <GameScreen
        initialMatch={match}
        onSoloComplete={handleSoloComplete}
        onExit={() => setMatch(null)}
      />
    );
  }

  if (roomSession) {
    return (
      <RoomGameScreen
        initialSession={roomSession}
        onExit={exitRoom}
      />
    );
  }

  return (
    <HomeScreen
      nickname={nickname}
      daily={daily}
      maps={maps}
      selectedMapId={selectedMapId}
      difficultyMode={difficultyMode}
      timerSeconds={timerSeconds}
      leaderboardDifficulty={leaderboardDifficulty}
      soloLeaderboard={
        sharedSoloLeaderboard.length > 0 ? sharedSoloLeaderboard : soloLeaderboard
      }
      roomCode={roomCode}
      apiAvailable={apiAvailable}
      loading={loading}
      error={error}
      onNicknameChange={setNickname}
      onMapChange={setSelectedMapId}
      onDifficultyChange={setDifficultyMode}
      onTimerSecondsChange={setTimerSeconds}
      onLeaderboardDifficultyChange={setLeaderboardDifficulty}
      onRoomCodeChange={setRoomCode}
      onStartSolo={startSolo}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
    />
  );
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
