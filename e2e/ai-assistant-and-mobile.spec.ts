import { test, expect, loginAsTestUser } from "./fixtures";

test.describe("AI 어시스턴트 심화 기능(컴파일 힌트, 창 확대/축소, 첨부 설정, 추천 질문) 및 모바일 전용 UI 검증", () => {
  test("비로그인 상태에서 AI 어시스턴트 입력 비활성화 및 로그인 안내 문구 검증", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    if (!isMobile) {
      await page
        .getByRole("button", { name: "ArchReactor AI 어시스턴트 열기" })
        .click();
    } else {
      await page.getByRole("button", { name: "어시스턴트" }).click();
    }

    await expect(
      page.getByText("로그인 후 이용할 수 있습니다.").locator("visible=true")
    ).toBeVisible();
    const chatInput = page
      .getByPlaceholder("C 코드나 파이프라인에 대해 질문하세요...")
      .locator("visible=true");
    await expect(chatInput).toBeDisabled();
  });

  test("로그인 후 컴파일 힌트 팝업, AI 어시스턴트 확대/축소, 코드·실행 컨텍스트 첨부 설정 및 추천 질문 칩 검증", async ({
    page,
    isMobile,
  }) => {
    await loginAsTestUser(page);

    // 1. 컴파일 후 1스텝 전진 (실행 컨텍스트 첨부 활성화 조건: Single 모드에서 clock > 0)
    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(
      page.getByRole("region", { name: "어셈블리 명령어 목록" })
    ).toBeVisible({ timeout: 30_000 });

    const stepForwardBtn = isMobile
      ? page.getByTitle("한 단계 실행 (Step Over / Forward)")
      : page.getByTitle(/다음 (스텝 실행|사이클 진행)/);
    await stepForwardBtn.click();

    if (!isMobile) {
      // 데스크톱/노트북: 컴파일 완료 3초 후 노출되는 컴파일 힌트(#assistant-compile-hint) 확인 및 클릭하여 오픈
      const compileHint = page.locator("#assistant-compile-hint");
      await expect(compileHint).toBeVisible({ timeout: 10_000 });
      await compileHint.click();

      // 팝업 창 최대화(확대) / 최소화(축소) 버튼 동작 검증
      await page.getByTitle("최대 크기로 확대").click();
      await page.getByTitle("최소 크기로 축소").click();
    } else {
      await page.getByRole("button", { name: "어시스턴트" }).click();
    }

    // 2. 첨부 바(attachment-bar) 및 첨부 설정(원문 자동 첨부 토글, 실행 컨텍스트 첨부) 검증
    const attachmentBar = page
      .locator('[data-testid="attachment-bar"]')
      .locator("visible=true");
    await expect(attachmentBar).toBeVisible();

    // 기본 코드 첨부 해제 버튼 클릭 -> '코드 미첨부' 전환 확인
    const detachCodeBtn = attachmentBar.getByRole("button", {
      name: "코드 첨부 해제",
    });
    await expect(detachCodeBtn).toBeVisible();
    await detachCodeBtn.click();
    await expect(attachmentBar.getByText("코드 미첨부")).toBeVisible();

    // '첨부 설정' 열어서 '작성 중인 원문 자동 첨부' 체크박스 다시 활성화
    await attachmentBar.getByRole("button", { name: /첨부 설정/ }).click();
    const autoAttachCheckbox = attachmentBar.getByLabel(
      "작성 중인 원문 자동 첨부"
    );
    await autoAttachCheckbox.check();
    await expect(
      attachmentBar.getByRole("button", { name: "코드 첨부 해제" })
    ).toBeVisible();

    // 실행 컨텍스트(+ 실행 · clock 1) 첨부 및 해제 확인
    const attachExecBtn = attachmentBar.getByRole("button", {
      name: /\+ 실행 · clock/,
    });
    if (await attachExecBtn.isVisible()) {
      await attachExecBtn.click();
      const detachExecBtn = attachmentBar.getByRole("button", {
        name: "실행 첨부 해제",
      });
      await expect(detachExecBtn).toBeVisible();
      await detachExecBtn.click();
    }

    // 3. 추천 질문 칩 바 렌더링 확인 및 활성 상태일 때 클릭 시 입력창 채움 검증
    const chipBar = page
      .locator('[aria-label="추천 질문"]')
      .locator("visible=true");
    await expect(chipBar).toBeVisible();
    const codeExplainChip = chipBar.getByRole("button", {
      name: "📝 코드 설명",
    });
    await expect(codeExplainChip).toBeVisible();

    // 백엔드 AI 어시스턴트 서비스가 활성(enabled) 상태이면 칩 클릭 시 입력창에 질문이 채워짐
    if (await codeExplainChip.isEnabled()) {
      await codeExplainChip.click();
      const chatInput = page
        .getByPlaceholder("C 코드나 파이프라인에 대해 질문하세요...")
        .locator("visible=true");
      await expect(chatInput).toHaveValue(/첨부한 C 또는 RISC-V 코드/);
    }

    if (!isMobile) {
      await page.getByRole("button", { name: "창 닫기", exact: true }).click();
    } else {
      // 4. 모바일 전용 5버튼 바텀바 전체 탭 전환 및 모바일 튜터 해설 모달 검증
      await page.getByRole("button", { name: "레지스터·메모리" }).click();
      await expect(page.getByText("REGISTERS (x0 ~ x31)")).toBeVisible();

      await page.getByRole("button", { name: "분석·지표" }).click();
      await expect(
        page.getByRole("region", { name: "싱글 사이클 데이터패스" })
      ).toBeVisible();

      await page.getByRole("button", { name: "데이터패스" }).click();
      await expect(page.getByText("PERFORMANCE & CPI")).toBeVisible();

      await page.getByRole("button", { name: "코드", exact: true }).click();
      const asmList = page
        .getByRole("region", { name: "RISC-V 어셈블리 결과" })
        .getByRole("region", { name: "어셈블리 명령어 목록" });
      await asmList.getByRole("button", { name: /^ASM L1 / }).click();

      // 모바일에서 ASM 명령어 클릭 시 모바일 튜터 모달이 열리고 닫기(✕) 버튼이 동작하는지 확인
      const closeTutorModalBtn = page.getByTitle("튜터 모달 닫기");
      await expect(closeTutorModalBtn).toBeVisible();
      await closeTutorModalBtn.click();
      await expect(closeTutorModalBtn).toBeHidden();
    }
  });

  test("AI 어시스턴트 SSE 스트리밍(Markdown/KaTeX), 메모리 주소 첨부, 중단(Abort), 429 에러 재입력 및 데스크톱 드래그·리사이즈 검증 (모킹)", async ({
    page,
    isMobile,
    errorMonitor,
  }) => {
    errorMonitor.allowHttpError("/api/v1/assistant/chat");

    await loginAsTestUser(page);

    // AI status 모킹 (항상 enabled + editor_source_supported)
    await page.route("**/api/v1/assistant/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          code: "E2E_MOCK",
          editor_source_supported: true,
        }),
      })
    );

    // 컴파일 및 1스텝 전진 (실행 컨텍스트 확보)
    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(
      page.getByRole("region", { name: "어셈블리 명령어 목록" })
    ).toBeVisible({ timeout: 30_000 });

    const stepForwardBtn = isMobile
      ? page.getByTitle("한 단계 실행 (Step Over / Forward)")
      : page.getByTitle(/다음 (스텝 실행|사이클 진행)/);
    await stepForwardBtn.click();

    if (!isMobile) {
      await page
        .getByRole("button", { name: "ArchReactor AI 어시스턴트 열기" })
        .click();
    } else {
      await page.getByRole("button", { name: "어시스턴트" }).click();
    }

    const chatInput = page
      .getByPlaceholder("C 코드나 파이프라인에 대해 질문하세요...")
      .locator("visible=true");
    await expect(chatInput).toBeEnabled({ timeout: 15_000 });

    // 1. 데스크톱 플로팅 팝업 드래그 이동 및 리사이즈 핸들 검증
    if (!isMobile) {
      const popupHeader = page
        .locator("header[title*='드래그하여 이동']")
        .locator("visible=true");
      await expect(popupHeader).toBeVisible();
      const beforeBox = await popupHeader.boundingBox();
      expect(beforeBox).not.toBeNull();

      await page.mouse.move(
        beforeBox!.x + beforeBox!.width / 2,
        beforeBox!.y + beforeBox!.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        beforeBox!.x + beforeBox!.width / 2 - 80,
        beforeBox!.y + beforeBox!.height / 2 + 40,
        { steps: 5 }
      );
      await page.mouse.up();

      const afterDragBox = await popupHeader.boundingBox();
      expect(afterDragBox).not.toBeNull();
      expect(afterDragBox!.x).toBeLessThan(beforeBox!.x);

      // 좌측 리사이즈 핸들로 너비 확장 확인
      const leftResizeHandle = page.getByTitle("좌측 크기 조절");
      const handleBox = await leftResizeHandle.boundingBox();
      expect(handleBox).not.toBeNull();
      await page.mouse.move(
        handleBox!.x + handleBox!.width / 2,
        handleBox!.y + handleBox!.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        handleBox!.x - 60,
        handleBox!.y + handleBox!.height / 2,
        { steps: 4 }
      );
      await page.mouse.up();

      const afterResizeBox = await popupHeader.boundingBox();
      expect(afterResizeBox!.width).toBeGreaterThan(afterDragBox!.width);
    }

    // 2. 실행 컨텍스트 + 메모리 주소 선택 첨부 후 SSE 스트리밍(Markdown/KaTeX) 응답 검증
    const attachmentBar = page
      .locator('[data-testid="attachment-bar"]')
      .locator("visible=true");
    const attachExecBtn = attachmentBar.getByRole("button", {
      name: /\+ 실행 · clock/,
    });
    if (await attachExecBtn.isVisible()) {
      await attachExecBtn.click();
      await attachmentBar.getByRole("button", { name: /첨부 설정/ }).click();
      const memSummary = attachmentBar.getByText(/메모리 선택 \(0\/16\)/);
      if (await memSummary.isVisible()) {
        await memSummary.click();
        const memSelect = attachmentBar.getByLabel("첨부할 메모리 주소");
        const optionCount = await memSelect.locator("option").count();
        if (optionCount > 0) {
          const firstOptionVal = await memSelect
            .locator("option")
            .first()
            .getAttribute("value");
          if (firstOptionVal) {
            await memSelect.selectOption([firstOptionVal]);
            await expect(
              attachmentBar.getByText(/메모리 선택 \(1\/16\)/)
            ).toBeVisible();
          }
        }
      }
    }

    let chatCallCount = 0;
    let releaseAbortableRequest: (() => void) | null = null;

    await page.route("**/api/v1/assistant/chat", async (route) => {
      chatCallCount += 1;
      const body = route.request().postDataJSON();

      if (chatCallCount === 1) {
        // 1회차: 정상 SSE 스트리밍 (Markdown + KaTeX + done.context)
        const ctxRef = body?.context
          ? {
              execution_id: body.context.execution_id,
              mode: body.context.mode,
              cycle: body.context.cycle,
            }
          : undefined;
        const ssePayload = [
          ": connected",
          `data: ${JSON.stringify({
            type: "delta",
            text: "**핵심 분석**: `addi` 명령어가 완료되었고 수식은 $CPI = 1.25$ 입니다.",
          })}`,
          `data: ${JSON.stringify({
            type: "done",
            stop_reason: "end_turn",
            usage: {},
            ...(ctxRef ? { context: ctxRef } : {}),
          })}`,
          "",
        ].join("\n\n");

        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: ssePayload,
        });
        return;
      }

      if (chatCallCount === 2) {
        // 2회차: 지연 응답 -> 사용자가 '중단' 클릭할 수 있도록 대기
        await new Promise<void>((resolve) => {
          releaseAbortableRequest = resolve;
          setTimeout(resolve, 10_000);
        });
        await route.abort();
        return;
      }

      // 3회차: 429 Rate Limit 에러 응답
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
        }),
      });
    });

    // 1회차 전송: Markdown + KaTeX 렌더링 확인
    await chatInput.fill("CPI 계산 결과를 알려줘");
    await page.getByRole("button", { name: "전송", exact: true }).click();
    await expect(page.getByText("핵심 분석")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".katex").first()).toBeVisible();

    // 2회차 전송 후 '중단' 버튼 클릭 -> 중단 안내 문구 & '질문 다시 입력' 복원 검증
    await chatInput.fill("중단 테스트 질문입니다");
    await page.getByRole("button", { name: "전송", exact: true }).click();
    const abortBtn = page.getByRole("button", { name: "중단", exact: true });
    await expect(abortBtn).toBeVisible();
    await abortBtn.click();
    releaseAbortableRequest?.();

    await expect(page.getByText("답변 생성을 중단했습니다.")).toBeVisible();
    const retryInputBtn = page
      .getByRole("button", { name: "질문 다시 입력" })
      .last();
    await retryInputBtn.click();
    await expect(chatInput).toHaveValue("중단 테스트 질문입니다");

    // 3회차 전송: 429 에러 응답 시 안내 배너 및 재입력 버튼 노출 확인
    await page.getByRole("button", { name: "전송", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /한도|초과|429|요청/ }).last()
    ).toBeVisible({ timeout: 15_000 });
  });
});
