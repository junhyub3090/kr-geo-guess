import { formatDistance, type RoundGuessResult } from "@kr-geo-guess/shared";
import type { ApiMatch, ApiRoomRevealGuess } from "../api/gameApi";
import { formatMapDifficulty, formatTargetAddress } from "./gameDisplay";

const TAG_LABELS: Record<string, string> = {
  alley: "골목",
  "apartment-edge": "아파트 외곽",
  backstreet: "이면도로",
  "city-edge": "도시 외곽",
  "clue-rich-road": "단서 많은 도로",
  "coast-city": "해안 도시",
  "coastal-plain": "해안 평야",
  "coastal-road": "해안도로",
  "edge-road": "외곽길",
  "farm-road": "농로",
  "field-wall": "밭담",
  "forest-edge": "숲 가장자리",
  "harbor-edge": "항구 주변",
  hill: "구릉지",
  hillside: "언덕길",
  industrial: "산업지대",
  island: "섬",
  lakeside: "호수 주변",
  "low-clue-road": "조용한 도로",
  "mid-mountain": "중산간",
  mountain: "산지",
  "mountain-road": "산길",
  "new-town-edge": "신도시 외곽",
  "old-town": "구도심",
  "ordinary-road": "생활도로",
  plain: "평야",
  "port-edge": "항만 주변",
  residential: "주거지",
  river: "하천",
  "river-road": "하천길",
  rural: "농어촌",
  "service-road": "보조도로",
  slope: "경사지",
  "small-shops": "상가 골목",
  "small-town": "소도시",
  suburban: "교외",
  test: "테스트 위치",
  "two-lane": "2차선 도로",
  underpass: "하부도로",
  urban: "도심",
  valley: "계곡",
  village: "마을길",
  "wetland-edge": "습지 주변",
  "wide-road": "넓은 도로",
};

const TAG_HINTS: Record<string, string> = {
  alley: "좁은 길 폭과 건물 간격을 함께 보면 방향을 잡기 쉽습니다.",
  "apartment-edge": "대단지 가장자리 도로는 방음벽과 넓은 보행로가 단서가 됩니다.",
  backstreet: "이면도로는 큰 간선도로보다 생활권 분위기를 먼저 보는 편이 좋습니다.",
  "city-edge": "도시 외곽은 산지와 신도시 경계가 함께 보이는 경우가 많습니다.",
  "clue-rich-road": "도로 폭, 표지판, 주변 건물 밀도를 함께 읽어보세요.",
  "coastal-road": "해안도로는 바다 방향과 산지 위치가 강한 단서입니다.",
  "farm-road": "농로는 논밭 모양과 멀리 보이는 산세가 지역감을 만듭니다.",
  "low-clue-road": "단서가 적은 길은 지형과 도로 곡률을 먼저 보는 편이 좋습니다.",
  "mountain-road": "산길은 경사, 굽은 정도, 계곡 방향이 핵심 단서입니다.",
  "ordinary-road": "생활도로는 차선 폭과 주변 건물 용도를 함께 보면 좋습니다.",
  "river-road": "하천길은 물길 방향과 제방 형태가 위치 추정에 도움됩니다.",
  rural: "농어촌 길은 밭, 축사, 산 능선의 조합을 관찰해 보세요.",
  urban: "도심은 건물 밀도, 차선 수, 보행 환경이 강한 단서입니다.",
};

export function getSeedTagLabels(tags: readonly string[], limit = 3) {
  return tags.slice(0, limit).map((tag) => TAG_LABELS[tag] ?? formatUnknownTag(tag));
}

export function getSeedTagHint(tags: readonly string[]) {
  const primaryTag = tags.find((tag) => TAG_HINTS[tag]);
  if (primaryTag) {
    return TAG_HINTS[primaryTag];
  }

  const primaryLabel = getSeedTagLabels(tags, 1)[0] ?? "주변 단서";
  return `${primaryLabel}의 도로 폭, 지형, 주변 건물 밀도를 함께 살펴보세요.`;
}

export function getRoundScoreTone(score: number) {
  if (score >= 4_500) {
    return "정확한 감각";
  }

  if (score >= 3_000) {
    return "좋은 접근";
  }

  if (score >= 1_500) {
    return "단서 확보";
  }

  return "다음 위치에서 만회";
}

export function createRoundShareText(
  result: RoundGuessResult,
  mapName: string,
) {
  const distance =
    result.distanceMeters === null ? "미제출" : formatDistance(result.distanceMeters);

  return `어디길 ${mapName} R${result.roundNumber}: ${result.score.toLocaleString("ko-KR")}점 · ${distance}`;
}

export function createFinalShareText(match: ApiMatch) {
  const bestRound = getBestRound(match.results);
  const bestText = bestRound
    ? `최고 R${bestRound.roundNumber} ${bestRound.score.toLocaleString("ko-KR")}점`
    : "최고 라운드 없음";

  return `어디길 ${formatMapDifficulty(match.mapName, match.difficultyMode)} ${match.totalScore.toLocaleString("ko-KR")}점 · ${bestText}`;
}

export function createRoomShareText({
  players,
  roundHistory,
}: {
  players: readonly { nickname: string; score: number }[];
  roundHistory: readonly { roundNumber: number; guesses: ApiRoomRevealGuess[] }[];
}) {
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = rankedPlayers[0];
  const roundCount = roundHistory.length;

  if (!winner) {
    return "어디길 친구방 결과 없음";
  }

  return `어디길 친구방 ${roundCount}R · 1등 ${winner.nickname} ${winner.score.toLocaleString("ko-KR")}점`;
}

export function getResultLearningSummary(result: RoundGuessResult) {
  const address = formatTargetAddress(result.target);
  const clues = getSeedTagLabels(result.target.tags);

  return {
    address,
    clues,
    hint: getSeedTagHint(result.target.tags),
    tone: getRoundScoreTone(result.score),
  };
}

function getBestRound(results: readonly RoundGuessResult[]) {
  return [...results].sort((left, right) => right.score - left.score)[0] ?? null;
}

function formatUnknownTag(tag: string) {
  return tag
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.trim())
    .join(" ");
}
