// Presentation adapter only. All educational explanations come from FastAPI.
import api from '@/api/config';
export interface RuleExplanation {
  kind: 'c' | 'asm' | 'crt'; category: string; title: string;
  summary: string; detail: string; opcode?: string | null; operands?: string | null;
  reads?: string[]; writes?: string[]; notes?: string[];
  supported?: boolean; evidence_level?: 'syntax' | 'observed' | 'unknown';
}
export interface TutorInstruction {
  text: string; explanation: RuleExplanation; runtime_explanation?: RuleExplanation | null;
  pc?: string; source_line?: number | null; source_file?: string | null;
  source_column?: number | null; function?: string | null;
  mapping_status?: 'mapped' | 'unmapped'; mapping_basis?: string;
  retire_count?: number; observed_in_history?: boolean;
}
export interface TutorExecutionStep {
  history_index: number; cycle: number; display_clock: number; retired_pc: string | null;
  register_changes: {key: string; before: unknown; after: unknown}[];
  memory_changes: {key: string; before: unknown; after: unknown}[];
  memory_transfer: Record<string, unknown> | null;
}
export interface TutorBundle {
  schema_version: string;
  c_lines?: { line: number; text: string; explanation: RuleExplanation }[];
  asm_instructions?: TutorInstruction[];
  execution_steps?: TutorExecutionStep[];
  source_mapping?: {basis: string; warnings: string[]; notes: string[]};
  cycle_explanations?: { history_index: number; cycle: number; events: {
    type: string; title: string; summary: string; detail: string;
  }[] }[];
}
const cache = new Map<string, RuleExplanation>();
const key = (kind: string, text: string, line = 1, pc?: string) => JSON.stringify([kind, text, line, pc]);
function put(k: string, value: RuleExplanation) {
  if (cache.size >= 4096 && !cache.has(k)) cache.delete(cache.keys().next().value!);
  cache.set(k, value);
}
export function seedTutor(bundle?: TutorBundle | null) {
  bundle?.c_lines?.forEach(x => put(key('c', x.text, x.line), x.explanation));
  bundle?.asm_instructions?.forEach(x => {
    put(key('asm', x.text), x.explanation);
    if (x.runtime_explanation) put(key('crt', x.text, 1, x.pc), x.runtime_explanation);
  });
}
export async function fetchTutor(items: {kind: 'c'|'asm'|'crt'; text: string; line?: number; pc?: string}[], signal: AbortSignal) {
  const unique = new Map(items.map(x => [key(x.kind, x.text, x.line ?? 1, x.pc), x]));
  const missing = [...unique].filter(([k]) => !cache.has(k));
  for (let start = 0; start < missing.length; start += 128) {
    const chunk = missing.slice(start, start + 128);
    const {data} = await api.post<{items: RuleExplanation[]}>('/api/v1/tutor/explain', {items: chunk.map(([, x]) => x)}, {signal});
    if (signal.aborted) return;
    chunk.forEach(([k], i) => put(k, data.items[i]));
  }
}
const pending: RuleExplanation = {kind: 'c', category: 'pending', title: '해설 대기', summary: '해설을 불러오는 중입니다.', detail: ''};
export function analyzeCLine(text: string, line: number) {
  const x = cache.get(key('c', text, line)) ?? pending;
  return {type: x.title, badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200', summary: x.summary, detail: x.detail};
}
export function analyzeAsmInstruction(text: string) {
  const x = cache.get(key('asm', text)) ?? pending;
  return {opcode: x.opcode ?? '', operands: x.operands ?? '', action: x.title, explanation: x.summary, hardwareDetail: x.detail};
}
export function analyzeCrtInstruction(text: string, pc?: string) {
  const x = cache.get(key('crt', text, 1, pc)) ?? pending;
  return {title: x.title, badge: x.category === 'unmapped' ? '미확인' : '문맥', summary: x.summary, detail: x.detail, role: x.title, instructionDetail: analyzeAsmInstruction(text)};
}

export function instructionAt(bundle: TutorBundle | null | undefined, pc?: string) {
  if (!pc || !/^0x[0-9a-f]+$/i.test(pc)) return undefined;
  return bundle?.asm_instructions?.find(item => item.pc && Number.parseInt(item.pc, 16) === Number.parseInt(pc, 16));
}
