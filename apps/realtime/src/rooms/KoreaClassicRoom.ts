import { Client, Room } from "@colyseus/core";
import {
  KOREA_SEED_CATALOG,
  createMatchPlan,
  submitRoundGuess,
  type LatLng,
  type MatchPlan,
} from "@kr-geo-guess/shared";

type PlayerSeat = {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  guessedRound: number | null;
};

type RoomPhase = "lobby" | "round_active" | "round_reveal" | "finished";

type RevealGuesses = Record<
  string,
  {
    guess: LatLng;
    score: number;
    distanceMeters: number | null;
  }
>;

type KoreaClassicState = {
  phase: RoomPhase;
  roundIndex: number;
  timerEndsAt: number | null;
  players: Record<string, PlayerSeat>;
  revealed: null | {
    roundNumber: number;
    target: LatLng;
    guesses: RevealGuesses;
  };
};

type TimedGuess = {
  guess: LatLng;
  submittedAt: number;
};

export class KoreaClassicRoom extends Room {
  declare state: KoreaClassicState;
  maxClients = 20;
  private matchPlan: MatchPlan | null = null;
  private guesses = new Map<string, TimedGuess>();

  onCreate() {
    this.matchPlan = createMatchPlan(KOREA_SEED_CATALOG, {
      roundCount: 5,
      timerSeconds: 30,
    });
    this.setState({
      phase: "lobby",
      roundIndex: 0,
      timerEndsAt: null,
      players: {},
      revealed: null,
    });

    this.onMessage("start", (client) => this.startGame(client));
    this.onMessage("guess", (client, guess: LatLng) => this.receiveGuess(client, guess));
    this.onMessage("next", (client) => this.nextRound(client));
  }

  onJoin(client: Client, options?: { nickname?: string }) {
    const nickname = options?.nickname?.slice(0, 20) || `Player ${client.sessionId.slice(0, 4)}`;

    this.state.players[client.sessionId] = {
      id: client.sessionId,
      nickname,
      score: 0,
      connected: true,
      guessedRound: null,
    };
    this.broadcast("players", this.state.players);
  }

  onLeave(client: Client) {
    const player = this.state.players[client.sessionId];

    if (player) {
      player.connected = false;
      this.broadcast("players", this.state.players);
    }
  }

  private startGame(client: Client) {
    if (!this.isHost(client) || !this.matchPlan) {
      return;
    }

    this.state.phase = "round_active";
    this.state.roundIndex = 0;
    this.state.timerEndsAt = Date.now() + this.matchPlan.timerSeconds * 1000;
    this.state.revealed = null;
    this.guesses.clear();
    this.broadcast("round", this.publicRoundState());
  }

  private receiveGuess(client: Client, guess: LatLng) {
    if (this.state.phase !== "round_active") {
      return;
    }

    const player = this.state.players[client.sessionId];

    if (!player || player.guessedRound === this.state.roundIndex) {
      return;
    }

    player.guessedRound = this.state.roundIndex;
    this.guesses.set(client.sessionId, { guess, submittedAt: Date.now() });
    this.broadcast("players", this.state.players);

    const activePlayers = Object.values(this.state.players).filter(
      (seat) => seat.connected,
    );

    if (this.guesses.size >= activePlayers.length) {
      this.revealRound();
    }
  }

  private nextRound(client: Client) {
    if (!this.isHost(client) || !this.matchPlan) {
      return;
    }

    const nextRoundIndex = this.state.roundIndex + 1;

    if (nextRoundIndex >= this.matchPlan.rounds.length) {
      this.state.phase = "finished";
      this.state.timerEndsAt = null;
      this.broadcast("finished", this.state.players);
      return;
    }

    this.state.phase = "round_active";
    this.state.roundIndex = nextRoundIndex;
    this.state.timerEndsAt = Date.now() + this.matchPlan.timerSeconds * 1000;
    this.state.revealed = null;
    this.guesses.clear();

    for (const player of Object.values(this.state.players)) {
      player.guessedRound = null;
    }

    this.broadcast("round", this.publicRoundState());
  }

  private revealRound() {
    const round = this.matchPlan?.rounds[this.state.roundIndex];

    if (!round) {
      return;
    }

    const guesses = this.buildRevealGuesses(round.seed);

    this.state.phase = "round_reveal";
    this.state.timerEndsAt = null;
    this.state.revealed = {
      roundNumber: round.roundNumber,
      target: round.seed,
      guesses,
    };
    this.broadcast("reveal", this.state.revealed);
  }

  private buildRevealGuesses(target: (typeof KOREA_SEED_CATALOG)[number]) {
    const revealGuesses: RevealGuesses = {};

    for (const [sessionId, submission] of this.guesses) {
      const player = this.state.players[sessionId];

      if (!player) {
        continue;
      }

      const result = submitRoundGuess({
        roundNumber: this.state.roundIndex + 1,
        target,
        guess: submission.guess,
        scope: "national",
        timeRemainingSeconds: this.getRemainingSeconds(submission.submittedAt),
        timerSeconds: this.matchPlan?.timerSeconds ?? 30,
      });

      player.score += result.score;
      revealGuesses[sessionId] = {
        guess: submission.guess,
        score: result.score,
        distanceMeters: result.distanceMeters,
      };
    }

    return revealGuesses;
  }

  private publicRoundState() {
    const round = this.matchPlan?.rounds[this.state.roundIndex];

    if (!round) {
      return null;
    }

    return {
      roundNumber: round.roundNumber,
      timerEndsAt: this.state.timerEndsAt,
      seedId: round.seed.id,
      regionHint: round.seed.region1,
    };
  }

  private isHost(client: Client) {
    return this.clients[0]?.sessionId === client.sessionId;
  }

  private getRemainingSeconds(currentTime: number) {
    if (!this.state.timerEndsAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((this.state.timerEndsAt - currentTime) / 1000));
  }
}
