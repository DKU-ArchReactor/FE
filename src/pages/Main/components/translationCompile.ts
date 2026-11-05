import { compileCode } from "@/api/build";
import type { SimulationArtifact } from "@/type/simulation";

export type MappedAssemblyRow = { sourceLine: number; text: string };

export interface TranslationCompileResult {
  assembly: string;
  artifact: SimulationArtifact;
}

export async function compileTranslation(source: string): Promise<TranslationCompileResult> {
  const result = await compileCode({
    content: source,
    lang: "c",
    compile_profile: "rv32im",
    compiler_opt: "-O0 -g",
  });
  if (result.status !== "success") {
    throw new Error(result.log || "컴파일에 실패했습니다.");
  }
  if (!result.assembly_url) throw new Error("어셈블리 결과를 찾을 수 없습니다.");

  // 1. 어셈블리 텍스트 가져오기
  const response = await fetch(result.assembly_url);
  if (!response.ok) throw new Error(`어셈블리 파일을 불러오지 못했습니다. (HTTP ${response.status})`);
  const assembly = await response.text();

  const targetToken = result.build_id ? { build_id: result.build_id } : result.simulation_token ? { simulation_token: result.simulation_token } : null;
  if (!targetToken) throw new Error('시뮬레이션 실행에 필요한 빌드 정보가 없습니다.');

  return {
    assembly,
    artifact: targetToken,
  };
}

export function mapAssembly(assembly: string, sourceLineCount: number): MappedAssemblyRow[] {
  const sourceFiles = new Map<number, string>();
  let sourceLine: number | null = null;
  let executable = false;
  let previousExecutable = false;
  const sectionStack: boolean[] = [];
  const mapped: MappedAssemblyRow[] = [];

  for (const raw of assembly.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const file = line.match(/^\.file\s+(\d+)\s+(.+)$/);
    if (file) {
      const names = [...file[2].matchAll(/"((?:\\.|[^"\\])*)"/g)];
      const name = names.at(-1)?.[1];
      if (name) sourceFiles.set(Number(file[1]), name.replace(/\\\\/g, "/").split("/").at(-1) || name);
      continue;
    }
    const section = line.match(/^\.(section|pushsection)\s+([^,\s]+)(?:\s*,\s*"([^"]*)")?/);
    if (section) {
      if (section[1] === "pushsection") sectionStack.push(executable);
      previousExecutable = executable;
      executable = section[3]?.includes("x") ?? /^\.text(?:\.|$)/.test(section[2]);
      sourceLine = null;
      continue;
    }
    if (/^\.(?:text|data|bss|rodata)(?:\s|$)/.test(line)) {
      executable = /^\.text(?:\s|$)/.test(line);
      sourceLine = null;
      continue;
    }
    if (line === ".popsection" || line === ".previous") {
      const next = line === ".popsection" ? sectionStack.pop() ?? false : previousExecutable;
      previousExecutable = executable;
      executable = next;
      sourceLine = null;
      continue;
    }
    if (/^\.(?:cfi_endproc|size)\b/.test(line)) {
      sourceLine = null;
      continue;
    }
    const location = line.match(/^\.loc\s+(\d+)\s+(\d+)\b/);
    if (location) {
      const candidate = Number(location[2]);
      sourceLine = sourceFiles.get(Number(location[1])) === "source.c" && candidate > 0 && candidate <= sourceLineCount ? candidate : null;
      continue;
    }
    if (!executable || !line || line.startsWith(".")) continue;
    if (/^[.$\w]+:$/.test(line)) continue;
    if (/^[a-zA-Z][\w.]*\s*[^=]*$/.test(line) && sourceLine !== null) {
      mapped.push({ sourceLine, text: line });
    }
  }
  return mapped;
}
