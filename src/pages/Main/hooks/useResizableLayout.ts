import React, { useState, useEffect, useRef } from 'react';
import type { SectionConfig } from '../types';

interface ResizingCol {
  idx: number;
  startX: number;
  initialWidths: number[];
  viewportWidth: number;
}

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

  // 1. 구역 간 가로 너비 리사이징 (델타 기반: 슬라이드 오프셋에 영향받지 않음)
  const [resizingCol, setResizingCol] = useState<ResizingCol | null>(null);

  // 2. 구역 내 슬롯 간 세로 높이 리사이징
  const [resizingRowSlot, setResizingRowSlot] = useState<ResizingRowSlot | null>(null);

  // 3. 2개 묶음(Pair) 내부 좌우 분할 리사이징
  const [resizingPair, setResizingPair] = useState<ResizingPair | null>(null);

  // 마우스 이동 및 업 이벤트 핸들러
  useEffect(() => {
    if (resizingCol === null && resizingRowSlot === null && resizingPair === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      // (1) 구역 간 가로 너비 리사이징 (연쇄 캐스케이딩 밀기)
      if (resizingCol !== null) {
        const { idx, startX, initialWidths, viewportWidth } = resizingCol;
        if (viewportWidth <= 0) return;

        const deltaX = e.clientX - startX;
        const deltaPercent = (deltaX / viewportWidth) * 100;
        const minPercent = 30;

        const newWidths = [...initialWidths];

        if (deltaPercent > 0) {
          // 오른쪽으로 드래그: idx 컴포넌트를 늘리고, 오른쪽 컴포넌트들을 순차적으로 줄임
          let needed = deltaPercent;
          // 오른쪽 컴포넌트들(idx+1, idx+2, ...)에서 여유분을 깎아냄
          for (let r = idx + 1; r < newWidths.length; r++) {
            const available = newWidths[r] - minPercent;
            if (available > 0) {
              const reduce = Math.min(needed, available);
              newWidths[r] -= reduce;
              needed -= reduce;
              if (needed <= 0.001) break;
            }
          }
          // 실제로 오른쪽 컴포넌트들에서 확보된 폭만큼만 idx 컴포넌트를 늘림
          const actualGained = deltaPercent - needed;
          newWidths[idx] = initialWidths[idx] + actualGained;
        } else if (deltaPercent < 0) {
          // 왼쪽으로 드래그: idx+1 컴포넌트를 늘리고, 왼쪽 컴포넌트들을 순차적으로 줄임
          let needed = -deltaPercent;
          // 왼쪽 컴포넌트들(idx, idx-1, ...)에서 여유분을 깎아냄
          for (let l = idx; l >= 0; l--) {
            const available = newWidths[l] - minPercent;
            if (available > 0) {
              const reduce = Math.min(needed, available);
              newWidths[l] -= reduce;
              needed -= reduce;
              if (needed <= 0.001) break;
            }
          }
          // 실제로 왼쪽 컴포넌트들에서 확보된 폭만큼만 idx+1 컴포넌트를 늘림
          const actualGained = (-deltaPercent) - needed;
          newWidths[idx + 1] = initialWidths[idx + 1] + actualGained;
        }

        setSections((prev) =>
          prev.map((s, i) => {
            if (newWidths[i] !== undefined) {
              return { ...s, widthPercent: Math.round(newWidths[i] * 10) / 10 };
            }
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
      setResizingCol(null);
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
  }, [resizingCol, resizingRowSlot, resizingPair, setSections]);

  const handleColResizeStart = (colIdx: number, e?: React.MouseEvent) => {
    if (colIdx < 0 || colIdx >= sections.length - 1) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const viewportWidth = containerRef.current?.clientWidth || window.innerWidth;
    setResizingCol({
      idx: colIdx,
      startX: e ? e.clientX : 0,
      initialWidths: sections.map((s) => s.widthPercent),
      viewportWidth,
    });
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
    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const slots = next[secIdx]?.slots;
      if (slots && slots[slotIdx] && slots[slotIdx + 1]) {
        slots[slotIdx].flexRatio = 1;
        slots[slotIdx + 1].flexRatio = 1;
      }
      return next;
    });
  };

  return {
    containerRef,
    resizingSplitterIndex: resizingCol?.idx ?? null,
    resizingRowSlot,
    resizingPair,
    handleColResizeStart,
    handleSlotResizeStart,
    handlePairResizeStart,
    handlePairReset,
    handleSlotReset,
  };
}
