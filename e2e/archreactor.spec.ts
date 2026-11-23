import { test, expect, loginAsTestUser } from "./fixtures";

test("ArchReactor 기본 실행 및 시각화 검증 (녹화 시나리오)", async ({
  page,
  isMobile,
}) => {
  await loginAsTestUser(page);

  // 1. Single 모드 C 컴파일
  await page.getByRole("button", { name: "컴파일" }).click();
  await expect(page.getByRole("region", { name: "어셈블리 명령어 목록" })).toBeVisible({
    timeout: 30_000,
  });

  if (!isMobile) {
    // 데스크톱/노트북: 우측 슬라이딩 뷰포트 NEXT / PREV 이동
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "PREV" }).click();
  } else {
    // 모바일: 하단 5버튼 바텀바로 뷰포트 전환 후 코드 탭 복귀
    await page.getByRole("button", { name: "레지스터·메모리" }).click();
    await page.getByRole("button", { name: "분석·지표" }).click();
    await page.getByRole("button", { name: "코드", exact: true }).click();
  }

  // 2. Single 모드 ASM 직접 작성 및 어셈블
  await page.getByRole("button", { name: "ASM", exact: true }).click();
  await page.getByRole("button", { name: "어셈블", exact: true }).click();

  if (!isMobile) {
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "PREV" }).click();
    await page.getByRole("button", { name: "PREV" }).click();
  }

  // 3. Pipeline 모드 전환 및 C 컴파일
  await page.getByRole("button", { name: "Pipeline" }).click();
  await page.getByRole("button", { name: "C", exact: true }).click();
  await page.getByRole("button", { name: "컴파일" }).click();
  await expect(page.getByRole("region", { name: "어셈블리 명령어 목록" })).toBeVisible({
    timeout: 30_000,
  });

  if (!isMobile) {
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "PREV" }).click();
    await page.getByRole("button", { name: "PLAY", exact: true }).click();
    await page.getByRole("button", { name: "2.0x" }).click();
    await page.getByRole("button", { name: "ArchReactor AI 어시스턴트 열기" }).click();
    await page.getByRole("button", { name: "창 닫기", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "어시스턴트" }).click();
    await expect(page.getByText("ArchReactor AI 어시스턴트")).toBeVisible();
    await page.getByRole("button", { name: "코드", exact: true }).click();
  }

  // 4. Pipeline 모드 ASM 어셈블 및 재생/일시정지
  await page.getByRole("button", { name: "ASM", exact: true }).click();
  await page.getByRole("button", { name: "어셈블", exact: true }).click();

  if (!isMobile) {
    const playBtn = page.getByRole("button", { name: "PLAY", exact: true });
    await expect(playBtn).toBeEnabled({ timeout: 30_000 });
    await playBtn.click();
    const pauseBtn = page.getByRole("button", { name: "PAUSE", exact: true });
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
    }
    await page.getByRole("button", { name: "ArchReactor AI 어시스턴트 열기" }).click();
    await page.getByRole("button", { name: "창 닫기", exact: true }).click();
  }

  await expect(page.locator("body")).toContainText("ASSEMBLY");
});
