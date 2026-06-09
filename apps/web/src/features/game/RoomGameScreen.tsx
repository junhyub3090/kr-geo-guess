import {
  Clock3,
  Copy,
  Send,
  Sparkles,
} from "lucide-react";
import { getGameMap } from "@kr-geo-guess/shared";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FriendRoomSession } from "./useFriendRoomGame";
import { useFriendRoomGame } from "./useFriendRoomGame";
import { KoreaGuessMap } from "../map/KoreaGuessMap";
import { KakaoRoadviewPanel } from "../provider/KakaoRoadviewPanel";
import type { KakaoRoadviewStatus } from "../provider/kakaoTypes";
import {
  formatClock,
  formatMapDifficulty,
  formatTargetAddress,
  getTimerProgressPercent,
  isUrgentTimer,
} from "./gameDisplay";
import {
  LobbySeats,
  PlayerList,
  RevealCountdownOverlay,
  RoomColorPicker,
  RoomFinalResultsPanel,
  RoomRoundRanking,
  RoomTopbar,
} from "./RoomGamePanels";
import { RoundProgressTrack } from "./RoundProgressTrack";

export function RoomGameScreen({
  initialSession,
  onRoomComplete,
  onCreateRematchRoom,
  onExit,
}: {
  initialSession: FriendRoomSession;
  onRoomComplete?: () => void;
  onCreateRematchRoom?: (room: FriendRoomSession["room"]) => void;
  onExit: () => void;
}) {
  const game = useFriendRoomGame(initialSession);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const completedRoomCodeRef = useRef<string | null>(null);
  const reportedNoPanoSeedIdRef = useRef<string | null>(null);
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
    game.draftGuess && !game.self?.hasGuessed ? "ready" : "",
    timerUrgent ? "urgent" : "",
  ].filter(Boolean).join(" ");
  const submitButtonStyle = {
    "--timer-progress": submitTimerProgress,
  } as CSSProperties;
  const inviteLink = useMemo(
    () => `${window.location.origin}${window.location.pathname}?room=${room.roomCode}`,
    [room.roomCode],
  );
  const completedScores = useMemo(() => {
    const scores = new Map<number, number>();

    for (const round of room.roundHistory ?? []) {
      const selfGuess = round.guesses.find(
        (guess) => guess.playerId === game.playerId,
      );
      if (selfGuess) {
        scores.set(round.roundNumber, selfGuess.score);
      }
    }

    return scores;
  }, [game.playerId, room.roundHistory]);
  const revealedTargetAddress =
    isReveal && room.revealed ? formatTargetAddress(room.revealed.target) : null;

  useEffect(() => {
    if (isFinished && completedRoomCodeRef.current !== room.roomCode) {
      completedRoomCodeRef.current = room.roomCode;
      onRoomComplete?.();
    }
  }, [isFinished, onRoomComplete, room.roomCode]);

  async function copyInvite() {
    const copiedInvite = await copyTextToClipboard(inviteLink);
    setCopyStatus(copiedInvite ? "copied" : "failed");
    window.setTimeout(() => setCopyStatus("idle"), 1400);
  }

  const handleRoadviewStatusChange = useCallback((status: KakaoRoadviewStatus) => {
    if (
      status === "no_pano" &&
      room.currentRound &&
      reportedNoPanoSeedIdRef.current !== room.currentRound.seedId
    ) {
      reportedNoPanoSeedIdRef.current = room.currentRound.seedId;
      void game.reportCurrentSeedIssue("no_pano");
    }
  }, [game, room.currentRound]);

  if (isLobby) {
    return (
      <main className="app-shell room-lobby-shell">
        <RoomTopbar
          roomCode={room.roomCode}
          mapName={room.mapName}
          difficultyMode={room.difficultyMode}
          timerLabel={timerLabel}
          roundLabel={`${room.roundCount}라운드`}
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
            {game.self ? (
              <RoomColorPicker
                currentPlayerId={game.playerId}
                disabled={game.submitting}
                players={room.players}
                selectedColor={game.self.color}
                onSelect={game.setPlayerColor}
              />
            ) : null}
            <div className="invite-row">
              <input readOnly value={inviteLink} aria-label="초대 링크" />
              <button onClick={copyInvite} type="button">
                <Copy size={16} aria-hidden="true" />
                {copyStatus === "copied" ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="invite-status" aria-label="초대 링크 상태">
              {copyStatus === "copied"
                ? "복사됨"
                : copyStatus === "failed"
                  ? "직접 복사해 주세요"
                  : "링크 준비"}
            </div>
            {copyStatus === "copied" ? <div className="copy-toast">초대 링크 복사됨</div> : null}
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
          <LobbySeats players={room.players} currentPlayerId={game.playerId} />
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
          onCreateRematchRoom={() => onCreateRematchRoom?.(room)}
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
        roundLabel={`${Math.min(roundNumber, room.roundCount)} / ${room.roundCount}라운드`}
        score={game.self?.score ?? 0}
        timerProgress={submitTimerProgress}
        timerUrgent={timerUrgent}
        onExit={onExit}
      />

      <RoundProgressTrack
        completedScores={completedScores}
        currentRoundNumber={Math.min(roundNumber, room.roundCount)}
        roundCount={room.roundCount}
      />

      <section className="game-layout">
        <KakaoRoadviewPanel
          target={game.currentTargetForViewer}
          onStatusChange={handleRoadviewStatusChange}
        />

        <aside className="side-panel" aria-label="친구방 추측과 결과">
          <section
            className={[
              "panel-section",
              "map-panel",
              isReveal || isRevealCountdown ? "reveal-map-panel" : "",
              game.draftGuess && !isReveal && !isRevealCountdown ? "has-guess" : "",
            ].filter(Boolean).join(" ")}
          >
            <div className="section-heading compact-heading">
              <div>
                <h2>{isReveal || isRevealCountdown ? "결과 확인" : "핀 찍기"}</h2>
                <p>
                  {revealedTargetAddress
                    ? `정답 · ${revealedTargetAddress}`
                    : `${mapDefinition.name} · ${activePlayerCount}명`}
                </p>
              </div>
              <div className="map-action-state">
                {!isReveal && !isRevealCountdown ? (
                  <span
                    className={[
                      "guess-ready-chip",
                      game.self?.hasGuessed || game.draftGuess ? "ready" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {game.self?.hasGuessed
                      ? "제출 완료"
                      : game.draftGuess
                        ? "핀 선택됨"
                        : "지도에서 선택"}
                  </span>
                ) : null}
                <div className="guess-status" aria-label="제출 현황">
                  {submittedLabel}
                </div>
              </div>
            </div>
            <KoreaGuessMap
              guess={game.guess}
              guessColor={game.self?.color}
              regions={mapDefinition.regions}
              resetKey={`${room.roundIndex}:${room.currentRound?.seedId ?? "pending"}`}
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
            {game.roundNotice ? (
              <p className="inline-notice">{game.roundNotice}</p>
            ) : null}
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
                <span>결과 공개</span>
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
                  <span>결과 공개</span>
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

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textArea.remove();
  }
}
