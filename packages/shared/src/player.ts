import { hashString } from "./seeds.js";

export function normalizeNickname(rawNickname: string): string {
  const nickname = rawNickname.trim().replace(/\s+/g, " ");

  if (!nickname) {
    return "게스트";
  }

  return [...nickname].slice(0, 8).join("");
}

export function createRoomCode(seed: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let state = hashString(seed);
  let code = "";

  for (let index = 0; index < 4; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    code += alphabet[state % alphabet.length];
  }

  return `KR-${code}`;
}
