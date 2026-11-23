import { test as base, expect, type Page } from "@playwright/test";

export const TEST_USER = {
  email: process.env.E2E_USER_EMAIL || "test@dankook.ac.kr",
  password: process.env.E2E_USER_PASSWORD || "test1234",
};

export interface ErrorMonitor {
  runtimeErrors: Error[];
  httpErrors: { status: number; method: string; url: string }[];
  allowHttpError: (matcher: RegExp | string | number) => void;
  clearHttpErrors: () => void;
}

export const test = base.extend<{
  errorMonitor: ErrorMonitor;
}>({
  errorMonitor: [
    async ({ page }, use) => {
      const runtimeErrors: Error[] = [];
      const httpErrors: { status: number; method: string; url: string }[] = [];
      const allowedMatchers: (RegExp | string | number)[] = [];

      const isAllowed = (status: number, url: string) =>
        allowedMatchers.some((m) => {
          if (typeof m === "number") return m === status;
          if (typeof m === "string") return url.includes(m);
          return m.test(url);
        });

      const onPageError = (err: Error) => {
        const msg = err?.message || String(err);
        // Mixed Content / HTTPS 경고 및 Monaco Editor 언마운트 시 내부 Canceled 토큰은 무시
        if (
          /mixed content|https-only|insecure|ssl|certificate/i.test(msg) ||
          msg === "Canceled" ||
          err?.name === "Canceled"
        ) {
          return;
        }
        console.error(`[JS PageError] ${msg}`);
        runtimeErrors.push(err);
      };

      const onConsole = (msg: any) => {
        if (msg.type() === "warning" || msg.type() === "error") {
          const text: string = msg.text();
          if (/mixed content|https|insecure request|upgrade-insecure-requests/i.test(text)) {
            return;
          }
        }
      };

      const onResponse = (response: any) => {
        const status = response.status();
        const url = response.url();
        const method = response.request().method();

        if (status >= 400) {
          // favicon 등 브라우저 부가 요청 또는 명시적으로 허용한 네거티브 테스트 응답인지 확인
          if (url.endsWith("/favicon.ico")) return;
          console.warn(`[HTTP Error Detected] ${status} ${method} ${url}`);
          if (!isAllowed(status, url)) {
            httpErrors.push({ status, method, url });
          }
        }
      };

      page.on("pageerror", onPageError);
      page.on("console", onConsole);
      page.on("response", onResponse);

      const monitor: ErrorMonitor = {
        runtimeErrors,
        httpErrors,
        allowHttpError: (matcher) => {
          allowedMatchers.push(matcher);
        },
        clearHttpErrors: () => {
          httpErrors.length = 0;
        },
      };

      await use(monitor);

      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("response", onResponse);

      expect(
        runtimeErrors,
        `브라우저 콘솔 JS 런타임 에러(pageerror)가 발생했습니다: ${runtimeErrors
          .map((e) => e.message)
          .join(" | ")}`
      ).toHaveLength(0);

      expect(
        httpErrors,
        `네트워크 요청 중 HTTP 400 이상 에러가 감지되었습니다: ${httpErrors
          .map((e) => `[${e.status}] ${e.method} ${e.url}`)
          .join(", ")}`
      ).toHaveLength(0);
    },
    { auto: true },
  ],
});

/**
 * S3 정적 웹사이트 호스팅 환경에서도 안전하게 SPA 라우트로 이동하기 위한 헬퍼
 */
export async function gotoSpaRoute(page: Page, path: string) {
  const currentUrl = page.url();
  if (!currentUrl || currentUrl === "about:blank") {
    await page.goto("/");
  }
  if (path === "/") {
    if (new URL(page.url()).pathname !== "/") {
      await page.evaluate(() => {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    }
    return;
  }
  await page.evaluate((targetPath) => {
    window.history.pushState({}, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/**
 * 테스트 계정 로그인 공통 헬퍼
 */
export async function loginAsTestUser(page: Page) {
  await page.goto("/");
  const loginLink = page.getByRole("link", { name: "로그인" });
  if (await loginLink.isVisible()) {
    await loginLink.click();
  } else {
    await gotoSpaRoute(page, "/login");
  }

  await page.getByRole("textbox", { name: "이메일" }).fill(TEST_USER.email);
  await page.getByRole("textbox", { name: "비밀번호" }).fill(TEST_USER.password);
  await page.locator("form").getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/simulator/);
}

export { expect };
