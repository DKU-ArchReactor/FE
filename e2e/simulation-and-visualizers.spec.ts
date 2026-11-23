import { test, expect } from "./fixtures";

test.describe("시뮬레이션 엔진(Single/Pipeline), 재생 컨트롤, 3대 뷰포트 시각화 및 내장 튜터 검증", () => {
  test("재생 컨트롤 5종(초기화, 다시시작, 이전/다음 스텝, 재생/일시정지), 배속 4종(0.5x~2.0x) 및 레지스터·메모리 뷰어 검증", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    // 컴파일 실행
    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(
      page.getByRole("region", { name: "어셈블리 명령어 목록" })
    ).toBeVisible({ timeout: 30_000 });

    // 1. 스텝 전진 / 후진 / 초기화 검증
    const stepForwardBtn = isMobile
      ? page.getByTitle("한 단계 실행 (Step Over / Forward)")
      : page.getByTitle(/다음 (스텝 실행|사이클 진행)/);
    const stepBackBtn = isMobile
      ? page.getByTitle("이전 단계 (Step Back)")
      : page.getByTitle(/이전 (스텝|사이클)/);
    const resetBtn = page.getByTitle("처음으로 초기화 (Reset / Stop)").locator("visible=true");

    await expect(stepForwardBtn).toBeEnabled();
    await stepForwardBtn.click();
    await stepForwardBtn.click();
    await expect(stepBackBtn).toBeEnabled();
    await stepBackBtn.click();

    // 초기화 버튼 클릭
    await resetBtn.click();
    await expect(stepBackBtn).toBeDisabled();

    // 2. 배속 4종(0.5x, 1.0x, 1.5x, 2.0x) 클릭 전환 검증 (모바일은 상단 배속 바가 숨겨짐)
    if (!isMobile) {
      for (const speedLabel of ["1.5x", "2.0x", "1.0x", "0.5x"]) {
        await page
          .getByRole("button", { name: speedLabel, exact: true })
          .click();
      }
    }

    // 3. 처음부터 다시시작(Restart) 및 일시정지(PAUSE) 검증 (조건부 스킵 없이 명시적 확인)
    const restartBtn = page
      .getByTitle("처음부터 다시시작 (Restart / Reset & Play)")
      .locator("visible=true");
    await restartBtn.click();
    if (!isMobile) {
      const pauseBtn = page.getByRole("button", { name: "PAUSE", exact: true });
      await expect(pauseBtn).toBeVisible();
      await pauseBtn.click();
      await expect(
        page.getByRole("button", { name: "PLAY", exact: true })
      ).toBeVisible();

      // 타임라인 슬라이더(input[type="range"]) 직접 점프 검증
      const slider = page.locator('input[type="range"]').first();
      await expect(slider).toBeEnabled();
      await slider.fill("2");
      await expect(slider).toHaveValue("2");
    }

    // 4. 레지스터(x0~x31) 및 메모리 세그먼트(6대 영역 + User Program 접기/펼치기) 검증
    if (isMobile) {
      await page.getByRole("button", { name: "레지스터·메모리" }).click();
    }

    await expect(page.getByText("REGISTERS (x0 ~ x31)")).toBeVisible();
    await expect(page.getByText("(x0)")).toBeVisible();
    await expect(page.getByText("(x2)")).toBeVisible();
    await expect(page.getByText("(x10)")).toBeVisible();

    await expect(page.getByText("MEMORY LAYOUT")).toBeVisible();
    await expect(page.getByText("User Program (main)")).toBeVisible();
    await expect(page.getByText("NULL Pointer Guard (접근 금지 보호 구역)")).toBeVisible();

    // User Program (main) 닫기 ▼ / 열기 ▲ 토글
    const collapseCodeBtn = page.getByRole("button", { name: "닫기 ▼" });
    await expect(collapseCodeBtn).toBeVisible();
    await collapseCodeBtn.click();
    const expandCodeBtn = page.getByRole("button", { name: "열기 ▲" });
    await expect(expandCodeBtn).toBeVisible();
    await expandCodeBtn.click();

    // 5. ASM 기본 산술 연산(Basic ALU) 실행 후 실제 레지스터 값(t0=10, t1=20, t2=30, a0=20) 변화 정확성 검증
    if (isMobile) {
      await page.getByRole("button", { name: "코드", exact: true }).click();
    }
    await page.getByRole("button", { name: "ASM", exact: true }).click();
    const asmRegion = page.getByRole("region", {
      name: "RISC-V 어셈블리 결과",
    });
    await asmRegion
      .getByTitle("어셈블리 파일 불러오기 및 예제 템플릿 열기")
      .click();
    await page.getByText("기본 산술 연산 (Basic ALU)").click();
    await page.getByRole("button", { name: "어셈블", exact: true }).click();
    await expect(stepForwardBtn).toBeEnabled({ timeout: 30_000 });

    // 4개 산술 명령어(addi t0=10, addi t1=20, add t2=30, sub a0=20) 실행 완료까지 전진
    for (let i = 0; i < 4; i++) {
      await stepForwardBtn.click();
    }

    if (isMobile) {
      await page.getByRole("button", { name: "레지스터·메모리" }).click();
    }
    await expect(
      page.locator('div[title*="Temporary 0"]').filter({ hasText: "(x5)" })
    ).toContainText("10");
    await expect(
      page.locator('div[title*="Temporary 1"]').filter({ hasText: "(x6)" })
    ).toContainText("20");
    await expect(
      page.locator('div[title*="Temporary 2"]').filter({ hasText: "(x7)" })
    ).toContainText("30");
    await expect(
      page.locator('div[title*="Return value 0"]').filter({ hasText: "(x10)" })
    ).toContainText("20");
  });

  test("Single 데이터패스(하드웨어 상세 모달 ALU/Decoder/PC Select), Pipeline 데이터패스(줌 컨트롤), 멀티사이클 타이밍 다이어그램, CPI 지표 및 튜터 해설 검증", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    // Single 모드 컴파일 및 1스텝 전진
    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(
      page.getByRole("region", { name: "어셈블리 명령어 목록" })
    ).toBeVisible({ timeout: 30_000 });

    const stepForwardBtn = isMobile
      ? page.getByTitle("한 단계 실행 (Step Over / Forward)")
      : page.getByTitle(/다음 (스텝 실행|사이클 진행)/);
    await stepForwardBtn.click();

    // 1. 데스크톱 내장 튜터(ARCHREACTOR TUTOR) 및 스플리터 더블클릭 리셋 검증
    if (!isMobile) {
      const tutorRegion = page.getByRole("region", { name: "튜터 해설 패널" });
      await expect(tutorRegion).toBeVisible();
      await expect(tutorRegion).toContainText("ARCHREACTOR TUTOR");

      const detailSummary = tutorRegion.locator("summary", {
        hasText: "자세히 보기",
      }).first();
      if (await detailSummary.isVisible()) {
        await detailSummary.click();
      }

      // 워크스페이스 스플리터 더블클릭 리셋 검증
      await page
        .getByTitle(
          "드래그하여 좌측 에디터 영역과 우측 뷰포트 너비 조절 (더블클릭: 50:50 기본 리셋)"
        )
        .dblclick();
    }

    // 2. 뷰포트 2 (Datapath): Single 모드 데이터 흐름 제어 및 하드웨어 상세 모달(ALU, Decoder, PC Select) 검증
    if (!isMobile) {
      await page.getByRole("button", { name: "NEXT" }).click();
    } else {
      await page.getByRole("button", { name: "분석·지표" }).click();
    }

    const singleDatapath = page.getByRole("region", {
      name: "싱글 사이클 데이터패스",
    });
    await expect(singleDatapath).toBeVisible();

    // 흐름 재생 조작 버튼 확인
    const flowControls = singleDatapath.getByRole("group", {
      name: "데이터 흐름 재생 조작",
    });
    await expect(flowControls).toBeVisible();
    await flowControls.getByRole("button", { name: "흐름 다시 보기" }).click();

    // ALU 하드웨어 상세 모달 오픈 및 비트 구간 선택 후 닫기
    await singleDatapath
      .getByRole("button", { name: "ALU 역할과 동작 보기" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("ALU는 어떻게 계산할까?");
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toBeHidden();

    // Instruction Decoder 하드웨어 상세 모달 오픈 및 닫기
    await singleDatapath
      .getByRole("button", { name: "Instruction Decoder 역할과 동작 보기" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "32비트 명령어는 어떻게 해독할까?"
    );
    await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();

    // PC Select 하드웨어 상세 모달 오픈 및 닫기
    await singleDatapath
      .getByRole("button", { name: "PC Select 역할과 동작 보기" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "다음 PC를 만드는 구성 요소"
    );
    await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();

    // 3. Pipeline 모드로 전환하여 PIPELINE DATAPATH 및 줌 컨트롤(−, 100%, +) 검증
    await page.getByRole("button", { name: "Pipeline" }).click();
    await expect(page.getByText("PIPELINE DATAPATH")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTitle("확대").click();
    await expect(page.getByTitle("100% (세로 맞춤)")).toContainText("115%");
    await page.getByTitle("축소").click();
    await page.getByTitle("100% (세로 맞춤)").click();
    await expect(page.getByTitle("100% (세로 맞춤)")).toContainText("100%");

    // 4. 뷰포트 3 (Timing & Performance Metrics): 멀티사이클 다이어그램 및 CPI 지표 검증
    if (!isMobile) {
      await page.getByRole("button", { name: "NEXT" }).click();
    } else {
      await page.getByRole("button", { name: "데이터패스" }).click();
    }

    await expect(page.getByText("PIPELINING EXECUTION")).toBeVisible();
    await expect(page.getByText("PERFORMANCE & CPI")).toBeVisible();
    await expect(page.getByText("Ideal CPI: 1.00")).toBeVisible();

    // 멀티사이클 타이밍 다이어그램에서 C2 컬럼 클릭 시 Cycle 2로 점프하는지 확인
    const cycle2ColBtn = page.getByRole("button", { name: "C2", exact: true });
    await expect(cycle2ColBtn).toBeVisible();
    await cycle2ColBtn.click();
  });

  test("예외 상태 모킹 검증: 튜터 API 실패 후 재시도 복구 및 시뮬레이션 CYCLE_LIMIT 상태 표시", async ({
    page,
    isMobile,
    errorMonitor,
  }) => {
    errorMonitor.allowHttpError("/api/v1/tutor/explain");

    let tutorAttempts = 0;
    await page.route("**/api/v1/tutor/explain", async (route) => {
      tutorAttempts += 1;
      if (tutorAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Temporary tutor outage" }),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/api/v1/simulation/run", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.mode === "single") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            execution_status: "CYCLE_LIMIT",
            tutor: {
              schema_version: "1.0",
              asm_instructions: [
                {
                  pc: "0x00010000",
                  text: "addi a0, zero, 1",
                  raw_instruction: "0x00100513",
                  source_line: 1,
                  mapping_status: "mapped",
                  explanation: {
                    kind: "asm",
                    category: "alu",
                    title: "즉치 덧셈",
                    summary: "zero와 1을 더해 a0에 저장합니다.",
                    detail: "ALU가 즉치값 덧셈을 수행합니다.",
                    opcode: "addi",
                    operands: "a0, zero, 1",
                    reads: ["x0"],
                    writes: ["x10"],
                  },
                },
              ],
            },
            result: {
              simulator: { mode: "single", pipeline_model: "single-cycle" },
              program: { entry_point: "0x00010000" },
              summary: { total_cycles: 1 },
              status: "CYCLE_LIMIT",
              history: [
                {
                  clock: 0,
                  buffers: {
                    IF: {
                      pc: "0x00010000",
                      assembly: "addi a0, zero, 1",
                      status: "normal",
                    },
                  },
                  cycle_events: {},
                  global_result: {
                    registers: { x0: "0x00000000", x10: "0x00000001" },
                    memory_snapshot: {},
                    metrics: { accumulated_instructions: 1 },
                  },
                },
              ],
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(
      page.getByRole("region", { name: "어셈블리 명령어 목록" })
    ).toBeVisible({ timeout: 30_000 });

    // 1. 데스크톱에서 튜터 API 1회 실패 시 에러 배너 노출 및 '다시 시도' 복구 확인
    if (!isMobile) {
      const tutorRegion = page.getByRole("region", { name: "튜터 해설 패널" });
      const retryBtn = tutorRegion.getByRole("button", { name: "다시 시도" });
      await expect(
        tutorRegion.getByText("해설을 불러오지 못했습니다.")
      ).toBeVisible({ timeout: 15_000 });
      await retryBtn.click();
      await expect(
        tutorRegion.getByText("해설을 불러오지 못했습니다.")
      ).toHaveCount(0);
    }

    // 2. Single 모드 1스텝 전진 후 CYCLE_LIMIT 상태 문구 확인
    const stepForwardBtn = isMobile
      ? page.getByTitle("한 단계 실행 (Step Over / Forward)")
      : page.getByTitle(/다음 (스텝 실행|사이클 진행)/);
    await stepForwardBtn.click();

    if (!isMobile) {
      await page.getByRole("button", { name: "NEXT" }).click();
    } else {
      await page.getByRole("button", { name: "분석·지표" }).click();
    }

    const singleDatapath = page.getByRole("region", {
      name: "싱글 사이클 데이터패스",
    });
    await expect(singleDatapath).toBeVisible();
    // 데이터 흐름 재생 시작(또는 다시 보기) 후 완료 시 표시되는 CYCLE_LIMIT 상태 텍스트 확인
    await singleDatapath.getByRole("button", { name: "흐름 다시 보기" }).click();
    await expect(
      singleDatapath.locator('[data-execution-status="CYCLE_LIMIT"]')
    ).toContainText("최대 클록 수 도달 · 실행 중단", { timeout: 30_000 });
  });
});
