import type {
  GameDifficultyMode,
  LatLng,
  MatchPlan,
  RoomPlayerColor,
  RoundGuessResult,
  SeedIssueReason,
} from "@kr-geo-guess/shared";

export type RoomPhase =
  | "lobby"
  | "round_active"
  | "round_reveal_countdown"
  | "round_reveal"
  | "finished";

export type RoomPlayer = {
  playerId: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  color: RoomPlayerColor;
  guessedRound: number | null;
};

export type FriendRoom = {
  roomCode: string;
  phase: RoomPhase;
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  roundIndex: number;
  roundStartedAt: number | null;
  revealCountdownStartedAt: number | null;
  plan: MatchPlan;
  players: RoomPlayer[];
  guesses: Map<string, RoomGuessSubmission>;
  resultsByRound: Map<number, RoomRoundResult[]>;
  createdAt: number;
  leaderboardRecorded: boolean;
  excludedSeedIds: Set<string>;
  seedIssueReports: SeedIssueReport[];
};

export type RoomGuessSubmission = {
  guess: LatLng | null;
  submittedAt: number;
};

export type RoomRoundResult = RoundGuessResult & {
  playerId: string;
  totalScoreAfterRound: number;
};

export type SeedIssueReport = {
  seedId: string;
  roundNumber: number;
  playerId: string;
  reason: SeedIssueReason;
  reportedAt: number;
};
