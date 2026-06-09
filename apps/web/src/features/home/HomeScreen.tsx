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
import { startTransition, useMemo, useState } from "react";
import {
  type LocalSoloLeaderboardEntry,
} from "../leaderboard/localSoloLeaderboard";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import type {
  DailyChallenge,
  GameDifficultyMode,
  GameMapSummary,
  LeaderboardGameMode,
} from "../api/gameApi";

export type LeaderboardModeFilter = "all" | LeaderboardGameMode;

type HomeScreenProps = {
  nickname: string;
  daily: DailyChallenge | null;
  maps: GameMapSummary[];
  selectedMapId: string;
  difficultyMode: GameDifficultyMode;
  timerSeconds: number;
  leaderboardDifficulty: GameDifficultyMode;
  leaderboardMode: LeaderboardModeFilter;
  soloLeaderboard: LocalSoloLeaderboardEntry[];
  personalLeaderboard: LocalSoloLeaderboardEntry[];
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
  onLeaderboardModeChange: (mode: LeaderboardModeFilter) => void;
  onRoomCodeChange: (roomCode: string) => void;
  onStartSolo: () => void;
  onStartDailyChallenge: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onSubmitFeedback: (message: string) => Promise<void>;
};

const EMPTY_MAP_REGIONS: readonly string[] = [];
const noopGuess = () => undefined;

export function HomeScreen({
  nickname,
  daily,
  maps,
  selectedMapId,
  difficultyMode,
  timerSeconds,
  leaderboardDifficulty,
  leaderboardMode,
  soloLeaderboard,
  personalLeaderboard,
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
  onLeaderboardModeChange,
  onRoomCodeChange,
  onStartSolo,
  onStartDailyChallenge,
  onCreateRoom,
  onJoinRoom,
  onSubmitFeedback,
}: HomeScreenProps) {
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [activeMapInfoId, setActiveMapInfoId] = useState<string | null>(null);
  const [previewMapId, setPreviewMapId] = useState<string | null>(null);
  const selectableMaps = maps.length > 0 ? maps : fallbackMaps;
  const selectedMap =
    selectableMaps.find((gameMap) => gameMap.id === selectedMapId) ??
    selectableMaps[0];
  const activeMapInfo = activeMapInfoId
    ? selectableMaps.find((gameMap) => gameMap.id === activeMapInfoId)
    : null;
  const visualPreviewMap = previewMapId
    ? selectableMaps.find((gameMap) => gameMap.id === previewMapId)
    : null;
  const previewInfoMap = activeMapInfo ?? selectedMap;
  const previewMap = visualPreviewMap ?? selectedMap;
  const isHoverPreview = Boolean(activeMapInfo);
  const enforcePlayableMaps = apiConfigured && apiAvailable;
  const previewRegions = previewMap?.regions ?? EMPTY_MAP_REGIONS;
  const mapPreview = useMemo(
    () => (
      <KoreaGuessMap
        guess={null}
        regions={previewRegions}
        disabled
        showLabels={false}
        compact
        onGuess={noopGuess}
      />
    ),
    [previewRegions],
  );
  const leaderboardRows = getLeaderboardRows(
    soloLeaderboard,
    leaderboardDifficulty,
    leaderboardMode,
    LEADERBOARD_PREVIEW_LIMIT,
  );
  const personalBest = getPersonalBest(
    personalLeaderboard,
    selectedMap?.name ?? "전국",
    leaderboardDifficulty,
  );

  function showMapPreview(mapId: string) {
    setActiveMapInfoId(mapId);
    startTransition(() => {
      setPreviewMapId(mapId);
    });
  }

  function clearMapPreview() {
    setActiveMapInfoId(null);
    startTransition(() => {
      setPreviewMapId(null);
    });
  }

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
        <nav className="home-nav" aria-label="서비스 내비게이션">
          <a className="home-nav-link active" href="#play">
            <Play size={16} aria-hidden="true" />
            플레이
          </a>
          <a className="home-nav-link" href="#maps">
            <Map size={16} aria-hidden="true" />
            맵
          </a>
          <a className="home-nav-link" href="#rooms">
            <KeyRound size={16} aria-hidden="true" />
            친구방
          </a>
          <a className="home-nav-link" href="#ranking">
            <Trophy size={16} aria-hidden="true" />
            랭킹
          </a>
          <a className="home-nav-link" href="#feedback">
            <MessageSquareText size={16} aria-hidden="true" />
            제보
          </a>
        </nav>
      </header>

      <section className="home-grid">
        <section className="start-panel home-hub-primary" id="play" aria-label="게임 시작">
          <div className="home-hero-layout">
            <div className="start-copy">
              <div className="home-play-summary" aria-label="현재 게임 설정">
                <span className="summary-kicker">현재 설정</span>
                <div className="map-facts">
                  <span>
                    <small>맵</small>
                    <strong>{selectedMap?.name ?? "전국"}</strong>
                  </span>
                  <span>
                    <small>난이도</small>
                    <strong>{difficultyLabelById[difficultyMode]}</strong>
                  </span>
                  <span>
                    <small>라운드</small>
                    <strong>5</strong>
                  </span>
                  <span>
                    <small>제한 시간</small>
                    <strong>{timerSeconds}초</strong>
                  </span>
                </div>
              </div>

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

              <div className="home-option-row home-settings-strip" aria-label="게임 설정">
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
                      <h3>시간 제한</h3>
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

              <div className="home-cta-row">
                <button
                  className="play-button home-start-button"
                  disabled={loading}
                  onClick={onStartSolo}
                  type="button"
                >
                  <Play size={20} aria-hidden="true" />
                  <span>시작</span>
                </button>
                <button
                  className="home-secondary-cta"
                  disabled={loading || !apiConfigured}
                  onClick={onCreateRoom}
                  type="button"
                >
                  <KeyRound size={18} aria-hidden="true" />
                  친구방 새로 만들기
                </button>
              </div>
            </div>

            <div className="map-profile">
              <div className="map-art" aria-hidden="true">
                {mapPreview}
              </div>
              <div className="map-showcase-caption">
                <strong>{previewInfoMap?.name ?? "전국"}</strong>
                <span>
                  {isHoverPreview
                    ? getMapHoverSummary(previewInfoMap, enforcePlayableMaps)
                    : previewInfoMap?.description || "한국 곳곳의 거리뷰 위치 풀"}
                </span>
                <em>
                  {previewInfoMap?.id === selectedMap?.id ? "현재 선택" : "미리보기"}
                </em>
              </div>
            </div>
          </div>

          <section className="map-select-block home-map-gallery" id="maps" aria-label="맵 선택">
            <div className="select-heading">
              <div className="select-heading-main">
                <Map size={18} aria-hidden="true" />
                <h3>맵</h3>
              </div>
            </div>
            <div className="map-choice-grid">
              {selectableMaps.map((gameMap) => {
                const mapSelectable = canSelectMap(gameMap, enforcePlayableMaps);

                return (
                  <button
                    className={[
                      "map-choice",
                      gameMap.id === selectedMapId ? "selected" : "",
                      !mapSelectable ? "disabled" : "",
                    ].filter(Boolean).join(" ")}
                    aria-pressed={gameMap.id === selectedMapId}
                    aria-label={`${gameMap.name}: ${getMapHoverSummary(gameMap, enforcePlayableMaps)}`}
                    disabled={!mapSelectable}
                    key={gameMap.id}
                    onBlur={clearMapPreview}
                    onClick={() => onMapChange(gameMap.id)}
                    onFocus={() => showMapPreview(gameMap.id)}
                    onPointerEnter={() => showMapPreview(gameMap.id)}
                    onPointerLeave={clearMapPreview}
                    type="button"
                  >
                    <strong>{gameMap.name}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          {error ? <p className="home-error">{error}</p> : null}
        </section>

        <aside className="home-side home-action-rail">
          <section className="mini-panel room-panel-active" id="rooms" aria-label="친구방">
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

          <section className="mini-panel daily-panel" aria-label="데일리 챌린지">
            <div className="mini-heading">
              <CalendarDays size={18} aria-hidden="true" />
              <h2>데일리 챌린지</h2>
            </div>
            <p>
              {daily
                ? `${daily.date} 오늘의 한국 위치`
                : "오늘의 챌린지를 불러오는 중입니다."}
            </p>
            <button
              className="daily-start-button"
              disabled={loading}
              onClick={onStartDailyChallenge}
              type="button"
            >
              오늘의 챌린지 시작
            </button>
          </section>

          <section className="mini-panel leaderboard-preview" id="ranking" aria-label="통합 랭킹">
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
            <div className="leaderboard-tabs mode-tabs" aria-label="랭킹 모드">
              {leaderboardModeOptions.map((option) => (
                <button
                  className={
                    option.id === leaderboardMode
                      ? "leaderboard-mode-tab selected"
                      : "leaderboard-mode-tab"
                  }
                  aria-pressed={option.id === leaderboardMode}
                  key={option.id}
                  onClick={() => onLeaderboardModeChange(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="personal-best-strip" aria-label="내 최고 기록">
              <span>내 최고 기록</span>
              <strong>
                {personalBest
                  ? `${personalBest.totalScore.toLocaleString("ko-KR")}점`
                  : "기록 없음"}
              </strong>
              <em>{selectedMap?.name ?? "전국"} · {difficultyLabelById[leaderboardDifficulty]}</em>
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

          <section className="mini-panel feedback-panel" id="feedback" aria-label="마음의 소리함">
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

function getLeaderboardRows(
  entries: readonly LocalSoloLeaderboardEntry[],
  difficultyMode: GameDifficultyMode,
  mode: LeaderboardModeFilter,
  limit: number,
) {
  return entries
    .filter((entry) => entry.difficultyMode === difficultyMode)
    .filter((entry) => mode === "all" || (entry.gameMode ?? "solo") === mode)
    .sort(compareLeaderboardEntries)
    .slice(0, limit);
}

function getPersonalBest(
  entries: readonly LocalSoloLeaderboardEntry[],
  mapName: string,
  difficultyMode: GameDifficultyMode,
) {
  return entries
    .filter((entry) => entry.mapName === mapName)
    .filter((entry) => entry.difficultyMode === difficultyMode)
    .sort(compareLeaderboardEntries)[0] ?? null;
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

function canSelectMap(gameMap: GameMapSummary, enforcePlayableMaps: boolean) {
  return !enforcePlayableMaps || gameMap.playable !== false;
}

function getMapHoverSummary(
  gameMap: GameMapSummary | undefined,
  enforcePlayableMaps: boolean,
) {
  if (!gameMap) {
    return "지도 준비 중";
  }

  if (enforcePlayableMaps && gameMap.playable === false) {
    return `${gameMap.description || gameMap.name} · 준비 중`;
  }

  return gameMap.description || gameMap.name;
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

const LEADERBOARD_PREVIEW_LIMIT = 5;

const leaderboardModeOptions: Array<{
  id: LeaderboardModeFilter;
  label: string;
}> = [
  { id: "all", label: "전체" },
  { id: "solo", label: "싱글" },
  { id: "room", label: "친구방" },
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
