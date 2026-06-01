import { expect, test, type Locator } from "@playwright/test";

test("plays one solo round by placing a Korea map pin and revealing a score", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "KR Geo Guess" })).toBeVisible();
  await expect(page.getByRole("button", { name: "바로 시작" })).toBeVisible();
  await page.getByLabel("닉네임").fill("지훈");
  await page.getByRole("button", { name: /제주/ }).click();
  await page.getByRole("button", { name: "바로 시작" }).click();

  await expect(page.getByText("제주").first()).toBeVisible();
  await expect(page.getByLabel("로드뷰 영역")).toBeVisible();
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeDisabled();

  const map = page.getByTestId("guess-map");

  await map.click({ position: await findVisibleMapRelativePoint(map) });
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeEnabled();

  await page.getByRole("button", { name: "추측 제출" }).click();

  await expect(page.getByRole("heading", { name: "정답 공개" })).toBeVisible();
  await expect(page.getByText(/오차/)).toBeVisible();
  await expect(page.locator(".answer-link")).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 라운드" })).toBeVisible();
});

test("keeps the mobile map workflow usable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "KR Geo Guess" })).toBeVisible();
  await page.getByRole("button", { name: "바로 시작" }).click();
  await expect(page.getByTestId("guess-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "추측 제출" })).toBeVisible();
});

test("lets friends join the same room and reveals shared pins after the round", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("닉네임").fill("지훈");
  await page.getByRole("button", { name: "방 만들기" }).click();

  const roomHeading = page.locator("h1", { hasText: /^KR-/ });
  await expect(roomHeading).toBeVisible();
  const roomCode = (await roomHeading.textContent()) ?? "";

  const friend = await context.newPage();
  await friend.goto(`/?room=${roomCode}`);
  await friend.getByLabel("닉네임").fill("하린");
  await friend.getByRole("button", { name: "입장" }).click();
  await expect(friend.locator("h1", { hasText: roomCode })).toBeVisible();

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
  const map = page.getByTestId("guess-map");
  await map.click({ position: await findVisibleMapRelativePoint(map) });
}

async function findVisibleMapRelativePoint(map: Locator) {
  const point = await map.evaluate((svgElement) => {
    const paths = [
      ...(svgElement as SVGSVGElement).querySelectorAll<SVGPathElement>(
        ".map-region",
      ),
    ];

    for (const path of paths) {
      const rect = path.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        continue;
      }

      for (const xRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        for (const yRatio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
          const x = rect.left + rect.width * xRatio;
          const y = rect.top + rect.height * yRatio;
          if (document.elementsFromPoint(x, y).includes(path)) {
            return { x, y };
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
