import React, { useState, useEffect, useRef } from 'react';
import type { SectionConfig } from '../types';

interface ResizingRowSlot {
  secIdx: number;
  slotIdx: number;
  startY: number;
  initialTopRatio: number;
  initialBtmRatio: number;
  containerHeight: number;
}

interface ResizingPair {
  secIdx: number;
  slotIdx: number;
  startX: number;
  initialLeftRatio: number;
  containerWidth: number;
}

export function useResizableLayout(
  sections: SectionConfig[],
  setSections: React.Dispatch<React.SetStateAction<SectionConfig[]>>
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. 구역 간 가로 너비 리사이징
  const [resizingSplitterIndex, setResizingSplitterIndex] = useState<number | null>(null);

  // 2. 구역 내 슬롯 간 세로 높이 리사이징
  const [resizingRowSlot, setResizingRowSlot] = useState<ResizingRowSlot | null>(null);

  // 3. 2개 묶음(Pair) 내부 좌우 분할 리사이징
  const [resizingPair, setResizingPair] = useState<ResizingPair | null>(null);

  // 마우스 이동 및 업 이벤트 핸들러
  useEffect(() => {
    if (resizingSplitterIndex === null && resizingRowSlot === null && resizingPair === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      // (1) 구역 간 가로 너비 리사이징
      if (resizingSplitterIndex !== null && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const idx = resizingSplitterIndex;
        if (idx < 0 || idx >= sections.length - 1) return;

        const currentSplitterLeft = e.clientX - rect.left;
        const targetRatio = (currentSplitterLeft / rect.width) * 100;
        const prevWidthSum = sections.slice(0, idx).reduce((acc, s) => acc + s.widthPercent, 0);
        const combinedTwoWidths = sections[idx].widthPercent + sections[idx + 1].widthPercent;

        const newLeftWidth = Math.max(12, Math.min(targetRatio - prevWidthSum, combinedTwoWidths - 12));
        const newRightWidth = combinedTwoWidths - newLeftWidth;

        setSections((prev) =>
          prev.map((s, i) => {
            if (i === idx) return { ...s, widthPercent: Math.round(newLeftWidth * 10) / 10 };
            if (i === idx + 1) return { ...s, widthPercent: Math.round(newRightWidth * 10) / 10 };
            return s;
          })
        );
      }

      // (2) 구역 내 슬롯 간 세로 높이 리사이징
      if (resizingRowSlot !== null) {
        const { secIdx, slotIdx, startY, initialTopRatio, initialBtmRatio, containerHeight } = resizingRowSlot;
        if (containerHeight <= 0) return;
        const deltaY = e.clientY - startY;
        const combinedRatio = initialTopRatio + initialBtmRatio;
        const deltaRatio = (deltaY / containerHeight) * combinedRatio;

        const newTop = Math.max(0.35, Math.min(initialTopRatio + deltaRatio, combinedRatio - 0.35));
        const newBtm = combinedRatio - newTop;

        setSections((prev) =>
          prev.map((sec, sIdx) => {
            if (sIdx !== secIdx) return sec;
            const updatedSlots = sec.slots.map((sl, slIdx) => {
              if (slIdx === slotIdx) return { ...sl, flexRatio: Math.round(newTop * 100) / 100 };
              if (slIdx === slotIdx + 1) return { ...sl, flexRatio: Math.round(newBtm * 100) / 100 };
              return sl;
            });
            return { ...sec, slots: updatedSlots };
          })
        );
      }

      // (3) 2개 묶음(Pair) 내부 좌우 분할 리사이징
      if (resizingPair !== null) {
        const { secIdx, slotIdx, startX, initialLeftRatio, containerWidth } = resizingPair;
        if (containerWidth <= 0) return;
        const deltaX = e.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100;
        const newLeftPercent = Math.max(20, Math.min(80, Math.round((initialLeftRatio + deltaPercent) * 10) / 10));

        setSections((prev) =>
          prev.map((sec, sIdx) => {
            if (sIdx !== secIdx) return sec;
            const updatedSlots = sec.slots.map((sl, slIdx) => {
              if (slIdx === slotIdx && sl.type === 'pair') {
                return { ...sl, pairRatio: newLeftPercent };
              }
              return sl;
            });
            return { ...sec, slots: updatedSlots };
          })
        );
      }
    };

    const handleMouseUp = () => {
      setResizingSplitterIndex(null);
      setResizingRowSlot(null);
      setResizingPair(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (resizingRowSlot !== null) {
      document.body.style.cursor = 'row-resize';
    } else {
      document.body.style.cursor = 'col-resize';
    }
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingSplitterIndex, resizingRowSlot, resizingPair, sections, setSections]);

  const handleColResizeStart = (colIdx: number) => {
    setResizingSplitterIndex(colIdx);
  };

  const handleSlotResizeStart = (
    secIdx: number,
    slotIdx: number,
    topRatio: number,
    btmRatio: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const parentCol = (e.currentTarget as HTMLElement).closest('.flex-col') as HTMLElement | null;
    const containerHeight = parentCol ? parentCol.clientHeight : 500;

    setResizingRowSlot({
      secIdx,
      slotIdx,
      startY: e.clientY,
      initialTopRatio: topRatio,
      initialBtmRatio: btmRatio,
      containerHeight,
    });
  };

  const handlePairResizeStart = (
    secIdx: number,
    slotIdx: number,
    leftRatio: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const parentSlot = (e.currentTarget as HTMLElement).closest('.flex-1') as HTMLElement | null;
    const containerWidth = parentSlot ? parentSlot.clientWidth : 300;

    setResizingPair({
      secIdx,
      slotIdx,
      startX: e.clientX,
      initialLeftRatio: leftRatio,
      containerWidth,
    });
  };

  return {
    containerRef,
    resizingSplitterIndex,
    resizingRowSlot,
    resizingPair,
    handleColResizeStart,
    handleSlotResizeStart,
    handlePairResizeStart,
  };
}
