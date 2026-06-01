import { expect, test, type Locator } from "@playwright/test";

test("desktop layout has no horizontal overflow and keeps primary controls visible", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "바로 시작" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데일리 챌린지" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home-desktop-qa.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "바로 시작" }).click();
  await expect(page.getByLabel("로드뷰 영역")).toBeVisible();
  await expect(page.getByTestId("guess-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: testInfo.outputPath("desktop-qa.png"),
    fullPage: true,
  });
});

test("map picker hides pool counts and focuses the selected region map", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "서울" })).toBeVisible();

  const homeText = await page.locator("body").innerText();
  for (const label of [
    "전국",
    "서울특별시",
    "경기도",
    "강원도",
    "충청북도",
    "충청남도",
    "경상북도",
    "경상남도",
    "전라북도",
    "전라남도",
    "제주도",
  ]) {
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

  await page.getByRole("button", { name: "바로 시작" }).click();
  await expect(page.getByText("전라남도").first()).toBeVisible();
  await page.waitForTimeout(150);
  const gameMap = page.getByTestId("guess-map");
  expect(await gameMap.getAttribute("viewBox")).toBe(jeonnamViewBox);

  const submit = page.getByRole("button", { name: "추측 제출" });
  const mapBox = await gameMap.boundingBox();
  expect(mapBox).not.toBeNull();
  await gameMap.click({ position: { x: 5, y: 5 } });
  await expect(submit).toBeDisabled();
  const insidePoint = await findVisibleMapRelativePoint(gameMap);
  await gameMap.click({ position: insidePoint });
  await expect(submit).toBeEnabled();
});

test("desktop map picker lays out choices in two balanced rows", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout contract");

  await page.goto("/");

  const choices = page.locator(".map-choice-grid .map-choice");
  await expect(choices).toHaveCount(11);
  await expect(choices.locator("strong")).toHaveText([
    "전국",
    "서울특별시",
    "경기도",
    "강원도",
    "충청북도",
    "충청남도",
    "경상북도",
    "경상남도",
    "전라북도",
    "전라남도",
    "제주도",
  ]);

  const rowTops = await choices.evaluateAll((buttons) => {
    const roundedTops = buttons.map((button) =>
      Math.round(button.getBoundingClientRect().top),
    );
    return [...new Set(roundedTops)].sort((a, b) => a - b);
  });
  expect(rowTops).toHaveLength(2);

  const rowCounts = await choices.evaluateAll((buttons) => {
    const rows = new Map<number, number>();
    for (const button of buttons) {
      const top = Math.round(button.getBoundingClientRect().top);
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    return [...rows.values()].sort((a, b) => b - a);
  });
  expect(rowCounts).toEqual([6, 5]);
});

test("guess marker lands on the exact visible map point that was clicked", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "바로 시작" }).click();

  const map = page.getByTestId("guess-map");
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

test("national game map keeps province borders but hides region labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "바로 시작" }).click();

  const map = page.getByTestId("guess-map");
  await expect(map.locator(".province-boundary").first()).toBeVisible();
  await expect(map.locator(".map-label")).toHaveCount(0);

  const boundaryRegions = await map
    .locator(".province-boundary")
    .evaluateAll((paths) =>
      paths.map((path) => path.getAttribute("data-boundary-regions") ?? ""),
    );
  expect(boundaryRegions.length).toBeGreaterThan(0);
  for (const boundaryRegion of boundaryRegions) {
    expect(boundaryRegion).not.toMatch(/부산|대구|인천|광주|대전|울산|세종/);
  }

  const strokeWidths = await map.evaluate((svg) => {
    const region = svg.querySelector<SVGPathElement>(".map-region-boundary");
    const boundary = svg.querySelector<SVGPathElement>(".province-boundary");

    if (!region || !boundary) {
      throw new Error("Map stroke targets missing");
    }

    return {
      region: Number.parseFloat(getComputedStyle(region).strokeWidth),
      boundary: Number.parseFloat(getComputedStyle(boundary).strokeWidth),
    };
  });
  expect(strokeWidths.boundary - strokeWidths.region).toBeLessThanOrEqual(0.12);
});

test("Seoul game map draws district boundaries above fills so lines do not get covered", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "서울특별시" }).click();
  await page.getByRole("button", { name: "바로 시작" }).click();

  const map = page.getByTestId("guess-map");
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
  await page.getByRole("button", { name: "바로 시작" }).click();

  const map = page.getByTestId("guess-map");
  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await page.getByRole("button", { name: "추측 제출" }).click();

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
  await page.getByRole("button", { name: "바로 시작" }).click();

  await expect(page.getByText("경상남도").first()).toBeVisible();
  const map = page.getByTestId("guess-map");
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
      const rect = path.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        continue;
      }

      for (const xRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        for (const yRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
          const x = rect.left + rect.width * xRatio;
          const y = rect.top + rect.height * yRatio;
          const hitElements = document.elementsFromPoint(x, y);
          if (!hitElements.includes(path)) {
            continue;
          }

          return { x, y };
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

  await expect(page.getByRole("button", { name: "바로 시작" })).toBeVisible();
  await page.getByRole("button", { name: "바로 시작" }).click();

  const submit = page.getByRole("button", { name: "추측 제출" });
  const map = page.getByTestId("guess-map");

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
