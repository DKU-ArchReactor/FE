import { useRef, useEffect, useState, useCallback } from "react";
import type { TraceRow } from "../utils/multiCycleTrace";

export interface ScrollRangeState {
  scrollTop: number;
  scrollLeft: number;
  viewportWidth: number;
  viewportHeight: number;
}

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
  const rafIdRef = useRef<number | null>(null);

  const [scrollState, setScrollState] = useState<ScrollRangeState>({
    scrollTop: 0,
    scrollLeft: 0,
    viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1000,
    viewportHeight: typeof window !== "undefined" ? window.innerHeight : 500,
  });

  const updateScrollState = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const el = rightScrollRef.current;
      if (!el) return;

      const newScrollTop = el.scrollTop;
      const newScrollLeft = el.scrollLeft;
      const newClientWidth = el.clientWidth;
      const newClientHeight = el.clientHeight;

      setScrollState((prev) => {
        if (
          prev.scrollTop === newScrollTop &&
          prev.scrollLeft === newScrollLeft &&
          prev.viewportWidth === newClientWidth &&
          prev.viewportHeight === newClientHeight
        ) {
          return prev;
        }
        return {
          scrollTop: newScrollTop,
          scrollLeft: newScrollLeft,
          viewportWidth: newClientWidth,
          viewportHeight: newClientHeight,
        };
      });
    });
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      updateScrollState();
      return;
    }
    if (rightScrollRef.current && leftScrollRef.current) {
      isSyncingRight.current = true;
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
    updateScrollState();
  }, [updateScrollState]);

  const handleRightScroll = useCallback(() => {
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      updateScrollState();
      return;
    }
    if (leftScrollRef.current && rightScrollRef.current) {
      isSyncingLeft.current = true;
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;

    const updateScrollbarAndDimensions = () => {
      const hasHorizontalScroll = el.scrollWidth > el.clientWidth;
      const scrollHeightDiff = el.offsetHeight - el.clientHeight;
      setHScrollbarHeight(hasHorizontalScroll && scrollHeightDiff > 0 ? scrollHeightDiff : 0);
      setScrollState((prev) => ({
        ...prev,
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
        viewportWidth: el.clientWidth,
        viewportHeight: el.clientHeight,
      }));
    };

    updateScrollbarAndDimensions();
    const ro = new ResizeObserver(updateScrollbarAndDimensions);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
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
    scrollState,
  };
}
