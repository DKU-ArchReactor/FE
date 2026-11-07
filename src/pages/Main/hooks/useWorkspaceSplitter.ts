import { useState, useEffect, useRef } from "react";

export function useWorkspaceSplitter() {
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(45);
  const [resizingLeftPane, setResizingLeftPane] = useState<boolean>(false);
  const mainWorkspaceRef = useRef<HTMLDivElement>(null);

  // 상단 (C 소스 + ASM) vs 하단 (Tutor) 높이 비율 (기본 56% : 44%)
  const [leftTopHeightPercent, setLeftTopHeightPercent] = useState<number>(56);
  const [resizingLeftVertical, setResizingLeftVertical] = useState<boolean>(false);
  const leftPaneContainerRef = useRef<HTMLDivElement>(null);

  // 상단 내부 C 소스 vs ASM 매핑 가로 너비 비율 (기본 50% : 50%)
  const [leftCodeColRatio, setLeftCodeColRatio] = useState<number>(50);
  const [resizingLeftCodeCol, setResizingLeftCodeCol] = useState<boolean>(false);
  const leftTopContainerRef = useRef<HTMLDivElement>(null);

  // 1) 메인 좌우 분할선 드래그 핸들러
  const handleMainDividerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingLeftPane(true);
  };

  useEffect(() => {
    if (!resizingLeftPane) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainWorkspaceRef.current) return;
      const rect = mainWorkspaceRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const percent = (currentX / rect.width) * 100;
      setLeftPaneWidth(Math.max(30, Math.min(65, Math.round(percent * 10) / 10)));
    };

    const handleMouseUp = () => {
      setResizingLeftPane(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingLeftPane]);

  // 2) 좌측 상단(코드/ASM) <-> 하단(튜터) 세로 분할선 드래그 핸들러
  useEffect(() => {
    if (!resizingLeftVertical) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!leftPaneContainerRef.current) return;
      const rect = leftPaneContainerRef.current.getBoundingClientRect();
      const currentY = e.clientY - rect.top;
      const percent = (currentY / rect.height) * 100;
      setLeftTopHeightPercent(Math.max(25, Math.min(80, Math.round(percent * 10) / 10)));
    };

    const handleMouseUp = () => {
      setResizingLeftVertical(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingLeftVertical]);

  // 3) 좌측 C 소스 <-> ASM 매핑 가로 분할선 드래그 핸들러
  useEffect(() => {
    if (!resizingLeftCodeCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!leftTopContainerRef.current) return;
      const rect = leftTopContainerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const percent = (currentX / rect.width) * 100;
      setLeftCodeColRatio(Math.max(20, Math.min(80, Math.round(percent * 10) / 10)));
    };

    const handleMouseUp = () => {
      setResizingLeftCodeCol(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingLeftCodeCol]);

  return {
    leftPaneWidth,
    setLeftPaneWidth,
    resizingLeftPane,
    mainWorkspaceRef,
    handleMainDividerResizeStart,

    leftTopHeightPercent,
    setLeftTopHeightPercent,
    resizingLeftVertical,
    setResizingLeftVertical,
    leftPaneContainerRef,

    leftCodeColRatio,
    setLeftCodeColRatio,
    resizingLeftCodeCol,
    setResizingLeftCodeCol,
    leftTopContainerRef,
  };
}

