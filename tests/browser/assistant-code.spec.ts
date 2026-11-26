import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const original = 'int main(void) { return 0; }';
const code = 'int main(void) {\n  int sum = 0;\n  for (int i = 1; i <= 10; i++) sum += i;\n  return sum;\n}\n';
const asmOriginal = '.text\n.globl main\nmain:\n  li a0, 0\n  ret\n';
const asmCode = '.text\n.globl main\nmain:\n  li a0, 55\n  ret\n';
const asmAnswer = '```asm\n' + asmCode + '```';
const answer = '1부터 10까지 합을 반환합니다.\n\n```c\n' + code + '```';
const frame = (event: object) => `data: ${JSON.stringify(event)}\n\n`;
const sse = (text = answer, reason = 'end_turn') => frame({type:'delta', text}) + frame({type:'done', stop_reason: reason});
const input = (page: Page) => page.getByPlaceholder('C 코드나 파이프라인에 대해 질문하세요...').filter({visible:true});
async function setup(page: Page) {
  await page.addInitScript(() => localStorage.setItem('access_token', 'test-only'));
  await page.route('**/api/v1/assistant/status', route => route.fulfill({json:{enabled:true,code:'TEST',editor_source_supported:true}}));
  await page.goto('/tests/browser/code-harness.html');
  await expect(input(page)).toBeEnabled();
}
async function send(page: Page, text = '반복문 예제를 만들어줘') {
  await input(page).fill(text);
  await page.getByRole('button', {name:'전송',exact:true}).click();
}
test('manual application, undo, and undo disabled after subsequent edits', async ({page}) => {
  await setup(page);
  let payload: any;
  await page.route('**/api/v1/assistant/chat', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({contentType:'text/event-stream',body:sse()});
  });
  await send(page);
  const apply = page.getByRole('button', {name:'C 코드에 적용',exact:true});
  await expect(apply).toBeVisible();
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
  expect(payload.messages[0].content).toContain('main 함수를 포함한');
  expect(Object.keys(payload).sort()).toEqual(['editor_source','messages']);
  await apply.click();
  await expect(page.getByLabel('C 원문')).toHaveValue(code);
  await page.getByRole('button', {name:'코드 적용 되돌리기'}).click();
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
  await apply.click();
  await page.getByLabel('C 원문').fill(code+'// user edit');
  await expect(page.getByRole('button', {name:'코드 적용 되돌리기'})).toHaveCount(0);
});
test('explicit request automatically applies without an automatic application checkbox', async ({page}) => {
  await setup(page);
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse(answer,'stop')}));
  await input(page).fill('예제를 만들어서 C 코드 영역에 넣어줘');
  await expect(page.getByLabel(/생성 후.*자동 적용/)).toHaveCount(0);
  await page.getByRole('button', {name:'전송',exact:true}).click();
  await expect(page.getByLabel('C 원문')).toHaveValue(code);
  await page.getByRole('button', {name:'코드 적용 되돌리기'}).click();
  await send(page);
  await expect(page.getByRole('button', {name:'C 코드에 적용',exact:true})).toHaveCount(2);
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
});
for (const change of ['edit', 'edit-and-restore', 'asm-edit', 'file', 'mode', 'busy']) {
  test(`pending automatic application protects ${change}`, async ({page}) => {
    await setup(page);
    let release!: () => void;
    let started = false;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/assistant/chat', async route => {
      started = true; await wait;
      await route.fulfill({contentType:'text/event-stream',body:sse()});
    });
    await send(page, '예제를 만들어서 편집기에 넣어줘');
    await expect.poll(() => started).toBe(true);
    if (change === 'asm-edit') await page.getByLabel('ASM 원문').fill(asmCode);
    else if (change.startsWith('edit')) {
      await page.getByLabel('C 원문').fill('int main() { return 42; }');
      if (change === 'edit-and-restore') await page.getByLabel('C 원문').fill(original);
    } else await page.getByRole('button', {name:change==='file'?'switch file':change==='mode'?'switch editor':'toggle busy'}).click();
    release();
    await expect(page.getByText(/편집 내용이나 작업 상태가 바뀌어/)).toBeVisible();
    await expect(page.getByLabel('C 원문')).toHaveValue(change === 'edit' ? 'int main() { return 42; }' : original);
  });
}
for (const [name, body] of [
  ['truncation', sse(answer,'max_tokens')],
  ['disconnect', frame({type:'delta',text:answer})],
  ['unclosed fence', sse('```c\nint main() {')],
  ['foreign code', sse('```python\nprint(1)\n```')],
  ['error', frame({type:'error',code:'MODEL_ERROR',message:'test failure'})],
]) {
  test(`${name} cannot replace source`, async ({page}) => {
    await setup(page);
    await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body}));
    await send(page, '예제를 만들어서 편집기에 넣어줘');
    await expect(page.getByRole('button',{name:'전송',exact:true})).toBeVisible();
    await expect(page.getByLabel('C 원문')).toHaveValue(original);
    await expect(page.getByRole('button',{name:'C 코드에 적용',exact:true})).toHaveCount(0);
  });
}
test('multiple C candidates require a choice; negated application stays manual', async ({page}) => {
  await setup(page);
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse(answer+'\n\n```c\nint main() { return 7; }\n```')}));
  await send(page, '예제를 만들어서 편집기에 넣어줘');
  await expect(page.getByText(/코드가 여러 개라/)).toBeVisible();
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
  await page.getByRole('button',{name:'C 코드에 적용 (2)',exact:true}).click();
  await expect(page.getByLabel('C 원문')).toHaveValue('int main() { return 7; }\n');
  await page.getByRole('button',{name:'코드 적용 되돌리기'}).click();
  await input(page).fill('예제를 만들어줘. 편집기에 적용하지 말아줘');
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse()}));
  await page.getByRole('button',{name:'전송',exact:true}).click();
  await expect(page.getByRole('button',{name:'C 코드에 적용',exact:true})).toBeVisible();
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
});
for (const target of ['c', 'asm'] as const) {
test(`real workspace applies ${target} to Monaco, invalidates old run, and sends new source to compilation`, async ({page}) => {
  await setup(page);
  await page.route('**/auth/me', route => route.fulfill({json:{user_id:'test',name:'Test',email:'test@example.invalid',role:'user'}}));
  await page.route('**/api/v1/files**', route => route.fulfill({json:[]}));
  await page.route('https://**/*', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/**', route => {
    const suffix = new URL(route.request().url()).pathname.split('/min/vs/')[1];
    return route.fulfill({path:fileURLToPath(new URL(`../../node_modules/monaco-editor/min/vs/${suffix}`,import.meta.url))});
  });
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse(target === 'c' ? answer : asmAnswer)}));
  let compiled: any;
  await page.route('**/api/v1/build/compile', route => {
    compiled = route.request().postDataJSON();
    return route.fulfill({json:{status:'success',simulation_token:'test-only'}});
  });
  await page.route('**/api/v1/simulation/run', route => {
    const mode = route.request().postDataJSON().mode;
    const result = JSON.parse(readFileSync(new URL(`./fixtures/${mode}.json`,import.meta.url),'utf8'));
    return route.fulfill({json:{result}});
  });
  await page.route('**/api/v1/tutor/explain', route => route.fulfill({json:{items:[]}}));
  await page.goto('/pipeline');
  await page.getByTitle('C 코드 컴파일 및 어셈블리 변환',{exact:true}).filter({visible:true}).click();
  const next = page.getByTitle('다음 스텝 실행 (Step Forward)',{exact:true}).filter({visible:true});
  await expect(next).toBeEnabled();
  await page.getByTitle('ArchReactor AI 어시스턴트 열기',{exact:true}).click();
  await send(page,`${target.toUpperCase()} 예제를 만들어서 ${target.toUpperCase()} 코드 영역에 넣어줘`);
  await expect(page.getByText(`${target.toUpperCase()} 코드에 적용했습니다. 컴파일하여 결과를 확인하세요.`,{exact:true})).toBeVisible();
  await page.screenshot({path:`test-results/assistant-${target}-applied.png`});
  await page.getByTitle('창 닫기',{exact:true}).click();
  await expect(page.locator('.monaco-editor').filter({hasText:target === 'c' ? 'sum' : 'li a0, 55'}).first()).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByTitle(target === 'c' ? 'C 코드 컴파일 및 어셈블리 변환' : '어셈블리 빌드 및 시뮬레이션 준비',{exact:true}).filter({visible:true}).click();
  await expect.poll(() => compiled?.content).toBe(target === 'c' ? code : asmCode);
  expect(compiled.file_id).toBeUndefined();
  await page.screenshot({path:`test-results/assistant-${target}-workspace.png`});
});
}

test('stopping generation prevents a late answer from applying code', async ({page}) => {
  await setup(page);
  let release!: () => void;
  let started = false;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/assistant/chat', async route => {
    started = true; await wait;
    await route.fulfill({contentType:'text/event-stream',body:sse()});
  });
  await send(page,'예제를 만들어서 편집기에 넣어줘');
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button',{name:'중단',exact:true}).click();
  release();
  await expect(page.getByText('답변 생성을 중단했습니다.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
  await expect(page.getByRole('button',{name:'C 코드에 적용',exact:true})).toHaveCount(0);
});

test('switching files clears undo even when source content is identical', async ({page}) => {
  await setup(page);
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse()}));
  await send(page,'예제를 만들어서 편집기에 넣어줘');
  await expect(page.getByRole('button',{name:'코드 적용 되돌리기'})).toBeVisible();
  await page.getByRole('button',{name:'switch file',exact:true}).click();
  await expect(page.getByRole('button',{name:'코드 적용 되돌리기'})).toHaveCount(0);
});

for (const automatic of [false, true]) {
  test(`ASM ${automatic ? 'automatic' : 'manual'} application switches editor and undo restores only ASM`, async ({page}) => {
    await setup(page);
    let payload: any;
    await page.route('**/api/v1/assistant/chat', route => {
      payload = route.request().postDataJSON();
      return route.fulfill({contentType:'text/event-stream',body:sse(asmAnswer)});
    });
    await send(page, automatic ? 'ASM 예제를 만들어서 ASM 코드 영역에 넣어줘' : 'ASM 예제를 만들어줘');
    const apply = page.getByRole('button', {name:'ASM 코드에 적용',exact:true});
    await expect(apply).toBeVisible();
    expect(payload.messages[0].content).toContain('완성된 RV32IM RISC-V');
    if (!automatic) {
      await expect(page.getByLabel('ASM 원문')).toHaveValue(asmOriginal);
      await apply.click();
    }
    await expect(page.getByLabel('ASM 원문')).toHaveValue(asmCode);
    await expect(page.getByLabel('C 원문')).toHaveValue(original);
    await expect(page.getByTestId('editor-language')).toHaveText('asm');
    await page.getByRole('button', {name:'switch editor',exact:true}).click();
    await page.getByRole('button', {name:'코드 적용 되돌리기'}).click();
    await expect(page.getByLabel('ASM 원문')).toHaveValue(asmOriginal);
    await expect(page.getByLabel('C 원문')).toHaveValue(original);
    await expect(page.getByTestId('editor-language')).toHaveText('asm');
  });
}
test('ASM mode guides generic generation and allows C application to switch back', async ({page}) => {
  await setup(page);
  await page.getByRole('button', {name:'switch editor',exact:true}).click();
  let payload: any;
  await page.route('**/api/v1/assistant/chat', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({contentType:'text/event-stream',body:sse()});
  });
  await send(page);
  const apply = page.getByRole('button', {name:'C 코드에 적용',exact:true});
  await expect(apply).toBeVisible();
  expect(payload.messages[0].content).toContain('```asm');
  await apply.click();
  await expect(page.getByTestId('editor-language')).toHaveText('c');
  await expect(page.getByLabel('C 원문')).toHaveValue(code);
  await expect(page.getByLabel('ASM 원문')).toHaveValue(asmOriginal);
});
test('wrong-language response cannot auto apply to an explicit ASM request', async ({page}) => {
  await setup(page);
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse()}));
  await send(page,'ASM 코드를 만들어서 편집기에 넣어줘');
  await expect(page.getByText(/요청한 ASM 코드가 아니어서/)).toBeVisible();
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
  await expect(page.getByLabel('ASM 원문')).toHaveValue(asmOriginal);
});
test('mixed C and ASM candidates require a choice and apply to the chosen editor', async ({page}) => {
  await setup(page);
  await page.route('**/api/v1/assistant/chat', route => route.fulfill({contentType:'text/event-stream',body:sse(answer+'\n'+asmAnswer)}));
  await send(page,'ASM 예제를 만들어서 편집기에 넣어줘');
  await expect(page.getByText(/코드가 여러 개라/)).toBeVisible();
  await expect(page.getByLabel('ASM 원문')).toHaveValue(asmOriginal);
  await page.getByRole('button',{name:'ASM 코드에 적용 (2)',exact:true}).click();
  await expect(page.getByLabel('ASM 원문')).toHaveValue(asmCode);
  await expect(page.getByLabel('C 원문')).toHaveValue(original);
});

test('example recommendations send a single-program instruction and can be applied immediately', async ({page}) => {
  await setup(page);
  let payload: any;
  await page.route('**/api/v1/assistant/chat', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({contentType:'text/event-stream',body:sse()});
  });
  await send(page, '반복문 예제 추천해줘');
  const apply = page.getByRole('button', {name:'C 코드에 적용',exact:true});
  await expect(apply).toHaveCount(1);
  expect(payload.messages[0].content).toContain('선택 또는 추가 확인을 요구하지 마');
  expect(payload.messages[0].content).toContain('완성된 프로그램 정확히 하나와 코드 블록 정확히 하나');
  await apply.click();
  await expect(page.getByLabel('C 원문')).toHaveValue(code);
});
