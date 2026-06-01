export type LatLng = {
  lat: number;
  lng: number;
};

export type GameScope = "national" | "province" | "city";

export type SeedDifficulty = "easy" | "medium" | "hard";

export type GameDifficultyMode = "easy" | "normal" | "hard" | "mixed";

export type SeedSourceType =
  | "manual"
  | "osm_derived"
  | "public_dataset"
  | "user_submitted";

export type SeedLocation = LatLng & {
  id: string;
  title: string;
  region1: string;
  region2: string;
  tags: readonly string[];
  difficulty: SeedDifficulty;
  sourceType: SeedSourceType;
};

export type GameMapDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  scope: GameScope;
  regions: readonly string[];
  featured?: boolean;
};

export type RoundPlan = {
  id: string;
  roundNumber: number;
  seed: SeedLocation;
};

export type MatchPlan = {
  id: string;
  mapId: string;
  mapName: string;
  difficultyMode: GameDifficultyMode;
  timerSeconds: number;
  rounds: RoundPlan[];
};

export type PublicRound = {
  roundNumber: number;
  seedId: string;
  regionHint: string;
  mapId: string;
  mapName: string;
  difficulty: SeedDifficulty;
  tags: readonly string[];
  roadviewTarget: LatLng;
  timerEndsAt: number | null;
};

export type RoundGuessResult = {
  roundNumber: number;
  target: SeedLocation;
  guess: LatLng | null;
  distanceMeters: number | null;
  distanceScore: number;
  timeBonus: number;
  timeRemainingSeconds: number | null;
  score: number;
};

export type LeaderboardInput = {
  playerId: string;
  nickname: string;
  totalScore: number;
  totalDistanceMeters: number;
  totalTimeSeconds: number;
};

export type LeaderboardEntry = LeaderboardInput & {
  rank: number;
};
