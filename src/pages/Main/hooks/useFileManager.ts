import { useState, useEffect, useRef, useCallback } from "react";
import type { FileSummary } from "@/type/file";
import { getFiles, getFileById, saveFile } from "@/api/file";

export const DEFAULT_TRANSLATION_SOURCE =
  "int main(void) {\n    int a = 5;\n    int b = 3;\n    int sum = a + b;\n    return sum;\n}\n";
export const TRANSLATION_SOURCE_KEY = "archreactor.translation.source";

export function useFileManager(
  initialFileId: string | null,
  example?: { source: string; fileName: string },
  onInitialResetSimulation?: () => void
) {
  const [fileId, setFileId] = useState<string | null>(initialFileId);
  const [cFileName, setCFileName] = useState<string>(example?.fileName ?? "main.c");
  const [savedFiles, setSavedFiles] = useState<FileSummary[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    () => !!localStorage.getItem("access_token")
  );

  const loadedInitialFileIdRef = useRef<string | null>(null);
  const onInitialResetRef = useRef(onInitialResetSimulation);

  useEffect(() => {
    onInitialResetRef.current = onInitialResetSimulation;
  }, [onInitialResetSimulation]);

  const [translationSource, setTranslationSource] = useState(
    () => example?.source ?? (sessionStorage.getItem(TRANSLATION_SOURCE_KEY) || DEFAULT_TRANSLATION_SOURCE)
  );
  const [translationAssembly, setTranslationAssembly] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);

  // 로그인 상태 및 파일 목록 불러오기
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      return;
    }
    getFiles()
      .then((list) => setSavedFiles(list))
      .catch((err) => console.error("Saved file list fetch error:", err));
  }, []);

  const updateTranslationSource = useCallback(
    (
      source: string,
      fileName = "main.c",
      resetSimulation = false,
      keepFileId: string | null = null,
      onResetSimulation?: () => void
    ) => {
      setTranslationSource(source);
      setCFileName(fileName);
      setFileId(keepFileId);
      sessionStorage.setItem(TRANSLATION_SOURCE_KEY, source);
      setTranslationAssembly("");
      setTranslationError("");

      if (resetSimulation && onResetSimulation) {
        onResetSimulation();
      }
    },
    []
  );

  const handleOpenSavedFileInEditor = useCallback(
    async (targetId: string, onResetSimulation?: () => void) => {
      try {
        const detail = await getFileById(targetId);
        updateTranslationSource(
          detail.content,
          detail.title || "main.c",
          true,
          targetId,
          onResetSimulation
        );
      } catch (err) {
        console.error("File detail fetch error:", err);
        setTranslationError("선택한 소스 코드 파일을 불러오지 못했습니다.");
      }
    },
    [updateTranslationSource]
  );

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
    getFileById(initialFileId)
      .then((detail) => {
        updateTranslationSource(
          detail.content,
          detail.title || "main.c",
          true,
          initialFileId,
          () => {
            onInitialResetRef.current?.();
          }
        );
      })
      .catch((err) => {
        console.error("File detail fetch error:", err);
        setTranslationError("선택한 소스 코드 파일을 불러오지 못했습니다.");
      });
  }, [initialFileId, updateTranslationSource]);

  return {
    fileId,
    setFileId,
    cFileName,
    setCFileName,
    cContent: translationSource,
    savedFiles,
    setSavedFiles,
    isLoggedIn,
    setIsLoggedIn,
    translationSource,
    setTranslationSource,
    translationAssembly,
    setTranslationAssembly,
    translationError,
    setTranslationError,
    translationBusy,
    setTranslationBusy,
    updateTranslationSource,
    handleOpenSavedFileInEditor,
    handleSaveTranslationFile,
    DEFAULT_TRANSLATION_SOURCE,
  };
}
