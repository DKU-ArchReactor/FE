type TimelineListener = (progress: number, cycle: number) => void;

export const TIMELINE_END_THRESHOLD = 0.98;

/** 현재 사이클의 완료 지점(]) 전인 (~] 구간 진행 중 상태인지 판별합니다. */
export function isMidCycleProgress(
  currentCycle: number,
  syncCycle: number,
  progress: number,
): boolean {
  return (
    currentCycle > 0 &&
    syncCycle === currentCycle &&
    progress < TIMELINE_END_THRESHOLD
  );
}

class TimelineSync {
  private listeners = new Set<TimelineListener>();
  private currentCycle = 0;
  private currentProgress = 0;
  private epoch = 0;

  setProgress(cycle: number, progress: number) {
    this.currentCycle = cycle;
    this.currentProgress = progress;
    for (const fn of this.listeners) {
      fn(progress, cycle);
    }
  }

  /** 수동 스텝/점프/리셋 등 즉시 위치 확정 시 세대(epoch)를 올려 직전 rAF 잔여 프레임 덮어쓰기를 차단합니다. */
  snapProgress(cycle: number, progress: number) {
    this.epoch += 1;
    this.setProgress(cycle, progress);
  }

  getEpoch() {
    return this.epoch;
  }

  getProgress() {
    return { cycle: this.currentCycle, progress: this.currentProgress };
  }

  subscribe(listener: TimelineListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const timelineSync = new TimelineSync();
