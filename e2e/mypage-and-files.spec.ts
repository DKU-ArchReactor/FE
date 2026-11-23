import {
  test,
  expect,
  TEST_USER,
  gotoSpaRoute,
  loginAsTestUser,
} from "./fixtures";

test.describe("비로그인 접근 제어, 에디터 코드 저장/불러오기 및 마이페이지 파일 관리 전수 검증", () => {
  test("비로그인 상태에서 에디터 파일 저장 시 alert 차단 및 마이페이지(/my) 비로그인 접근 제어 검증", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    // 1. 비로그인 상태에서 C 에디터 '저장' 클릭 시 alert 메시지 확인
    const cEditorRegion = page.getByRole("region", {
      name: "Translation C 편집기",
    });
    let alertMessage = "";
    page.once("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    await cEditorRegion.getByTitle("현재 소스 코드를 서버에 저장").click();
    expect(alertMessage).toContain("파일 저장은 로그인 후 이용할 수 있습니다.");

    // 2. 비로그인 상태에서 /my 접근 시 안내 문구 및 '로그인하러 가기' 버튼 검증
    await gotoSpaRoute(page, "/my");
    await expect(
      page.getByText("로그인이 필요한 서비스입니다.")
    ).toBeVisible();
    await page.getByRole("button", { name: "로그인하러 가기" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("로그인 후 에디터 파일 저장, 마이페이지 프로필 확인, [+ 코드 추가] 모달, 더블클릭 상세 모달, 시뮬레이터 연동 및 파일 삭제 검증", async ({
    page,
  }) => {
    await loginAsTestUser(page);

    const uniqueId = Date.now();
    const editorSavedFileName = `e2e_editor_${uniqueId}.c`;
    const modalSavedFileName = `e2e_modal_${uniqueId}.c`;
    const asmSavedFileName = `e2e_asm_${uniqueId}.s`;

    // 1. 시뮬레이터 C 에디터에서 서버 저장 (window.prompt 핸들링)
    const cEditorRegion = page.getByRole("region", {
      name: "Translation C 편집기",
    });
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("prompt");
      await dialog.accept(editorSavedFileName);
    });
    await cEditorRegion.getByTitle("현재 소스 코드를 서버에 저장").click();
    await expect(cEditorRegion).toContainText(`(${editorSavedFileName})`, {
      timeout: 15_000,
    });

    // 2. 헤더의 사용자 이름('마이페이지로 이동') 버튼 클릭하여 마이페이지(/my) 이동
    await page.locator("header").getByTitle("마이페이지로 이동").click();
    await expect(page).toHaveURL(/\/my/);
    await expect(
      page.getByRole("heading", { name: "마이페이지" })
    ).toBeVisible();
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // 에디터에서 저장한 파일이 목록에 표시되는지 확인
    await expect(page.getByText(editorSavedFileName)).toBeVisible();

    // 3. 마이페이지 [+ 코드 추가]로 로컬 파일 업로드 및 AddTaskFileModal 저장 검증
    const myFileInput = page.locator('input[type="file"][accept=".c,.s,.asm"]');
    await myFileInput.setInputFiles({
      name: modalSavedFileName,
      mimeType: "text/x-c",
      buffer: Buffer.from("int main(void) {\n  return 42;\n}\n"),
    });

    await expect(
      page.getByText("새 소스 코드 확인 및 저장")
    ).toBeVisible();
    await page.getByRole("button", { name: "저장하기" }).click();
    await expect(page.getByText(modalSavedFileName)).toBeVisible({
      timeout: 15_000,
    });

    // 4. 항목 더블클릭하여 파일 상세 확인 모달(TaskFileDetailModal) 열기 및 '선택하여 시뮬레이터로 이동' 실제 로드 검증
    const modalFileRow = page
      .locator("div[title='더블클릭하여 코드 내용 확인']")
      .filter({ hasText: modalSavedFileName });
    await modalFileRow.dispatchEvent("dblclick");
    const moveToSimBtn = page.getByRole("button", {
      name: "선택하여 시뮬레이터로 이동",
    });
    await expect(moveToSimBtn).toBeVisible();
    await expect(page.getByText("return 42;")).toBeVisible();
    await moveToSimBtn.click();

    await expect(page).toHaveURL(/\/simulator\?fileId=/);
    await expect(cEditorRegion).toContainText(`(${modalSavedFileName})`, {
      timeout: 15_000,
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          sessionStorage.getItem("archreactor.translation.source")
        )
      )
      .toContain("return 42;");

    // 5. ASM 모드 서버 저장, 저장 목록 확인 및 로컬 파일 다운로드 검증
    await page.getByRole("button", { name: "ASM", exact: true }).click();
    const asmRegion = page.getByRole("region", {
      name: "RISC-V 어셈블리 결과",
    });
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("prompt");
      await dialog.accept(asmSavedFileName);
    });
    await asmRegion
      .getByTitle("현재 어셈블리 코드를 main.s 파일로 다운로드")
      .click();
    await expect(asmRegion.getByText("✓")).toBeVisible({
      timeout: 15_000,
    });

    // ASM 불러오기 팝업에서 저장된 파일 노출 및 로컬 다운로드 이벤트 확인
    await asmRegion
      .getByTitle("어셈블리 파일 불러오기 및 예제 템플릿 열기")
      .click();
    await expect(page.getByText("저장된 어셈블리 파일")).toBeVisible();
    const savedAsmRow = page
      .locator("div[title='클릭하여 어셈블리 에디터에 열기']")
      .filter({ hasText: asmSavedFileName });
    await expect(savedAsmRow).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      savedAsmRow.getByTitle("로컬 파일로 다운로드").click(),
    ]);
    expect(download.suggestedFilename()).toContain(asmSavedFileName);

    // 6. 마이페이지 복귀 후 생성한 테스트 파일 3종 삭제 정리 (단건 삭제 & 선택 일괄 삭제)
    await page.locator("header").getByTitle("마이페이지로 이동").click();
    await expect(page).toHaveURL(/\/my/);

    const modalFileRowCleanup = page
      .locator("div[title='더블클릭하여 코드 내용 확인']")
      .filter({ hasText: modalSavedFileName });
    await expect(modalFileRowCleanup).toBeVisible({ timeout: 15_000 });
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await modalFileRowCleanup.getByRole("button", { name: "삭제" }).click();
    await expect(page.getByText(modalSavedFileName)).toHaveCount(0);

    // 나머지 에디터 C 파일 & ASM 파일은 체크박스 선택 후 '선택 삭제'로 일괄 제거
    for (const fileName of [editorSavedFileName, asmSavedFileName]) {
      const row = page
        .locator("div[title='더블클릭하여 코드 내용 확인']")
        .filter({ hasText: fileName });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.locator('input[type="checkbox"]').check();
    }
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole("button", { name: /선택 삭제/ }).click();
    await expect(page.getByText(editorSavedFileName)).toHaveCount(0);
    await expect(page.getByText(asmSavedFileName)).toHaveCount(0);
  });
});
