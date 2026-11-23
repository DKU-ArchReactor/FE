import { test, expect, TEST_USER, gotoSpaRoute } from "./fixtures";

test.describe("인증(로그인/회원가입/로그아웃) 및 테마(라이트/다크) 전수 검증", () => {
  test("잘못된 계정 로그인 에러 처리, 회원가입 폼 및 중복 예외 처리, 로그인 성공 및 로그아웃 검증", async ({
    page,
    errorMonitor,
  }) => {
    await page.goto("/");
    const loginLink = page.getByRole("link", { name: "로그인" });
    if (await loginLink.isVisible()) {
      await loginLink.click();
    } else {
      await gotoSpaRoute(page, "/login");
    }
    await expect(page).toHaveURL(/\/login/);

    // 1. 잘못된 비밀번호 로그인 시도 시 에러 배너 노출 검증
    errorMonitor.allowHttpError("/auth/login");
    await page.getByRole("textbox", { name: "이메일" }).fill(TEST_USER.email);
    await page
      .getByRole("textbox", { name: "비밀번호" })
      .fill("wrong_password_123!");
    await page.locator("form").getByRole("button", { name: "로그인" }).click();

    await expect(
      page.locator("div.bg-rose-50, div.text-rose-600")
    ).toBeVisible();

    // 2. 하단 '회원가입' 링크로 회원가입 페이지 이동 및 입력 필드/중복 가입 예외 검증
    await page
      .getByText("아직 계정이 없으신가요?")
      .getByRole("button", { name: "회원가입" })
      .click();
    await expect(page).toHaveURL(/\/signup/);

    const userIdInput = page.getByLabel("아이디");
    const nameInput = page.getByLabel("이름");
    const emailInput = page.getByLabel("이메일");
    const passwordInput = page.getByLabel("비밀번호");

    await expect(passwordInput).toHaveAttribute("minlength", "8");

    // 이미 존재하는 이메일로 회원가입 요청 시 에러 메시지 표시 확인
    errorMonitor.allowHttpError("/auth/signup");
    await userIdInput.fill("existing_test_user");
    await nameInput.fill("테스트유저");
    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill("test123456");
    await page
      .locator("form")
      .getByRole("button", { name: "회원가입" })
      .click();

    await expect(
      page.locator("div.bg-rose-50, div.text-rose-600")
    ).toBeVisible();

    // 3. '이미 계정이 있으신가요? 로그인' 클릭하여 정상 로그인 수행
    await page
      .getByText("이미 계정이 있으신가요?")
      .getByRole("button", { name: "로그인" })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

    const loginEmailInput = page.getByRole("textbox", { name: "이메일" });
    const loginPasswordInput = page.getByRole("textbox", { name: "비밀번호" });
    await loginEmailInput.click();
    await loginEmailInput.fill(TEST_USER.email);
    await expect(loginEmailInput).toHaveValue(TEST_USER.email);
    await loginPasswordInput.click();
    await loginPasswordInput.fill(TEST_USER.password);
    await expect(loginPasswordInput).toHaveValue(TEST_USER.password);
    await page.locator("form").getByRole("button", { name: "로그인" }).click();

    await expect(page).toHaveURL(/\/simulator/);

    // 토큰 저장 및 헤더 사용자 프로필/로그아웃 버튼 노출 확인
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token")
    );
    expect(token).toBeTruthy();
    await expect(
      page.locator("header").getByRole("button", { name: "로그아웃" })
    ).toBeVisible();

    // 4. 로그아웃 클릭 시 토큰 제거 및 /login 이동 확인
    await page.locator("header").getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login/);
    const tokenAfterLogout = await page.evaluate(() =>
      localStorage.getItem("access_token")
    );
    expect(tokenAfterLogout).toBeNull();
  });

  test("글로벌 헤더 테마 스위치(라이트 ↔ 다크 모드) 전환 및 새로고침 시 상태 유지 검증", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(page).toHaveURL(/\/simulator/);

    const themeSwitch = page.getByRole("switch", { name: "VS Code 테마 전환" });
    await expect(themeSwitch).toBeVisible();

    // 초기 라이트 모드 확인
    await expect(themeSwitch).toHaveAttribute("aria-checked", "false");
    const initialDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(initialDarkClass).toBe(false);

    // 다크 모드로 전환
    await themeSwitch.click();
    await expect(themeSwitch).toHaveAttribute("aria-checked", "true");
    const isDarkAfterToggle = await page.evaluate(() => ({
      hasClass: document.documentElement.classList.contains("dark"),
      saved: localStorage.getItem("archreactor.theme"),
    }));
    expect(isDarkAfterToggle.hasClass).toBe(true);
    expect(isDarkAfterToggle.saved).toBe("dark");

    // 홈으로 이동 후 새로고침하고 다시 시뮬레이터로 돌아와도 다크 모드가 유지되는지 확인
    await gotoSpaRoute(page, "/");
    await page.reload();
    await page.getByRole("link", { name: "시작하기", exact: true }).click();
    await expect(themeSwitch).toHaveAttribute("aria-checked", "true");

    // 다시 라이트 모드로 복원
    await themeSwitch.click();
    await expect(themeSwitch).toHaveAttribute("aria-checked", "false");
  });

  test("토큰 만료(401) 응답 시 자동 토큰 정리 및 비로그인 헤더 복귀 검증", async ({
    page,
    errorMonitor,
  }) => {
    errorMonitor.allowHttpError("/auth/me");
    errorMonitor.allowHttpError("/api/v1/files");
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("access_token", "expired-e2e-token");
      localStorage.setItem("token_type", "bearer");
    });

    await page.route("**/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Token expired" }),
      })
    );

    await gotoSpaRoute(page, "/simulator");
    await expect(page).toHaveURL(/\/simulator/);

    // /auth/me 401 응답 후 토큰이 제거되고 헤더에 로그인 버튼이 노출되는지 확인
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("access_token"))
      )
      .toBeNull();
    await expect(
      page.locator("header").getByRole("button", { name: "로그인" })
    ).toBeVisible();
  });
});
