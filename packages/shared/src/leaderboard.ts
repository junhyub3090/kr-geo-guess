import type { LeaderboardEntry, LeaderboardInput } from "./types.js";

export function createLeaderboard(
  entries: readonly LeaderboardInput[],
): LeaderboardEntry[] {
  return [...entries]
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      if (left.totalTimeSeconds !== right.totalTimeSeconds) {
        return left.totalTimeSeconds - right.totalTimeSeconds;
      }

      return left.totalDistanceMeters - right.totalDistanceMeters;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
