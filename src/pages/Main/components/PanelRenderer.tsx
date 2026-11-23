import type { EditorSelection } from '../utils/assistantSource';
import React from "react";
import type { PanelKey } from "../types";

// 컴포넌트 임포트
import TutorArea from "./TutorArea";
import PipelineVisualizer from "./PipelineVisualizer";
import SingleCycleDatapath from "./SingleCycleDatapath";
import RegisterVisualizer from "./RegisterVisualizer";
import MemorySegmentVisualizer from "./MemorySegmentVisualizer";
import MultiCycleDiagram from "./MultiCycleDiagram";
import PerformanceMetrics from "./PerformanceMetrics";
import HazardDiagnostics from "./HazardDiagnostics";
import TranslationEditor from "./TranslationEditor";
import TranslationMapping from "./TranslationMapping";

import type { SimulationResult, CycleHistoryItem } from "@/type/simulation";
import type { FileSummary } from "@/type/file";
import type { MappedAssemblyRow } from "../utils/translationCompile";


const EMPTY_REGISTERS: Record<string, string> = {};

interface PanelRendererProps {
  tutorSelection?:{kind:'c'|'asm';revision:number};
  onTutorSelect?:(kind:'c'|'asm')=>void;
  onSourceSelection?: (selection: EditorSelection | null) => void;
  panelKey: PanelKey;
  simulationData: SimulationResult | null;
  currentData: CycleHistoryItem | null;
  prevData: CycleHistoryItem | null;
  currentCycle: number;
  playSpeed: number;
  onPausePlayback?: () => void;
  isPlaying?: boolean;
  singlePlaybackFinished?: boolean;
  playbackRevision?: number;
  loadingMessage: string | null;
  simulationMode: "single" | "pipeline";
  isSingleEngine: boolean;
  currentActiveRow: MappedAssemblyRow | null;
  mappedAssemblyRows: MappedAssemblyRow[];
  activeExecutionCLine: number | null;
  effectiveSelectedLine: number | null;

  // C & ASM 편집 및 매핑
  translationSource: string;
  translationAssembly: string;
  cFileName: string;
  fileId: string | null;
  editorTarget: "c" | "asm";
  customAssembly: string;
  translationBusy: boolean;
  translationError: string;
  asmError?: string;
  translationSelectedLine: number | null;
  translationSelectedAsmIndex: number | null;

  // 액션 핸들러
  onUpdateTranslationSource: (val: string) => void;
  onResetTranslationSource: () => void;
  onTranslationCompile: () => void;
  onTranslationFile: (file: File) => void;
  onSelectTranslationLine: (line: number | null, asmIndex?: number | null, openTutorModal?: boolean) => void;
  onSaveTranslationFile: (name?: string) => Promise<boolean>;
  onSaveAssemblyFile?: (name?: string) => Promise<boolean>;
  onOpenSavedFileInEditor: (fileId: string) => void;
  onOpenSavedAssemblyFile?: (fileId: string) => void;
  onCustomAssemblyChange: (val: string) => void;
  onSimulateAssembly: () => void;
  onResetCustomAssembly: () => void;
  onJumpToCycle: (cycle: number) => void;

  // 저장된 파일 목록 상태
  savedFiles: FileSummary[];
  isLoggedIn: boolean;
  onCloseTutor?: () => void;
}

export const PanelRenderer: React.FC<PanelRendererProps> = ({
  panelKey,
  onSourceSelection,
  tutorSelection,
  onTutorSelect,
  simulationData,
  currentData,
  prevData,
  currentCycle,
  playSpeed,
  onPausePlayback,
  isPlaying,
  singlePlaybackFinished,
  playbackRevision,
  loadingMessage,
  simulationMode,
  isSingleEngine,
  currentActiveRow,
  mappedAssemblyRows,
  activeExecutionCLine,
  effectiveSelectedLine,

  translationSource,
  translationAssembly,
  cFileName,
  fileId,
  editorTarget,
  customAssembly,
  translationBusy,
  translationError,
  asmError = "",
  translationSelectedLine,
  translationSelectedAsmIndex,

  onUpdateTranslationSource,
  onResetTranslationSource,
  onTranslationCompile,
  onTranslationFile,
  onSelectTranslationLine,
  onSaveTranslationFile,
  onSaveAssemblyFile,
  onOpenSavedFileInEditor,
  onOpenSavedAssemblyFile,
  onCustomAssemblyChange,
  onSimulateAssembly,
  onResetCustomAssembly,
  onJumpToCycle,

  savedFiles,
  isLoggedIn,
  onCloseTutor,
}) => {
  switch (panelKey) {
    case "cSource":
      return (
        <TranslationEditor
          onSourceSelection={onSourceSelection}
          source={translationSource}
          fileName={cFileName || "main.c"}
          onChange={onUpdateTranslationSource}
          onCompile={onTranslationCompile}
          onFile={onTranslationFile}
          onReset={onResetTranslationSource}
          busy={translationBusy}
          error={translationError}
          selectedLine={translationSelectedLine}
          executionLine={activeExecutionCLine}
          onSelectLine={(...args)=>{if(args[0]!=null)onTutorSelect?.('c');onSelectTranslationLine(...args);}}
          savedFiles={savedFiles}
          isLoggedIn={isLoggedIn}
          currentFileId={fileId}
          onOpenSavedFile={onOpenSavedFileInEditor}
          onSave={onSaveTranslationFile}
          activeTarget={editorTarget}
          mode={simulationMode}
        />
      );

    case "source":
      return (
        <TranslationMapping
          onSourceSelection={onSourceSelection}
          source={translationSource}
          assembly={editorTarget === "asm" ? customAssembly : translationAssembly}
          mappedRows={editorTarget === "asm" ? undefined : mappedAssemblyRows}
          busy={translationBusy}
          error={asmError}
          selectedLine={translationSelectedLine}
          selectedAsmIndex={translationSelectedAsmIndex}
          executionLine={activeExecutionCLine}
          onSelectLine={(...args)=>{if(args[0]!=null||args[1]!=null)onTutorSelect?.('asm');onSelectTranslationLine(...args);}}
          stageBuffers={currentData?.buffers}
          prevStageBuffers={prevData?.buffers}
          cycleEvents={currentData?.cycle_events}
          simulationData={simulationData}
          playbackCycle={currentCycle}
          mode={simulationMode}
          currentActiveStep={
            isSingleEngine
              ? currentActiveRow
                ? mappedAssemblyRows.findIndex((r) => r === currentActiveRow)
                : null
              : null
          }
          activeTarget={editorTarget}
          onAssemblyChange={onCustomAssemblyChange}
          onSimulateAssembly={onSimulateAssembly}
          onResetAssembly={onResetCustomAssembly}
          onSave={onSaveAssemblyFile}
          onOpenSavedFile={onOpenSavedAssemblyFile}
          savedFiles={savedFiles}
          currentFileId={fileId}
          isSimulated={Boolean(simulationData)}
        />
      );

    case "tutor":
      return (
        <TutorArea
          selectionKind={tutorSelection?.kind}
          selectionRevision={tutorSelection?.revision}
          isPlaying={isPlaying}
          simulationData={simulationData}
          currentCycleData={currentData}
          loadingMessage={loadingMessage}
          translationSource={translationSource}
          translationAssembly={editorTarget === "asm" ? customAssembly : translationAssembly}
          mappedRows={editorTarget === "asm" && !simulationData ? undefined : mappedAssemblyRows}
          selectedTranslationLine={editorTarget === "asm" ? translationSelectedLine : effectiveSelectedLine}
          selectedAsmIndex={translationSelectedAsmIndex}
          currentActiveAsmIndex={
            isSingleEngine
              ? currentActiveRow
                ? mappedAssemblyRows.findIndex((r) => r === currentActiveRow)
                : null
              : null
          }
          isUserSelected={translationSelectedLine !== null || translationSelectedAsmIndex !== null}
          activeTarget={editorTarget}
          mode={simulationMode}
          onClose={onCloseTutor}
        />
      );

    case "pipeline":
      if (simulationMode === "single") {
        return (
          <SingleCycleDatapath
            lessonContext={{
              isPlaying,
              playbackRevision,
              playbackFinished: singlePlaybackFinished,
              flowDurationMs: playSpeed,
              onPausePlayback,
              source: editorTarget === "c" ? translationSource : undefined,
              rows: mappedAssemblyRows,
              selectedAsmIndex: translationSelectedAsmIndex,
              selectedCLine: editorTarget === "c" ? translationSelectedLine : undefined,
              onSelectAsm: (line: number | null, index: number) => onSelectTranslationLine(line, index, false),
              onJumpToCycle,
            }}
            currentData={currentData}
            prevData={prevData}
            simulationData={simulationData}
            loadingMessage={loadingMessage}
          />
        );
      }
      return (
        <PipelineVisualizer
          lessonContext={{
            isPlaying,
            playbackRevision,
            playbackFinished: singlePlaybackFinished,
            flowDurationMs: playSpeed,
            onPausePlayback,
            source: editorTarget === "c" ? translationSource : undefined,
            rows: mappedAssemblyRows,
            selectedAsmIndex: translationSelectedAsmIndex,
            selectedCLine: editorTarget === "c" ? translationSelectedLine : undefined,
            onSelectAsm: (line: number | null, index: number) => onSelectTranslationLine(line, index, false),
            onJumpToCycle,
          }}
          currentData={currentData}
          prevData={prevData}
          simulationData={simulationData}
          loadingMessage={loadingMessage}
          mode="pipeline"
        />
      );

    case "registers":
      return (
        <RegisterVisualizer
          registers={currentData?.global_result.registers ?? EMPTY_REGISTERS}
          prevRegisters={prevData?.global_result.registers}
          playSpeed={playSpeed}
          cycle={currentCycle}
          mode={simulationMode}
        />
      );

    case "memory":
      return (
        <MemorySegmentVisualizer
          currentData={currentData}
          prevData={prevData}
          simulationData={simulationData}
          playSpeed={playSpeed}
          cycle={currentCycle}
        />
      );

    case "multiCycle":
      return (
        <MultiCycleDiagram
          simulationData={simulationData}
          currentCycle={currentCycle}
          onJumpToCycle={onJumpToCycle}
          mappedRows={mappedAssemblyRows}
          mode={simulationMode}
          loadingMessage={loadingMessage}
        />
      );

    case "metrics":
      return (
        <PerformanceMetrics
          simulationData={simulationData}
          currentCycle={currentCycle}
          mode={simulationMode}
        />
      );

    case "hazardDiag":
      return (
        <HazardDiagnostics
          simulationData={simulationData}
          currentCycleData={currentData}
          currentCycle={currentCycle}
        />
      );

    default:
      return null;
  }
};

export default PanelRenderer;
