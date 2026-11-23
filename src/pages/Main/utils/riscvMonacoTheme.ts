import type { Monaco } from "@monaco-editor/react";
import { RISCV_LANGUAGE_ID, riscvLanguageDef } from "./riscvLanguage";

export const STAGES_CONFIG: {
  key: "IF" | "ID" | "EX" | "MEM" | "WB";
  name: string;
  badgeBg: string;
  mappedBg: string;
}[] = [
  {
    key: "IF",
    name: "IF",
    badgeBg: "bg-[#EF4444] text-white",
    mappedBg: "bg-red-500/10 dark:bg-red-500/20 border-red-400/60 dark:border-red-500/50 text-red-950 dark:text-red-200",
  },
  {
    key: "ID",
    name: "ID",
    badgeBg: "bg-[#F97316] text-white",
    mappedBg: "bg-orange-500/10 dark:bg-orange-500/20 border-orange-400/60 dark:border-orange-500/50 text-orange-950 dark:text-orange-200",
  },
  {
    key: "EX",
    name: "EX",
    badgeBg: "bg-[#22C55E] dark:bg-[#15803D] text-white",
    mappedBg: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-400/60 dark:border-emerald-500/50 text-emerald-950 dark:text-emerald-200",
  },
  {
    key: "MEM",
    name: "MEM",
    badgeBg: "bg-[#0EA5E9] text-white",
    mappedBg: "bg-sky-500/10 dark:bg-sky-500/20 border-sky-400/60 dark:border-sky-500/50 text-sky-950 dark:text-sky-200",
  },
  {
    key: "WB",
    name: "WB",
    badgeBg: "bg-[#8B5CF6] text-white",
    mappedBg: "bg-purple-500/10 dark:bg-purple-500/20 border-purple-400/60 dark:border-purple-500/50 text-purple-950 dark:text-purple-200",
  },
];

export function getRiscvMonacoThemeName(mode: "single" | "pipeline", theme: "light" | "dark"): string {
  if (mode === "single") {
    return theme === "dark" ? "riscv-asm-single-dark" : "riscv-asm-single-light";
  }
  return theme === "dark" ? "riscv-asm-theme-dark" : "riscv-asm-theme-light";
}

export function registerRiscvAndThemes(monacoInstance: Monaco): void {
  // 1. RISC-V 커스텀 언어 등록 (최초 1회 등록)
  if (!monacoInstance.languages.getLanguages().some((l: { id: string }) => l.id === RISCV_LANGUAGE_ID)) {
    monacoInstance.languages.register({ id: RISCV_LANGUAGE_ID });
    monacoInstance.languages.setMonarchTokensProvider(RISCV_LANGUAGE_ID, riscvLanguageDef);
  }

  // 2. 테마는 언어 등록 상태와 무관하게 항상 확실하게 등록
  // [파이프라인 모드] 라이트: Opcode 보라색 bold (#6D28D9)
  monacoInstance.editor.defineTheme("riscv-asm-theme-light", {
    base: "vs",
    inherit: false,
    rules: [
      { token: "keyword", foreground: "6D28D9", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "6E7681", fontStyle: "italic" },
      { token: "type.identifier", foreground: "1F2328", fontStyle: "bold" },
      { token: "variable.predefined", foreground: "24292F" },
      { token: "identifier", foreground: "24292F" },
      { token: "number", foreground: "24292F" },
      { token: "number.hex", foreground: "24292F" },
      { token: "comment", foreground: "8C959F", fontStyle: "italic" },
      { token: "string", foreground: "24292F" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#24292F",
      "editorLineNumber.foreground": "#8C959F",
      "editorLineNumber.activeForeground": "#6D28D9",
      "editorGutter.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
    },
  });

  // [파이프라인 모드] 다크: Opcode 보라색 bold (#A78BFA)
  monacoInstance.editor.defineTheme("riscv-asm-theme-dark", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "keyword", foreground: "A78BFA", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "858585", fontStyle: "italic" },
      { token: "type.identifier", foreground: "E9D5FF", fontStyle: "bold" },
      { token: "variable.predefined", foreground: "CCCCCC" },
      { token: "identifier", foreground: "CCCCCC" },
      { token: "number", foreground: "CCCCCC" },
      { token: "number.hex", foreground: "CCCCCC" },
      { token: "comment", foreground: "6E7681", fontStyle: "italic" },
      { token: "string", foreground: "CCCCCC" },
    ],
    colors: {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#CCCCCC",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#C4B5FD",
      "editorGutter.background": "#1E1E1E",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
    },
  });

  // [싱글 사이클 모드] 라이트: Opcode 파란색 bold (#005FB8)
  monacoInstance.editor.defineTheme("riscv-asm-single-light", {
    base: "vs",
    inherit: false,
    rules: [
      { token: "keyword", foreground: "005FB8", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "6E7681", fontStyle: "italic" },
      { token: "type.identifier", foreground: "1F2328", fontStyle: "bold" },
      { token: "variable.predefined", foreground: "24292F" },
      { token: "identifier", foreground: "24292F" },
      { token: "number", foreground: "24292F" },
      { token: "number.hex", foreground: "24292F" },
      { token: "comment", foreground: "8C959F", fontStyle: "italic" },
      { token: "string", foreground: "24292F" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#24292F",
      "editorLineNumber.foreground": "#8C959F",
      "editorLineNumber.activeForeground": "#005FB8",
      "editorGutter.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
    },
  });

  // [싱글 사이클 모드] 다크: Opcode 파란색 bold (#569CD6)
  monacoInstance.editor.defineTheme("riscv-asm-single-dark", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
      { token: "keyword.directive", foreground: "858585", fontStyle: "italic" },
      { token: "type.identifier", foreground: "9CDCFE", fontStyle: "bold" },
      { token: "variable.predefined", foreground: "CCCCCC" },
      { token: "identifier", foreground: "CCCCCC" },
      { token: "number", foreground: "CCCCCC" },
      { token: "number.hex", foreground: "CCCCCC" },
      { token: "comment", foreground: "6E7681", fontStyle: "italic" },
      { token: "string", foreground: "CCCCCC" },
    ],
    colors: {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#CCCCCC",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#79C0FF",
      "editorGutter.background": "#1E1E1E",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
    },
  });
}
