import { expect, test, type Locator } from "@playwright/test";

test("plays one solo round by placing a Korea map pin and revealing a score", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();
  await page.getByLabel("닉네임").fill("지훈");
  await page.getByRole("button", { name: /제주/ }).click();
  await page.getByRole("button", { name: "시작" }).click();

  await expect(page.getByText("제주").first()).toBeVisible();
  await expect(page.getByLabel("라운드 정보")).toContainText("제주도 · 중");
  await expect(page.getByLabel("로드뷰 영역")).toBeVisible();
  await expect(page.getByRole("button", { name: /위치 찍기/ })).toBeDisabled();

  const map = page.locator(".app-shell").getByTestId("guess-map");

  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await expect(page.getByRole("button", { name: /위치 찍기/ })).toBeEnabled();

  await page.getByRole("button", { name: /위치 찍기/ }).click();

  await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();
  await expect(page.getByText(/오차/)).toBeVisible();
  await expect(page.locator(".answer-link")).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 라운드" })).toBeVisible();
});

test("starts the round timer only after the Korea map data has loaded", async ({
  page,
}) => {
  let releaseMapData: () => void = () => undefined;
  const mapDataReleased = new Promise<void>((resolve) => {
    releaseMapData = resolve;
  });

  await page.route("**/skorea_municipalities_geo_simple*.json", async (route) => {
    await mapDataReleased;
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "시작" }).click();

  await expect(page.getByLabel("라운드 정보")).toContainText("준비 중");
  await expect(page.getByText("지도 로딩 중")).toBeVisible();

  releaseMapData();

  await expect(page.locator(".app-shell").getByTestId("guess-map")).toBeVisible();
  await expect(page.getByLabel("라운드 정보")).toContainText("00:30");
});

test("uses the selected round timer for static solo play", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "60초" }).click();
  await page.getByRole("button", { name: "시작" }).click();

  await expect(page.locator(".app-shell").getByTestId("guess-map")).toBeVisible();
  await expect(page.getByLabel("라운드 정보")).toContainText("01:00");
  await expect(page.getByRole("button", { name: /위치 찍기/ })).toContainText("01:00");
});

test("warns when the active round is almost out of time", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-06-02T06:00:00.000Z") });
  await page.goto("/");

  await page.getByRole("button", { name: "시작" }).click();
  await expect(page.locator(".app-shell").getByTestId("guess-map")).toBeVisible();
  await expect(page.getByLabel("라운드 정보")).toContainText("00:30");

  await page.clock.fastForward(21_000);

  const timer = page.locator(".metric.timer");
  const submitButton = page.getByRole("button", { name: /위치 찍기/ });
  await expect(timer).toContainText("00:09");
  await expect(timer).toContainText("곧 끝나요");
  await expect(timer).toHaveClass(/urgent/);
  await expect(submitButton).toContainText("00:09");
  await expect(submitButton).toHaveClass(/urgent/);
  await expect(submitButton).toHaveCSS("--timer-progress", "70%");
});

test("supports static single-player when the Node API is unavailable", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "방 만들기" })).toBeDisabled();
  await page.getByRole("button", { name: "서울특별시" }).click();
  await page.getByRole("button", { name: "시작" }).click();

  await expect(page.getByLabel("로드뷰 영역")).toBeVisible();
  const map = page.getByTestId("guess-map");
  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await page.getByRole("button", { name: /위치 찍기/ }).click();

  await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();
  await expect(page.locator(".answer-link")).toBeVisible();
});

test("keeps the mobile map workflow usable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await page.getByRole("button", { name: "시작" }).click();
  await expect(page.locator(".app-shell").getByTestId("guess-map")).toBeVisible();
  await expect(page.getByRole("button", { name: /위치 찍기/ })).toBeVisible();
});

test("shows final round statistics without roadview or map after the last round", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작" }).click();

  for (let round = 1; round <= 5; round += 1) {
    await placeGuess(page);
    await page.getByRole("button", { name: /위치 찍기/ }).click();
    await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();

    if (round < 5) {
      await page.getByRole("button", { name: "다음 라운드" }).click();
      await expect(page.getByRole("button", { name: /위치 찍기/ })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "최종 결과" }).click();
    }
  }

  await expect(page.getByRole("heading", { name: "최종 결과" })).toBeVisible();
  await expect(page.getByLabel("라운드별 결과").locator(".round-result-row")).toHaveCount(5);
  await expect(page.getByText("평균 오차")).toBeVisible();
  await expect(page.getByText("최고 라운드")).toBeVisible();
  await expect(page.getByLabel("로드뷰 영역")).toHaveCount(0);
  await expect(page.getByTestId("guess-map")).toHaveCount(0);
});

test("lets friends compete in the same room with reveal rankings and final standings", async ({
  page,
  context,
}) => {
  await installFriendRoomApiMock(context);

  await page.goto("/");
  await page.getByLabel("닉네임").fill("지훈");
  await page.getByRole("button", { name: "방 만들기" }).click();

  const roomHeading = page.locator("h2", { hasText: /^KR-/ });
  await expect(roomHeading).toBeVisible();
  const roomCode = (await roomHeading.textContent()) ?? "";

  const friend = await context.newPage();
  await friend.goto(`/?room=${roomCode}`);
  await friend.getByLabel("닉네임").fill("하린");
  await friend.getByRole("button", { name: "입장" }).click();
  await expect(friend.locator("h2", { hasText: roomCode })).toBeVisible();

  await page.getByRole("button", { name: "시작" }).click();
  await expect(page.getByText("핀 찍기")).toBeVisible();
  await expect(friend.getByText("핀 찍기")).toBeVisible();

  await placeGuess(page);
  await page.getByRole("button", { name: /위치 찍기/ }).click();
  await expect(page.getByRole("button", { name: "정답 공개" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /제출 완료/ })).toContainText("1/2");
  await expect(page.getByLabel("제출 현황")).toHaveText("1/2");
  await expect(page.locator(".peer-guess-marker")).toHaveCount(0);
  await expect(page.getByLabel("라운드 순위")).toHaveCount(0);

  await placeGuess(friend);
  await friend.getByRole("button", { name: /위치 찍기/ }).click();

  await expect(page.getByText("정답 공개")).toBeVisible();
  await expect(page.locator(".target-marker")).toBeVisible();
  await expect(page.locator(".peer-guess-marker")).toBeVisible();
  await expect(page.getByLabel("라운드 순위")).toContainText("하린");
  await expect(page.getByLabel("라운드 순위")).toContainText("80 m");
  await expect(page.locator(".peer-rank-badge")).toBeVisible();

  await page.getByRole("button", { name: "최종 결과" }).click();

  await expect(page.getByRole("heading", { name: "친구방 최종 결과" })).toBeVisible();
  await expect(page.getByText("하린 승리")).toBeVisible();
  await expect(page.locator(".winner-crown")).toBeVisible();
  await expect(page.locator(".confetti-piece")).toHaveCount(18);
  await expect(page.getByLabel("최종 순위")).toContainText("하린");
  await expect(page.getByLabel("라운드별 점수")).toContainText("R1");
  await expect(page.getByTestId("guess-map")).toHaveCount(0);
});

async function installFriendRoomApiMock(
  context: import("@playwright/test").BrowserContext,
) {
  const roomCode = "KR-4821";
  const hostId = "player-host";
  const guestId = "player-guest";
  const target = {
    id: "mock-seoul-1",
    title: "서울 테스트 생활도로",
    lat: 37.5,
    lng: 127,
    region1: "서울",
    region2: "테스트구",
    tags: ["test"],
    difficulty: "medium",
    sourceType: "osm_derived",
  };
  const currentRound = {
    roundNumber: 1,
    seedId: target.id,
    regionHint: target.region1,
    mapId: "seoul",
    mapName: "서울특별시",
    difficulty: target.difficulty,
    tags: target.tags,
    roadviewTarget: { lat: target.lat, lng: target.lng },
    timerEndsAt: Date.now() + 30_000,
  };
  const hostGuess = { lat: 37.49, lng: 127.01 };
  const guestGuess = { lat: 37.5007, lng: 127.0002 };
  const revealGuesses = [
    {
      rank: 1,
      playerId: guestId,
      nickname: "하린",
      guess: guestGuess,
      distanceMeters: 80,
      score: 4990,
      totalScore: 4990,
    },
    {
      rank: 2,
      playerId: hostId,
      nickname: "지훈",
      guess: hostGuess,
      distanceMeters: 1400,
      score: 4300,
      totalScore: 4300,
    },
  ];
  let phase: "lobby" | "round_active" | "round_reveal" | "finished" = "lobby";
  const guessedPlayers = new Set<string>();

  function room() {
    const isReveal = phase === "round_reveal" || phase === "finished";
    return {
      roomCode,
      phase,
      mapId: "seoul",
      mapName: "서울특별시",
      difficultyMode: "normal",
      roundIndex: 0,
      roundCount: 1,
      timerSeconds: 30,
      players: [
        {
          playerId: hostId,
          nickname: "지훈",
          score: isReveal ? 4300 : 0,
          connected: true,
          isHost: true,
          hasGuessed: guessedPlayers.has(hostId),
        },
        {
          playerId: guestId,
          nickname: "하린",
          score: isReveal ? 4990 : 0,
          connected: true,
          isHost: false,
          hasGuessed: guessedPlayers.has(guestId),
        },
      ],
      currentRound: phase === "finished" ? null : currentRound,
      revealed: isReveal
        ? {
            roundNumber: 1,
            target,
            guesses: revealGuesses,
          }
        : null,
      roundHistory: isReveal
        ? [
            {
              roundNumber: 1,
              target,
              guesses: revealGuesses,
            },
          ]
        : [],
    };
  }

  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (method === "GET" && path === "/api/daily") {
      await route.fulfill({
        json: {
          id: "daily-2026-06-04",
          date: "2026-06-04",
          roundCount: 1,
          timerSeconds: 30,
          rounds: [currentRound],
        },
      });
      return;
    }

    if (method === "GET" && path === "/api/maps") {
      await route.fulfill({
        json: {
          maps: [
            {
              id: "kr-all",
              name: "전국",
              shortName: "전국",
              description: "전체 위치 풀",
              scope: "national",
              regions: [],
              featured: true,
              seedCount: 1,
            },
            {
              id: "seoul",
              name: "서울특별시",
              shortName: "서울",
              description: "서울 테스트 지도",
              scope: "city",
              regions: ["서울"],
              featured: true,
              seedCount: 1,
            },
          ],
        },
      });
      return;
    }

    if (method === "GET" && path === "/api/leaderboard") {
      await route.fulfill({ json: { entries: [] } });
      return;
    }

    if (method === "POST" && path === "/api/rooms") {
      phase = "lobby";
      guessedPlayers.clear();
      await route.fulfill({ status: 201, json: { playerId: hostId, room: room() } });
      return;
    }

    if (method === "POST" && path === `/api/rooms/${roomCode}/join`) {
      await route.fulfill({ json: { playerId: guestId, room: room() } });
      return;
    }

    if (method === "GET" && path === `/api/rooms/${roomCode}`) {
      await route.fulfill({ json: { room: room() } });
      return;
    }

    if (method === "POST" && path === `/api/rooms/${roomCode}/start`) {
      phase = "round_active";
      await route.fulfill({ json: { room: room() } });
      return;
    }

    if (method === "POST" && path === `/api/rooms/${roomCode}/guess`) {
      const body = route.request().postDataJSON() as { playerId: string };
      guessedPlayers.add(body.playerId);
      if (guessedPlayers.size >= 2) {
        phase = "round_reveal";
      }
      await route.fulfill({ json: { room: room() } });
      return;
    }

    if (method === "POST" && path === `/api/rooms/${roomCode}/next`) {
      phase = "finished";
      await route.fulfill({ json: { room: room() } });
      return;
    }

    await route.fulfill({ status: 404, json: { error: "Unhandled mocked API" } });
  });
}

async function placeGuess(page: import("@playwright/test").Page) {
  const map = page.locator(".app-shell").getByTestId("guess-map");
  await map.click({ position: await findVisibleMapRelativePoint(map) });
}

async function findVisibleMapRelativePoint(map: Locator) {
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect
    .poll(async () => (await map.locator(".map-region").first().boundingBox())?.width ?? 0)
    .toBeGreaterThan(0);

  const point = await map.evaluate((svgElement) => {
    const svg = svgElement as SVGSVGElement;
    const paths = [...svg.querySelectorAll<SVGPathElement>(".map-region")];

    for (const path of paths) {
      const box = path.getBBox();
      if (box.width <= 0 || box.height <= 0) {
        continue;
      }

      for (const xRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        for (const yRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
          const svgPoint = new DOMPoint(
            box.x + box.width * xRatio,
            box.y + box.height * yRatio,
          );
          if (path.isPointInFill(svgPoint)) {
            const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM() ?? new DOMMatrix());
            return { x: screenPoint.x, y: screenPoint.y };
          }
        }
      }
    }

    throw new Error("No visible map point found");
  });
  const box = await map.boundingBox();
  expect(box).not.toBeNull();

  return {
    x: point.x - box!.x,
    y: point.y - box!.y,
  };
}
