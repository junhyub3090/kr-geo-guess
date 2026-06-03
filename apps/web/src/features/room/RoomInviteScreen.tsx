import { DoorOpen, Home, KeyRound, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { formatMapDifficulty } from "../game/gameDisplay";
import type { ApiRoom } from "../api/gameApi";

type RoomInviteScreenProps = {
  roomCode: string;
  nickname: string;
  room: ApiRoom | null;
  apiAvailable: boolean;
  loading: boolean;
  error: string | null;
  onNicknameChange: (nickname: string) => void;
  onJoinRoom: () => void;
  onExit: () => void;
};

export function RoomInviteScreen({
  roomCode,
  nickname,
  room,
  apiAvailable,
  loading,
  error,
  onNicknameChange,
  onJoinRoom,
  onExit,
}: RoomInviteScreenProps) {
  const isJoinable = apiAvailable && room?.phase === "lobby";
  const playerCount = room?.players.length ?? 0;
  const mapLabel = room
    ? formatMapDifficulty(room.mapName, room.difficultyMode)
    : "친구방";

  return (
    <main className="invite-shell">
      <header className="home-header">
        <div className="brand-block">
          <h1>어디길</h1>
        </div>
      </header>

      <section className="invite-card" aria-label="친구방 입장">
        <div className="invite-card-main">
          <div className="invite-room-badge">
            <KeyRound size={18} aria-hidden="true" />
            <span>{roomCode}</span>
          </div>
          <h2>친구방 입장</h2>
          <div className="invite-facts" aria-label="방 상태">
            <span>{mapLabel}</span>
            <span>{room ? `${room.roundCount}라운드` : "확인 중"}</span>
            <span>{room ? `${room.timerSeconds}초` : "대기"}</span>
          </div>

          <label className="field-label" htmlFor="invite-nickname">
            닉네임
          </label>
          <input
            id="invite-nickname"
            className="nickname-input"
            maxLength={16}
            placeholder="게스트"
            value={nickname}
            onChange={(event) => onNicknameChange(event.target.value)}
          />

          {!apiAvailable ? (
            <p className="home-error">친구방은 서버 연결 후 사용할 수 있습니다.</p>
          ) : null}
          {apiAvailable && room && room.phase !== "lobby" ? (
            <p className="home-error">이미 시작된 방입니다.</p>
          ) : null}
          {error ? <p className="home-error">{error}</p> : null}

          <div className="invite-actions">
            <button
              className="secondary-button invite-home-button"
              onClick={onExit}
              type="button"
            >
              <Home size={16} aria-hidden="true" />
              홈으로
            </button>
            <button
              className="play-button invite-join-button"
              disabled={loading || !isJoinable}
              onClick={onJoinRoom}
              type="button"
            >
              <DoorOpen size={18} aria-hidden="true" />
              입장
            </button>
          </div>
        </div>

        <aside className="invite-waiting-panel">
          <div className="mini-heading">
            <Users size={18} aria-hidden="true" />
            <h2>대기 중</h2>
            <span className="mini-heading-note">{playerCount}명</span>
          </div>
          <div className="invite-player-stack">
            {room?.players.map((player) => (
              <div
                className="invite-player-seat"
                key={player.playerId}
                style={{ "--player-color": player.color } as CSSProperties}
              >
                <span>{player.nickname.slice(0, 1)}</span>
                <strong>
                  {player.nickname}
                  {player.isHost ? " · 방장" : ""}
                </strong>
              </div>
            )) ?? (
              <p className="room-unavailable">방 정보를 확인하는 중입니다.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
