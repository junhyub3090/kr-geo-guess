import type { LatLng } from "./types.js";

const EARTH_RADIUS_METERS = 6_371_000;

export const KOREA_GAMEPLAY_BOUNDS = {
  minLat: 33,
  maxLat: 38.75,
  minLng: 124.6,
  maxLng: 132.1,
} as const;

export function distanceMeters(from: LatLng, to: LatLng): number {
  if (from.lat === to.lat && from.lng === to.lng) {
    return 0;
  }

  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

export function isInsideKoreaBounds(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= KOREA_GAMEPLAY_BOUNDS.minLat &&
    point.lat <= KOREA_GAMEPLAY_BOUNDS.maxLat &&
    point.lng >= KOREA_GAMEPLAY_BOUNDS.minLng &&
    point.lng <= KOREA_GAMEPLAY_BOUNDS.maxLng
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
