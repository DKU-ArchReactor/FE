import { useEffect, useState } from 'react';
import { runSimulation } from '@/api/simulation';
import type { SimulationArtifact, SimulationMode, SimulationResult } from '@/type/simulation';

export function useSimulationSession(mode: SimulationMode, source: string) {
  const [artifact, setArtifact] = useState<{ source: string; value: SimulationArtifact } | null>(null);
  const [response, setResponse] = useState<{ artifact: typeof artifact; mode: SimulationMode; result?: SimulationResult; error?: string } | null>(null);
  const activeArtifact = artifact?.source === source ? artifact : null;
  const current = response?.artifact === activeArtifact && response?.mode === mode ? response : null;

  useEffect(() => {
    if (!activeArtifact) return;
    let stale = false;
    const controller = new AbortController();
    runSimulation({ ...activeArtifact.value, mode, max_cycles: 2000 }, controller.signal).then(
      (result) => { if (!stale) setResponse({ artifact: activeArtifact, mode, result }); },
      (error: unknown) => {
        if (!stale) setResponse({ artifact: activeArtifact, mode, error: error instanceof Error ? error.message : '시뮬레이션 실행에 실패했습니다.' });
      },
    );
    return () => { stale = true; controller.abort(); };
  }, [activeArtifact, mode]);

  return {
    data: current?.result ?? null,
    busy: Boolean(activeArtifact && !current),
    error: current?.error ?? '',
    load: (value: SimulationArtifact) => setArtifact({ source, value }),
    clear: () => setArtifact(null),
  };
}
