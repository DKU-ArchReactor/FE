/** Only closed, explicitly C-labelled fences are candidates for whole-editor replacement. */
export function extractCPrograms(text: string): string[] {
  const programs: string[] = [];
  let fence: { marker: string; length: number; c: boolean; lines: string[] } | null = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/.exec(line);
      if (opening) fence = {
        marker: opening[1][0], length: opening[1].length,
        c: /^(c|C)\s*$/.test(opening[2].trim()), lines: [],
      };
      continue;
    }
    const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
    if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
      const source = fence.lines.join('\n');
      if (fence.c && source.trim() && !source.includes('\0') && new TextEncoder().encode(source).length <= 65535) {
        programs.push(source + '\n');
      }
      fence = null;
    } else fence.lines.push(line);
  }
  return programs;
}

/** Conservative convenience detection. The visible checkbox can always override it. */
export function requestsCodeApplication(text: string): boolean {
  if (/하지|말아|말고|마세요|말고요|않|지\s*마|설명|의미|방법|어떻게|가능|[“”‘’"`]|할\s*수|[?？]|\b(don['’]?t|do not|how|can|could)\b/i.test(text)) return false;
  return /(?:편집기|에디터|C\s*코드\s*영역).{0,30}(?:넣어|적용해|작성해|채워|바꿔|반영해)/i.test(text)
    || /\b(?:apply|insert|write|put|replace)\b.{0,60}\b(?:editor|code area)\b/i.test(text);
}

export function codeGenerationQuestion(text: string, apply: boolean, language: 'c' | 'asm' = 'c'): string {
  if (!apply && (/(?:ASM|assembly|어셈블리)/i.test(text) || (language === 'asm' && !/\bC\b|C언어/i.test(text)))) return text;
  if (!apply && !/(?:예제|코드|프로그램).{0,40}(?:만들|작성|생성|수정)|\b(?:generate|write|create)\b.{0,40}\b(?:code|example|program)\b/i.test(text)) return text;
  const question = text + '\n\nC 편집기에 적용할 수 있도록 main 함수를 포함한 완성된 C 프로그램을 하나의 ```c 코드 블록으로 작성해 줘. 생략 부호나 변경 부분만 출력하지 말고 전체 소스를 포함해 줘. RV32IM 학습용으로 외부 라이브러리·입출력 없이 계산 결과를 main에서 반환하는 짧은 예제를 선호해. 설명은 코드 블록 밖에 짧게 쓰고, 직접 저장·컴파일·실행했다고 주장하지 마.';
  return [...question].length <= 8000 ? question : text;
}
