import React, { useState, useRef, useEffect, useCallback } from "react";

export const DEFAULT_POPUP_WIDTH = 480;
export const DEFAULT_POPUP_HEIGHT = 570;
export const MIN_POPUP_WIDTH = 480;
export const MIN_POPUP_HEIGHT = 570;

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// 사이트 글로벌 헤더의 하단 경계(px) 계산
export const getSiteHeaderBottom = () => {
  if (typeof document === "undefined") return 48;
  const siteHeader = document.querySelector("header.sticky") || document.querySelector("header");
  if (siteHeader) {
    const rect = siteHeader.getBoundingClientRect();
    return Math.max(48, Math.round(rect.bottom));
  }
  return 48;
};

const getResizeCursor = (dir: ResizeDirection): string => {
  switch (dir) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
  }
};

export function useFloatingWindow(
  isOpen: boolean,
  inline: boolean,
  anchorRef?: React.RefObject<HTMLElement | null>
) {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_POPUP_WIDTH,
    height: DEFAULT_POPUP_HEIGHT,
  });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resizingDirection, setResizingDirection] = useState<ResizeDirection | null>(null);
  const [isSmoothTransition, setIsSmoothTransition] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const transitionTimerRef = useRef<number | null>(null);

  const triggerSmoothChange = useCallback(
    (nextSize: { width: number; height: number }, nextPos: { x: number; y: number }) => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      setIsSmoothTransition(true);
      setSize(nextSize);
      setPosition(nextPos);
      transitionTimerRef.current = window.setTimeout(() => {
        setIsSmoothTransition(false);
        transitionTimerRef.current = null;
      }, 320);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });

  const resizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    posX: number;
    posY: number;
    width: number;
    height: number;
  }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
    width: DEFAULT_POPUP_WIDTH,
    height: DEFAULT_POPUP_HEIGHT,
  });

  // 버튼 바로 아래 기본 위치 계산 (사이트 헤더 제외, 버튼 오른쪽 정렬 & 바로 아래 8px)
  const getAnchorPosition = useCallback(
    (popupWidth = sizeRef.current.width, popupHeight = sizeRef.current.height) => {
      if (typeof window === "undefined") return { x: 100, y: 64 };
      const minY = getSiteHeaderBottom() + 8;
      if (anchorRef?.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        const x = Math.max(12, Math.min(window.innerWidth - popupWidth - 12, rect.right - popupWidth));
        const y = Math.max(minY, Math.min(window.innerHeight - popupHeight - 12, rect.bottom + 8));
        return { x, y };
      }
      const margin = 16;
      const x = Math.max(12, window.innerWidth - popupWidth - margin);
      const y = Math.max(minY, 64);
      return { x, y };
    },
    [anchorRef]
  );

  useEffect(() => {
    if (!isOpen) {
      setHasAnimated(false);
    } else {
      setPosition(getAnchorPosition());
    }
  }, [isOpen, getAnchorPosition]);

  useEffect(() => {
    if (isOpen && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hasAnimated]);

  useEffect(() => {
    const handleResize = () => {
      const curW = sizeRef.current.width;
      const curH = sizeRef.current.height;
      const minY = getSiteHeaderBottom() + 8;
      const maxAllowedW = Math.max(MIN_POPUP_WIDTH, window.innerWidth - 24);
      const maxAllowedH = Math.max(MIN_POPUP_HEIGHT, window.innerHeight - minY - 12);
      const clampedW = Math.min(curW, maxAllowedW);
      const clampedH = Math.min(curH, maxAllowedH);

      if (clampedW !== curW || clampedH !== curH) {
        setSize({ width: clampedW, height: clampedH });
      }

      setPosition((prev) => {
        if (!prev) return prev;
        const maxX = Math.max(12, window.innerWidth - clampedW - 12);
        const maxY = Math.max(minY, window.innerHeight - clampedH - 12);
        return {
          x: Math.max(12, Math.min(maxX, prev.x)),
          y: Math.max(minY, Math.min(maxY, prev.y)),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setIsSmoothTransition(false);
    setHasAnimated(true);

    const curPos = position || getAnchorPosition();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: curPos.x,
      posY: curPos.y,
    };
    setIsDragging(true);
  };

  const startResize = (e: React.MouseEvent, dir: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setIsSmoothTransition(false);
    setHasAnimated(true);

    const curPos = position || getAnchorPosition();
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: curPos.x,
      posY: curPos.y,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
    };
    setResizingDirection(dir);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const curW = sizeRef.current.width;
      const curH = sizeRef.current.height;
      const minY = getSiteHeaderBottom() + 8;
      const maxX = Math.max(12, window.innerWidth - curW - 12);
      const maxY = Math.max(minY, window.innerHeight - curH - 12);

      const rawX = dragStartRef.current.posX + deltaX;
      const rawY = dragStartRef.current.posY + deltaY;

      setPosition({
        x: Math.max(12, Math.min(maxX, rawX)),
        y: Math.max(minY, Math.min(maxY, rawY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  useEffect(() => {
    if (!resizingDirection) return;

    const dir = resizingDirection;
    const handleMouseMove = (e: MouseEvent) => {
      const { mouseX, mouseY, posX, posY, width, height } = resizeStartRef.current;
      const deltaX = e.clientX - mouseX;
      const deltaY = e.clientY - mouseY;

      let newX = posX;
      let newY = posY;
      let newWidth = width;
      let newHeight = height;

      const minW = MIN_POPUP_WIDTH;
      const minH = MIN_POPUP_HEIGHT;
      const minY = getSiteHeaderBottom() + 8;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      if (dir.includes('e')) {
        const maxAllowedWidth = Math.max(minW, viewportW - posX - 12);
        newWidth = Math.max(minW, Math.min(maxAllowedWidth, width + deltaX));
      } else if (dir.includes('w')) {
        const rightEdge = posX + width;
        const rawX = posX + deltaX;
        newX = Math.max(12, Math.min(rightEdge - minW, rawX));
        newWidth = rightEdge - newX;
      }

      if (dir.includes('s')) {
        const maxAllowedHeight = Math.max(minH, viewportH - posY - 12);
        newHeight = Math.max(minH, Math.min(maxAllowedHeight, height + deltaY));
      } else if (dir.includes('n')) {
        const bottomEdge = posY + height;
        const rawY = posY + deltaY;
        newY = Math.max(minY, Math.min(bottomEdge - minH, rawY));
        newHeight = bottomEdge - newY;
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setResizingDirection(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = getResizeCursor(dir);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [resizingDirection]);

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    if (inline) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    document.body.style.userSelect = "";
    setHasAnimated(true);

    const siteHeaderBottom = getSiteHeaderBottom();
    const topY = siteHeaderBottom + 8;
    const maxW = Math.max(MIN_POPUP_WIDTH, window.innerWidth - 24);
    const maxH = Math.max(MIN_POPUP_HEIGHT, window.innerHeight - topY - 12);

    const isCurrentMax = (
      sizeRef.current.width >= maxW - 20 &&
      sizeRef.current.height >= maxH - 20
    );

    if (isCurrentMax) {
      const nextSize = { width: MIN_POPUP_WIDTH, height: MIN_POPUP_HEIGHT };
      const nextPos = getAnchorPosition(MIN_POPUP_WIDTH, MIN_POPUP_HEIGHT);
      triggerSmoothChange(nextSize, nextPos);
    } else {
      const nextSize = { width: maxW, height: maxH };
      const nextPos = { x: 12, y: topY };
      triggerSmoothChange(nextSize, nextPos);
    }
  };

  return {
    size,
    position,
    isDragging,
    resizingDirection,
    isSmoothTransition,
    hasAnimated,
    setHasAnimated,
    getAnchorPosition,
    triggerSmoothChange,
    startDrag,
    startResize,
    handleHeaderDoubleClick,
  };
}
