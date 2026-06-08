import {
  Clock3,
  Crown,
  Flag,
  Home,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { formatDistance, ROOM_PLAYER_COLORS } from "@kr-geo-guess/shared";
import confetti from "canvas-confetti";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type { ApiRoomRevealGuess, ApiRoomRoundHistory } from "../api/gameApi";
import { formatMapDifficulty } from "./gameDisplay";
import { MetricPill } from "./MetricPill";
import type { FriendRoomSession } from "./useFriendRoomGame";

export function RevealCountdownOverlay({ label }: { label: string }) {
  return (
    <div className="reveal-countdown-overlay" aria-label="정답 공개 카운트다운">
      <p>정답 공개</p>
      <strong key={label}>{label}</strong>
    </div>
  );
}

export function RoomFinalResultsPanel({
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
        <WinnerConfetti active={Boolean(winner)} />
        <p>친구방 완료</p>
        <h2>최종 결과</h2>
        <div className="winner-spotlight" aria-label="우승자">
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
              style={{ "--player-color": player.color } as CSSProperties}
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
                    style={{ "--player-color": guess.color } as CSSProperties}
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

const ROOM_PLAYER_COLOR_LABELS: Record<string, string> = {
  "#2563eb": "파랑",
  "#dc2626": "빨강",
  "#16a34a": "초록",
  "#f59e0b": "노랑",
  "#7c3aed": "보라",
  "#0891b2": "청록",
  "#db2777": "분홍",
  "#ea580c": "주황",
  "#0f766e": "딥그린",
  "#4f46e5": "남색",
  "#65a30d": "연두",
  "#be123c": "진홍",
  "#0284c7": "하늘",
  "#9333ea": "자주",
  "#ca8a04": "금색",
  "#475569": "회색",
};

const WINNER_CONFETTI_CANVAS_ATTRIBUTE = "data-winner-confetti-canvas";
const WINNER_CONFETTI_COLORS = [
  "#2563eb",
  "#111827",
  "#f6c84c",
  "#22c55e",
  "#ffffff",
];
const WINNER_CONFETTI_DURATION_MS = 2_800;
const WINNER_CONFETTI_REMOVE_DELAY_MS = 2_000;

function WinnerConfetti({ active }: { active: boolean }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      firedRef.current = false;
      return undefined;
    }

    if (firedRef.current) {
      return undefined;
    }

    firedRef.current = true;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    document
      .querySelectorAll(`canvas[${WINNER_CONFETTI_CANVAS_ATTRIBUTE}="true"]`)
      .forEach((canvas) => canvas.remove());

    const canvas = document.createElement("canvas");
    canvas.className = "winner-confetti-canvas";
    canvas.setAttribute(WINNER_CONFETTI_CANVAS_ATTRIBUTE, "true");
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const celebrate = confetti.create(canvas, {
      disableForReducedMotion: true,
      resize: true,
      useWorker: true,
    });
    const startedAt = Date.now();
    let stopped = false;

    const fire = (options: NonNullable<Parameters<typeof celebrate>[0]>) => {
      if (stopped) {
        return;
      }

      void celebrate({
        colors: WINNER_CONFETTI_COLORS,
        ...options,
      });
    };

    const fireSideCannons = () => {
      fire({
        angle: 58,
        decay: 0.91,
        drift: 0.1,
        gravity: 0.82,
        origin: { x: 0, y: 0.68 },
        particleCount: 24,
        scalar: 0.82,
        spread: 54,
        startVelocity: 42,
        ticks: 230,
      });
      fire({
        angle: 122,
        decay: 0.91,
        drift: -0.1,
        gravity: 0.82,
        origin: { x: 1, y: 0.68 },
        particleCount: 24,
        scalar: 0.82,
        spread: 54,
        startVelocity: 42,
        ticks: 230,
      });
    };

    fire({
      decay: 0.9,
      gravity: 0.82,
      origin: { x: 0.5, y: 0.56 },
      particleCount: 150,
      scalar: 0.96,
      spread: 104,
      startVelocity: 48,
      ticks: 260,
    });
    fireSideCannons();

    const sideCannonInterval = window.setInterval(() => {
      fireSideCannons();
    }, 360);

    const softRainInterval = window.setInterval(() => {
      const progress = (Date.now() - startedAt) / WINNER_CONFETTI_DURATION_MS;
      if (progress >= 1) {
        return;
      }

      fire({
        decay: 0.92,
        gravity: 0.46,
        origin: { x: 0.2 + Math.random() * 0.6, y: 0 },
        particleCount: 12,
        scalar: 0.72,
        spread: 72,
        startVelocity: 18,
        ticks: 210,
      });
    }, 180);

    const stopBursts = window.setTimeout(() => {
      window.clearInterval(sideCannonInterval);
      window.clearInterval(softRainInterval);
    }, WINNER_CONFETTI_DURATION_MS);

    const removeCanvas = () => {
      if (stopped) {
        return;
      }

      stopped = true;
      window.clearInterval(sideCannonInterval);
      window.clearInterval(softRainInterval);
      window.clearTimeout(stopBursts);
      celebrate.reset();
      canvas.remove();
    };

    const cleanupCanvas = window.setTimeout(
      removeCanvas,
      WINNER_CONFETTI_DURATION_MS + WINNER_CONFETTI_REMOVE_DELAY_MS,
    );

    return () => {
      window.clearTimeout(cleanupCanvas);
      removeCanvas();
      firedRef.current = false;
    };
  }, [active]);

  return (
    <div
      className="winner-confetti-anchor"
      data-testid="winner-confetti"
      aria-hidden="true"
    />
  );
}

export function RoomRoundRanking({
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
            style={{ "--player-color": guess.color } as CSSProperties}
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

function formatRoomDistance(distanceMeters: number | null) {
  return distanceMeters === null ? "미제출" : formatDistance(distanceMeters);
}

export function RoomColorPicker({
  players,
  currentPlayerId,
  selectedColor,
  disabled,
  onSelect,
}: {
  players: FriendRoomSession["room"]["players"];
  currentPlayerId: string;
  selectedColor: string;
  disabled: boolean;
  onSelect: (color: string) => void;
}) {
  const takenByOtherPlayers = new Set(
    players
      .filter((player) => player.playerId !== currentPlayerId)
      .map((player) => player.color),
  );

  return (
    <section className="room-color-picker" aria-label="내 핀 색상">
      <div className="room-color-picker-heading">
        <span>내 핀 색상</span>
        <em>대기실에서만 변경</em>
      </div>
      <div className="room-color-grid">
        {ROOM_PLAYER_COLORS.map((color) => {
          const ownerIndex = players.findIndex((player) => player.color === color);
          const colorOwner = ownerIndex >= 0 ? players[ownerIndex] : null;
          const isSelected = selectedColor === color;
          const isTaken = takenByOtherPlayers.has(color);
          const colorLabel = getRoomPlayerColorLabel(color);

          return (
            <button
              aria-label={
                isTaken
                  ? `${colorLabel} ${colorOwner?.nickname ?? ""} 사용 중`
                  : isSelected
                    ? `${colorLabel} 선택됨`
                    : `${colorLabel} 선택`
              }
              className={[
                "room-color-choice",
                colorOwner ? "owned" : "",
                isSelected ? "selected" : "",
                isTaken ? "taken" : "",
              ].filter(Boolean).join(" ")}
              disabled={disabled || isSelected || isTaken}
              key={color}
              onClick={() => onSelect(color)}
              style={{ "--player-color": color } as CSSProperties}
              title={colorOwner ? `${colorOwner.nickname} 사용 중` : colorLabel}
              type="button"
            >
              {colorOwner ? <span aria-hidden="true">{ownerIndex + 1}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getRoomPlayerColorLabel(color: string) {
  return ROOM_PLAYER_COLOR_LABELS[color.toLowerCase()] ?? "색상";
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

export function RoomTopbar({
  roomCode,
  mapName,
  difficultyMode,
  timerLabel,
  roundLabel,
  score,
  timerProgress,
  timerUrgent,
  onExit,
}: {
  roomCode: string;
  mapName: string;
  difficultyMode: FriendRoomSession["room"]["difficultyMode"];
  timerLabel: string;
  roundLabel: string;
  score?: number;
  timerProgress?: string;
  timerUrgent?: boolean;
  onExit: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <h1>어디길</h1>
      </div>
      <div className="round-metrics" aria-label="방 정보">
        <MetricPill icon={<Users size={16} />} label={roomCode} />
        <MetricPill
          icon={<MapIcon size={16} />}
          label={formatMapDifficulty(mapName, difficultyMode)}
        />
        <MetricPill icon={<Flag size={16} />} label={roundLabel} />
        <MetricPill
          icon={<Clock3 size={16} />}
          label={timerLabel}
          tone="timer"
          progress={timerProgress}
          urgent={timerUrgent}
        />
        {typeof score === "number" ? (
          <MetricPill icon={<Trophy size={16} />} label={score.toLocaleString("ko-KR")} />
        ) : null}
        <button className="icon-action" onClick={onExit} type="button" aria-label="홈으로">
          <Home size={16} />
        </button>
      </div>
    </header>
  );
}

export function PlayerList({
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
            style={{ "--player-color": player.color } as CSSProperties}
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

export function LobbySeats({
  players,
  currentPlayerId,
}: {
  players: FriendRoomSession["room"]["players"];
  currentPlayerId: string;
}) {
  return (
    <aside className="lobby-seats" aria-label="참가자 준비 상태">
      <div className="mini-heading">
        <Users size={18} aria-hidden="true" />
        <h2>대기실</h2>
        <span className="mini-heading-note">{players.length}명</span>
      </div>
      <div className="lobby-seat-grid">
        {players.map((player) => (
          <div
            className={[
              "lobby-seat",
              player.playerId === currentPlayerId ? "self" : "",
              player.connected ? "" : "disconnected",
            ].filter(Boolean).join(" ")}
            key={player.playerId}
            style={{ "--player-color": player.color } as CSSProperties}
          >
            <span>{player.nickname.slice(0, 1)}</span>
            <div>
              <strong>
                {player.nickname}
                {player.playerId === currentPlayerId ? " · 나" : ""}
              </strong>
              <em>
                {[
                  player.isHost ? "방장" : null,
                  player.connected ? "준비" : "대기",
                  player.playerId === currentPlayerId ? "나" : null,
                ].filter(Boolean).join(" · ")}
              </em>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
