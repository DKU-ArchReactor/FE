import { compileCode } from "@/api/build";
import { runSimulation } from "@/api/simulation";
import type { SimulationResult } from "@/type/simulation";

export type MappedAssemblyRow = {
  sourceLine: number | null;
  text: string;
  isRuntime?: boolean;
  pc?: string;
};

export function extractAssemblyFromSimulation(
  simulationResult: SimulationResult | null
): MappedAssemblyRow[] {
  if (!simulationResult) return [];

  const tutorInstructions = simulationResult.tutor?.asm_instructions;
  if (simulationResult.tutor?.source_mapping && tutorInstructions?.length) {
    return tutorInstructions.filter(item => item.pc).map(item => ({
      pc: item.pc, text: item.text, sourceLine: item.source_line ?? null,
      isRuntime: false,
    }));
  }

  // 1순위: CORE가 제공하는 정적 코드 매핑 테이블(program.code_mapping) 직접 사용
  // 실행되지 않은 분기문(if/else)까지 포함된 완전한 전체 어셈블리 목록 및 C 라인 매핑 제공
  const codeMap = simulationResult.program?.code_mapping;
  if (codeMap && Object.keys(codeMap).length > 0) {
    return Object.entries(codeMap)
      .sort((a, b) => parseInt(a[0], 16) - parseInt(b[0], 16))
      .map(([pc, item]) => {
        const sLine = item.source_line !== undefined && item.source_line !== null ? item.source_line : null;
        return {
          pc,
          text: item.assembly || "",
          sourceLine: sLine,
          isRuntime: sLine === null,
        };
      });
  }

  // 2순위 (폴백): code_mapping이 없는 구버전 시뮬레이션 응답의 경우 사이클 히스토리 순회
  if (!simulationResult.history || !simulationResult.history.length) return [];
  const rows: MappedAssemblyRow[] = [];
  const seenPc = new Set<string>();

  for (const item of simulationResult.history) {
    const ifBuf = item.buffers?.IF || item.if_stage || item.stage_activity?.IF;
    if (!ifBuf || !ifBuf.assembly || ifBuf.assembly === "bubble" || ifBuf.assembly === "empty") continue;

    const pcKey = (ifBuf.pc || "").trim().toLowerCase();
    if (pcKey && seenPc.has(pcKey)) continue;
    if (pcKey) seenPc.add(pcKey);

    const sLine = ifBuf.source_line !== undefined ? ifBuf.source_line : null;

    rows.push({
      pc: ifBuf.pc,
      text: ifBuf.assembly,
      sourceLine: sLine,
      isRuntime: sLine === null,
    });
  }

  return rows;
}

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
  preferredMode: "single" | "pipeline" = "single",
  options: { capture: boolean; signal: AbortSignal }
): Promise<TranslationCompileResult> {
  const result = await compileCode({
    content: source,
    lang: "c",
    compile_profile: "rv32im",
    compiler_opt: "-O0 -g",
  }, options.signal);
  if (result.status !== "success") {
    throw new Error(result.log || "컴파일에 실패했습니다.");
  }

  // 1. Single과 Pipeline 모드를 백그라운드 병렬(Promise.all)로 동시 실행하여 즉시 캐싱
  let singleResult: SimulationResult | null = null;
  let pipelineResult: SimulationResult | null = null;
  let assembly = "";

  // 어셈블리 텍스트 가져오기 (선택적 / 폴백 지원)
  if (result.assembly_url) {
    try {
      const response = await fetch(result.assembly_url, { signal: options.signal });
      if (response.ok) {
        assembly = await response.text();
      }
    } catch {
      // S3 다운로드 실패 시에도 시뮬레이션 로그에서 어셈블리를 자동 추출하므로 차단하지 않음
    }
  }

  const targetToken = result.build_id
    ? { build_id: result.build_id }
    : result.simulation_token
    ? { simulation_token: result.simulation_token }
    : null;

  options.signal.throwIfAborted();
  if (targetToken) {
    try {
      const [pRes, sRes] = await Promise.allSettled([
        runSimulation({ ...targetToken, mode: "pipeline", max_cycles: 2000, capture_assistant_context: options.capture }, options.signal),
        runSimulation({ ...targetToken, mode: "single", max_cycles: 2000, capture_assistant_context: options.capture }, options.signal),
      ]);
      if (pRes.status === "fulfilled") pipelineResult = pRes.value;
      if (sRes.status === "fulfilled") singleResult = sRes.value;
    } catch (simError) {
      console.warn("시뮬레이션 동시 실행 실패:", simError);
    }
  }

  const activeResult = preferredMode === "single" ? singleResult : pipelineResult;

  // S3 assembly_url이 없으면(단일 패스 컴파일), 상단 code_mapping에서 어셈블리 텍스트를 자동 생성
  if (!assembly && activeResult) {
    const rows = extractAssemblyFromSimulation(activeResult);
    if (rows.length > 0) {
      assembly = rows.map((r) => r.text).join("\n");
    }
  }

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
  preferredMode: "single" | "pipeline" = "single",
  options: { capture: boolean; signal: AbortSignal }
): Promise<TranslationCompileResult> {
  const result = await compileCode({
    content: assemblySource,
    lang: "asm",
    compile_profile: "rv32im",
    compiler_opt: "",
  }, options.signal);
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

  options.signal.throwIfAborted();
  if (targetToken) {
    try {
      const [pRes, sRes] = await Promise.allSettled([
        runSimulation({ ...targetToken, mode: "pipeline", max_cycles: 2000, capture_assistant_context: options.capture }, options.signal),
        runSimulation({ ...targetToken, mode: "single", max_cycles: 2000, capture_assistant_context: options.capture }, options.signal),
      ]);
      if (pRes.status === "fulfilled") pipelineResult = pRes.value;
      if (sRes.status === "fulfilled") singleResult = sRes.value;
    } catch (simError) {
      console.warn("어셈블리 시뮬레이션 동시 실행 실패:", simError);
    }
  }

  const activeResult = preferredMode === "single" ? singleResult : pipelineResult;

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
  // 섹션 디렉티브(.text, .data 등)가 전혀 없는 순수 어셈블리 텍스트인 경우 기본적으로 실행 가능 코드로 간주
  const hasSectionDirectives = /^\s*\.(?:text|data|bss|rodata|section|pushsection)\b/m.test(assembly);
  let executable = !hasSectionDirectives;
  let previousExecutable = executable;
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
    if (/^[a-zA-Z][\w.]*\s*[^=]*$/.test(line)) {
      mapped.push({
        sourceLine: sourceLine,
        text: line,
        isRuntime: sourceLine === null,
      });
    }
  }
  return mapped;
}
