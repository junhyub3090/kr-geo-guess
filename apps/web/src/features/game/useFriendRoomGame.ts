import { formatDistance, type LatLng } from "@kr-geo-guess/shared";
import { useEffect, useMemo, useState } from "react";
import {
  getFriendRoom,
  nextRoomRound,
  revealRoom,
  startFriendRoom,
  submitRoomGuess,
  type ApiRoom,
} from "../api/gameApi";

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

  useEffect(() => {
    setGuess(null);
  }, [room.roundIndex]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

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

  async function revealCurrentRound() {
    await runRoomAction(() => revealRoom({ roomCode: room.roomCode, playerId }));
  }

  async function nextRound() {
    await runRoomAction(() => nextRoomRound({ roomCode: room.roomCode, playerId }));
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
    submitting,
    error,
    setGuess,
    startGame,
    submitCurrentGuess,
    revealCurrentRound,
    nextRound,
  };
}
