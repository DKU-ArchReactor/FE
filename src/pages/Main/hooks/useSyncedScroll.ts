import { useRef, useEffect, useState } from "react";
import type { TraceRow } from "../utils/multiCycleTrace";

export function useSyncedScroll(
  historyLength: number,
  traceRows: TraceRow[],
  activeCycleCol: number,
  colWidth: number,
  rowHeight: number
) {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);
  const [hScrollbarHeight, setHScrollbarHeight] = useState<number>(0);

  const handleLeftScroll = () => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    if (rightScrollRef.current && leftScrollRef.current) {
      isSyncingRight.current = true;
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    if (leftScrollRef.current && rightScrollRef.current) {
      isSyncingLeft.current = true;
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  };

  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;

    const updateScrollbarHeight = () => {
      const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
      const scrollHeightDiff = el.offsetHeight - el.clientHeight;
      setHScrollbarHeight(hasHorizontalScroll && scrollHeightDiff > 0 ? scrollHeightDiff : 0);
    };

    updateScrollbarHeight();
    const ro = new ResizeObserver(updateScrollbarHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [historyLength, traceRows.length]);

  useEffect(() => {
    const rightContainer = rightScrollRef.current;
    if (!rightContainer || !traceRows.length) return;

    if (activeCycleCol < 0) {
      rightContainer.scrollTo({
        left: 0,
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    const targetLeft = Math.max(
      0,
      activeCycleCol * colWidth - rightContainer.clientWidth * 0.35 + colWidth / 2
    );

    const activeRowIndices: number[] = [];
    traceRows.forEach((row, idx) => {
      if (row.cells[activeCycleCol]) {
        activeRowIndices.push(idx);
      }
    });

    const midRowIdx =
      activeRowIndices.length > 0
        ? activeRowIndices[Math.floor(activeRowIndices.length / 2)]
        : activeCycleCol;

    const targetTop = Math.max(
      0,
      midRowIdx * rowHeight - (rightContainer.clientHeight - 30) * 0.35 + rowHeight / 2
    );

    rightContainer.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: "smooth",
    });
  }, [activeCycleCol, traceRows, colWidth, rowHeight]);

  return {
    leftScrollRef,
    rightScrollRef,
    hScrollbarHeight,
    handleLeftScroll,
    handleRightScroll,
  };
}
