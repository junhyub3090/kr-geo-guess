import type { GameDifficultyMode } from "../api/gameApi";

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getDifficultyLabel(difficultyMode: GameDifficultyMode) {
  switch (difficultyMode) {
    case "easy":
      return "하";
    case "normal":
      return "중";
    case "hard":
      return "상";
    case "mixed":
      return "혼합";
  }
}

export function formatMapDifficulty(
  mapName: string,
  difficultyMode: GameDifficultyMode,
) {
  return `${mapName} · ${getDifficultyLabel(difficultyMode)}`;
}

export function getTimerProgressPercent(
  timerSeconds: number,
  remainingSeconds: number,
) {
  if (timerSeconds <= 0) {
    return "0%";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.min(timerSeconds, timerSeconds - remainingSeconds),
  );
  return `${Math.round((elapsedSeconds / timerSeconds) * 100)}%`;
}

export function isUrgentTimer(
  remainingSeconds: number,
  timerSeconds: number,
) {
  return timerSeconds > 0 && remainingSeconds > 0 && remainingSeconds <= 10;
}
