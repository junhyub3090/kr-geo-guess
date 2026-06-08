export class RoomNotFoundError extends Error {
  constructor(roomCode: string) {
    super(`Room not found: ${roomCode}`);
  }
}

export class RoomConflictError extends Error {}
