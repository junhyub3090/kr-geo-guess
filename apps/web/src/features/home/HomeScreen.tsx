import { CalendarDays, Gauge, KeyRound, Map, Play, Trophy } from "lucide-react";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import type {
  DailyChallenge,
  GameDifficultyMode,
  GameMapSummary,
  LeaderboardEntry,
} from "../api/gameApi";

type HomeScreenProps = {
  nickname: string;
  daily: DailyChallenge | null;
  maps: GameMapSummary[];
  selectedMapId: string;
  difficultyMode: GameDifficultyMode;
  roomCode: string;
  leaderboard: LeaderboardEntry[];
  apiAvailable: boolean;
  loading: boolean;
  error: string | null;
  onNicknameChange: (nickname: string) => void;
  onMapChange: (mapId: string) => void;
  onDifficultyChange: (difficultyMode: GameDifficultyMode) => void;
  onRoomCodeChange: (roomCode: string) => void;
  onStartSolo: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
};

export function HomeScreen({
  nickname,
  daily,
  maps,
  selectedMapId,
  difficultyMode,
  roomCode,
  leaderboard,
  apiAvailable,
  loading,
  error,
  onNicknameChange,
  onMapChange,
  onDifficultyChange,
  onRoomCodeChange,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
}: HomeScreenProps) {
  const selectableMaps = maps.length > 0 ? maps : fallbackMaps;
  const selectedMap =
    selectableMaps.find((gameMap) => gameMap.id === selectedMapId) ??
    selectableMaps[0];
  const selectedDifficulty = difficultyOptions.find(
    (option) => option.id === difficultyMode,
  );
  const placeholderLeaderboard = {
    rank: 1,
    nickname: "준비 중",
    totalScore: 0,
  };

  return (
    <main className="home-shell">
      <header className="home-header">
        <div className="brand-block">
          <h1>어디길</h1>
        </div>
      </header>

      <section className="home-grid">
        <section className="start-panel">
          <div className="map-profile">
            <div className="map-art" aria-hidden="true">
              <KoreaGuessMap
                guess={null}
                regions={selectedMap?.regions ?? []}
                disabled
                showLabels={false}
                compact
                onGuess={() => undefined}
              />
            </div>
            <div className="start-copy">
              <h2>{selectedMap?.name ?? "전국"}</h2>
              <p>{selectedMap?.description ?? "한국 전역에서 라운드를 시작합니다."}</p>
              <div className="map-facts">
                <span>5라운드</span>
                <span>30초</span>
              </div>
            </div>
          </div>

          <div className="setup-row">
            <label className="field-label" htmlFor="nickname">
              닉네임
            </label>
            <input
              id="nickname"
              className="nickname-input"
              maxLength={16}
              value={nickname}
              onChange={(event) => onNicknameChange(event.target.value)}
              placeholder="게스트"
            />
          </div>

          <section className="map-select-block" aria-label="맵 선택">
            <div className="select-heading">
              <div className="select-heading-main">
                <Map size={18} aria-hidden="true" />
                <h3>맵 선택</h3>
              </div>
            </div>
            <div className="map-choice-grid">
              {selectableMaps.map((gameMap) => (
                <button
                  className={
                    gameMap.id === selectedMapId
                      ? "map-choice selected"
                      : "map-choice"
                  }
                  key={gameMap.id}
                  onClick={() => onMapChange(gameMap.id)}
                  type="button"
                >
                  <strong>{gameMap.name}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="difficulty-select-block" aria-label="난이도 선택">
            <div className="select-heading">
              <div className="select-heading-main">
                <Gauge size={18} aria-hidden="true" />
                <h3>난이도</h3>
              </div>
            </div>
            <div className="difficulty-choice-grid">
              {difficultyOptions.map((option) => (
                <button
                  className={
                    option.id === difficultyMode
                      ? "difficulty-choice selected"
                      : "difficulty-choice"
                  }
                  key={option.id}
                  onClick={() => onDifficultyChange(option.id)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                </button>
              ))}
            </div>
          </section>

          {error ? <p className="home-error">{error}</p> : null}

          <div className="mode-grid">
            <button
              className="play-button"
              disabled={loading}
              onClick={onStartSolo}
              type="button"
            >
              <Play size={20} aria-hidden="true" />
              <span>바로 시작</span>
              <small>
                {selectedMap?.shortName ?? "전국"} / {selectedDifficulty?.label ?? "중"}
              </small>
            </button>
          </div>
        </section>

        <aside className="home-side">
          <section className="mini-panel room-panel-active">
            <div className="mini-heading">
              <KeyRound size={18} aria-hidden="true" />
              <h2>친구방</h2>
            </div>
            <button
              className="room-create-button active"
              disabled={loading || !apiAvailable}
              onClick={onCreateRoom}
              type="button"
            >
              방 만들기
            </button>
            <div className="room-entry">
              <input
                aria-label="방 코드"
                value={roomCode}
                onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())}
                placeholder="KR-4821"
              />
              <button
                disabled={loading || !apiAvailable || roomCode.trim().length < 4}
                onClick={onJoinRoom}
                type="button"
              >
                입장
              </button>
            </div>
            {!apiAvailable ? (
              <p className="room-unavailable">싱글플레이만 사용 가능</p>
            ) : null}
          </section>

          <section className="mini-panel">
            <div className="mini-heading">
              <CalendarDays size={18} aria-hidden="true" />
              <h2>데일리 챌린지</h2>
            </div>
            <p>
              {daily
                ? `${daily.date} 오늘의 한국 위치`
                : "오늘의 챌린지를 불러오는 중입니다."}
            </p>
          </section>

          <section className="mini-panel leaderboard-preview">
            <div className="mini-heading">
              <Trophy size={18} aria-hidden="true" />
              <h2>오늘의 상위권</h2>
            </div>
            <div className="leaderboard-list">
              <div className="leaderboard-row placeholder-row">
                <span>{placeholderLeaderboard.rank}</span>
                <strong>{placeholderLeaderboard.nickname}</strong>
                <em>{placeholderLeaderboard.totalScore.toLocaleString("ko-KR")}</em>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

const fallbackMaps: GameMapSummary[] = [
  {
    id: "kr-all",
    name: "전국",
    shortName: "전국",
    description: "전체 위치 풀",
    scope: "national",
    regions: [],
    featured: true,
    seedCount: 0,
  },
];

const difficultyOptions: Array<{
  id: GameDifficultyMode;
  label: string;
}> = [
  {
    id: "easy",
    label: "하",
  },
  {
    id: "normal",
    label: "중",
  },
  {
    id: "hard",
    label: "상",
  },
];
