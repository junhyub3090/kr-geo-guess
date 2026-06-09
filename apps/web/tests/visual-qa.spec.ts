import { expect, test, type Locator } from "@playwright/test";

const MAP_PICKER_LABELS = [
  "전국",
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기도",
  "강원도",
  "충청북도",
  "충청남도",
  "경상북도",
  "경상남도",
  "전라북도",
  "전라남도",
  "제주도",
];

test("desktop layout has no horizontal overflow and keeps primary controls visible", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "시작", exact: true })).not.toContainText("/");
  await expect(page.getByRole("heading", { name: "데일리 챌린지" })).toBeVisible();
  await expect(page.locator(".leaderboard-empty")).toHaveText("아직 기록 없음");
  await expect(page.locator(".placeholder-row")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("더미");
  await page.screenshot({
    path: testInfo.outputPath("home-desktop-qa.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByLabel("로드뷰 영역")).toBeVisible();
  await expect(page.locator(".app-shell").getByTestId("guess-map")).toBeVisible();
  await expect(page.getByRole("button", { name: /위치 찍기/ })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: testInfo.outputPath("desktop-qa.png"),
    fullPage: true,
  });
});

test("home presents a complete game service hub", async ({ page }) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "서비스 내비게이션" });
  await expect(navigation.getByRole("link", { name: "플레이" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "맵" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "친구방" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "랭킹" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "제보" })).toBeVisible();

  await expect(page.getByText("한국 골목을 맞혀보세요")).toHaveCount(0);
  await expect(page.getByText("실제 거리뷰를 보고 위치를 추측하세요.")).toHaveCount(0);
  await expect(page.getByText("혼자 기록을 남기거나 친구방에서 같은 라운드를 두고 겨룰 수 있습니다.")).toHaveCount(0);
  await expect(page.getByLabel("현재 게임 설정")).toContainText("맵");
  await expect(page.getByLabel("현재 게임 설정")).toContainText("난이도");
  await expect(page.getByLabel("현재 게임 설정")).toContainText("제한 시간");
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "친구방 새로 만들기" })).toBeVisible();
  await expect(page.getByLabel("게임 시작")).toBeVisible();
  await expect(page.getByLabel("맵 선택")).toBeVisible();
  await expect(page.getByLabel("친구방")).toBeVisible();
  await expect(page.getByLabel("통합 랭킹")).toBeVisible();
  await expect(page.getByLabel("마음의 소리함")).toBeVisible();

  await navigation.getByRole("link", { name: "맵" }).click();
  await expect(page).toHaveURL(/#maps$/);

  const activeNavStyle = await navigation.getByRole("link", { name: "플레이" }).evaluate(
    (element) => {
      element.focus();
      const style = window.getComputedStyle(element);

      return {
        boxShadow: style.boxShadow,
        transform: style.transform,
      };
    },
  );
  expect(activeNavStyle).toEqual({ boxShadow: "none", transform: "none" });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("compact desktop home keeps the map preview and start button inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible();

  const layout = await page.evaluate(() => {
    const header = document.querySelector(".home-header")?.getBoundingClientRect();
    const homeGrid = document.querySelector(".home-grid")?.getBoundingClientRect();
    const startPanel = document.querySelector(".start-panel")?.getBoundingClientRect();
    const mapArt = document.querySelector(".map-art")?.getBoundingClientRect();
    const playButton = document.querySelector(".play-button")?.getBoundingClientRect();

    if (!header || !homeGrid || !startPanel || !mapArt || !playButton) {
      throw new Error("Home layout elements are missing");
    }

    return {
      viewportHeight: window.innerHeight,
      headerTop: header.top,
      headerHeight: header.height,
      homeGridTop: homeGrid.top,
      gapAfterHeader: homeGrid.top - header.bottom,
      startPanelTop: startPanel.top,
      mapArtTop: mapArt.top,
      playButtonBottom: playButton.bottom,
      horizontalOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(layout.headerTop).toBeLessThanOrEqual(10);
  expect(layout.headerHeight).toBeLessThanOrEqual(46);
  expect(layout.gapAfterHeader).toBeLessThanOrEqual(12);
  expect(layout.homeGridTop).toBeLessThanOrEqual(64);
  expect(layout.mapArtTop).toBeGreaterThanOrEqual(layout.startPanelTop);
  expect(layout.playButtonBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
});

test("home behaves like a focused game hub and remembers the last selected map", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout contract");

  await page.goto("/");

  const primaryHub = page.locator(".home-hub-primary");
  const mapArt = page.locator(".map-art");
  const startButton = page.getByRole("button", { name: "시작", exact: true });
  const secondaryRail = page.locator(".home-action-rail");

  await expect(primaryHub).toBeVisible();
  await expect(startButton).toBeVisible();
  await expect(secondaryRail).toBeVisible();

  const layout = await page.evaluate(() => {
    const primary = document.querySelector(".home-hub-primary")?.getBoundingClientRect();
    const map = document.querySelector(".map-art")?.getBoundingClientRect();
    const start = document.querySelector(".home-start-button")?.getBoundingClientRect();
    const rail = document.querySelector(".home-action-rail")?.getBoundingClientRect();

    if (!primary || !map || !start || !rail) {
      throw new Error("Home hub elements are missing");
    }

    return {
      mapArea: map.width * map.height,
      startTop: start.top,
      startBottom: start.bottom,
      mapBottom: map.bottom,
      primaryBottom: primary.bottom,
      primaryWidth: primary.width,
      railWidth: rail.width,
      railTop: rail.top,
      primaryTop: primary.top,
    };
  });

  expect(layout.mapArea).toBeGreaterThan(160_000);
  expect(layout.startTop).toBeLessThanOrEqual(layout.mapBottom);
  expect(layout.startBottom).toBeLessThanOrEqual(layout.primaryBottom);
  expect(layout.primaryWidth).toBeGreaterThan(layout.railWidth);
  expect(layout.railTop).toBeGreaterThanOrEqual(layout.primaryTop);

  await page.getByRole("button", { name: "제주도" }).click();
  await expect(page.locator(".map-showcase-caption strong")).toHaveText("제주도");
  await page.reload();
  await expect(page.locator(".map-showcase-caption strong")).toHaveText("제주도");
});

test("home falls back cleanly when the persisted map id is stale", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout contract");

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "kr-geo-guess:last-map-id:v1",
      "removed-map-id",
    );
  });
  await page.goto("/");

  await expect(page.locator(".map-showcase-caption strong")).toHaveText("전국");
  await expect(page.getByRole("button", { name: "전국" })).toHaveClass(/selected/);
});

test("home leaderboard shows local solo scores by selected difficulty", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "kr-geo-guess:solo-leaderboard:v1",
      JSON.stringify([
        {
          id: "hard-1",
          nickname: "하드왕",
          totalScore: 21000,
          difficultyMode: "hard",
          mapName: "전국",
          completedAt: "2026-06-02T06:00:00.000Z",
        },
        {
          id: "easy-1",
          nickname: "이지왕",
          totalScore: 19000,
          difficultyMode: "easy",
          mapName: "제주도",
          completedAt: "2026-06-02T06:01:00.000Z",
        },
      ]),
    );
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "통합 랭킹" })).toBeVisible();
  const rankingTabs = page.getByLabel("랭킹 난이도");
  await expect(rankingTabs.getByRole("button", { name: "중" })).toHaveClass(/selected/);
  await expect(page.locator(".leaderboard-empty")).toHaveText("아직 기록 없음");

  await rankingTabs.getByRole("button", { name: "상" }).click();
  await expect(page.locator(".leaderboard-row").first()).toContainText("하드왕");
  await expect(page.locator(".leaderboard-row").first()).toContainText("21,000점");
  await expect(page.getByLabel("내 최고 기록")).toContainText("21,000점");
  await expect(page.getByLabel("내 최고 기록")).toContainText("전국 · 상");

  await rankingTabs.getByRole("button", { name: "하" }).click();
  await expect(page.locator(".leaderboard-row").first()).toContainText("이지왕");
  await expect(page.locator(".leaderboard-row").first()).toContainText("19,000점");
  await expect(page.getByLabel("내 최고 기록")).toContainText("기록 없음");
  await expect(page.getByLabel("내 최고 기록")).toContainText("전국 · 하");
});

test("home ranking filters by game mode and shows the current personal best", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "kr-geo-guess:solo-leaderboard:v1",
      JSON.stringify([
        {
          id: "solo-normal",
          nickname: "솔로왕",
          totalScore: 21500,
          difficultyMode: "normal",
          mapName: "전국",
          completedAt: "2026-06-02T06:00:00.000Z",
          gameMode: "solo",
        },
        {
          id: "room-normal",
          nickname: "방친구",
          totalScore: 19800,
          difficultyMode: "normal",
          mapName: "전국",
          completedAt: "2026-06-02T06:01:00.000Z",
          gameMode: "room",
        },
      ]),
    );
  });

  await page.goto("/");

  await expect(page.getByLabel("내 최고 기록")).toContainText("21,500점");
  await expect(page.getByLabel("내 최고 기록")).toContainText("전국");

  const modeTabs = page.getByLabel("랭킹 모드");
  await expect(modeTabs.getByRole("button", { name: "전체" })).toHaveClass(/selected/);
  await expect(page.locator(".leaderboard-row")).toHaveCount(2);

  await modeTabs.getByRole("button", { name: "친구방" }).click();
  await expect(page.locator(".leaderboard-row")).toHaveCount(1);
  await expect(page.locator(".leaderboard-row").first()).toContainText("방친구");
  await expect(page.locator(".leaderboard-row").first()).toContainText("친구방");

  await modeTabs.getByRole("button", { name: "싱글" }).click();
  await expect(page.locator(".leaderboard-row")).toHaveCount(1);
  await expect(page.locator(".leaderboard-row").first()).toContainText("솔로왕");
  await expect(page.locator(".leaderboard-row").first()).toContainText("싱글");
});

test("home personal best ignores higher shared leaderboard scores", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "kr-geo-guess:solo-leaderboard:v1",
      JSON.stringify([
        {
          id: "local-normal",
          nickname: "내기록",
          totalScore: 12000,
          difficultyMode: "normal",
          mapName: "전국",
          completedAt: "2026-06-02T06:00:00.000Z",
          gameMode: "solo",
        },
      ]),
    );
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (method === "GET" && path === "/api/daily") {
      await route.fulfill({
        json: {
          id: "daily-2026-06-10",
          date: "2026-06-10",
          roundCount: 5,
          timerSeconds: 30,
          rounds: [],
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
              seedCount: 1000,
            },
          ],
        },
      });
      return;
    }

    if (method === "GET" && path === "/api/leaderboard") {
      await route.fulfill({
        json: {
          entries: [
            {
              rank: 1,
              playerId: "shared-high",
              nickname: "서버왕",
              totalScore: 25000,
              totalDistanceMeters: 1000,
              totalTimeSeconds: 50,
              difficultyMode: "normal",
              mapName: "전국",
              gameMode: "solo",
            },
          ],
        },
      });
      return;
    }

    await route.fulfill({ status: 404, json: { error: "Unhandled mocked API" } });
  });

  await page.goto("/");

  await expect(page.locator(".leaderboard-row").first()).toContainText("서버왕");
  await expect(page.locator(".leaderboard-row").first()).toContainText("25,000점");
  await expect(page.getByLabel("내 최고 기록")).toContainText("12,000점");
  await expect(page.getByLabel("내 최고 기록")).not.toContainText("25,000점");
});

test("home ranking area stays stable across difficulty filters", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "kr-geo-guess:solo-leaderboard:v1",
      JSON.stringify([
        {
          id: "hard-1",
          nickname: "Hard Player",
          totalScore: 21000,
          difficultyMode: "hard",
          mapName: "Seoul",
          completedAt: "2026-06-02T06:00:00.000Z",
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          id: `easy-${index + 1}`,
          nickname: `Easy Player ${index + 1}`,
          totalScore: 19000 - index * 100,
          difficultyMode: "easy",
          mapName: "Jeju",
          completedAt: `2026-06-02T06:${String(index + 1).padStart(2, "0")}:00.000Z`,
        })),
      ]),
    );
  });

  await page.goto("/");

  const currentMapSummaryStyle = await page.locator(".map-facts span").first().evaluate(
    (element) => {
      const style = window.getComputedStyle(element);

      return {
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        transform: style.transform,
      };
    },
  );
  expect(currentMapSummaryStyle).toEqual({
    backgroundImage: "none",
    boxShadow: "none",
    transform: "none",
  });

  const leaderboardList = page.locator(".leaderboard-preview .leaderboard-list");
  const tabs = page.locator(".leaderboard-tab");
  await expect(tabs).toHaveCount(3);

  const emptyHeight = await leaderboardList.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  await tabs.nth(2).click();
  await expect(page.locator(".leaderboard-row")).toHaveCount(1);
  const singleRowHeight = await leaderboardList.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  const leaderboardRowStyle = await page.locator(".leaderboard-row").first().evaluate(
    (element) => {
      const style = window.getComputedStyle(element);

      return {
        boxShadow: style.boxShadow,
        transform: style.transform,
      };
    },
  );
  expect(leaderboardRowStyle).toEqual({ boxShadow: "none", transform: "none" });

  await tabs.nth(0).click();
  await expect(page.locator(".leaderboard-row")).toHaveCount(5);
  const fullHeight = await leaderboardList.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  expect(Math.abs(singleRowHeight - emptyHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(fullHeight - emptyHeight)).toBeLessThanOrEqual(1);
});

test("home leaderboard celebrates top five integrated scores", async ({ page }) => {
  await page.addInitScript(() => {
    const entries = Array.from({ length: 11 }, (_, index) => ({
      id: `entry-${index + 1}`,
      nickname: `Player ${String(index + 1).padStart(2, "0")}`,
      totalScore: 25000 - index * 100,
      difficultyMode: "normal",
      mapName: "Seoul",
      completedAt: `2026-06-02T06:${String(index).padStart(2, "0")}:00.000Z`,
      gameMode: index === 0 ? "room" : "solo",
    }));

    window.localStorage.setItem(
      "kr-geo-guess:solo-leaderboard:v1",
      JSON.stringify(entries),
    );
  });

  await page.goto("/");

  const rows = page.locator(".leaderboard-row");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toHaveClass(/leaderboard-row--champion/);
  await expect(
    rows.first().locator("[data-testid='leaderboard-rank-icon']"),
  ).toHaveCount(1);
  await expect(rows.first().locator(".leaderboard-mode-chip")).toHaveAttribute(
    "data-mode",
    "room",
  );
  await expect(rows.nth(4)).toContainText("Player 05");
  await expect(
    page.locator(".leaderboard-row", { hasText: "Player 06" }),
  ).toHaveCount(0);
});

test("home feedback box submits player reports", async ({ page }) => {
  let feedbackPayload: unknown = null;

  await page.route("**/api/feedback", async (route) => {
    feedbackPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        feedback: {
          id: "feedback-test",
          nickname: "지훈",
          message: "방 만들기가 안 됩니다.",
          createdAt: "2026-06-04T00:00:00.000Z",
        },
      },
    });
  });

  await page.goto("/");

  await page.locator(".feedback-panel textarea").fill("방 만들기가 안 됩니다.");
  await page.getByRole("button", { name: "제보 보내기" }).click();

  expect(feedbackPayload).toEqual(
    expect.objectContaining({
      message: "방 만들기가 안 됩니다.",
    }),
  );
  await expect(page.locator(".feedback-status")).toHaveText("제보 고맙습니다");
});

test("map picker hides pool counts and focuses the selected region map", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "서울" })).toBeVisible();

  const homeText = await page.locator("body").innerText();
  for (const label of MAP_PICKER_LABELS) {
    expect(homeText).toContain(label);
  }
  expect(homeText).not.toMatch(/\d[\d,]*\s*(개 위치|곳)/);
  expect(homeText).not.toContain("공식 SDK 사용");

  const previewMap = page.getByTestId("guess-map");
  const fullViewBox = await previewMap.getAttribute("viewBox");
  await expect(previewMap.getByTestId("seoul-han-river")).toHaveCount(0);

  const seoulMapButton = page.getByRole("button", { name: "서울" });
  await expect(seoulMapButton).not.toHaveAttribute("title", /.+/);
  await seoulMapButton.hover();
  await expect(page.locator(".map-showcase-caption strong")).toHaveText("서울", {
    timeout: 250,
  });
  await expect(page.locator(".map-showcase-caption")).toContainText("서울");
  await expect(page.locator(".map-showcase-caption")).not.toContainText(/곳/);
  await expect(page.locator(".map-showcase-caption")).not.toContainText("플레이 가능");

  await page.getByRole("button", { name: "서울" }).click();
  await page.waitForTimeout(150);
  const seoulViewBox = await previewMap.getAttribute("viewBox");
  await expect(previewMap.getByTestId("seoul-han-river")).toBeVisible();

  await page.getByRole("button", { name: "전라남도" }).click();
  await page.waitForTimeout(150);
  const jeonnamViewBox = await previewMap.getAttribute("viewBox");
  await expect(previewMap.getByTestId("seoul-han-river")).toHaveCount(0);

  expect(fullViewBox).toBe("0 0 524 631");
  expect(seoulViewBox).not.toBe(fullViewBox);
  expect(jeonnamViewBox).not.toBe(fullViewBox);
  expect(jeonnamViewBox).not.toBe(seoulViewBox);

  await page.screenshot({
    path: testInfo.outputPath("region-picker-qa.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "시작", exact: true }).click();
  await expect(page.getByText("전라남도").first()).toBeVisible();
  await page.waitForTimeout(150);
  const gameMap = page.locator(".app-shell").getByTestId("guess-map");
  expect(await gameMap.getAttribute("viewBox")).toBe(jeonnamViewBox);

  const submit = page.getByRole("button", { name: /위치 찍기/ });
  const mapBox = await gameMap.boundingBox();
  expect(mapBox).not.toBeNull();
  await gameMap.click({ position: { x: 5, y: 5 } });
  await expect(submit).toBeDisabled();
  const insidePoint = await findVisibleMapRelativePoint(gameMap);
  await gameMap.click({ position: insidePoint });
  await expect(submit).toBeEnabled();
});

test("desktop map picker lays out choices in three balanced rows", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout contract");

  await page.goto("/");

  const choices = page.locator(".map-choice-grid .map-choice");
  await expect(choices).toHaveCount(18);
  await expect(choices.locator("strong")).toHaveText(MAP_PICKER_LABELS);

  const rowTops = await choices.evaluateAll((buttons) => {
    const roundedTops = buttons.map((button) =>
      Math.round(button.getBoundingClientRect().top),
    );
    return [...new Set(roundedTops)].sort((a, b) => a - b);
  });
  expect(rowTops).toHaveLength(3);

  const rowCounts = await choices.evaluateAll((buttons) => {
    const rows = new Map<number, number>();
    for (const button of buttons) {
      const top = Math.round(button.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    return [...rows.values()].sort((a, b) => b - a);
  });
  expect(rowCounts).toEqual([6, 6, 6]);
});

test("national and Gyeongbuk maps mark Dokdo", async ({ page }) => {
  await page.goto("/");

  const previewMap = page.locator(".map-art").getByTestId("guess-map");
  await expect(previewMap.getByTestId("dokdo-landmark")).toBeVisible();
  await expect(previewMap.locator(".dokdo-landmark text")).toHaveCount(0);
  await expect(previewMap.getByTestId("dokdo-dongdo-islet")).toBeVisible();
  await expect(previewMap.getByTestId("dokdo-seodo-islet")).toBeVisible();

  const dokdoLayout = await previewMap.evaluate((svg) => {
    const getCenter = (testId: string) => {
      const element = svg.querySelector<SVGEllipseElement>(
        `[data-testid="${testId}"]`,
      );
      if (!element) {
        throw new Error(`${testId} missing`);
      }

      const point = new DOMPoint(
        Number(element.getAttribute("cx")),
        Number(element.getAttribute("cy")),
      ).matrixTransform(element.getCTM() ?? new DOMMatrix());
      return { x: point.x, y: point.y };
    };

    return {
      dongdo: getCenter("dokdo-dongdo-islet"),
      seodo: getCenter("dokdo-seodo-islet"),
    };
  });

  expect(dokdoLayout.dongdo.x).toBeGreaterThan(dokdoLayout.seodo.x);
  expect(dokdoLayout.dongdo.y).toBeGreaterThan(dokdoLayout.seodo.y);

  await page.getByRole("button", { name: "경상북도" }).click();
  await expect(previewMap.getByTestId("dokdo-landmark")).toBeVisible();

  await page.getByRole("button", { name: "경상남도" }).click();
  await expect(previewMap.getByTestId("dokdo-landmark")).toHaveCount(0);
});

test("guess marker lands on the exact visible map point that was clicked", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map).toBeVisible();
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect
    .poll(async () => (await map.boundingBox())?.width ?? 0)
    .toBeGreaterThan(100);

  const clickPoint = await findVisibleMapViewportPoint(map);

  await page.mouse.click(clickPoint.x, clickPoint.y);

  const markerPoint = await map.locator(".guess-marker").evaluate((marker) => {
    const screenPoint = new DOMPoint(0, 0).matrixTransform(
      (marker as SVGGElement).getScreenCTM() ?? new DOMMatrix(),
    );
    return { x: screenPoint.x, y: screenPoint.y };
  });

  expect(Math.abs(markerPoint.x - clickPoint.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(markerPoint.y - clickPoint.y)).toBeLessThanOrEqual(4);
  await expect(map.locator(".guess-marker-halo")).toBeVisible();
  await expect(map.locator(".guess-marker-core")).toBeVisible();
});

test("guess map wheel zoom keeps pin placement precise", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only pointer precision contract");

  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map).toBeVisible();

  const initialViewBox = parseViewBox(await map.getAttribute("viewBox"));
  const zoomAnchor = await findVisibleMapViewportPoint(map);

  await page.mouse.move(zoomAnchor.x, zoomAnchor.y);
  await page.mouse.wheel(0, -700);

  await expect
    .poll(async () => parseViewBox(await map.getAttribute("viewBox")).width)
    .toBeLessThan(initialViewBox.width);

  const clickPoint = await findVisibleMapViewportPoint(map);
  await page.mouse.click(clickPoint.x, clickPoint.y);

  const markerPoint = await getGuessMarkerViewportPoint(map);
  expect(Math.abs(markerPoint.x - clickPoint.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(markerPoint.y - clickPoint.y)).toBeLessThanOrEqual(4);
});

test("guess map controls zoom, pan, and reset without accidental guesses", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only pointer precision contract");

  await page.goto("/");
  await page.getByRole("button", { name: "서울" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map).toBeVisible();

  const initialViewBox = parseViewBox(await map.getAttribute("viewBox"));
  await page.getByRole("button", { name: "지도 확대" }).click();
  await page.getByRole("button", { name: "지도 확대" }).click();

  const zoomedViewBox = parseViewBox(await map.getAttribute("viewBox"));
  expect(zoomedViewBox.width).toBeLessThan(initialViewBox.width);
  expect(zoomedViewBox.height).toBeLessThan(initialViewBox.height);

  const dragStart = await findVisibleMapViewportPoint(map);
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 70, dragStart.y + 36, { steps: 5 });
  await page.mouse.up();

  const pannedViewBox = parseViewBox(await map.getAttribute("viewBox"));
  const panDelta =
    Math.abs(pannedViewBox.x - zoomedViewBox.x) +
    Math.abs(pannedViewBox.y - zoomedViewBox.y);
  expect(panDelta).toBeGreaterThan(1);
  await expect(map.locator(".guess-marker")).toHaveCount(0);

  await page.getByRole("button", { name: "지도 초기화" }).click();
  const resetViewBox = parseViewBox(await map.getAttribute("viewBox"));
  expect(resetViewBox.x).toBeCloseTo(initialViewBox.x, 2);
  expect(resetViewBox.y).toBeCloseTo(initialViewBox.y, 2);
  expect(resetViewBox.width).toBeCloseTo(initialViewBox.width, 2);
  expect(resetViewBox.height).toBeCloseTo(initialViewBox.height, 2);
});

test("guess map resets zoom for each new solo round", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only round transition contract");

  await page.goto("/");
  await page.getByRole("button", { name: "서울" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map).toBeVisible();

  const initialViewBox = parseViewBox(await map.getAttribute("viewBox"));
  await page.getByRole("button", { name: "지도 확대" }).click();
  await page.getByRole("button", { name: "지도 확대" }).click();

  const zoomedViewBox = parseViewBox(await map.getAttribute("viewBox"));
  expect(zoomedViewBox.width).toBeLessThan(initialViewBox.width);
  expect(zoomedViewBox.height).toBeLessThan(initialViewBox.height);

  const dragStart = await findVisibleMapViewportPoint(map);
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 70, dragStart.y + 36, { steps: 5 });
  await page.mouse.up();

  const pannedViewBox = parseViewBox(await map.getAttribute("viewBox"));
  const panDelta =
    Math.abs(pannedViewBox.x - zoomedViewBox.x) +
    Math.abs(pannedViewBox.y - zoomedViewBox.y);
  expect(panDelta).toBeGreaterThan(1);

  const clickPoint = await findVisibleMapViewportPoint(map);
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await page.getByRole("button", { name: /위치 찍기/ }).click();

  await expect(page.getByRole("heading", { name: "결과 확인" })).toBeVisible();
  await page.getByRole("button", { name: "다음 라운드" }).click();
  await expect(page.getByRole("heading", { name: "지도에 핀 찍기" })).toBeVisible();

  const nextRoundViewBox = parseViewBox(await map.getAttribute("viewBox"));
  expect(nextRoundViewBox.x).toBeCloseTo(initialViewBox.x, 2);
  expect(nextRoundViewBox.y).toBeCloseTo(initialViewBox.y, 2);
  expect(nextRoundViewBox.width).toBeCloseTo(initialViewBox.width, 2);
  expect(nextRoundViewBox.height).toBeCloseTo(initialViewBox.height, 2);
  await expect(page.getByRole("button", { name: "지도 축소" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "지도 확대" })).toBeEnabled();
});

test("game map hover names the visible municipality outside Seoul", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  const hoverPoint = await findVisibleMapViewportPoint(map);
  await page.mouse.move(hoverPoint.x, hoverPoint.y);

  const tooltip = page.getByTestId("map-hover-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator("text")).not.toHaveText("");
});

test("national game map keeps province borders but hides region labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map.locator(".province-boundary").first()).toBeVisible();
  await expect(map.locator(".map-label")).toHaveCount(0);

  const boundaryRegions = await map
    .locator(".province-boundary")
    .evaluateAll((paths) =>
      paths.map((path) => path.getAttribute("data-boundary-regions") ?? ""),
    );
  expect(boundaryRegions.length).toBeGreaterThan(0);
  expect(boundaryRegions.some((region) => /부산|대구|인천|광주|대전|울산|세종/.test(region)))
    .toBe(true);
  await expect(map.getByTestId("dokdo-landmark")).toBeVisible();

  const strokeWidths = await map.evaluate((svg) => {
    const region = svg.querySelector<SVGPathElement>(".map-region-boundary");
    const boundary = svg.querySelector<SVGPathElement>(".province-boundary");
    const parseStrokeWidth = (element: SVGPathElement) => {
      const computed = Number.parseFloat(getComputedStyle(element).strokeWidth);
      if (Number.isFinite(computed)) {
        return computed;
      }

      const attribute = Number.parseFloat(element.getAttribute("stroke-width") ?? "");
      if (Number.isFinite(attribute)) {
        return attribute;
      }

      throw new Error("Stroke width is not numeric");
    };

    if (!region || !boundary) {
      throw new Error("Map stroke targets missing");
    }

    return {
      region: parseStrokeWidth(region),
      boundary: parseStrokeWidth(boundary),
    };
  });
  expect(strokeWidths.boundary - strokeWidths.region).toBeLessThanOrEqual(0.12);
});

test("Seoul game map draws district boundaries above fills so lines do not get covered", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "서울" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect(map.getByTestId("seoul-han-river")).toBeVisible();
  await expect(map.locator(".map-region-boundary").first()).toBeVisible();
  await expect(map.locator(".province-boundary")).toHaveCount(0);

  const layerOrder = await map.evaluate((svg) =>
    [...svg.children].map((child) => child.getAttribute("class") ?? child.tagName),
  );
  expect(layerOrder.indexOf("municipality-boundary-layer")).toBeGreaterThan(
    layerOrder.indexOf("province-layer"),
  );
  expect(layerOrder.indexOf("seoul-river-layer")).toBeGreaterThan(
    layerOrder.indexOf("province-layer"),
  );
  expect(layerOrder.indexOf("seoul-river-layer")).toBeLessThan(
    layerOrder.indexOf("municipality-boundary-layer"),
  );

  const counts = await map.evaluate((svg) => ({
    fills: svg.querySelectorAll(".map-region").length,
    boundaries: svg.querySelectorAll(".map-region-boundary").length,
    rivers: svg.querySelectorAll(".seoul-river-layer").length,
    riverSurfaces: svg.querySelectorAll(".seoul-han-river-surface").length,
    boundaryPointerEvents: getComputedStyle(
      svg.querySelector(".map-region-boundary") as Element,
    ).pointerEvents,
    riverPointerEvents: getComputedStyle(
      svg.querySelector(".seoul-river-layer") as Element,
    ).pointerEvents,
  }));
  expect(counts).toEqual({
    fills: 25,
    boundaries: 25,
    rivers: 1,
    riverSurfaces: 2,
    boundaryPointerEvents: "none",
    riverPointerEvents: "none",
  });
});

test("reveal map keeps result overlays minimal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await page.getByRole("button", { name: /위치 찍기/ }).click();

  await expect(page.getByRole("heading", { name: "결과 확인" })).toBeVisible();
  await expect(page.locator(".roadview-shell .reveal-ribbon")).toHaveCount(0);
  await expect(map.locator(".target-marker")).toBeVisible();
  await expect(map.locator(".guess-marker")).toBeVisible();
  await expect(map.locator(".answer-distance-label")).toBeVisible();
  await expect(map.locator(".answer-distance-pill")).toBeVisible();
  await expect(map.locator(".answer-line-halo")).toBeVisible();
  await expect(map.locator(".answer-line-core")).toBeVisible();
  await expect(map.locator(".target-marker text")).toHaveCount(0);
  await expect(map.locator(".guess-marker text")).toHaveCount(0);

  const answerLineWidth = await map
    .locator(".answer-line-core")
    .evaluate((line) => Number.parseFloat(getComputedStyle(line).strokeWidth));
  expect(answerLineWidth).toBeLessThanOrEqual(1.2);

  const distanceLabelOffset = await map.locator(".answer-distance-label").evaluate((label) => {
    const textBox = (label as SVGGraphicsElement).getBBox();
    const pill = label.parentElement?.querySelector(".answer-distance-pill") as
      | SVGGraphicsElement
      | null;

    if (!pill) {
      throw new Error("Distance pill not found");
    }

    const pillBox = pill.getBBox();
    const textCenter = textBox.y + textBox.height / 2;
    const pillCenter = pillBox.y + pillBox.height / 2;

    return Math.abs(textCenter - pillCenter);
  });
  expect(distanceLabelOffset).toBeLessThanOrEqual(1.8);
});

test("game map title shows selected map while the map itself has no region labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "경상남도" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  await expect(page.getByText("경상남도").first()).toBeVisible();
  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect(map.locator(".map-label")).toHaveCount(0);
});

test("desktop game surface gives the guess map a primary decision area", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout contract");

  await page.goto("/");
  await page.getByRole("button", { name: "서울" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const roadview = page.getByLabel("로드뷰 영역");
  const mapPanel = page.locator(".map-panel");
  const map = page.locator(".app-shell").getByTestId("guess-map");

  await expect(roadview).toBeVisible();
  await expect(map).toBeVisible();

  const layout = await page.evaluate(() => {
    const roadviewBox = document
      .querySelector('[aria-label="로드뷰 영역"]')
      ?.getBoundingClientRect();
    const mapPanelBox = document.querySelector(".map-panel")?.getBoundingClientRect();
    const mapBox = document
      .querySelector('.app-shell [data-testid="guess-map"]')
      ?.getBoundingClientRect();

    if (!roadviewBox || !mapPanelBox || !mapBox) {
      throw new Error("Game layout elements are missing");
    }

    return {
      roadviewWidth: roadviewBox.width,
      mapPanelWidth: mapPanelBox.width,
      mapHeight: mapBox.height,
      progressHeight:
        document.querySelector(".round-progress-track")?.getBoundingClientRect()
          .height ?? 0,
    };
  });

  expect(layout.mapPanelWidth).toBeGreaterThanOrEqual(480);
  expect(layout.roadviewWidth).toBeGreaterThan(layout.mapPanelWidth);
  expect(layout.roadviewWidth).toBeLessThan(layout.mapPanelWidth * 1.75);
  expect(layout.mapHeight).toBeGreaterThanOrEqual(360);
  expect(layout.progressHeight).toBeLessThanOrEqual(36);
});

test("game surface gives clear progress, timer, and pin feedback", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only interaction polish contract");

  await page.goto("/");
  await page.getByRole("button", { name: "서울" }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const progress = page.getByLabel("라운드 진행 상황");
  const map = page.locator(".app-shell").getByTestId("guess-map");
  const mapPanel = page.locator(".map-panel");
  const submit = page.getByRole("button", { name: /위치 찍기/ });

  await expect(progress).toBeVisible();
  await expect(progress).toContainText("라운드 1 / 5");
  await expect(progress).toContainText("이번 라운드 진행 중");
  await expect(progress.locator(".round-progress-dot")).toHaveCount(5);
  await expect(progress.locator(".round-progress-dot.current")).toHaveCount(1);
  await expect(progress.locator(".round-progress-dot.completed")).toHaveCount(0);
  await expect(page.locator(".metric.timer .metric-progress")).toBeVisible();
  await expect(mapPanel).not.toHaveClass(/has-guess/);
  await expect(mapPanel.locator(".guess-ready-chip")).toHaveText("지도에서 선택");
  await expect(submit).not.toHaveClass(/ready/);

  const actionLayout = await page.evaluate(() => {
    const mapBox = document
      .querySelector('.app-shell [data-testid="guess-map"]')
      ?.getBoundingClientRect();
    const submitBox = document
      .querySelector(".map-panel .submit-button")
      ?.getBoundingClientRect();

    if (!mapBox || !submitBox) {
      throw new Error("Map action elements are missing");
    }

    return {
      gap: submitBox.top - mapBox.bottom,
      submitHeight: submitBox.height,
      submitWidth: submitBox.width,
      mapWidth: mapBox.width,
    };
  });
  expect(actionLayout.gap).toBeLessThanOrEqual(16);
  expect(actionLayout.submitHeight).toBeGreaterThanOrEqual(50);
  expect(actionLayout.submitWidth).toBeGreaterThanOrEqual(actionLayout.mapWidth * 0.94);

  await map.click({ position: await findVisibleMapRelativePoint(map) });

  await expect(mapPanel).toHaveClass(/has-guess/);
  await expect(mapPanel.locator(".guess-ready-chip")).toHaveText("핀 선택됨");
  await expect(submit).toHaveClass(/ready/);
  await expect(map.locator(".guess-marker")).toHaveCount(1);
  const readySubmitStyle = await submit.evaluate((element) => {
    const style = window.getComputedStyle(element);

    return {
      boxShadow: style.boxShadow,
      transform: style.transform,
    };
  });
  expect(readySubmitStyle).toEqual({ boxShadow: "none", transform: "none" });

  await submit.click();

  await expect(page.getByRole("heading", { name: "결과 확인" })).toBeVisible();
  await expect(progress).toContainText("완료 1개");
  await expect(progress.locator(".round-progress-dot.completed")).toHaveCount(1);
});

async function findVisibleMapRelativePoint(map: Locator) {
  const point = await findVisibleMapViewportPoint(map);
  const box = await map.boundingBox();

  if (!box) {
    throw new Error("Map box is not available");
  }

  return {
    x: point.x - box.x,
    y: point.y - box.y,
  };
}

function parseViewBox(value: string | null) {
  if (!value) {
    throw new Error("Map viewBox is missing");
  }

  const [x, y, width, height] = value.split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite)) {
    throw new Error(`Invalid map viewBox: ${value}`);
  }

  return { x, y, width, height };
}

async function getGuessMarkerViewportPoint(map: Locator) {
  return map.locator(".guess-marker").evaluate((marker) => {
    const screenPoint = new DOMPoint(0, 0).matrixTransform(
      (marker as SVGGElement).getScreenCTM() ?? new DOMMatrix(),
    );
    return { x: screenPoint.x, y: screenPoint.y };
  });
}

async function findVisibleMapViewportPoint(map: Locator) {
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect
    .poll(async () => {
      const firstRegionBox = await map.locator(".map-region").first().boundingBox();
      return firstRegionBox?.width ?? 0;
    })
    .toBeGreaterThan(0);

  return map.evaluate((svgElement) => {
    const svg = svgElement as SVGSVGElement;
    const viewportBox = svg.getBoundingClientRect();
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
            const screenPoint = svgPoint.matrixTransform(
              svg.getScreenCTM() ?? new DOMMatrix(),
            );
            if (
              screenPoint.x < viewportBox.left ||
              screenPoint.x > viewportBox.right ||
              screenPoint.y < viewportBox.top ||
              screenPoint.y > viewportBox.bottom
            ) {
              continue;
            }
            return { x: screenPoint.x, y: screenPoint.y };
          }
        }
      }
    }

    throw new Error("No visible fill point found");
  });
}

test("mobile layout stacks roadview, map, and submit flow without clipping", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "시작", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  const submit = page.getByRole("button", { name: /위치 찍기/ });
  const map = page.locator(".app-shell").getByTestId("guess-map");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(map).toBeVisible();
  await expect(submit).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const mapBox = await map.boundingBox();
  const submitBox = await submit.boundingBox();

  expect(mapBox?.height).toBeGreaterThan(250);
  expect(submitBox?.height).toBeGreaterThan(44);

  await page.screenshot({
    path: testInfo.outputPath("mobile-qa.png"),
    fullPage: true,
  });
});
