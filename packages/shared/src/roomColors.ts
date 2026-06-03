export const ROOM_PLAYER_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#ea580c",
  "#0f766e",
  "#4f46e5",
  "#65a30d",
  "#be123c",
  "#0284c7",
  "#9333ea",
  "#ca8a04",
  "#475569",
] as const;

export type RoomPlayerColor = (typeof ROOM_PLAYER_COLORS)[number];

export function isRoomPlayerColor(value: unknown): value is RoomPlayerColor {
  return (
    typeof value === "string" &&
    ROOM_PLAYER_COLORS.includes(value as RoomPlayerColor)
  );
}
