import {
  CalendarDays,
  Clock3,
  Crown,
  Gauge,
  KeyRound,
  Map,
  MessageSquareText,
  Medal,
  Play,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import {
  getLocalSoloLeaderboardByDifficulty,
  type LocalSoloLeaderboardEntry,
} from "../leaderboard/localSoloLeaderboard";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import type {
  DailyChallenge,
  GameDifficultyMode,
  GameMapSummary,
} from "../api/gameApi";

type HomeScreenProps = {
  nickname: string;
  daily: DailyChallenge | null;
  maps: GameMapSummary[];
  selectedMapId: string;
  difficultyMode: GameDifficultyMode;
  timerSeconds: number;
  leaderboardDifficulty: GameDifficultyMode;
  soloLeaderboard: LocalSoloLeaderboardEntry[];
  roomCode: string;
  apiAvailable: boolean;
  apiConfigured: boolean;
  loading: boolean;
  error: string | null;
  onNicknameChange: (nickname: string) => void;
  onMapChange: (mapId: string) => void;
  onDifficultyChange: (difficultyMode: GameDifficultyMode) => void;
  onTimerSecondsChange: (timerSeconds: number) => void;
  onLeaderboardDifficultyChange: (difficultyMode: GameDifficultyMode) => void;
  onRoomCodeChange: (roomCode: string) => void;
  onStartSolo: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onSubmitFeedback: (message: string) => Promise<void>;
};

export function HomeScreen({
  nickname,
  daily,
  maps,
  selectedMapId,
  difficultyMode,
  timerSeconds,
  leaderboardDifficulty,
  soloLeaderboard,
  roomCode,
  apiAvailable,
  apiConfigured,
  loading,
  error,
  onNicknameChange,
  onMapChange,
  onDifficultyChange,
  onTimerSecondsChange,
  onLeaderboardDifficultyChange,
  onRoomCodeChange,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  onSubmitFeedback,
}: HomeScreenProps) {
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const selectableMaps = maps.length > 0 ? maps : fallbackMaps;
  const selectedMap =
    selectableMaps.find((gameMap) => gameMap.id === selectedMapId) ??
    selectableMaps[0];
  const leaderboardRows = getLocalSoloLeaderboardByDifficulty(
    soloLeaderboard,
    leaderboardDifficulty,
    LEADERBOARD_PREVIEW_LIMIT,
  );

  async function submitFeedbackForm() {
    const message = feedbackMessage.trim();
    if (!message || feedbackStatus === "sending") {
      return;
    }

    setFeedbackStatus("sending");
    setFeedbackError("");

    try {
      await onSubmitFeedback(message);
      setFeedbackMessage("");
      setFeedbackStatus("sent");
    } catch (submitError) {
      setFeedbackStatus("error");
      setFeedbackError(
        submitError instanceof Error ? submitError.message : "제보를 보내지 못했습니다.",
      );
    }
  }

  return (
    <main className="home-shell">
      <header className="home-header">
        <div className="brand-block">
          <h1>어디길</h1>
        </div>
      </header>

      <section className="home-grid">
        <section className="start-panel home-hub-primary">
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
              <div className="map-facts">
                <span>{difficultyLabelById[difficultyMode]}</span>
                <span>5라운드</span>
                <span>{timerSeconds}초</span>
              </div>
            </div>
          </div>

          <button
            className="play-button home-start-button"
            disabled={loading}
            onClick={onStartSolo}
            type="button"
          >
            <Play size={20} aria-hidden="true" />
            <span>시작</span>
          </button>

          <div className="home-command-row">
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
                  aria-pressed={gameMap.id === selectedMapId}
                  key={gameMap.id}
                  onClick={() => onMapChange(gameMap.id)}
                  type="button"
                >
                  <strong>{gameMap.name}</strong>
                </button>
              ))}
            </div>
          </section>

          <div className="home-option-row">
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
                    aria-pressed={option.id === difficultyMode}
                    key={option.id}
                    onClick={() => onDifficultyChange(option.id)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="timer-select-block" aria-label="시간 선택">
              <div className="select-heading">
                <div className="select-heading-main">
                  <Clock3 size={18} aria-hidden="true" />
                  <h3>시간</h3>
                </div>
              </div>
              <div className="timer-choice-grid">
                {timerOptions.map((option) => (
                  <button
                    className={
                      option.seconds === timerSeconds
                        ? "timer-choice selected"
                        : "timer-choice"
                    }
                    aria-pressed={option.seconds === timerSeconds}
                    key={option.seconds}
                    onClick={() => onTimerSecondsChange(option.seconds)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {error ? <p className="home-error">{error}</p> : null}
        </section>

        <aside className="home-side home-action-rail">
          <section className="mini-panel room-panel-active">
            <div className="mini-heading">
              <KeyRound size={18} aria-hidden="true" />
              <h2>친구방</h2>
            </div>
              <button
                className="room-create-button active"
                disabled={loading || !apiConfigured}
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
                disabled={loading || !apiConfigured || roomCode.trim().length < 4}
                onClick={onJoinRoom}
                type="button"
              >
                입장
              </button>
            </div>
            {!apiConfigured ? (
              <p className="room-unavailable">싱글플레이만 사용 가능</p>
            ) : !apiAvailable ? (
              <p className="room-unavailable">서버 연결은 방 만들기 때 다시 확인합니다</p>
            ) : null}
          </section>

          <section className="mini-panel feedback-panel">
            <div className="mini-heading">
              <MessageSquareText size={18} aria-hidden="true" />
              <h2>마음의 소리함</h2>
            </div>
            <textarea
              aria-label="마음의 소리"
              maxLength={1200}
              placeholder="버그, 이상한 위치, 방 입장 문제"
              value={feedbackMessage}
              onChange={(event) => {
                setFeedbackMessage(event.target.value);
                setFeedbackStatus("idle");
                setFeedbackError("");
              }}
            />
            <button
              className="feedback-submit-button"
              disabled={
                !apiConfigured ||
                feedbackStatus === "sending" ||
                feedbackMessage.trim().length === 0
              }
              onClick={() => void submitFeedbackForm()}
              type="button"
            >
              {feedbackStatus === "sending" ? "보내는 중" : "제보 보내기"}
            </button>
            {feedbackStatus === "sent" ? (
              <p className="feedback-status">제보 고맙습니다</p>
            ) : null}
            {feedbackStatus === "error" ? (
              <p className="feedback-status error">{feedbackError}</p>
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
              <h2>통합 랭킹</h2>
              <span className="mini-heading-note">
                TOP {LEADERBOARD_PREVIEW_LIMIT}
              </span>
            </div>
            <div className="leaderboard-tabs" aria-label="랭킹 난이도">
              {difficultyOptions.map((option) => (
                <button
                  className={
                    option.id === leaderboardDifficulty
                      ? "leaderboard-tab selected"
                      : "leaderboard-tab"
                  }
                  aria-pressed={option.id === leaderboardDifficulty}
                  key={option.id}
                  onClick={() => onLeaderboardDifficultyChange(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="leaderboard-list">
              {leaderboardRows.length > 0 ? (
                leaderboardRows.map((entry, index) => {
                  const rank = index + 1;
                  const gameMode = entry.gameMode ?? "solo";

                  return (
                    <div className={getLeaderboardRowClassName(rank)} key={entry.id}>
                      <span className="leaderboard-rank-badge" aria-label={`${rank}등`}>
                        {renderLeaderboardRankIcon(rank)}
                      </span>
                      <div className="leaderboard-entry-main">
                        <strong>{entry.nickname}</strong>
                        <small>{entry.mapName}</small>
                      </div>
                      <span className="leaderboard-mode-chip" data-mode={gameMode}>
                        {getLeaderboardModeLabel(gameMode)}
                      </span>
                      <em>{entry.totalScore.toLocaleString("ko-KR")}점</em>
                    </div>
                  );
                })
              ) : (
                <p className="leaderboard-empty">아직 기록 없음</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function getLeaderboardRowClassName(rank: number) {
  return [
    "leaderboard-row",
    rank === 1 ? "leaderboard-row--champion" : "",
    rank === 2 ? "leaderboard-row--runner-up" : "",
    rank === 3 ? "leaderboard-row--third" : "",
  ].filter(Boolean).join(" ");
}

function renderLeaderboardRankIcon(rank: number) {
  if (rank === 1) {
    return <Crown size={16} aria-hidden="true" data-testid="leaderboard-rank-icon" />;
  }

  if (rank <= 3) {
    return <Medal size={16} aria-hidden="true" data-testid="leaderboard-rank-icon" />;
  }

  return rank;
}

function getLeaderboardModeLabel(
  gameMode: NonNullable<LocalSoloLeaderboardEntry["gameMode"]>,
) {
  return gameMode === "room" ? "친구방" : "싱글";
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

const LEADERBOARD_PREVIEW_LIMIT = 10;

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

const difficultyLabelById: Record<GameDifficultyMode, string> = {
  easy: "하",
  normal: "중",
  hard: "상",
  mixed: "혼합",
};

const timerOptions = [
  { seconds: 30, label: "30초" },
  { seconds: 45, label: "45초" },
  { seconds: 60, label: "60초" },
  { seconds: 90, label: "90초" },
];
