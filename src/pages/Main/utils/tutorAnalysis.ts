// Presentation adapter only. Educational explanations come from the TUTOR service.
import api from '@/api/config';
import { getTutorCache, hasTutorCache, putTutorCache, seedTutor, tutorCacheKey } from '@/api/tutorCache';
export { seedTutor };
export interface RuleExplanation {
  kind: 'c' | 'asm' | 'crt'; category: string; title: string;
  summary: string; detail: string; opcode?: string | null; operands?: string | null;
  operation?: string | null;
  reads?: string[]; writes?: string[]; notes?: string[];
  supported?: boolean; evidence_level?: 'syntax' | 'observed' | 'unknown';
}
export interface TutorInstruction {
  text: string; explanation: RuleExplanation; runtime_explanation?: RuleExplanation | null;
  pc?: string; source_line?: number | null; source_file?: string | null;
  raw_instruction?: string | null;
  source_column?: number | null; function?: string | null;
  mapping_status?: 'mapped' | 'unmapped'; mapping_basis?: string;
  retire_count?: number; observed_in_history?: boolean;
  teaching?: {
    operand_roles: {operand: string; role: string}[];
    principle: string;
    register_connections: {register: string; pc: string; text: string}[];
    walkthrough?: {title: string; text: string}[];
    concepts?: {id: string; title: string; explanation: string; example: string;
      plain?: string;
      question: string; answer: string; sources: {title: string; url: string}[]}[];
  };
}
export interface TutorExecutionStep {
  history_index: number; cycle: number; display_clock: number; retired_pc: string | null;
  register_changes: {key: string; before: unknown; after: unknown}[];
  memory_changes: {key: string; before: unknown; after: unknown}[];
  memory_transfer: Record<string, unknown> | null;
  instruction_observations?: {pc: string; stage: string; summary: string; kind?: 'address' | 'value' | 'control'}[];
}
export interface TutorBundle {
  schema_version: string;
  performance_analysis?: {
    schema_version: string;
    snapshots: {history_index: number; cycles: number; completed: number | null; cpi: number | null;
      stall_cycles: number; flush_cycles: number; forwarding_cycles: number; overlap_cycles: number; hazard_cycles: number;
      idle_cycles: number; hazard_idle_cycles: number; other_idle_cycles: number; unknown_completion_cycles: number; extra_cycles: number | null}[];
    records: {history_index: number; cycle: number; kind: 'stall' | 'flush' | 'forwarding'; reason: string | null;
      instruction: {pc: string | null; assembly: string | null; source_line: number | null};
      dependencies: {register: string; stage: string; pc: string | null; assembly: string | null; source_line: number | null}[];
      title: string; detail: string}[];
    notes: string[];
  };
  c_lines?: { line: number; text: string; explanation: RuleExplanation }[];
  asm_instructions?: TutorInstruction[];
  execution_steps?: TutorExecutionStep[];
  line_explanations?: {source_line: number; summary: string; detail: string;
    steps: {pc: string; text: string; summary: string}[]}[];
  source_mapping?: {basis: string; warnings: string[]; notes: string[]};
  cycle_explanations?: { history_index: number; cycle: number; events: {
    type: string; title: string; summary: string; detail: string;
  }[] }[];
}
export async function fetchTutor(items: {kind: 'c'|'asm'|'crt'; text: string; line?: number; pc?: string}[], signal: AbortSignal) {
  const unique = new Map(items.map(x => [tutorCacheKey(x.kind, x.text, x.line ?? 1, x.pc), x]));
  const missing = [...unique].filter(([k]) => !hasTutorCache(k));
  let changed = false;
  for (let start = 0; start < missing.length; start += 128) {
    const chunk = missing.slice(start, start + 128);
    const {data} = await api.post<{items: RuleExplanation[]}>('/api/v1/tutor/explain', {items: chunk.map(([, x]) => x)}, {signal});
    if (signal.aborted) return false;
    chunk.forEach(([k], i) => putTutorCache(k, data.items[i]));
    changed = true;
  }
  return changed;
}
const pending: RuleExplanation = {kind: 'c', category: 'pending', title: '해설 대기', summary: '해설을 불러오는 중입니다.', detail: ''};
export function analyzeCLine(text: string, line: number) {
  const x = getTutorCache(tutorCacheKey('c', text, line)) ?? pending;
  return {type: x.title, badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200', summary: x.summary, detail: x.detail};
}
export function analyzeAsmInstruction(text: string, verified?: RuleExplanation) {
  const x = verified ?? getTutorCache(tutorCacheKey('asm', text)) ?? pending;
  return {opcode: x.opcode ?? '', operands: x.operands ?? '', action: x.title, explanation: x.summary,
    operation: x.operation, hardwareDetail: x.detail};
}
export function analyzeCrtInstruction(text: string, pc?: string) {
  const x = getTutorCache(tutorCacheKey('crt', text, 1, pc)) ?? pending;
  return {title: x.title, badge: x.category === 'unmapped' ? '미확인' : '문맥', summary: x.summary, detail: x.detail, role: x.title, instructionDetail: analyzeAsmInstruction(text)};
}

const instructionIndexes = new WeakMap<TutorBundle, Map<number, TutorInstruction>>();
export function instructionAt(bundle: TutorBundle | null | undefined, pc?: string) {
  if (!bundle || !pc || !/^0x[0-9a-f]+$/i.test(pc)) return undefined;
  let index = instructionIndexes.get(bundle);
  if (!index) {
    index = new Map();
    for (const item of bundle.asm_instructions ?? []) {
      const address = Number.parseInt(item.pc ?? '', 16);
      if (Number.isFinite(address) && !index.has(address)) index.set(address, item);
    }
    instructionIndexes.set(bundle, index);
  }
  return index.get(Number.parseInt(pc, 16));
}
