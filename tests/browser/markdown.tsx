// Static local preview: no API calls, user data or production entry imports.
import { createRoot } from 'react-dom/client';
import { AssistantMarkdown } from '../../src/components/AssistantMarkdown';
import '../../src/index.css';

const text = String.raw`### CPI 계산 예시

**CPI** (Cycles Per Instruction)는 명령어 하나당 사용한 사이클 수입니다.

- 실행 사이클: **100**
- 완료 명령어: **25**

\[
\text{CPI} = \frac{100}{25} = 4.0
\]

| 지표 | 값 |
| --- | --- |
| CPI | 4.0 |
| IPC | 0.25 |

~~~asm
lw t0, 0(s0)
add t1, t0, t2
~~~

> 실제 스톨 여부는 첨부한 실행 결과로 확인합니다.
`;

createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 400, margin: '24px auto', padding: 18, fontSize: 14, lineHeight: 1.7 }}>
    <h1 style={{ fontWeight: 700, marginBottom: 12 }}>AI 답변 표시 검증 · 예시 데이터</h1>
    <div style={{ background: '#f3f4f6', border: '1px solid #ddd', borderRadius: 16, padding: 18 }}>
      <AssistantMarkdown text={text} />
    </div>
  </main>,
);
