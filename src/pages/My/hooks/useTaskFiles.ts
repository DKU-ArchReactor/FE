import React, { useCallback, useEffect, useRef, useState } from "react";
import { getFiles, saveFile, getFileById, deleteFile } from "@/api/file";
import { getAccessToken } from "@/api/authSession";
import type { FileSummary, FileDetail } from "@/type/file";

export function useTaskFiles() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // + 버튼 파일 추가 미리보기/저장 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newLang, setNewLang] = useState<string>("c");
  const [newContent, setNewContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 더블클릭 파일 상세 확인 모달 상태
  const [detailFile, setDetailFile] = useState<FileDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  const fetchFileList = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await getFiles();
      setFiles(list);
      setSelectedIds(new Set());
    } catch {
      setErrorMsg("파일 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFileList();
  }, [fetchFileList]);

  // 체크박스 개별 토글
  const handleToggleSelect = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // 전체 선택 토글
  const handleToggleSelectAll = () => {
    if (selectedIds.size === files.length && files.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.file_id)));
    }
  };

  // 개별 삭제
  const handleDeleteSingle = async (fileId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`'${title}' 파일을 삭제하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      await deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      if (detailFile?.file_id === fileId) {
        setDetailFile(null);
      }
    } catch {
      setErrorMsg("파일 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 선택된 파일 일괄 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개의 파일을 모두 삭제하시겠습니까?`)) return;

    setIsDeleting(true);
    try {
      const targetIds = Array.from(selectedIds);
      await Promise.all(targetIds.map((id) => deleteFile(id)));
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.file_id)));
      if (detailFile && selectedIds.has(detailFile.file_id)) {
        setDetailFile(null);
      }
      setSelectedIds(new Set());
    } catch {
      setErrorMsg("일부 파일 삭제 중 오류가 발생했습니다.");
      void fetchFileList();
    } finally {
      setIsDeleting(false);
    }
  };

  // + 버튼 클릭 -> 로컬 파일 선택창 열기
  const handleAddButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const detectedLang = ext === "s" || ext === "asm" ? "asm" : "c";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = (ev.target?.result as string) || "";
      setNewTitle(file.name);
      setNewLang(detectedLang);
      setNewContent(content);
      setIsAddModalOpen(true);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 새 파일 저장
  const handleSaveNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await saveFile({
        title: newTitle.trim(),
        content: newContent,
        lang: newLang,
      });
      setIsAddModalOpen(false);
      await fetchFileList();
    } catch {
      setErrorMsg("파일 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 더블클릭 시 상세 조회 모달 열기
  const handleRowDoubleClick = async (fileId: string) => {
    setIsDetailLoading(true);
    setErrorMsg(null);
    try {
      const detail = await getFileById(fileId);
      setDetailFile(detail);
    } catch {
      setErrorMsg("파일 상세 내용을 불러오지 못했습니다.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  return {
    fileInputRef,
    files,
    isLoading,
    errorMsg,
    setErrorMsg,
    selectedIds,
    isDeleting,
    isAddModalOpen,
    setIsAddModalOpen,
    newTitle,
    setNewTitle,
    newLang,
    setNewLang,
    newContent,
    setNewContent,
    isSaving,
    detailFile,
    setDetailFile,
    isDetailLoading,
    handleToggleSelect,
    handleToggleSelectAll,
    handleDeleteSingle,
    handleDeleteSelected,
    handleAddButtonClick,
    handleFileChange,
    handleSaveNewFile,
    handleRowDoubleClick,
  };
}
