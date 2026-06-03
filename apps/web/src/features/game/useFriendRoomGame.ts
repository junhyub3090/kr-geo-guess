import {
  formatDistance,
  type LatLng,
  type SeedIssueReason,
} from "@kr-geo-guess/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFriendRoom,
  nextRoomRound,
  reportRoomSeedIssue,
  revealRoom,
  setRoomPlayerColor,
  startFriendRoom,
  submitRoomGuess,
  type ApiRoom,
} from "../api/gameApi";

const REVEAL_COUNTDOWN_SECONDS = 3;

export type FriendRoomSession = {
  playerId: string;
  room: ApiRoom;
};

export function useFriendRoomGame(initialSession: FriendRoomSession) {
  const [room, setRoom] = useState(initialSession.room);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [roundNotice, setRoundNotice] = useState<string | null>(null);
  const [revealCountdownObservedAt, setRevealCountdownObservedAt] =
    useState<number | null>(null);
  const observedRoundRef = useRef({
    roundIndex: initialSession.room.roundIndex,
    seedId: initialSession.room.currentRound?.seedId ?? null,
  });
  const playerId = initialSession.playerId;

  const self = room.players.find((player) => player.playerId === playerId) ?? null;
  const isHost = Boolean(self?.isHost);
  const selfRevealGuess =
    room.revealed?.guesses.find((item) => item.playerId === playerId) ?? null;
  const activeGuess = room.phase === "round_reveal" ? selfRevealGuess?.guess ?? guess : guess;
  const peerGuesses = room.phase === "round_reveal"
    ? room.revealed?.guesses
        .filter((item) => item.playerId !== playerId)
        .filter((item) => item.guess !== null)
        .map((item) => ({
          id: item.playerId,
          label: item.nickname,
          point: item.guess!,
          color: item.color,
          rank: item.rank,
          distanceLabel:
            item.distanceMeters === null ? "미제출" : formatDistance(item.distanceMeters),
        })) ?? []
    : [];
  const currentTargetForViewer = useMemo(() => {
    return room.currentRound?.roadviewTarget ?? room.revealed?.target ?? {
      lat: 37.5665,
      lng: 126.978,
    };
  }, [room.currentRound?.roadviewTarget, room.revealed?.target]);
  const formattedDistance = selfRevealGuess
    ? selfRevealGuess.distanceMeters === null
      ? "미제출"
      : formatDistance(selfRevealGuess.distanceMeters)
    : null;
  const remainingSeconds =
    room.phase === "round_active" && room.currentRound?.timerEndsAt
      ? Math.max(0, Math.ceil((room.currentRound.timerEndsAt - nowMs) / 1000))
      : 0;
  const revealCountdownSeconds =
    room.phase === "round_reveal_countdown" && revealCountdownObservedAt !== null
      ? getRevealCountdownSeconds(nowMs, revealCountdownObservedAt)
      : 0;

  useEffect(() => {
    setGuess(null);
  }, [room.roundIndex]);

  useEffect(() => {
    const nextSeedId = room.currentRound?.seedId ?? null;
    const previous = observedRoundRef.current;

    if (
      room.phase === "round_active" &&
      previous.seedId &&
      nextSeedId &&
      previous.seedId !== nextSeedId &&
      previous.roundIndex === room.roundIndex
    ) {
      setGuess(null);
      setRoundNotice("새 위치로 바뀌었어요");
      const timeout = window.setTimeout(() => setRoundNotice(null), 1800);
      observedRoundRef.current = {
        roundIndex: room.roundIndex,
        seedId: nextSeedId,
      };
      return () => window.clearTimeout(timeout);
    }

    if (
      previous.seedId !== nextSeedId ||
      previous.roundIndex !== room.roundIndex
    ) {
      setGuess(null);
      observedRoundRef.current = {
        roundIndex: room.roundIndex,
        seedId: nextSeedId,
      };
    }

    return undefined;
  }, [room.currentRound?.seedId, room.phase, room.roundIndex]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (room.phase === "round_reveal_countdown") {
      const observedAt = Date.now();
      setNowMs(observedAt);
      setRevealCountdownObservedAt((currentObservedAt) =>
        currentObservedAt ?? observedAt,
      );
      return;
    }

    setRevealCountdownObservedAt(null);
  }, [room.phase, room.roundIndex]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      getFriendRoom(room.roomCode)
        .then((response) => setRoom(response.room))
        .catch(() => undefined);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [room.roomCode]);

  useEffect(() => {
    if (
      room.phase === "round_active" &&
      remainingSeconds === 0 &&
      !self?.hasGuessed &&
      !submitting
    ) {
      void submitCurrentGuess(guess);
    }
  }, [guess, remainingSeconds, room.phase, self?.hasGuessed, submitting]);

  async function startGame() {
    await runRoomAction(() =>
      startFriendRoom({ roomCode: room.roomCode, playerId }),
    );
  }

  async function submitCurrentGuess(finalGuess: LatLng | null = guess) {
    if (room.phase !== "round_active" || self?.hasGuessed) {
      return;
    }

    await runRoomAction(() =>
      submitRoomGuess({
        roomCode: room.roomCode,
        playerId,
        roundIndex: room.roundIndex,
        guess: finalGuess,
      }),
    );
  }

  async function nextRound() {
    await runRoomAction(() => nextRoomRound({ roomCode: room.roomCode, playerId }));
  }

  async function revealCurrentRound() {
    await runRoomAction(() => revealRoom({ roomCode: room.roomCode, playerId }));
  }

  async function setPlayerColor(color: string) {
    await runRoomAction(() =>
      setRoomPlayerColor({ roomCode: room.roomCode, playerId, color }),
    );
  }

  async function reportCurrentSeedIssue(reason: SeedIssueReason) {
    if (room.phase !== "round_active" || !room.currentRound) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await reportRoomSeedIssue({
        roomCode: room.roomCode,
        playerId,
        roundIndex: room.roundIndex,
        seedId: room.currentRound.seedId,
        reason,
      });

      setGuess(null);
      setRoom(response.room);
    } catch (issueError) {
      setError(
        issueError instanceof Error
          ? issueError.message
          : "로드뷰 없는 위치를 건너뛰지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function runRoomAction(action: () => Promise<{ room: ApiRoom }>) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await action();
      setRoom(response.room);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "방 상태를 바꾸지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return {
    room,
    playerId,
    self,
    isHost,
    guess: activeGuess ?? null,
    draftGuess: guess,
    peerGuesses,
    currentTargetForViewer,
    selfRevealGuess,
    formattedDistance,
    remainingSeconds,
    revealCountdownSeconds,
    roundNotice,
    submitting,
    error,
    setGuess,
    startGame,
    submitCurrentGuess,
    revealCurrentRound,
    setPlayerColor,
    reportCurrentSeedIssue,
    nextRound,
  };
}

function getRevealCountdownSeconds(nowMs: number, observedAt: number) {
  const elapsedMs = Math.max(0, nowMs - observedAt);
  const secondsLeft = Math.ceil(
    (REVEAL_COUNTDOWN_SECONDS * 1000 - elapsedMs) / 1000,
  );

  return Math.min(REVEAL_COUNTDOWN_SECONDS, Math.max(1, secondsLeft));
}
