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
  await expect(page.getByLabel("로드뷰 영역")).toBeVisible();
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeDisabled();

  const map = page.locator(".app-shell").getByTestId("guess-map");

  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeEnabled();

  await page.getByRole("button", { name: "추측 제출" }).click();

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
  await page.getByRole("button", { name: "추측 제출" }).click();

  await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();
  await expect(page.locator(".answer-link")).toBeVisible();
});

test("keeps the mobile map workflow usable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "어디길" })).toBeVisible();
  await page.getByRole("button", { name: "시작" }).click();
  await expect(page.locator(".app-shell").getByTestId("guess-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeVisible();
});

test("shows final round statistics without roadview or map after the last round", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "전라남도" }).click();
  await page.getByRole("button", { name: "시작" }).click();

  for (let round = 1; round <= 5; round += 1) {
    await placeGuess(page);
    await page.getByRole("button", { name: "추측 제출" }).click();
    await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();

    if (round < 5) {
      await page.getByRole("button", { name: "다음 라운드" }).click();
      await expect(page.getByRole("button", { name: "추측 제출" })).toBeVisible();
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

test.skip("lets friends join the same room and reveals shared pins after the round", async ({
  page,
  context,
}) => {
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
  await page.getByRole("button", { name: "제출" }).click();
  await expect(page.getByRole("button", { name: "정답 공개" })).toBeVisible();
  await expect(page.locator(".peer-guess-marker")).toHaveCount(0);

  await placeGuess(friend);
  await friend.getByRole("button", { name: "제출" }).click();

  await expect(page.getByText("정답 공개")).toBeVisible();
  await expect(page.locator(".target-marker")).toBeVisible();
  await expect(page.locator(".peer-guess-marker")).toBeVisible();
});

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
