import {
  Clock3,
  Copy,
  Crown,
  Flag,
  Home,
  Map,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { formatDistance, getGameMap } from "@kr-geo-guess/shared";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { FriendRoomSession } from "./useFriendRoomGame";
import { useFriendRoomGame } from "./useFriendRoomGame";
import type { ApiRoomRevealGuess, ApiRoomRoundHistory } from "../api/gameApi";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import { KakaoRoadviewPanel } from "../provider/KakaoRoadviewPanel";
import {
  formatClock,
  formatMapDifficulty,
  getTimerProgressPercent,
  isUrgentTimer,
} from "./gameDisplay";

export function RoomGameScreen({
  initialSession,
  onExit,
}: {
  initialSession: FriendRoomSession;
  onExit: () => void;
}) {
  const game = useFriendRoomGame(initialSession);
  const [copied, setCopied] = useState(false);
  const room = game.room;
  const mapDefinition = getGameMap(room.mapId);
  const isLobby = room.phase === "lobby";
  const isRevealCountdown = room.phase === "round_reveal_countdown";
  const isReveal = room.phase === "round_reveal";
  const isFinished = room.phase === "finished";
  const roundNumber = room.currentRound?.roundNumber ?? room.roundIndex + 1;
  const timerRunning = room.phase === "round_active";
  const activePlayerCount =
    room.players.filter((player) => player.connected).length || room.players.length;
  const submittedPlayerCount = room.players.filter(
    (player) => player.connected && player.hasGuessed,
  ).length;
  const submittedLabel = `${submittedPlayerCount}/${activePlayerCount}`;
  const allActivePlayersSubmitted =
    activePlayerCount > 0 &&
    room.players
      .filter((player) => player.connected)
      .every((player) => player.hasGuessed);
  const revealCountdownLabel = game.revealCountdownSeconds > 0
    ? String(game.revealCountdownSeconds)
    : "공개";
  const timerUrgent = timerRunning &&
    isUrgentTimer(game.remainingSeconds, room.timerSeconds);
  const timerLabel = isRevealCountdown
    ? `공개 ${revealCountdownLabel}`
    : room.phase === "round_active"
    ? timerUrgent
      ? `곧 끝나요 · ${formatClock(game.remainingSeconds)}`
      : formatClock(game.remainingSeconds)
    : isLobby
      ? "대기"
      : "공개";
  const submitTimerProgress = timerRunning
    ? getTimerProgressPercent(room.timerSeconds, game.remainingSeconds)
    : "0%";
  const submitButtonClassName = [
    "submit-button",
    "timed-submit-button",
    timerUrgent ? "urgent" : "",
  ].filter(Boolean).join(" ");
  const submitButtonStyle = {
    "--timer-progress": submitTimerProgress,
  } as CSSProperties;
  const inviteLink = useMemo(
    () => `${window.location.origin}${window.location.pathname}?room=${room.roomCode}`,
    [room.roomCode],
  );

  async function copyInvite() {
    await navigator.clipboard?.writeText(inviteLink).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (isLobby) {
    return (
      <main className="app-shell room-lobby-shell">
        <RoomTopbar
          roomCode={room.roomCode}
          mapName={room.mapName}
          difficultyMode={room.difficultyMode}
          timerLabel={timerLabel}
          roundLabel={`${room.roundCount}R`}
          onExit={onExit}
        />
        <section className="room-lobby">
          <div className="room-lobby-main">
            <div className="lobby-stage">
              <p className="room-kicker">친구방</p>
              <h2>{room.roomCode}</h2>
              <div className="lobby-status-pulse">
                <span aria-hidden="true" />
                대기 중
              </div>
            </div>
            <div className="room-setting-strip" aria-label="방 설정">
              <span>{formatMapDifficulty(room.mapName, room.difficultyMode)}</span>
              <span>{room.roundCount}라운드</span>
              <span>{room.timerSeconds}초</span>
              <span>{room.players.length}명</span>
            </div>
            <div className="invite-row">
              <input readOnly value={inviteLink} aria-label="초대 링크" />
              <button onClick={copyInvite} type="button">
                <Copy size={16} aria-hidden="true" />
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            {game.isHost ? (
              <button
                className="play-button room-start-button"
                disabled={game.submitting}
                onClick={game.startGame}
                type="button"
              >
                게임 시작
              </button>
            ) : (
              <p className="room-waiting">방장이 시작하면 바로 들어갑니다.</p>
            )}
            {game.error ? <p className="inline-error">{game.error}</p> : null}
          </div>
          <PlayerList players={room.players} currentPlayerId={game.playerId} />
        </section>
      </main>
    );
  }

  if (isFinished) {
    return (
      <main className="app-shell final-shell">
        <RoomTopbar
          roomCode={room.roomCode}
          mapName={room.mapName}
          difficultyMode={room.difficultyMode}
          timerLabel="종료"
          roundLabel={`${room.roundCount}라운드 완료`}
          score={game.self?.score ?? 0}
          onExit={onExit}
        />
        <RoomFinalResultsPanel
          players={room.players}
          roundHistory={room.roundHistory ?? []}
          currentPlayerId={game.playerId}
          onExit={onExit}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <RoomTopbar
        roomCode={room.roomCode}
        mapName={room.mapName}
        difficultyMode={room.difficultyMode}
        timerLabel={timerLabel}
        roundLabel={`Round ${Math.min(roundNumber, room.roundCount)} / ${room.roundCount}`}
        score={game.self?.score ?? 0}
        timerUrgent={timerUrgent}
        onExit={onExit}
      />

      <section className="game-layout">
        <KakaoRoadviewPanel
          target={game.currentTargetForViewer}
        />

        <aside className="side-panel" aria-label="친구방 추측과 결과">
          <section className="panel-section map-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>{isReveal || isRevealCountdown ? "정답 공개" : "핀 찍기"}</h2>
                <p>{mapDefinition.name} · {activePlayerCount}명</p>
              </div>
              <div className="guess-status" aria-label="제출 현황">
                {submittedLabel}
              </div>
            </div>
            <KoreaGuessMap
              guess={game.guess}
              regions={mapDefinition.regions}
              showLabels={false}
              target={isReveal || isFinished ? room.revealed?.target : undefined}
              peerGuesses={game.peerGuesses}
              distanceLabel={isReveal || isFinished ? game.formattedDistance ?? undefined : undefined}
              disabled={
                isReveal ||
                isRevealCountdown ||
                isFinished ||
                Boolean(game.self?.hasGuessed)
              }
              onGuess={game.setGuess}
            />
            {game.error ? <p className="inline-error">{game.error}</p> : null}
            {isReveal ? (
              game.isHost ? (
                <button
                  className="submit-button"
                  disabled={game.submitting}
                  onClick={game.nextRound}
                  type="button"
                >
                  {roundNumber >= room.roundCount ? "최종 결과" : "다음 라운드"}
                </button>
              ) : (
                <button className="submit-button" disabled type="button">
                  방장 대기 중
                </button>
              )
            ) : isRevealCountdown ? (
              <button className="submit-button countdown-submit-button" disabled type="button">
                <Clock3 size={18} aria-hidden="true" />
                <span>정답 공개</span>
                <span className="submit-timer-label">{revealCountdownLabel}</span>
              </button>
            ) : game.self?.hasGuessed ? (
              game.isHost && allActivePlayersSubmitted ? (
                <button
                  className="submit-button reveal-ready-button"
                  disabled={game.submitting}
                  onClick={game.revealCurrentRound}
                  type="button"
                >
                  <Sparkles size={18} aria-hidden="true" />
                  <span>정답 공개</span>
                  <span className="submit-timer-label">{submittedLabel}</span>
                </button>
              ) : (
                <button className="submit-button waiting-submit-button" disabled type="button">
                  <Clock3 size={18} aria-hidden="true" />
                  <span>{allActivePlayersSubmitted ? "공개 대기 중" : "제출 완료"}</span>
                  <span className="submit-timer-label">{submittedLabel}</span>
                </button>
              )
            ) : (
              <button
                className={submitButtonClassName}
                disabled={!game.draftGuess || game.submitting}
                onClick={() => game.submitCurrentGuess()}
                style={submitButtonStyle}
                type="button"
              >
                <Send size={18} aria-hidden="true" />
                <span>위치 찍기</span>
                <span className="submit-timer-label">
                  {formatClock(game.remainingSeconds)}
                </span>
              </button>
            )}
          </section>

          <section className="panel-section result-panel room-score-panel">
            {isReveal && room.revealed ? (
              <RoomRoundRanking
                guesses={room.revealed.guesses}
                currentPlayerId={game.playerId}
              />
            ) : (
              <PlayerList players={room.players} currentPlayerId={game.playerId} />
            )}
          </section>
        </aside>
      </section>
      {isRevealCountdown ? (
        <RevealCountdownOverlay label={revealCountdownLabel} />
      ) : null}
    </main>
  );
}

function RevealCountdownOverlay({ label }: { label: string }) {
  return (
    <div className="reveal-countdown-overlay" aria-label="정답 공개 카운트다운">
      <p>정답 공개</p>
      <strong>{label}</strong>
    </div>
  );
}

function RoomFinalResultsPanel({
  players,
  roundHistory,
  currentPlayerId,
  onExit,
}: {
  players: FriendRoomSession["room"]["players"];
  roundHistory: ApiRoomRoundHistory[];
  currentPlayerId: string;
  onExit: () => void;
}) {
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = rankedPlayers[0];

  return (
    <section className="final-results room-final-results" aria-label="친구방 최종 결과">
      <div className="final-summary">
        <ConfettiBurst />
        <p>게임 완료</p>
        <h2>친구방 최종 결과</h2>
        <div className="winner-spotlight">
          <div className="winner-crown" aria-hidden="true">
            <Crown size={28} />
          </div>
          <strong>{winner ? `${winner.nickname} 승리` : "결과 없음"}</strong>
          <span>{winner ? `${winner.score.toLocaleString("ko-KR")}점` : "0점"}</span>
        </div>
        <div className="final-stats">
          <StatBlock label="참가자" value={`${players.length}명`} />
          <StatBlock
            label="최고 점수"
            value={winner ? `${winner.score.toLocaleString("ko-KR")}점` : "0점"}
          />
        </div>
        <button className="secondary-button final-home-button" onClick={onExit} type="button">
          <RotateCcw size={16} aria-hidden="true" />
          홈으로
        </button>
      </div>

      <div className="final-competition-panel" aria-label="최종 순위">
        <div className="mini-heading">
          <Trophy size={18} aria-hidden="true" />
          <h2>최종 순위</h2>
        </div>
        <div className="final-standing-list">
          {rankedPlayers.map((player, index) => (
            <div
              className={[
                "final-standing-row",
                index === 0 ? "winner" : "",
                player.playerId === currentPlayerId ? "self" : "",
              ].filter(Boolean).join(" ")}
              key={player.playerId}
            >
              <span>{index + 1}</span>
              <strong>
                {player.nickname}
                {player.playerId === currentPlayerId ? " · 나" : ""}
              </strong>
              <em>{player.score.toLocaleString("ko-KR")}점</em>
            </div>
          ))}
        </div>
      </div>

      <div className="round-history-panel" aria-label="라운드별 점수">
        <div className="mini-heading">
          <Sparkles size={18} aria-hidden="true" />
          <h2>라운드별 점수</h2>
        </div>
        <div className="round-history-list">
          {roundHistory.map((round) => (
            <article className="round-history-row" key={round.roundNumber}>
              <span>R{round.roundNumber}</span>
              <div>
                {round.guesses.map((guess) => (
                  <div
                    className={[
                      "round-score-chip",
                      guess.playerId === currentPlayerId ? "self" : "",
                    ].filter(Boolean).join(" ")}
                    key={guess.playerId}
                  >
                    <b>{guess.rank}</b>
                    <strong>
                      {guess.nickname}
                      {guess.playerId === currentPlayerId ? " · 나" : ""}
                    </strong>
                    <em>{guess.score.toLocaleString("ko-KR")}점</em>
                    <small>{formatRoomDistance(guess.distanceMeters)}</small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoomRoundRanking({
  guesses,
  currentPlayerId,
}: {
  guesses: ApiRoomRevealGuess[];
  currentPlayerId: string;
}) {
  return (
    <div className="room-round-ranking" aria-label="라운드 순위">
      <div className="mini-heading">
        <Trophy size={18} aria-hidden="true" />
        <h2>라운드 순위</h2>
      </div>
      <div className="round-ranking-list">
        {guesses.map((guess) => (
          <div
            className={[
              "round-ranking-row",
              guess.playerId === currentPlayerId ? "self" : "",
            ].filter(Boolean).join(" ")}
            key={guess.playerId}
          >
            <span>{guess.rank}</span>
            <strong>
              {guess.nickname}
              {guess.playerId === currentPlayerId ? " · 나" : ""}
            </strong>
            <em>{formatRoomDistance(guess.distanceMeters)}</em>
            <b>{guess.score.toLocaleString("ko-KR")}점</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfettiBurst() {
  return (
    <div className="confetti-burst" aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <span
          className="confetti-piece"
          key={index}
          style={{
            "--confetti-index": index,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function formatRoomDistance(distanceMeters: number | null) {
  return distanceMeters === null ? "미제출" : formatDistance(distanceMeters);
}

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="final-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoomTopbar({
  roomCode,
  mapName,
  difficultyMode,
  timerLabel,
  roundLabel,
  score,
  timerUrgent,
  onExit,
}: {
  roomCode: string;
  mapName: string;
  difficultyMode: FriendRoomSession["room"]["difficultyMode"];
  timerLabel: string;
  roundLabel: string;
  score?: number;
  timerUrgent?: boolean;
  onExit: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <h1>어디길</h1>
      </div>
      <div className="round-metrics" aria-label="방 정보">
        <Metric icon={<Users size={16} />} label={roomCode} />
        <Metric
          icon={<Map size={16} />}
          label={formatMapDifficulty(mapName, difficultyMode)}
        />
        <Metric icon={<Flag size={16} />} label={roundLabel} />
        <Metric
          icon={<Clock3 size={16} />}
          label={timerLabel}
          tone="timer"
          urgent={timerUrgent}
        />
        {typeof score === "number" ? (
          <Metric icon={<Trophy size={16} />} label={score.toLocaleString("ko-KR")} />
        ) : null}
        <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
          <Home size={16} />
        </button>
      </div>
    </header>
  );
}

function PlayerList({
  players,
  currentPlayerId,
}: {
  players: FriendRoomSession["room"]["players"];
  currentPlayerId: string;
}) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="room-player-list">
      <div className="mini-heading">
        <Users size={18} aria-hidden="true" />
        <h2>플레이어</h2>
      </div>
      <div className="leaderboard-list">
        {sortedPlayers.map((player, index) => (
          <div
            className={[
              "leaderboard-row",
              "room-player-row",
              player.playerId === currentPlayerId ? "self" : "",
              player.connected ? "" : "disconnected",
            ].filter(Boolean).join(" ")}
            key={player.playerId}
          >
            <span>{index + 1}</span>
            <strong>
              {player.nickname}
              {player.playerId === currentPlayerId ? " · 나" : ""}
              {player.isHost ? " · 방장" : ""}
            </strong>
            <em>{player.score.toLocaleString("ko-KR")}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  tone,
  urgent,
}: {
  icon: ReactNode;
  label: string;
  tone?: "timer";
  urgent?: boolean;
}) {
  const className = [
    "metric",
    tone === "timer" ? "timer" : "",
    urgent ? "urgent" : "",
  ].filter(Boolean).join(" ");

  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  );
}
