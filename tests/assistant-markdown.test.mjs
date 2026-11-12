import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/AssistantMarkdown.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace(/^import ['"].*\.css['"];\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`);
const { AssistantMarkdown } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const render = text => renderToStaticMarkup(createElement(AssistantMarkdown, { text }));

test('renders model markdown, tables, code and both math delimiter styles', () => {
  const html = render('### CPI\n\n**Cycles Per Instruction**\n\n- 사이클 / 명령어\n\n`ra`\n\n```c\nint a = 5;\n```\n\n| 값 | 결과 |\n| --- | --- |\n| CPI | 1 |\n\n\\[\\text{CPI} = \\frac{100}{25}\\]\n\n인라인 \\(x+1\\), $x+2$.');
  for (const fragment of ['<h3>CPI</h3>', '<strong>Cycles Per Instruction</strong>', '<ul>', '<code>ra</code>', '<pre>', '<table>', 'katex-display', 'class="katex"']) {
    assert.ok(html.includes(fragment), fragment);
  }
});

test('untrusted answer HTML, unsafe links and images cannot execute or load', () => {
  const html = render('<script>alert(1)</script>\n\n<img src="https://example.com/track" onerror="alert(1)">\n\n[bad](javascript:alert%281%29)\n\n![image](https://example.com/track)\n\n[docs](https://example.com/docs)\n\n$\\href{javascript:alert(1)}{bad}$');
  assert.doesNotMatch(html, /<script|<img|href="javascript:|onerror=/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('normalizing math preserves code and incomplete streaming fences', () => {
  for (const text of ['`\\(code\\)`', '```c\n\\[code\\]\n```', '```c\n\\[code\\]', '~~~\n\\(code\\)\n~~~']) {
    assert.doesNotMatch(render(text), /class="katex/);
    assert.match(render(text), /code/);
  }
  const text = '**CPI**\n\n\\[\\frac{100}{25}\\]\n\n```c\nint x = 1;\n```';
  for (let i = 0; i <= text.length; i++) assert.doesNotThrow(() => render(text.slice(0, i)));
});
