import React, { useState, useEffect, useRef, useCallback } from "react";
import type { FileSummary } from "@/type/file";
import { getFileById } from "@/api/file";
import { downloadTextFile } from "@/utils/fileDownload";

export function useUploadPopup(
  isOpen: boolean,
  onClose: () => void,
  anchorRef: React.RefObject<HTMLButtonElement | null>,
  popupWidth: number,
  onFileDrop: (file: File) => void
) {
  const popupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const updatePopupPos = useCallback(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const left = Math.max(
        12,
        Math.min(window.innerWidth - popupWidth - 12, rect.left)
      );
      const top = rect.bottom + 6;
      setPopupPos({ top, left });
    }
  }, [anchorRef, popupWidth]);

  useEffect(() => {
    if (isOpen) {
      updatePopupPos();
      window.addEventListener("resize", updatePopupPos);
      window.addEventListener("scroll", updatePopupPos, true);
      return () => {
        window.removeEventListener("resize", updatePopupPos);
        window.removeEventListener("scroll", updatePopupPos, true);
      };
    }
  }, [isOpen, updatePopupPos]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileDrop(files[0]);
      onClose();
    }
  };

  const handleDownloadSavedFile = async (
    e: React.MouseEvent,
    file: FileSummary,
    defaultExt?: string
  ) => {
    e.stopPropagation();
    try {
      const detail = await getFileById(file.file_id);
      const ext = defaultExt ?? (file.lang === "asm" ? "s" : "c");
      const fileName = detail.title || `${file.title || "source"}.${ext}`;
      downloadTextFile(detail.content, fileName);
    } catch (err) {
      console.error("File download error:", err);
      alert("파일을 다운로드하지 못했습니다.");
    }
  };

  return {
    popupRef,
    fileInputRef,
    isDragOver,
    popupPos,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDownloadSavedFile,
  };
}
