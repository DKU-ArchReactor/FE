import React, { useState, useEffect, useRef } from 'react';
import type { SectionConfig } from '../types';
import { getDefaultSections } from '../types';

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

  // 1. 구역 내 슬롯 간 세로 높이 리사이징
  const [resizingRowSlot, setResizingRowSlot] = useState<ResizingRowSlot | null>(null);

  // 2. 2개 묶음(Pair) 내부 좌우 분할 리사이징
  const [resizingPair, setResizingPair] = useState<ResizingPair | null>(null);

  // 마우스 이동 및 업 이벤트 핸들러
  useEffect(() => {
    if (resizingRowSlot === null && resizingPair === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      // (1) 구역 내 슬롯 간 세로 높이 리사이징
      if (resizingRowSlot !== null) {
        const { secIdx, slotIdx, startY, initialTopRatio, initialBtmRatio, containerHeight } = resizingRowSlot;
        if (containerHeight <= 0) return;
        const deltaY = e.clientY - startY;

        // sec-4(다이어그램-CPI-해저드)인 경우, CPI의 자연스러운 높이(~230px)를 제외한 가용 높이 기준 연산
        const isSec4 = sections[secIdx]?.id === 'sec-4';
        const effectiveContainerHeight = isSec4 ? Math.max(100, containerHeight - 240) : containerHeight;

        const combinedRatio = initialTopRatio + initialBtmRatio;
        const deltaRatio = (deltaY / effectiveContainerHeight) * combinedRatio;

        const newTop = Math.max(0.35, Math.min(initialTopRatio + deltaRatio, combinedRatio - 0.35));
        const newBtm = combinedRatio - newTop;

        setSections((prev) =>
          prev.map((sec, sIdx) => {
            if (sIdx !== secIdx) return sec;
            const topIdx = isSec4 ? 0 : slotIdx;
            const btmIdx = isSec4 ? 2 : slotIdx + 1;

            const updatedSlots = sec.slots.map((sl, slIdx) => {
              if (slIdx === topIdx) return { ...sl, flexRatio: Math.round(newTop * 100) / 100 };
              if (slIdx === btmIdx) return { ...sl, flexRatio: Math.round(newBtm * 100) / 100 };
              return sl;
            });
            return { ...sec, slots: updatedSlots };
          })
        );
      }

      // (2) 2개 묶음(Pair) 내부 좌우 분할 리사이징
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
  }, [resizingRowSlot, resizingPair, sections, setSections]);

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

  const handlePairReset = (secIdx: number, slotIdx: number) => {
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const targetSlot = next[secIdx]?.slots[slotIdx];
      if (targetSlot) {
        targetSlot.pairRatio = 50;
      }
      return next;
    });
  };

  const handleSlotReset = (secIdx: number, slotIdx: number) => {
    const defaults = getDefaultSections();
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const sec = next[secIdx];
      const defaultSec = defaults[secIdx];
      if (!sec || !defaultSec) return next;

      if (sec.id === 'sec-4') {
        sec.slots[0].flexRatio = defaultSec.slots[0]?.flexRatio ?? 1.8;
        sec.slots[1].flexRatio = defaultSec.slots[1]?.flexRatio ?? 0.7;
        sec.slots[2].flexRatio = defaultSec.slots[2]?.flexRatio ?? 1.0;
      } else {
        const slots = sec.slots;
        if (slots && slots[slotIdx] && slots[slotIdx + 1]) {
          slots[slotIdx].flexRatio = defaultSec.slots[slotIdx]?.flexRatio ?? 1;
          slots[slotIdx + 1].flexRatio = defaultSec.slots[slotIdx + 1]?.flexRatio ?? 1;
        }
      }
      return next;
    });
  };

  return {
    containerRef,
    resizingRowSlot,
    resizingPair,
    handleSlotResizeStart,
    handlePairResizeStart,
    handlePairReset,
    handleSlotReset,
  };
}
