export type CodeLanguage = 'c' | 'asm';
export interface CodeProgram { language: CodeLanguage; source: string }

/** Strip C/ASM comments while preserving string literals and original blank lines. */
export function stripCodeComments(source: string, language: CodeLanguage): string {
  const originalLines = source.split('\n');
  let out = '';
  let quote: '"' | "'" | null = null;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < source.length) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }

    if ((ch === '/' && next === '/') || (language === 'asm' && ch === '#')) {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  const strippedLines = out.split('\n');
  const result: string[] = [];
  for (let idx = 0; idx < strippedLines.length; idx += 1) {
    const cleaned = strippedLines[idx].trimEnd();
    const wasBlank = (originalLines[idx] ?? '').trim() === '';
    if (cleaned.length > 0 || wasBlank) {
      result.push(cleaned);
    }
  }
  return result.join('\n').trimEnd();
}

/** Only closed fences with a supported language can replace an editor. */
export function extractCodePrograms(text: string): CodeProgram[] {
  const programs: CodeProgram[] = [];
  let fence: { marker: string; length: number; language: CodeLanguage | null; lines: string[] } | null = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/.exec(line);
      if (opening) {
        const tag = opening[2].trim().toLowerCase();
        fence = {
          marker: opening[1][0], length: opening[1].length,
          language: tag === 'c' ? 'c' : ['asm', 'assembly', 'riscv', 'risc-v'].includes(tag) ? 'asm' : null,
          lines: [],
        };
      }
      continue;
    }
    const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
    if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
      const source = fence.lines.join('\n');
      if (fence.language && source.trim() && !source.includes('\0') && new TextEncoder().encode(source).length <= 65535) {
        programs.push({ language: fence.language, source: source + '\n' });
      }
      fence = null;
    } else fence.lines.push(line);
  }
  return programs;
}

/** Conservative opt-in from the user's request only, never from model output. */
export function requestsCodeApplication(text: string): boolean {
  if (/하지|말아|말고|마세요|말고요|않|지\s*마|설명|의미|방법|어떻게|가능|[“”‘’"`]|할\s*수|[?？]|\b(don['’]?t|do not|how|can|could)\b/i.test(text)) return false;
  return /(?:편집기|에디터|(?:C|ASM|어셈블리)\s*코드\s*영역).{0,30}(?:넣어|적용해|작성해|채워|바꿔|반영해)/i.test(text)
    || /\b(?:apply|insert|write|put|replace)\b.{0,60}\b(?:editor|code area)\b/i.test(text);
}

export function requestedCodeLanguage(text: string, fallback: CodeLanguage): CodeLanguage {
  // A named destination takes precedence over the source language in conversion requests.
  const destination = /(?:\b(C|ASM|assembly)\b|어셈블리)\s*(?:코드\s*)?(?:영역|편집기|에디터)(?:에|로)/i.exec(text);
  if (destination) return destination[1]?.toLowerCase() === 'c' ? 'c' : 'asm';
  const c = /\bC\b|C언어/i.test(text);
  const asm = /\b(?:ASM|assembly)\b|어셈블리/i.test(text);
  return c === asm ? fallback : c ? 'c' : 'asm';
}

export function codeGenerationQuestion(text: string, apply: boolean, language: CodeLanguage = 'c'): string {
  const generationRequest = /(?:예제|예시|코드|프로그램).{0,40}(?:만들|작성|생성|수정|보여|추천|부탁)|(?:만들어|작성해|생성해|보여줘|추천해).{0,40}(?:예제|예시|코드|프로그램)|\b(?:generate|write|create|show|provide|give)\b.{0,40}\b(?:code|example|sample|program)\b/i.test(text);
  if (!apply && !generationRequest) return text;
  const target = requestedCodeLanguage(text, language);
  const instructions = target === 'c'
    ? 'C 편집기에 적용할 수 있도록 int main(void) 함수 하나만 있는 완성된 C 프로그램을 하나의 ```c 코드 블록으로 작성해 줘. 32비트 이하 정수형 지역·전역 변수, 고정 배열, 포인터, volatile, static 전역 변수를 허용해. 동적 할당·연산·조건문·반복문은 main 안에 작성해. 헤더는 #include <stdlib.h>만, 함수 호출은 malloc·calloc·realloc·free만 허용해. 추가 함수·간접 호출·입출력·extern·다른 전처리 지시문·실수형·long long·가변 길이 배열·인라인 어셈블리는 사용하지 마. 동적 할당 시 NULL 검사와 free를 포함하고 realloc은 임시 포인터로 실패를 처리해. 힙은 메타데이터 포함 4 KiB이고 실행 제한은 2000클록이므로 작은 예제를 작성해. 입력은 초기값으로 지정하고 결과는 변수·배열이나 정수 반환값으로 확인하며 콘솔 출력으로 설명하지 마.'
    : 'ASM 편집기에 적용할 수 있도록 .text, .globl main, main 레이블과 ret을 포함한 완성된 RV32IM RISC-V 어셈블리 프로그램을 하나의 ```asm 코드 블록으로 작성해 줘. 외부 라이브러리·입출력·ecall 없이 결과를 a0로 반환하는 짧은 예제를 선호해. x86이나 ARM 문법은 사용하지 마.';
  const singleExample = '후보나 주제를 나열하거나 사용자에게 번호·옵션 선택 또는 추가 확인을 요구하지 마. 요청한 주제에 맞는 대표 예제 하나를 직접 정해 바로 작성해 줘. 세부 조건이 없으면 학습하기 쉬운 짧은 예제를 스스로 정하고, 가정은 한 문장으로만 알려 줘. 대안·변형·추가 예제 없이 완성된 프로그램 정확히 하나와 코드 블록 정확히 하나만 제공해 줘.';
  const question = text + '\n\n' + singleExample + ' ' + instructions + ' 코드 블록 안에는 주석(C의 //·/* */, ASM의 #)을 일절 넣지 말고 순수 코드만 작성해 줘. 생략 부호나 변경 부분만 출력하지 말고 전체 소스를 포함해 줘. 설명은 코드 블록 밖에 짧게 쓰고, 직접 저장·컴파일·실행했다고 주장하지 마.';
  return [...question].length <= 8000 ? question : text;
}
