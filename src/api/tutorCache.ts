import type { RuleExplanation, TutorBundle } from "@/pages/Main/utils/tutorAnalysis";

const cache = new Map<string, RuleExplanation>();

export const tutorCacheKey = (kind: string, text: string, line = 1, pc?: string): string =>
  JSON.stringify([kind, text, line, pc]);

export function putTutorCache(k: string, value: RuleExplanation): void {
  if (cache.size >= 4096 && !cache.has(k)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(k, value);
}

export function getTutorCache(k: string): RuleExplanation | undefined {
  return cache.get(k);
}

export function hasTutorCache(k: string): boolean {
  return cache.has(k);
}

export function seedTutor(bundle?: TutorBundle | null): void {
  bundle?.c_lines?.forEach((x) => putTutorCache(tutorCacheKey("c", x.text, x.line), x.explanation));
  bundle?.asm_instructions?.forEach((x) => {
    putTutorCache(tutorCacheKey("asm", x.text), x.explanation);
    if (x.runtime_explanation) {
      putTutorCache(tutorCacheKey("crt", x.text, 1, x.pc), x.runtime_explanation);
    }
  });
}
