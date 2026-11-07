import React from "react";
import type { PanelKey } from "../types";

// 컴포넌트 임포트
import TutorArea from "./TutorArea";
import AIAgentArea from "./AIAgentArea";
import PipelineVisualizer from "./PipelineVisualizer";
import StateVisualizer from "./StateVisualizer";
import RegisterVisualizer from "./RegisterVisualizer";
import MemorySegmentVisualizer from "./MemorySegmentVisualizer";
import MultiCycleDiagram from "./MultiCycleDiagram";
import PerformanceMetrics from "./PerformanceMetrics";
import HazardDiagnostics from "./HazardDiagnostics";
import TranslationEditor from "./TranslationEditor";
import TranslationMapping from "./TranslationMapping";
import FileListPanel from "./FileListPanel";

import type { SimulationResult, CycleHistoryItem } from "@/type/simulation";
import type { FileSummary } from "@/type/file";
import type { CodeLineSelectInfo } from "./Source/SourceViewer";
import type { MappedAssemblyRow } from "./translationCompile";

const EMPTY_REGISTERS: Record<string, string> = {};

interface PanelRendererProps {
  panelKey: PanelKey;
  simulationData: SimulationResult | null;
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  activeCycleIndex: number;
  playSpeed: number;
  loadingMessage: string | null;
  simulationMode: "single" | "pipeline";
  isSingleEngine: boolean;
  currentActiveRow: MappedAssemblyRow | null;
  mappedAssemblyRows: MappedAssemblyRow[];
  activeExecutionCLine: number | null;
  effectiveSelectedLine: number | null;
  isActuallyExecuting: boolean;

  // C & ASM 편집 및 매핑
  translationSource: string;
  translationAssembly: string;
  cContent: string;
  asmContent: string;
  cFileName: string;
  fileId: string | null;
  editorTarget: "c" | "asm";
  customAssembly: string;
  translationBusy: boolean;
  translationError: string;
  translationSelectedLine: number | null;
  translationSelectedAsmIndex: number | null;

  // 액션 핸들러
  onUpdateTranslationSource: (val: string) => void;
  onResetTranslationSource: () => void;
  onTranslationCompile: () => void;
  onTranslationFile: (file: File) => void;
  onSelectTranslationLine: (line: number | null, asmIndex?: number | null) => void;
  onSaveTranslationFile: (name?: string) => Promise<boolean>;
  onOpenSavedFileInEditor: (fileId: string) => void;
  onCustomAssemblyChange: (val: string) => void;
  onSimulateAssembly: () => void;
  onResetCustomAssembly: () => void;
  onJumpToCycle: (cycle: number) => void;

  // File List 상태
  savedFiles: FileSummary[];
  isLoggedIn: boolean;
  ensureFileContent: (fileId: string) => Promise<{ title: string; content: string } | null>;
  fileContentCache: Record<string, string>;
  loadingPreviewId: string | null;

  selectedCodeLine: CodeLineSelectInfo | null;
  onClearSelectedCodeLine: () => void;
}

export const PanelRenderer: React.FC<PanelRendererProps> = ({
  panelKey,
  simulationData,
  currentData,
  prevData,
  activeCycleIndex,
  playSpeed,
  loadingMessage,
  simulationMode,
  isSingleEngine,
  currentActiveRow,
  mappedAssemblyRows,
  activeExecutionCLine,
  effectiveSelectedLine,
  isActuallyExecuting,

  translationSource,
  translationAssembly,
  cContent,
  asmContent,
  cFileName,
  fileId,
  editorTarget,
  customAssembly,
  translationBusy,
  translationError,
  translationSelectedLine,
  translationSelectedAsmIndex,

  onUpdateTranslationSource,
  onResetTranslationSource,
  onTranslationCompile,
  onTranslationFile,
  onSelectTranslationLine,
  onSaveTranslationFile,
  onOpenSavedFileInEditor,
  onCustomAssemblyChange,
  onSimulateAssembly,
  onResetCustomAssembly,
  onJumpToCycle,

  savedFiles,
  isLoggedIn,
  ensureFileContent,
  fileContentCache,
  loadingPreviewId,

  selectedCodeLine,
  onClearSelectedCodeLine,
}) => {
  const renderPlaceholderBox = (title: string) => (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg shadow-xs border border-[var(--ar-border)] flex items-center justify-center p-4 min-h-0 overflow-hidden select-none transition-colors duration-150">
      <span className="text-base font-bold text-[var(--ar-text-primary)] tracking-wide">
        {title}
      </span>
    </div>
  );

  switch (panelKey) {
    case "cSource":
      return (
        <TranslationEditor
          source={translationSource}
          fileName={cFileName || "main.c"}
          onChange={onUpdateTranslationSource}
          onCompile={onTranslationCompile}
          onFile={onTranslationFile}
          onReset={onResetTranslationSource}
          busy={translationBusy}
          error={translationError}
          selectedLine={translationSelectedLine}
          executionLine={isActuallyExecuting ? activeExecutionCLine : null}
          onSelectLine={onSelectTranslationLine}
          savedFiles={savedFiles}
          isLoggedIn={isLoggedIn}
          currentFileId={fileId}
          onOpenSavedFile={onOpenSavedFileInEditor}
          onSave={onSaveTranslationFile}
          activeTarget={editorTarget}
        />
      );

    case "fileList":
      return (
        <FileListPanel
          savedFiles={savedFiles}
          isLoggedIn={isLoggedIn}
          selectedFileId={fileId}
          onOpenFileInEditor={onOpenSavedFileInEditor}
          ensureFileContent={ensureFileContent}
          fileContentCache={fileContentCache}
          loadingPreviewId={loadingPreviewId}
        />
      );

    case "source":
      return (
        <TranslationMapping
          source={translationSource || cContent}
          assembly={editorTarget === "asm" ? customAssembly : (translationAssembly || asmContent)}
          mappedRows={editorTarget === "asm" ? undefined : mappedAssemblyRows}
          busy={translationBusy}
          error={translationError}
          selectedLine={translationSelectedLine}
          selectedAsmIndex={translationSelectedAsmIndex}
          executionLine={activeExecutionCLine}
          onSelectLine={onSelectTranslationLine}
          stageBuffers={currentData?.buffers}
          mode={simulationMode}
          currentActiveStep={
            isSingleEngine
              ? currentActiveRow
                ? mappedAssemblyRows.findIndex((r) => r === currentActiveRow)
                : activeCycleIndex
              : null
          }
          activeTarget={editorTarget}
          onAssemblyChange={onCustomAssemblyChange}
          onSimulateAssembly={onSimulateAssembly}
          onResetAssembly={onResetCustomAssembly}
        />
      );

    case "tutor":
      return (
        <TutorArea
          simulationData={simulationData}
          currentCycleData={currentData}
          loadingMessage={loadingMessage}
          selectedCodeLine={selectedCodeLine}
          onClearSelectedCodeLine={onClearSelectedCodeLine}
          translationSource={translationSource || cContent}
          translationAssembly={translationAssembly || asmContent}
          selectedTranslationLine={effectiveSelectedLine}
          selectedAsmIndex={translationSelectedAsmIndex}
          currentActiveAsmIndex={
            isSingleEngine
              ? currentActiveRow
                ? mappedAssemblyRows.findIndex((r) => r === currentActiveRow)
                : activeCycleIndex
              : null
          }
          executionLine={isActuallyExecuting && editorTarget === "c" ? activeExecutionCLine : null}
          isUserSelected={editorTarget === "c" && translationSelectedLine !== null}
          onSelectTranslationLine={onSelectTranslationLine}
          activeTarget={editorTarget}
        />
      );

    case "pipeline":
      return (
        <PipelineVisualizer
          currentData={currentData}
          loadingMessage={loadingMessage}
          mode={simulationMode}
        />
      );

    case "state":
      return (
        <StateVisualizer
          currentData={currentData}
          prevData={prevData}
          simulationData={simulationData}
          defaultLayout="vertical"
        />
      );

    case "registers":
      return (
        <RegisterVisualizer
          registers={currentData?.global_result.registers ?? EMPTY_REGISTERS}
          prevRegisters={prevData?.global_result.registers}
          playSpeed={playSpeed}
          cycle={activeCycleIndex}
        />
      );

    case "memory":
      return (
        <MemorySegmentVisualizer
          currentData={currentData}
          prevData={prevData}
          simulationData={simulationData}
          translationAssembly={translationAssembly || asmContent}
          playSpeed={playSpeed}
          cycle={activeCycleIndex}
        />
      );

    case "multiCycle":
      return (
        <MultiCycleDiagram
          simulationData={simulationData}
          currentCycleData={currentData}
          currentCycle={activeCycleIndex}
          translationAssembly={translationAssembly || asmContent}
          onJumpToCycle={onJumpToCycle}
        />
      );

    case "metrics":
      return (
        <PerformanceMetrics
          simulationData={simulationData}
          currentCycleData={currentData}
          currentCycle={activeCycleIndex}
        />
      );

    case "hazardDiag":
      return (
        <HazardDiagnostics
          simulationData={simulationData}
          currentCycleData={currentData}
          currentCycle={activeCycleIndex}
        />
      );

    case "queues":
      return renderPlaceholderBox("Queues");

    case "ioDevice":
      return renderPlaceholderBox("IO Device");

    case "aiPanel":
      return <AIAgentArea />;

    default:
      return null;
  }
};

export default PanelRenderer;
