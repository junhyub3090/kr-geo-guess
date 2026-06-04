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
  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();
  await expect(page.getByRole("button", { name: "시작" })).not.toContainText("/");
  await expect(page.getByRole("heading", { name: "데일리 챌린지" })).toBeVisible();
  await expect(page.locator(".leaderboard-empty")).toHaveText("아직 기록 없음");
  await expect(page.locator(".placeholder-row")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("더미");
  await page.screenshot({
    path: testInfo.outputPath("home-desktop-qa.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "시작" }).click();
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

test("compact desktop home keeps the map preview and start button inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();

  const layout = await page.evaluate(() => {
    const startPanel = document.querySelector(".start-panel")?.getBoundingClientRect();
    const mapArt = document.querySelector(".map-art")?.getBoundingClientRect();
    const playButton = document.querySelector(".play-button")?.getBoundingClientRect();

    if (!startPanel || !mapArt || !playButton) {
      throw new Error("Home layout elements are missing");
    }

    return {
      viewportHeight: window.innerHeight,
      startPanelTop: startPanel.top,
      mapArtTop: mapArt.top,
      playButtonBottom: playButton.bottom,
      horizontalOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(layout.mapArtTop).toBeGreaterThanOrEqual(layout.startPanelTop);
  expect(layout.playButtonBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
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

  await rankingTabs.getByRole("button", { name: "하" }).click();
  await expect(page.locator(".leaderboard-row").first()).toContainText("이지왕");
  await expect(page.locator(".leaderboard-row").first()).toContainText("19,000점");
});

test("home leaderboard celebrates top ten integrated scores", async ({ page }) => {
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
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveClass(/leaderboard-row--champion/);
  await expect(
    rows.first().locator("[data-testid='leaderboard-rank-icon']"),
  ).toHaveCount(1);
  await expect(rows.first().locator(".leaderboard-mode-chip")).toHaveAttribute(
    "data-mode",
    "room",
  );
  await expect(rows.nth(9)).toContainText("Player 10");
  await expect(
    page.locator(".leaderboard-row", { hasText: "Player 11" }),
  ).toHaveCount(0);
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

  await page.getByRole("button", { name: "서울" }).click();
  await page.waitForTimeout(150);
  const seoulViewBox = await previewMap.getAttribute("viewBox");

  await page.getByRole("button", { name: "전라남도" }).click();
  await page.waitForTimeout(150);
  const jeonnamViewBox = await previewMap.getAttribute("viewBox");

  expect(fullViewBox).toBe("0 0 524 631");
  expect(seoulViewBox).not.toBe(fullViewBox);
  expect(jeonnamViewBox).not.toBe(fullViewBox);
  expect(jeonnamViewBox).not.toBe(seoulViewBox);

  await page.screenshot({
    path: testInfo.outputPath("region-picker-qa.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "시작" }).click();
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
  await page.getByRole("button", { name: "시작" }).click();

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

test("game map hover names the visible municipality outside Seoul", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작" }).click();

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
  await page.getByRole("button", { name: "시작" }).click();

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
  await page.getByRole("button", { name: "시작" }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect(map.locator(".map-region-boundary").first()).toBeVisible();
  await expect(map.locator(".province-boundary")).toHaveCount(0);

  const layerOrder = await map.evaluate((svg) =>
    [...svg.children].map((child) => child.getAttribute("class") ?? child.tagName),
  );
  expect(layerOrder.indexOf("municipality-boundary-layer")).toBeGreaterThan(
    layerOrder.indexOf("province-layer"),
  );

  const counts = await map.evaluate((svg) => ({
    fills: svg.querySelectorAll(".map-region").length,
    boundaries: svg.querySelectorAll(".map-region-boundary").length,
    boundaryPointerEvents: getComputedStyle(
      svg.querySelector(".map-region-boundary") as Element,
    ).pointerEvents,
  }));
  expect(counts).toEqual({
    fills: 25,
    boundaries: 25,
    boundaryPointerEvents: "none",
  });
});

test("reveal map keeps result overlays minimal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작" }).click();

  const map = page.locator(".app-shell").getByTestId("guess-map");
  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await page.getByRole("button", { name: /위치 찍기/ }).click();

  await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();
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
  await page.getByRole("button", { name: "시작" }).click();

  await expect(page.getByText("경상남도").first()).toBeVisible();
  const map = page.locator(".app-shell").getByTestId("guess-map");
  await expect(map.locator(".map-region").first()).toBeVisible();
  await expect(map.locator(".map-label")).toHaveCount(0);
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

  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();
  await page.getByRole("button", { name: "시작" }).click();

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
