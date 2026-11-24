import { test, expect, gotoSpaRoute } from "./fixtures";

test.describe("랜딩 페이지 및 라우팅/리다이렉트 전수 검증", () => {
  test("랜딩 페이지 인터랙티브 미리보기(Single/Pipeline, 스텝, 재생, 초기화) 및 FAQ/작업화면 미리보기 검증", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");

    // 1. 히어로 타이틀 및 핵심 배지 확인
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "CPU의 흐름이 되는 순간"
    );

    // 2. 인터랙티브 미리보기 (ProductPreview) 조작
    const singleBtn = page.getByRole("button", { name: "Single-cycle" });
    const pipelineBtn = page.getByRole("button", { name: "5-stage pipeline" });
    const stepBtn = page.getByRole("button", { name: "미리보기 한 클록 실행" });
    const resetBtn = page.getByRole("button", { name: "미리보기 초기화" });
    const progressBar = page.getByRole("progressbar", {
      name: "미리보기 실행 진행률",
    });

    await expect(singleBtn).toHaveAttribute("aria-pressed", "true");
    await expect(progressBar).toHaveAttribute("aria-valuenow", "0");

    // 한 클록씩 진행하여 레지스터/메모리 변화 확인
    await stepBtn.click();
    await expect(progressBar).toHaveAttribute("aria-valuenow", "1");
    await stepBtn.click();
    await expect(progressBar).toHaveAttribute("aria-valuenow", "2");

    // 초기화 버튼 클릭
    await resetBtn.click();
    await expect(progressBar).toHaveAttribute("aria-valuenow", "0");

    // 5-stage pipeline 모드로 전환 및 재생/일시정지 토글
    await pipelineBtn.click();
    await expect(pipelineBtn).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "미리보기 재생" }).click();
    await expect(
      page.getByRole("button", { name: "미리보기 일시정지" })
    ).toBeVisible();
    await page.getByRole("button", { name: "미리보기 일시정지" }).click();

    // 3. 실제 작업 화면 불러오기 (WorkspacePreview 지연 로딩 iframe)
    const revealBtn = page.getByRole("button", {
      name: /실제 작업 화면 불러오기/,
    });
    await revealBtn.click();
    await expect(
      page.locator('iframe[title="ArchReactor 실제 작업 공간 미리보기"]')
    ).toBeVisible();

    // 4. FAQ 아코디언 열기/닫기
    const secondFaq = page
      .locator("#faq details")
      .filter({ hasText: "어떤 코드와 명령어를 실행할 수 있나요?" });
    await secondFaq.locator("summary").click();
    await expect(secondFaq).toHaveAttribute("open", "");

    // 5. 모바일 뷰포트 전용 햄버거 메뉴 열기 및 Escape 닫기 검증
    if (isMobile) {
      const menuOpenBtn = page.getByRole("button", { name: "메뉴 열기" });
      await expect(menuOpenBtn).toBeVisible();
      await menuOpenBtn.click();
      await expect(
        page.getByRole("button", { name: "메뉴 닫기" })
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "메뉴 열기" })
      ).toBeVisible();
    }
  });

  test("랜딩 페이지 학습 예제 카드 3종(addition, loop, memory) 클릭 시 시뮬레이터 연동, /?fileId 리다이렉트 및 레거시 라우트 검증", async ({
    page,
    errorMonitor,
  }) => {
    const exampleCards = [
      { title: /덧셈부터 시작하기/, id: "addition", fileName: "(addition.c)" },
      { title: /반복문의 흐름 따라가기/, id: "loop", fileName: "(loop.c)" },
      { title: /메모리에서 값 읽어오기/, id: "memory", fileName: "(memory.c)" },
    ];

    for (const card of exampleCards) {
      await page.goto("/");
      await page.getByRole("link", { name: card.title }).click();
      await expect(page).toHaveURL(new RegExp(`/simulator\\?example=${card.id}`));
      await expect(page.locator("body")).toContainText(card.fileName);
    }

    // 루트 /?fileId=... 진입 시 /simulator?fileId=... 리다이렉트 검증
    errorMonitor.allowHttpError("/api/v1/files/");
    await gotoSpaRoute(page, "/?fileId=e2e-redirect-check");
    await expect(page).toHaveURL(/\/simulator\?fileId=e2e-redirect-check/);

    // 2. 레거시 라우트 리다이렉트 (/pipeline, /management, /c-to-asm, /coming-soon -> /simulator)
    for (const legacyPath of [
      "/pipeline",
      "/management",
      "/c-to-asm",
      "/coming-soon",
    ]) {
      await gotoSpaRoute(page, legacyPath);
      await expect(page).toHaveURL(/\/simulator/);
    }
  });
});
