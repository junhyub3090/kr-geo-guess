import {
  Clock3,
  Copy,
  Flag,
  Home,
  Map,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { getGameMap } from "@kr-geo-guess/shared";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { FriendRoomSession } from "./useFriendRoomGame";
import { useFriendRoomGame } from "./useFriendRoomGame";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import { KakaoRoadviewPanel } from "../provider/KakaoRoadviewPanel";

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
  const isReveal = room.phase === "round_reveal";
  const isFinished = room.phase === "finished";
  const roundNumber = room.currentRound?.roundNumber ?? room.roundIndex + 1;
  const timerLabel = room.phase === "round_active"
    ? formatClock(game.remainingSeconds)
    : isLobby
      ? "대기"
      : "공개";
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
          timerLabel={timerLabel}
          roundLabel={`${room.roundCount}R`}
          onExit={onExit}
        />
        <section className="room-lobby">
          <div className="room-lobby-main">
            <p className="room-kicker">친구방</p>
            <h2>{room.roomCode}</h2>
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
                시작
              </button>
            ) : (
              <p className="room-waiting">방장이 시작하면 바로 들어갑니다.</p>
            )}
            {game.error ? <p className="inline-error">{game.error}</p> : null}
          </div>
          <PlayerList players={room.players} />
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <RoomTopbar
        roomCode={room.roomCode}
        mapName={room.mapName}
        timerLabel={timerLabel}
        roundLabel={`Round ${Math.min(roundNumber, room.roundCount)} / ${room.roundCount}`}
        score={game.self?.score ?? 0}
        onExit={onExit}
      />

      <section className="game-layout">
        <KakaoRoadviewPanel
          target={game.currentTargetForViewer}
          phase={isReveal || isFinished ? "reveal" : "active"}
        />

        <aside className="side-panel" aria-label="친구방 추측과 결과">
          <section className="panel-section map-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>{isReveal ? "정답 공개" : "핀 찍기"}</h2>
                <p>{mapDefinition.name} · {room.players.length}명</p>
              </div>
              <div className="guess-status">
                {room.players.filter((player) => player.hasGuessed).length} / {room.players.length}
              </div>
            </div>
            <KoreaGuessMap
              guess={game.guess}
              regions={mapDefinition.regions}
              showLabels={false}
              target={isReveal || isFinished ? room.revealed?.target : undefined}
              peerGuesses={game.peerGuesses}
              distanceLabel={isReveal || isFinished ? game.formattedDistance ?? undefined : undefined}
              disabled={isReveal || isFinished || Boolean(game.self?.hasGuessed)}
              onGuess={game.setGuess}
            />
            {game.error ? <p className="inline-error">{game.error}</p> : null}
            {isFinished ? (
              <button className="submit-button" onClick={onExit} type="button">
                홈으로
              </button>
            ) : isReveal ? (
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
            ) : game.self?.hasGuessed ? (
              game.isHost ? (
                <button
                  className="submit-button"
                  disabled={game.submitting}
                  onClick={game.revealCurrentRound}
                  type="button"
                >
                  정답 공개
                </button>
              ) : (
                <button className="submit-button" disabled type="button">
                  친구 대기 중
                </button>
              )
            ) : (
                <button
                  className="submit-button"
                  disabled={!game.draftGuess || game.submitting}
                  onClick={() => game.submitCurrentGuess()}
                  type="button"
                >
                <Send size={18} aria-hidden="true" />
                제출
              </button>
            )}
          </section>

          <section className="panel-section result-panel room-score-panel">
            <PlayerList players={room.players} />
          </section>
        </aside>
      </section>
    </main>
  );
}

function RoomTopbar({
  roomCode,
  mapName,
  timerLabel,
  roundLabel,
  score,
  onExit,
}: {
  roomCode: string;
  mapName: string;
  timerLabel: string;
  roundLabel: string;
  score?: number;
  onExit: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark">KR</div>
        <div>
          <h1>{roomCode}</h1>
          <p>{mapName}</p>
        </div>
      </div>
      <div className="round-metrics" aria-label="방 정보">
        <Metric icon={<Map size={16} />} label={mapName} />
        <Metric icon={<Flag size={16} />} label={roundLabel} />
        <Metric icon={<Clock3 size={16} />} label={timerLabel} tone="timer" />
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

function PlayerList({ players }: { players: FriendRoomSession["room"]["players"] }) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="room-player-list">
      <div className="mini-heading">
        <Users size={18} aria-hidden="true" />
        <h2>플레이어</h2>
      </div>
      <div className="leaderboard-list">
        {sortedPlayers.map((player, index) => (
          <div className="leaderboard-row room-player-row" key={player.playerId}>
            <span>{index + 1}</span>
            <strong>
              {player.nickname}
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
}: {
  icon: ReactNode;
  label: string;
  tone?: "timer";
}) {
  return (
    <span className={tone === "timer" ? "metric timer" : "metric"}>
      {icon}
      {label}
    </span>
  );
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
