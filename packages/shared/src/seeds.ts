import type {
  GameDifficultyMode,
  GameMapDefinition,
  SeedDifficulty,
  SeedLocation,
} from "./types.js";

type SeedInput = Omit<SeedLocation, "sourceType">;

function seed(input: SeedInput): SeedLocation {
  return {
    ...input,
    sourceType: "manual",
  };
}

export const KOREA_GAME_MAPS: GameMapDefinition[] = [
  {
    id: "kr-all",
    name: "전국",
    shortName: "전국",
    description: "도심 외곽, 생활도로, 해안, 산간, 농어촌 도로",
    scope: "national",
    regions: [],
    featured: true,
  },
  {
    id: "seoul",
    name: "서울특별시",
    shortName: "서울",
    description: "대로변보다 생활도로와 구릉지 골목 중심",
    scope: "city",
    regions: ["서울"],
    featured: true,
  },
  {
    id: "gyeonggi",
    name: "경기도",
    shortName: "경기",
    description: "신도시 외곽, 하천길, 농촌과 도시가 맞닿은 도로",
    scope: "province",
    regions: ["경기"],
    featured: true,
  },
  {
    id: "gangwon",
    name: "강원도",
    shortName: "강원",
    description: "산간 2차선 도로, 하천길, 바닷가 마을길",
    scope: "province",
    regions: ["강원"],
    featured: true,
  },
  {
    id: "chungbuk",
    name: "충청북도",
    shortName: "충북",
    description: "내륙 산지, 호수 주변, 읍면 생활도로",
    scope: "province",
    regions: ["충북"],
    featured: true,
  },
  {
    id: "chungnam",
    name: "충청남도",
    shortName: "충남",
    description: "평야, 항구 외곽, 소도시와 농촌 생활도로",
    scope: "province",
    regions: ["충남"],
    featured: true,
  },
  {
    id: "gyeongbuk",
    name: "경상북도",
    shortName: "경북",
    description: "산간 마을, 강변 도로, 오래된 소도시 주변길",
    scope: "province",
    regions: ["경북"],
    featured: true,
  },
  {
    id: "gyeongnam",
    name: "경상남도",
    shortName: "경남",
    description: "남해안, 농어촌, 구릉지 생활도로",
    scope: "province",
    regions: ["경남"],
    featured: true,
  },
  {
    id: "jeonbuk",
    name: "전라북도",
    shortName: "전북",
    description: "평야, 산간 진입로, 오래된 읍내 주변 생활도로",
    scope: "province",
    regions: ["전북"],
    featured: true,
  },
  {
    id: "jeonnam",
    name: "전라남도",
    shortName: "전남",
    description: "해안 마을, 섬 진입로, 평야와 산자락 도로",
    scope: "province",
    regions: ["전남"],
    featured: true,
  },
  {
    id: "jeju",
    name: "제주도",
    shortName: "제주",
    description: "중산간, 밭담, 해안 마을, 오름 주변 도로",
    scope: "province",
    regions: ["제주"],
    featured: true,
  },
];

export const KOREA_SEED_CATALOG: SeedLocation[] = [
  seed({
    id: "seoul-west-hillside-alley",
    title: "서울 서쪽 구릉지 골목",
    lat: 37.5948,
    lng: 126.9169,
    region1: "서울",
    region2: "은평구",
    tags: ["alley", "hillside", "ordinary-road"],
    difficulty: "hard",
  }),
  seed({
    id: "seoul-east-industrial-side-road",
    title: "서울 동쪽 공업지대 이면도로",
    lat: 37.5432,
    lng: 127.0648,
    region1: "서울",
    region2: "성동구",
    tags: ["industrial", "side-road", "urban"],
    difficulty: "medium",
  }),
  seed({
    id: "seoul-south-residential-lane",
    title: "서울 남쪽 주택가 생활도로",
    lat: 37.4829,
    lng: 126.9392,
    region1: "서울",
    region2: "관악구",
    tags: ["residential", "alley", "slope"],
    difficulty: "medium",
  }),
  seed({
    id: "seoul-north-apartment-edge",
    title: "서울 북쪽 아파트 외곽길",
    lat: 37.6462,
    lng: 127.0348,
    region1: "서울",
    region2: "도봉구",
    tags: ["apartment-edge", "ordinary-road", "urban"],
    difficulty: "easy",
  }),
  seed({
    id: "seoul-riverside-underpass-road",
    title: "서울 하천 옆 연결도로",
    lat: 37.5614,
    lng: 127.0446,
    region1: "서울",
    region2: "성동구",
    tags: ["river-road", "underpass", "urban"],
    difficulty: "medium",
  }),
  seed({
    id: "seoul-west-market-backstreet",
    title: "서울 서부 동네 상권 뒷길",
    lat: 37.5561,
    lng: 126.9044,
    region1: "서울",
    region2: "마포구",
    tags: ["backstreet", "small-shops", "urban"],
    difficulty: "easy",
  }),
  seed({
    id: "gyeonggi-river-plain-road",
    title: "경기 하천 옆 평지 도로",
    lat: 37.4942,
    lng: 127.5076,
    region1: "경기",
    region2: "양평군",
    tags: ["river-road", "plain", "rural"],
    difficulty: "hard",
  }),
  seed({
    id: "gyeonggi-newtown-edge-road",
    title: "경기 신도시 외곽 도로",
    lat: 37.2978,
    lng: 127.0751,
    region1: "경기",
    region2: "용인시",
    tags: ["new-town-edge", "apartment-edge", "suburban"],
    difficulty: "easy",
  }),
  seed({
    id: "gyeonggi-farm-village-road",
    title: "경기 농촌 마을 진입로",
    lat: 37.1878,
    lng: 127.3377,
    region1: "경기",
    region2: "이천시",
    tags: ["farm-road", "village", "rural"],
    difficulty: "medium",
  }),
  seed({
    id: "incheon-port-backroad",
    title: "인천 항만 외곽 이면도로",
    lat: 37.4638,
    lng: 126.6319,
    region1: "인천",
    region2: "중구",
    tags: ["port-edge", "industrial", "ordinary-road"],
    difficulty: "easy",
  }),
  seed({
    id: "incheon-island-village-road",
    title: "인천 섬마을 생활도로",
    lat: 37.4484,
    lng: 126.4175,
    region1: "인천",
    region2: "중구",
    tags: ["island", "village", "coastal-road"],
    difficulty: "medium",
  }),
  seed({
    id: "gangwon-mountain-two-lane",
    title: "강원 산간 2차선 도로",
    lat: 37.6115,
    lng: 128.4663,
    region1: "강원",
    region2: "평창군",
    tags: ["mountain-road", "two-lane", "rural"],
    difficulty: "medium",
  }),
  seed({
    id: "gangwon-east-coast-village",
    title: "강원 동해안 마을길",
    lat: 38.0705,
    lng: 128.6694,
    region1: "강원",
    region2: "양양군",
    tags: ["coastal-road", "village", "ordinary-road"],
    difficulty: "easy",
  }),
  seed({
    id: "gangwon-river-valley-road",
    title: "강원 계곡 옆 지방도로",
    lat: 37.3994,
    lng: 128.6627,
    region1: "강원",
    region2: "정선군",
    tags: ["valley", "river-road", "mountain-road"],
    difficulty: "hard",
  }),
  seed({
    id: "gangwon-lakeside-outer-road",
    title: "강원 호수 외곽 도로",
    lat: 37.9099,
    lng: 127.7316,
    region1: "강원",
    region2: "춘천시",
    tags: ["lakeside", "city-edge", "ordinary-road"],
    difficulty: "easy",
  }),
  seed({
    id: "gangwon-snow-country-village",
    title: "강원 산간 마을길",
    lat: 37.6897,
    lng: 128.7054,
    region1: "강원",
    region2: "평창군",
    tags: ["village", "mountain", "rural"],
    difficulty: "hard",
  }),
  seed({
    id: "daejeon-old-town-backstreet",
    title: "대전 오래된 동네 뒷길",
    lat: 36.3259,
    lng: 127.4329,
    region1: "대전",
    region2: "중구",
    tags: ["old-town", "backstreet", "urban"],
    difficulty: "hard",
  }),
  seed({
    id: "sejong-edge-service-road",
    title: "세종 외곽 연결도로",
    lat: 36.4931,
    lng: 127.2926,
    region1: "세종",
    region2: "세종시",
    tags: ["new-town-edge", "service-road", "wide-road"],
    difficulty: "easy",
  }),
  seed({
    id: "chungbuk-river-village-road",
    title: "충북 강변 마을길",
    lat: 36.9804,
    lng: 128.3591,
    region1: "충북",
    region2: "단양군",
    tags: ["river-road", "village", "mountain"],
    difficulty: "medium",
  }),
  seed({
    id: "chungnam-west-coast-farm-road",
    title: "충남 서해안 들판 도로",
    lat: 36.3498,
    lng: 126.5561,
    region1: "충남",
    region2: "보령시",
    tags: ["farm-road", "coastal-plain", "rural"],
    difficulty: "hard",
  }),
  seed({
    id: "chungnam-small-town-edge",
    title: "충남 소도시 외곽길",
    lat: 36.2812,
    lng: 126.9216,
    region1: "충남",
    region2: "부여군",
    tags: ["small-town", "edge-road", "ordinary-road"],
    difficulty: "easy",
  }),
  seed({
    id: "gwangju-hillside-residential",
    title: "광주 구릉지 주택가",
    lat: 35.1424,
    lng: 126.9122,
    region1: "광주",
    region2: "남구",
    tags: ["hillside", "residential", "alley"],
    difficulty: "medium",
  }),
  seed({
    id: "jeonbuk-plain-village-road",
    title: "전북 평야 마을길",
    lat: 35.8097,
    lng: 127.0081,
    region1: "전북",
    region2: "김제시",
    tags: ["plain", "farm-road", "village"],
    difficulty: "hard",
  }),
  seed({
    id: "jeonbuk-old-port-backroad",
    title: "전북 항구도시 뒷길",
    lat: 35.9762,
    lng: 126.7056,
    region1: "전북",
    region2: "군산시",
    tags: ["port-edge", "old-town", "backstreet"],
    difficulty: "easy",
  }),
  seed({
    id: "jeonnam-island-approach-road",
    title: "전남 섬 진입도로",
    lat: 34.7724,
    lng: 127.6595,
    region1: "전남",
    region2: "여수시",
    tags: ["island", "coastal-road", "village"],
    difficulty: "hard",
  }),
  seed({
    id: "jeonnam-wetland-edge-road",
    title: "전남 습지 외곽 도로",
    lat: 34.9007,
    lng: 127.5098,
    region1: "전남",
    region2: "순천시",
    tags: ["wetland-edge", "rural", "ordinary-road"],
    difficulty: "hard",
  }),
  seed({
    id: "busan-hillside-neighborhood",
    title: "부산 산복도로 주변 주택가",
    lat: 35.1127,
    lng: 129.0262,
    region1: "부산",
    region2: "동구",
    tags: ["hillside", "residential", "coast-city"],
    difficulty: "medium",
  }),
  seed({
    id: "busan-coastal-small-road",
    title: "부산 해안가 생활도로",
    lat: 35.1846,
    lng: 129.2109,
    region1: "부산",
    region2: "해운대구",
    tags: ["coastal-road", "ordinary-road", "city-edge"],
    difficulty: "easy",
  }),
  seed({
    id: "daegu-low-rise-backstreet",
    title: "대구 저층 주거지 뒷길",
    lat: 35.8633,
    lng: 128.6028,
    region1: "대구",
    region2: "중구",
    tags: ["backstreet", "residential", "urban"],
    difficulty: "hard",
  }),
  seed({
    id: "ulsan-industrial-edge",
    title: "울산 산업단지 외곽길",
    lat: 35.5038,
    lng: 129.3741,
    region1: "울산",
    region2: "남구",
    tags: ["industrial", "port-edge", "wide-road"],
    difficulty: "easy",
  }),
  seed({
    id: "gyeongbuk-rural-hillside-road",
    title: "경북 구릉지 농로",
    lat: 35.8941,
    lng: 129.1515,
    region1: "경북",
    region2: "경주시",
    tags: ["farm-road", "hillside", "rural"],
    difficulty: "hard",
  }),
  seed({
    id: "gyeongbuk-river-village-lane",
    title: "경북 강변 마을길",
    lat: 36.5489,
    lng: 128.5221,
    region1: "경북",
    region2: "안동시",
    tags: ["river-road", "village", "rural"],
    difficulty: "hard",
  }),
  seed({
    id: "gyeongnam-harbor-hillside-road",
    title: "경남 항구 위 구릉지 길",
    lat: 34.8436,
    lng: 128.4193,
    region1: "경남",
    region2: "통영시",
    tags: ["harbor-edge", "hillside", "ordinary-road"],
    difficulty: "hard",
  }),
  seed({
    id: "gyeongnam-coastal-village-road",
    title: "경남 남해안 마을도로",
    lat: 34.8127,
    lng: 128.0473,
    region1: "경남",
    region2: "남해군",
    tags: ["coastal-road", "village", "hill"],
    difficulty: "hard",
  }),
  seed({
    id: "gyeongnam-river-city-edge",
    title: "경남 강변 도시 외곽길",
    lat: 35.1952,
    lng: 128.0794,
    region1: "경남",
    region2: "진주시",
    tags: ["river-road", "city-edge", "ordinary-road"],
    difficulty: "easy",
  }),
  seed({
    id: "gyeongnam-island-hill-road",
    title: "경남 섬 구릉지 도로",
    lat: 34.7396,
    lng: 128.6594,
    region1: "경남",
    region2: "거제시",
    tags: ["island", "hill", "coastal-road"],
    difficulty: "hard",
  }),
  seed({
    id: "gyeongnam-mountain-farm-road",
    title: "경남 산간 농로",
    lat: 35.5266,
    lng: 127.7217,
    region1: "경남",
    region2: "함양군",
    tags: ["farm-road", "mountain", "rural"],
    difficulty: "hard",
  }),
  seed({
    id: "jeju-west-coast-farm-wall-road",
    title: "제주 서쪽 밭담길",
    lat: 33.4247,
    lng: 126.2814,
    region1: "제주",
    region2: "제주시",
    tags: ["field-wall", "coastal-road", "island"],
    difficulty: "hard",
  }),
  seed({
    id: "jeju-east-village-lane",
    title: "제주 동쪽 마을길",
    lat: 33.4477,
    lng: 126.8816,
    region1: "제주",
    region2: "서귀포시",
    tags: ["village", "field-wall", "island"],
    difficulty: "hard",
  }),
  seed({
    id: "jeju-north-farm-road",
    title: "제주 북쪽 밭 사이 도로",
    lat: 33.4867,
    lng: 126.6049,
    region1: "제주",
    region2: "제주시",
    tags: ["farm-road", "field-wall", "island"],
    difficulty: "medium",
  }),
  seed({
    id: "jeju-mid-mountain-road",
    title: "제주 중산간 도로",
    lat: 33.4178,
    lng: 126.6718,
    region1: "제주",
    region2: "서귀포시",
    tags: ["mid-mountain", "forest-edge", "island"],
    difficulty: "hard",
  }),
  seed({
    id: "jeju-south-harbor-backroad",
    title: "제주 남쪽 항구 뒷길",
    lat: 33.2454,
    lng: 126.5662,
    region1: "제주",
    region2: "서귀포시",
    tags: ["harbor-edge", "backstreet", "island"],
    difficulty: "easy",
  }),
];

export function getGameMap(mapId?: string): GameMapDefinition {
  return (
    KOREA_GAME_MAPS.find((gameMap) => gameMap.id === mapId) ??
    KOREA_GAME_MAPS[0]
  );
}

export function getSeedsForMap(mapId?: string): SeedLocation[] {
  return getSeedsForMapFromCatalog(KOREA_SEED_CATALOG, mapId);
}

export function getSeedsForMapFromCatalog(
  seedCatalog: readonly SeedLocation[],
  mapId?: string,
): SeedLocation[] {
  const gameMap = getGameMap(mapId);

  if (gameMap.id === "kr-all" || gameMap.regions.length === 0) {
    return [...seedCatalog];
  }

  const allowedRegions = new Set(gameMap.regions);
  return seedCatalog.filter((seedLocation) =>
    allowedRegions.has(seedLocation.region1),
  );
}

export function getMapSummaries() {
  return getMapSummariesFromCatalog(KOREA_SEED_CATALOG);
}

export function getMapSummariesFromCatalog(seedCatalog: readonly SeedLocation[]) {
  return KOREA_GAME_MAPS.map((gameMap) => ({
    ...gameMap,
    seedCount: getSeedsForMapFromCatalog(seedCatalog, gameMap.id).length,
  }));
}

export function selectBalancedSeeds<TSeed extends SeedLocation>(
  seeds: readonly TSeed[],
  count: number,
): TSeed[] {
  if (count <= 0) {
    return [];
  }

  const selected: TSeed[] = [];
  const remaining = [...seeds];
  const usedRegions = new Set<string>();

  while (selected.length < count && remaining.length > 0) {
    const diverseIndex = remaining.findIndex(
      (seedLocation) => !usedRegions.has(seedLocation.region1),
    );
    const index = diverseIndex >= 0 ? diverseIndex : 0;
    const [selectedSeed] = remaining.splice(index, 1);

    if (!selectedSeed) {
      break;
    }

    selected.push(selectedSeed);
    usedRegions.add(selectedSeed.region1);
  }

  return selected;
}

export function selectDifficultyWeightedSeeds<TSeed extends SeedLocation>(
  seeds: readonly TSeed[],
  count: number,
  mode: GameDifficultyMode,
): TSeed[] {
  if (count <= 0) {
    return [];
  }

  const weights = DIFFICULTY_WEIGHTS[mode];
  const selected: TSeed[] = [];
  const selectedIds = new Set<string>();

  for (const difficulty of DIFFICULTY_ORDER) {
    const targetCount = Math.floor(count * weights[difficulty]);
    pickByDifficulty(seeds, difficulty, targetCount, selected, selectedIds);
  }

  while (selected.length < count) {
    const nextSeed = seeds.find((seedLocation) => !selectedIds.has(seedLocation.id));

    if (!nextSeed) {
      break;
    }

    selected.push(nextSeed);
    selectedIds.add(nextSeed.id);
  }

  return selected.slice(0, count);
}

const DIFFICULTY_ORDER: SeedDifficulty[] = ["easy", "medium", "hard"];

const DIFFICULTY_WEIGHTS: Record<
  GameDifficultyMode,
  Record<SeedDifficulty, number>
> = {
  easy: {
    easy: 0.62,
    medium: 0.3,
    hard: 0.08,
  },
  normal: {
    easy: 0.28,
    medium: 0.48,
    hard: 0.24,
  },
  hard: {
    easy: 0.1,
    medium: 0.28,
    hard: 0.62,
  },
  mixed: {
    easy: 0.34,
    medium: 0.33,
    hard: 0.33,
  },
};

function pickByDifficulty<TSeed extends SeedLocation>(
  seeds: readonly TSeed[],
  difficulty: SeedDifficulty,
  targetCount: number,
  selected: TSeed[],
  selectedIds: Set<string>,
) {
  if (targetCount <= 0) {
    return;
  }

  let picked = 0;

  for (const seedLocation of seeds) {
    if (picked >= targetCount) {
      break;
    }

    if (
      seedLocation.difficulty === difficulty &&
      !selectedIds.has(seedLocation.id)
    ) {
      selected.push(seedLocation);
      selectedIds.add(seedLocation.id);
      picked += 1;
    }
  }
}

export function deterministicShuffle<TItem>(
  items: readonly TItem[],
  seedValue: string,
): TItem[] {
  const output = [...items];
  let state = hashString(seedValue);

  for (let index = output.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
}

export function hashString(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function nextRandomState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
