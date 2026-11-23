import { test, expect, gotoSpaRoute } from "./fixtures";

test.describe("C/ASM 에디터, 예제 템플릿, 로컬 파일 업로드 예외 처리 및 라인 매핑 검증", () => {
  test("C 에디터 불러오기 팝업(4종 예제 템플릿), 로컬 파일 업로드 예외(.txt, 64KB 초과), 초기화 및 새로고침 세션 유지 검증", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    const cEditorRegion = page.getByRole("region", {
      name: "Translation C 편집기",
    });
    await expect(cEditorRegion).toBeVisible();
    await expect(cEditorRegion).toContainText("(main.c)");

    // 1. C 불러오기 팝업 열기 및 비로그인 안내 확인
    const openUploadBtn = cEditorRegion.getByTitle("파일 불러오기 및 예제 열기");
    await openUploadBtn.click();
    await expect(page.getByText("C 소스 불러오기 및 예제")).toBeVisible();
    await expect(page.getByText("로그인이 필요합니다")).toBeVisible();

    // 2. 4종 C 예제 템플릿 순차 로드 확인
    const templates = [
      { title: "기본 산술 연산 (Basic Arithmetic)", fileName: "addition.c" },
      { title: "반복문과 누적 합 (Loop & Sum)", fileName: "loop.c" },
      { title: "배열과 메모리 접근 (Array & Memory)", fileName: "memory.c" },
      { title: "조건 분기문 (Branch & If-Else)", fileName: "condition.c" },
    ];

    for (const tmpl of templates) {
      if (!(await page.getByText("C 소스 불러오기 및 예제").isVisible())) {
        await openUploadBtn.click();
      }
      await page.getByText(tmpl.title).click();
      await expect(cEditorRegion).toContainText(`(${tmpl.fileName})`);
    }

    // 3. 새로고침(세션 스토리지) 후에도 선택한 예제 코드가 유지되는지 검증
    const savedInSession = await page.evaluate(() =>
      sessionStorage.getItem("archreactor.translation.source")
    );
    expect(savedInSession).toContain("if (a > b)");
    await gotoSpaRoute(page, "/");
    await page.reload();
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    const afterReloadSession = await page.evaluate(() =>
      sessionStorage.getItem("archreactor.translation.source")
    );
    expect(afterReloadSession).toContain("if (a > b)");

    // 4. 비정상 파일 업로드 예외 처리 (.c가 아닌 파일 및 64KB 초과 파일)
    await openUploadBtn.click();
    const fileInput = page.locator('input[type="file"][accept*=".c"]');
    await fileInput.setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello world"),
    });
    await expect(cEditorRegion.getByRole("alert")).toContainText(
      ".c 파일을 선택해 주세요."
    );

    await openUploadBtn.click();
    const oversizedBuffer = Buffer.alloc(65 * 1024, "a");
    await fileInput.setInputFiles({
      name: "huge.c",
      mimeType: "text/x-c",
      buffer: oversizedBuffer,
    });
    await expect(cEditorRegion.getByRole("alert")).toContainText(
      "C 파일은 64 KiB 이하로 열어 주세요."
    );

    // 5. 초기화 버튼 클릭 시 기본 main.c 복원 확인
    await cEditorRegion.getByTitle("초기화").click();
    await expect(cEditorRegion).toContainText("(main.c)");
  });

  test("C 컴파일 에러 처리, C ↔ ASM 1:N 라인 매핑 선택, ASM 모드 3종 템플릿 및 어셈블 에러 검증", async ({
    page,
    errorMonitor,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    const cEditorRegion = page.getByRole("region", {
      name: "Translation C 편집기",
    });
    const asmRegion = page.getByRole("region", {
      name: "RISC-V 어셈블리 결과",
    });

    // 1. 문법 오류 C 파일 업로드 후 컴파일 시 에러 배너 노출 검증
    errorMonitor.allowHttpError("/api/v1/build/compile");
    await cEditorRegion.getByTitle("파일 불러오기 및 예제 열기").click();
    await page.locator('input[type="file"][accept*=".c"]').setInputFiles({
      name: "broken.c",
      mimeType: "text/x-c",
      buffer: Buffer.from("int main(void) { int a = ; return a; }"),
    });
    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(cEditorRegion.getByRole("alert")).toBeVisible({
      timeout: 30_000,
    });

    // 2. 초기화 후 정상 컴파일 및 어셈블리 명령어 행 클릭 매핑 검증
    await cEditorRegion.getByTitle("초기화").click();
    await page.getByRole("button", { name: "컴파일" }).click();

    const asmList = asmRegion.getByRole("region", {
      name: "어셈블리 명령어 목록",
    });
    await expect(asmList).toBeVisible({ timeout: 30_000 });

    const firstAsmRow = asmList.getByRole("button", { name: /^ASM L1 / });
    await expect(firstAsmRow).toBeVisible();
    await firstAsmRow.click();
    await expect(firstAsmRow).toHaveAttribute("aria-pressed", "true");

    // 모바일 뷰포트에서는 ASM 행 클릭 시 모바일 튜터 모달이 열리므로 닫은 뒤 선택 해제 확인
    const closeTutorBtn = page.getByTitle("튜터 모달 닫기");
    if (await closeTutorBtn.isVisible()) {
      await closeTutorBtn.click();
    } else {
      // 데스크톱에서는 다시 클릭하면 선택 해제
      await firstAsmRow.click();
      await expect(firstAsmRow).toHaveAttribute("aria-pressed", "false");
    }

    // 3. ASM 직접 작성 모드 전환 및 C 에디터 잠금 안내 화면 확인
    await page.getByRole("button", { name: "ASM", exact: true }).click();
    await expect(
      cEditorRegion.getByText(
        "현재 어셈블리(ASM) 직접 작성 모드가 활성화되어 있습니다."
      )
    ).toBeVisible();

    // 4. ASM 불러오기 팝업 및 3종 템플릿 로드 확인
    const asmUploadBtn = asmRegion.getByTitle(
      "어셈블리 파일 불러오기 및 예제 템플릿 열기"
    );
    await asmUploadBtn.click();
    await expect(
      page.getByText("어셈블리 불러오기 및 예제")
    ).toBeVisible();

    for (const tmplTitle of [
      "기본 산술 연산 (Basic ALU)",
      "반복문 카운터 (Loop Counter)",
      "메모리 로드 및 스토어 (Load & Store)",
    ]) {
      if (!(await page.getByText("어셈블리 불러오기 및 예제").isVisible())) {
        await asmUploadBtn.click();
      }
      await page.getByText(tmplTitle).click();
    }

    // 5. 잘못된 어셈블리 파일 업로드 후 어셈블 시 에러 배너 노출 확인
    errorMonitor.allowHttpError("/api/v1/build/compile");
    await asmUploadBtn.click();
    await asmRegion.locator('input[type="file"][accept*=".s"]').setInputFiles({
      name: "invalid.s",
      mimeType: "text/plain",
      buffer: Buffer.from("invalid_opcode_xyz x1, x2, x3\n"),
    });
    await page.getByRole("button", { name: "어셈블", exact: true }).click();
    await expect(asmRegion.getByRole("alert")).toBeVisible({
      timeout: 30_000,
    });

    // 6. ASM 초기화 후 정상 어셈블 및 비로그인 ASM 저장 차단 확인
    await asmRegion.getByTitle("기본 어셈블리 템플릿으로 초기화").click();
    await expect(asmRegion.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "어셈블", exact: true }).click();

    let asmAlertMessage = "";
    page.once("dialog", async (dialog) => {
      asmAlertMessage = dialog.message();
      await dialog.accept();
    });
    await asmRegion
      .getByTitle("현재 어셈블리 코드를 main.s 파일로 다운로드")
      .click();
    expect(asmAlertMessage).toContain("파일 저장은 로그인 후 이용할 수 있습니다.");

    // 7. C 모드 복귀 후 Monaco 에디터에 직접 코드 입력하여 컴파일 성공 검증
    await page.getByRole("button", { name: "C", exact: true }).click();
    const monacoContent = cEditorRegion.locator(".view-lines").first();
    await expect(monacoContent).toBeVisible();
    await monacoContent.click();
    await page.keyboard.type("// e2e direct edit\n");

    const editedSource = await page.evaluate(() =>
      sessionStorage.getItem("archreactor.translation.source")
    );
    expect(editedSource).toContain("// e2e direct edit");

    await page.getByRole("button", { name: "컴파일" }).click();
    await expect(asmList).toBeVisible({ timeout: 30_000 });
  });
});
