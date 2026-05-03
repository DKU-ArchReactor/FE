import SourceArea from "./components/Source";
import AIAgentArea from "./components/AIAgentArea";
import PipelineVisualizer from "./components/PipelineVisualizer";
import RegisterVisualizer from "./components/RegisterVisualizer";
import MemoryVisualizer from "./components/MemoryVisualizer";
import ControlPanel from "./components/ControlPanel";

const MainPage = () => {

  return (
    <main className="flex-1 flex px-4 pb-4 pt-4 w-full h-full" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
      <div className="flex w-full gap-4">
        <div className="w-1/5 flex flex-col min-w-0">
          <SourceArea />
        </div>
        
        <div className="w-3/5 flex flex-col gap-4 min-w-0">
          <div className="h-[60%] flex flex-col">
            <PipelineVisualizer />
          </div>
          <div className="h-[30%] flex gap-4">
            <div className="w-1/2 flex flex-col">
              <RegisterVisualizer />
            </div>
            <div className="w-1/2 flex flex-col">
              <MemoryVisualizer />
            </div>
          </div>
          <div className="h-[10%] flex flex-col">
            <ControlPanel />
          </div>
        </div>

        <div className="w-1/5 flex flex-col min-w-0">
          <AIAgentArea />
        </div>
      </div>
    </main>
  );
};

export default MainPage;
