type TimelineListener = (progress: number, cycle: number) => void;

class TimelineSync {
  private listeners = new Set<TimelineListener>();
  private currentCycle = 0;
  private currentProgress = 0;

  setProgress(cycle: number, progress: number) {
    this.currentCycle = cycle;
    this.currentProgress = progress;
    for (const fn of this.listeners) {
      fn(progress, cycle);
    }
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
