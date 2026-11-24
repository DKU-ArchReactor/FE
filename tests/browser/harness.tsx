// Local-only component integration harness. Vite's production entry excludes tests/.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AiAssistantPopup from "../../src/components/AiAssistantPopup";
import { useSimulationSession } from "../../src/pages/Main/hooks/useSimulationSession";
import { useSimulationPlayback } from "../../src/pages/Main/hooks/useSimulationPlayback";
import { useAuthSession, notifyAuthChanged } from "../../src/api/authSession";
import "../../src/index.css";
function Harness() {
  const auth = useAuthSession();
  const [source, setSource] = useState("int main(void) { return 0; }");
  const [assembly, setAssembly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  const session = useSimulationSession({
    workspaceKey: `${source}:${auth.epoch}`,
    translationSource: source,
    translationAssembly: assembly,
    translationBusy: busy,
    setTranslationBusy: setBusy,
    setTranslationError: setError,
    setTranslationAssembly: setAssembly,
  });
  const playback = useSimulationPlayback({
    simulationData: session.simulationData,
    mappedAssemblyRows: session.mappedAssemblyRows,
    isSingleEngine: session.isSingleEngine,
    editorTarget: "c",
    translationSelectedLine: null,
    onClearSelection: () => {},
  });
  const callbacks = {
    onSimulationComplete: playback.handleSimulationComplete,
    triggerPlaybackFeedback: playback.triggerPlaybackFeedback,
    isPlaying: playback.isPlaying,
    currentCycle: playback.currentCycle,
  };
  return (
    <>
      <div style={{ width: 450 }}>
        <button onClick={() => session.handleTranslationCompile(callbacks)}>
          compile
        </button>
        <button onClick={() => setSource((value) => value + " ")}>
          edit source
        </button>
        <button
          onClick={() =>
            session.handleSimulationModeChange("single", callbacks)
          }
        >
          single
        </button>
        <button
          onClick={() =>
            session.handleSimulationModeChange("pipeline", callbacks)
          }
        >
          pipeline
        </button>
        <button onClick={() => playback.setCurrentCycle((value) => value + 1)}>
          next cycle
        </button>
        <button
          onClick={() => {
            localStorage.setItem("access_token", "test-account-two");
            notifyAuthChanged();
          }}
        >
          switch account
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("access_token");
            notifyAuthChanged();
          }}
        >
          logout
        </button>
        <button onClick={() => setOpen(true)}>open chat</button>
        <p data-testid="run">
          {session.simulationData?.assistant_context?.available
            ? session.simulationData.assistant_context.execution_id
            : "none"}
        </p>
        <p data-testid="clock">{playback.currentData?.clock}</p>
        <p data-testid="busy">{String(busy)}</p>
        <p>{error}</p>
      </div>
      <AiAssistantPopup
        key={auth.epoch}
        isOpen={open}
        onClose={() => setOpen(false)}
        authenticated={auth.authenticated}
        simulation={session.simulationData}
        currentData={playback.currentData}
        mode={session.simulationEngineMode}
        beforeExecution={session.isSingleEngine && playback.currentCycle === 0}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
