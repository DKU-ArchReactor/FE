import { useState, useEffect, useRef } from "react";
import type { FileSummary } from "@/type/file";
import { getFiles, getFileById, saveFile } from "@/api/file";

const DEFAULT_TRANSLATION_SOURCE =
  "int main(void) {\n    int a = 5;\n    int b = 3;\n    int sum = a + b;\n    return sum;\n}\n";
export const TRANSLATION_SOURCE_KEY = "archreactor.translation.source";

export function useFileManager(initialFileId: string | null, example?: { source: string; fileName: string }) {
  const [fileId, setFileId] = useState<string | null>(initialFileId);
  const [cFileName, setCFileName] = useState<string>(example?.fileName ?? "");
  const [cContent, setCContent] = useState<string>(
    () => example?.source ?? sessionStorage.getItem(TRANSLATION_SOURCE_KEY) ?? ""
  );
  const [asmFileName, setAsmFileName] = useState<string>("");
  const [asmContent, setAsmContent] = useState<string>("");
  const [savedFiles, setSavedFiles] = useState<FileSummary[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!localStorage.getItem("access_token"));
  const [externalLoadFileId, setExternalLoadFileId] = useState<string | null>(null);

  const [fileContentCache, setFileContentCache] = useState<Record<string, string>>({});
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const loadedInitialFileIdRef = useRef<string | null>(null);

  const [translationSource, setTranslationSource] = useState(
    () => example?.source ?? (sessionStorage.getItem(TRANSLATION_SOURCE_KEY) || DEFAULT_TRANSLATION_SOURCE)
  );
  const [translationAssembly, setTranslationAssembly] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);

  // 로그인 상태 및 파일 목록 불러오기
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
    if (!token) {
      setSavedFiles([]);
      return;
    }
    getFiles()
      .then((list) => setSavedFiles(list))
      .catch((err) => console.error("Saved file list fetch error:", err));
  }, []);

  const updateTranslationSource = (
    source: string,
    fileName = "main.c",
    resetSimulation = false,
    keepFileId: string | null = null,
    onResetSimulation?: () => void
  ) => {
    setTranslationSource(source);
    setCContent(source);
    setCFileName(fileName);
    setFileId(keepFileId);
    sessionStorage.setItem(TRANSLATION_SOURCE_KEY, source);
    setAsmContent("");
    setTranslationAssembly("");
    setTranslationError("");

    if (resetSimulation && onResetSimulation) {
      onResetSimulation();
    }
  };

  const ensureFileContent = async (targetId: string): Promise<{ title: string; content: string } | null> => {
    const summary = savedFiles.find((f) => f.file_id === targetId);
    if (fileContentCache[targetId] !== undefined) {
      return {
        title: summary?.title || "main.c",
        content: fileContentCache[targetId],
      };
    }
    try {
      setLoadingPreviewId(targetId);
      const detail = await getFileById(targetId);
      setFileContentCache((prev) => ({ ...prev, [targetId]: detail.content }));
      return { title: detail.title, content: detail.content };
    } catch (err) {
      console.error("File detail fetch error:", err);
      return null;
    } finally {
      setLoadingPreviewId((prev) => (prev === targetId ? null : prev));
    }
  };

  const handleOpenSavedFileInEditor = async (
    targetId: string,
    onResetSimulation?: () => void
  ) => {
    const detail = await ensureFileContent(targetId);
    if (!detail) {
      setTranslationError("선택한 소스 코드 파일을 불러오지 못했습니다.");
      return;
    }
    updateTranslationSource(detail.content, detail.title, true, targetId, onResetSimulation);
  };

  const handleSaveTranslationFile = async (nameToSave?: string): Promise<boolean> => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("파일 저장은 로그인 후 이용할 수 있습니다.");
      return false;
    }

    const title = (nameToSave || cFileName || "main.c").trim();
    if (!title) return false;

    try {
      const saved = await saveFile({
        title,
        content: translationSource,
        lang: "c",
      });
      setFileId(saved.file_id);
      setCFileName(saved.title);
      const updatedList = await getFiles();
      setSavedFiles(updatedList);
      return true;
    } catch (err) {
      console.error("Save file error:", err);
      alert("파일 저장 중 오류가 발생했습니다.");
      return false;
    }
  };

  // initialFileId 변경 시 로드
  useEffect(() => {
    if (!initialFileId || loadedInitialFileIdRef.current === initialFileId) return;
    loadedInitialFileIdRef.current = initialFileId;
    void handleOpenSavedFileInEditor(initialFileId);
  }, [initialFileId]);

  return {
    fileId,
    setFileId,
    cFileName,
    setCFileName,
    cContent,
    setCContent,
    asmFileName,
    setAsmFileName,
    asmContent,
    setAsmContent,
    savedFiles,
    setSavedFiles,
    isLoggedIn,
    setIsLoggedIn,
    externalLoadFileId,
    setExternalLoadFileId,
    fileContentCache,
    loadingPreviewId,
    translationSource,
    setTranslationSource,
    translationAssembly,
    setTranslationAssembly,
    translationError,
    setTranslationError,
    translationBusy,
    setTranslationBusy,
    updateTranslationSource,
    ensureFileContent,
    handleOpenSavedFileInEditor,
    handleSaveTranslationFile,
    DEFAULT_TRANSLATION_SOURCE,
  };
}

