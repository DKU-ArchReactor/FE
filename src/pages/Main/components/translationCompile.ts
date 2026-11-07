import { compileCode } from "@/api/build";
import { runSimulation } from "@/api/simulation";
import type { SimulationResult } from "@/type/simulation";

export type MappedAssemblyRow = { sourceLine: number; text: string };

export interface TranslationCompileResult {
  assembly: string;
  simulationResult: SimulationResult | null;
  singleSimulationResult?: SimulationResult | null;
  pipelineSimulationResult?: SimulationResult | null;
  buildId?: string | null;
  simulationToken?: string | null;
}

export async function compileTranslation(
  source: string,
  preferredMode: "single" | "pipeline" = "pipeline"
): Promise<TranslationCompileResult> {
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

  // 2. Single과 Pipeline 모드를 백그라운드 병렬(Promise.all)로 동시 실행하여 즉시 캐싱
  let singleResult: SimulationResult | null = null;
  let pipelineResult: SimulationResult | null = null;
  const targetToken = result.build_id
    ? { build_id: result.build_id }
    : result.simulation_token
    ? { simulation_token: result.simulation_token }
    : null;

  if (targetToken) {
    try {
      const [pRes, sRes] = await Promise.allSettled([
        runSimulation({ ...targetToken, mode: "pipeline", max_cycles: 2000 }),
        runSimulation({ ...targetToken, mode: "single", max_cycles: 2000 }),
      ]);
      if (pRes.status === "fulfilled") pipelineResult = pRes.value;
      if (sRes.status === "fulfilled") singleResult = sRes.value;
    } catch (simError) {
      console.warn("시뮬레이션 동시 실행 실패:", simError);
    }
  }

  const activeResult = preferredMode === "single" ? (singleResult ?? pipelineResult) : (pipelineResult ?? singleResult);

  return {
    assembly,
    simulationResult: activeResult,
    singleSimulationResult: singleResult,
    pipelineSimulationResult: pipelineResult,
    buildId: result.build_id,
    simulationToken: result.simulation_token,
  };
}

export async function compileAssemblyDirectly(
  assemblySource: string,
  preferredMode: "single" | "pipeline" = "pipeline"
): Promise<TranslationCompileResult> {
  const result = await compileCode({
    content: assemblySource,
    lang: "asm",
    compile_profile: "rv32im",
    compiler_opt: "",
  });
  if (result.status !== "success") {
    throw new Error(result.log || "어셈블리 빌드에 실패했습니다.");
  }

  let singleResult: SimulationResult | null = null;
  let pipelineResult: SimulationResult | null = null;
  const targetToken = result.build_id
    ? { build_id: result.build_id }
    : result.simulation_token
    ? { simulation_token: result.simulation_token }
    : null;

  if (targetToken) {
    try {
      const [pRes, sRes] = await Promise.allSettled([
        runSimulation({ ...targetToken, mode: "pipeline", max_cycles: 2000 }),
        runSimulation({ ...targetToken, mode: "single", max_cycles: 2000 }),
      ]);
      if (pRes.status === "fulfilled") pipelineResult = pRes.value;
      if (sRes.status === "fulfilled") singleResult = sRes.value;
    } catch (simError) {
      console.warn("어셈블리 시뮬레이션 동시 실행 실패:", simError);
    }
  }

  const activeResult = preferredMode === "single" ? (singleResult ?? pipelineResult) : (pipelineResult ?? singleResult);

  return {
    assembly: assemblySource,
    simulationResult: activeResult,
    singleSimulationResult: singleResult,
    pipelineSimulationResult: pipelineResult,
    buildId: result.build_id,
    simulationToken: result.simulation_token,
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
