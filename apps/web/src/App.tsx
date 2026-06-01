import { GameScreen } from "./features/game/GameScreen";
import { RoomGameScreen } from "./features/game/RoomGameScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import {
  createFriendRoom,
  createSoloMatch,
  getDailyChallenge,
  getGameMaps,
  getLeaderboard,
  joinFriendRoom,
  type ApiMatch,
  type ApiRoom,
  type DailyChallenge,
  type GameDifficultyMode,
  type GameMapSummary,
  type LeaderboardEntry,
} from "./features/api/gameApi";
import { useEffect, useState } from "react";

export function App() {
  const [nickname, setNickname] = useState("");
  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [roomSession, setRoomSession] = useState<{
    playerId: string;
    room: ApiRoom;
  } | null>(null);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [maps, setMaps] = useState<GameMapSummary[]>([]);
  const [selectedMapId, setSelectedMapId] = useState("kr-all");
  const [difficultyMode, setDifficultyMode] = useState<GameDifficultyMode>("normal");
  const [roomCode, setRoomCode] = useState(() =>
    new URLSearchParams(window.location.search).get("room") ?? "",
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getDailyChallenge(), getLeaderboard(), getGameMaps()])
      .then(([dailyChallenge, leaderboardResponse, mapResponse]) => {
        if (cancelled) {
          return;
        }

        setDaily(dailyChallenge);
        setLeaderboard(leaderboardResponse.entries);
        setMaps(mapResponse.maps);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Node.js API 서버에 연결할 수 없습니다.");
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
      const created = await createSoloMatch(
        nickname,
        selectedMapId,
        difficultyMode,
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

  async function createRoom() {
    setLoading(true);
    setError(null);

    try {
      const created = await createFriendRoom(nickname, selectedMapId, difficultyMode);
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
      roomCode={roomCode}
      leaderboard={leaderboard}
      loading={loading}
      error={error}
      onNicknameChange={setNickname}
      onMapChange={setSelectedMapId}
      onDifficultyChange={setDifficultyMode}
      onRoomCodeChange={setRoomCode}
      onStartSolo={startSolo}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
    />
  );
}
