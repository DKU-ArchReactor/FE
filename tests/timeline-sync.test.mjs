import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(new URL("../package.json", import.meta.url));
const FE_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const source = readFileSync(
  new URL("../src/pages/Main/utils/timelineSync.ts", import.meta.url),
  "utf8",
);

function loadTimelineSync() {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports },
  );
  return exports;
}

/** React 19 createRoot 기반 상태·버튼 시뮬레이션용 경량 DOM/모듈 로더 */
function mountPlaybackRig(mode = "pipeline") {
  const React = require("react");
  const ReactDOMClient = require("react-dom/client");

  class FakeNode {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.childNodes = [];
      this.parentNode = null;
      this.ownerDocument = null;
      this.style = {};
      this._attrs = new Map();
      this._listeners = new Map();
    }
    get firstChild() { return this.childNodes[0] || null; }
    get nextSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.childNodes.indexOf(this);
      return idx >= 0 ? this.parentNode.childNodes[idx + 1] || null : null;
    }
    appendChild(child) { return this.insertBefore(child, null); }
    insertBefore(child, before) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      if (!before) this.childNodes.push(child);
      else {
        const idx = this.childNodes.indexOf(before);
        this.childNodes.splice(idx >= 0 ? idx : this.childNodes.length, 0, child);
      }
      return child;
    }
    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx >= 0) this.childNodes.splice(idx, 1);
      child.parentNode = null;
      return child;
    }
    setAttribute(k, v) {
      const s = String(v);
      this._attrs.set(k, s);
      if (k === "value" || k === "title" || k === "type") this[k] = s;
      if (k === "disabled") this.disabled = true;
    }
    getAttribute(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; }
    removeAttribute(k) {
      this._attrs.delete(k);
      if (k === "disabled") this.disabled = false;
    }
    addEventListener(type, fn, opts) {
      if (!this._listeners.has(type)) this._listeners.set(type, new Set());
      this._listeners.get(type).add({ fn, capture: Boolean(opts === true || opts?.capture) });
    }
    removeEventListener(type, fn) {
      const set = this._listeners.get(type);
      if (!set) return;
      for (const item of set) if (item.fn === fn) set.delete(item);
    }
    dispatchEvent(ev) {
      ev.target = this;
      const chain = [];
      for (let cur = this; cur; cur = cur.parentNode) chain.push(cur);
      for (let i = chain.length - 1; i >= 0; i--) {
        for (const l of chain[i]._listeners.get(ev.type) || []) if (l.capture) l.fn.call(chain[i], ev);
      }
      for (let i = 0; i < chain.length; i++) {
        ev.currentTarget = chain[i];
        for (const l of chain[i]._listeners.get(ev.type) || []) if (!l.capture) l.fn.call(chain[i], ev);
      }
    }
    contains(node) {
      for (let cur = node; cur; cur = cur.parentNode) if (cur === this) return true;
      return false;
    }
    focus() {}
  }
  class FakeElement extends FakeNode {
    constructor(tag) {
      super(1, tag.toUpperCase());
      this.tagName = tag.toUpperCase();
      this.localName = tag.toLowerCase();
      this.namespaceURI = "http://www.w3.org/1999/xhtml";
      this._text = "";
      this.disabled = false;
      this.className = "";
      this.title = "";
      this.type = "";
      this.value = "";
    }
    set textContent(v) { this._text = String(v ?? ""); this.childNodes = []; }
    get textContent() { return this.childNodes.length === 0 ? this._text : this.childNodes.map((c) => c.textContent).join(""); }
  }
  class FakeText extends FakeNode {
    constructor(data) { super(3, "#text"); this.data = String(data); }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
    get nodeValue() { return this.data; }
    set nodeValue(v) { this.data = String(v); }
  }
  class FakeComment extends FakeNode {
    constructor(data) { super(8, "#comment"); this.data = String(data); }
    get textContent() { return ""; }
  }

  const prevGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };

  const doc = new FakeNode(9, "#document");
  doc.ownerDocument = doc;
  doc.defaultView = globalThis;
  doc.HTMLIFrameElement = class HTMLIFrameElement {};
  doc.HTMLElement = FakeElement;
  doc.hidden = false;
  doc.createElement = (tag) => { const el = new FakeElement(tag); el.ownerDocument = doc; return el; };
  doc.createElementNS = (_ns, tag) => doc.createElement(tag);
  doc.createTextNode = (data) => { const t = new FakeText(data); t.ownerDocument = doc; return t; };
  doc.createComment = (data) => { const c = new FakeComment(data); c.ownerDocument = doc; return c; };
  doc.documentElement = doc.createElement("html");
  doc.body = doc.createElement("body");
  doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;

  let rafSeq = 1;
  const rafs = new Map();
  globalThis.window = globalThis;
  globalThis.document = doc;
  globalThis.HTMLIFrameElement = doc.HTMLIFrameElement;
  globalThis.HTMLElement = FakeElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (fn) => { const id = rafSeq++; rafs.set(id, fn); return id; };
  globalThis.cancelAnimationFrame = (id) => { rafs.delete(id); };

  const cache = new Map();
  const loadTs = (relPath) => {
    const full = path.resolve(FE_ROOT, relPath);
    if (cache.has(full)) return cache.get(full);
    const out = ts.transpileModule(readFileSync(full, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: full,
    }).outputText;
    const mod = { exports: {} };
    cache.set(full, mod.exports);
    const localRequire = (spec) => {
      if (spec === "react") return React;
      if (spec === "react/jsx-runtime") return require("react/jsx-runtime");
      if (spec === "react-dom/client") return ReactDOMClient;
      if (spec.endsWith(".css")) return {};
      if (spec.startsWith("@/")) {
        const target = path.join(FE_ROOT, "src", spec.slice(2));
        for (const ext of [".ts", ".tsx"]) {
          try { return loadTs(path.relative(FE_ROOT, target + ext)); } catch {}
        }
        return {};
      }
      if (spec.startsWith(".")) {
        const dir = path.dirname(full);
        for (const ext of ["", ".ts", ".tsx"]) {
          try { return loadTs(path.relative(FE_ROOT, path.resolve(dir, spec + ext))); } catch {}
        }
      }
      return require(spec);
    };
    new Function("exports", "require", "module", out)(mod.exports, localRequire, mod);
    cache.set(full, mod.exports);
    return mod.exports;
  };

  const { timelineSync: tsMod } = loadTs("src/pages/Main/utils/timelineSync.ts");
  const { useSimulationPlayback } = loadTs("src/pages/Main/hooks/useSimulationPlayback.ts");
  const ControlPanel = loadTs("src/pages/Main/components/ControlPanel.tsx").default;

  const makeFrame = (clock) => ({
    clock,
    buffers: { IF: { pc: `0x${(0x10000 + clock * 4).toString(16)}`, assembly: "addi a0, a0, 1" }, ID: null, EX: null, MEM: null, WB: null },
    stage_activity: { IF: { pc: `0x${(0x10000 + clock * 4).toString(16)}`, assembly: "addi a0, a0, 1", status: "active" }, ID: { assembly: "empty", status: "empty" }, EX: { assembly: "empty", status: "empty" }, MEM: { assembly: "empty", status: "empty" }, WB: { assembly: "empty", status: "empty" } },
    cycle_events: { stall: { has_stall: false }, forwarding: { has_forwarded: false }, control_hazard: { has_flush: false }, runtime_error: { has_error: false } },
    global_result: { current_pc: "0x10000", registers: {}, memory_snapshot: {}, metrics: { accumulated_instructions: clock } },
  });
  const simData = {
    simulator: { mode },
    program: { entry_point: "0x00010000" },
    history: [makeFrame(1), makeFrame(2), makeFrame(3), makeFrame(4), makeFrame(5)],
  };
  const rows = [{ pc: "0x10004", text: "addi a0, a0, 1", sourceLine: 1 }];

  let playback = null;
  function Harness() {
    const clear = React.useCallback(() => {}, []);
    const pb = useSimulationPlayback({
      simulationData: simData,
      mappedAssemblyRows: rows,
      isSingleEngine: mode === "single",
      editorTarget: "c",
      translationSelectedLine: null,
      onClearSelection: clear,
    });
    playback = pb;
    const prevCycleRef = React.useRef(pb.currentCycle);
    React.useEffect(() => {
      if (prevCycleRef.current !== pb.currentCycle) {
        prevCycleRef.current = pb.currentCycle;
        tsMod.setProgress(
          pb.currentCycle,
          pb.currentCycle === 0 ? 0 : pb.isPlaying ? 0 : 1,
        );
      }
    }, [pb.currentCycle, pb.isPlaying]);
    return React.createElement(ControlPanel, {
      currentCycle: pb.currentCycle,
      totalCycles: pb.totalCycles,
      isPlaying: pb.isPlaying,
      playSpeed: pb.playSpeed,
      onStepBack: pb.handleStepBack,
      onStepForward: pb.handleStepForward,
      onTogglePlay: pb.handleTogglePlay,
      onReset: pb.handleReset,
      onResetAndPlay: pb.handleResetAndPlay,
      onPlayCurrentCycle: pb.handlePlayCurrentCycle,
      isCyclePlaying: pb.isCyclePlaying,
      isAtTimelineEnd: pb.isAtTimelineEnd,
      onJumpToCycle: pb.handleJumpToCycle,
      onChangeSpeed: pb.setPlaySpeed,
      isReady: pb.isSimulationReady,
      isCompiling: false,
      mode,
      simulationData: simData,
      editorTarget: "c",
    });
  }

  const container = doc.createElement("div");
  doc.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);

  const clickEv = () => ({ type: "click", button: 0, bubbles: true, cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} });
  const findButton = (titleSub) => {
    const stack = [container];
    while (stack.length) {
      const n = stack.shift();
      if (n.tagName === "BUTTON" && n.title && n.title.includes(titleSub)) return n;
      if (n.childNodes) stack.push(...n.childNodes);
    }
    return null;
  };
  const cleanup = () => {
    Object.assign(globalThis, prevGlobals);
  };

  return { React, root, container, Harness, tsMod, findButton, clickEv, getPlayback: () => playback, cleanup };
}

test("isMidCycleProgress distinguishes (~] playback from ] completion", () => {
  const { isMidCycleProgress, TIMELINE_END_THRESHOLD } = loadTimelineSync();

  assert.equal(isMidCycleProgress(0, 0, 0), false);
  assert.equal(isMidCycleProgress(2, 2, 0), true);
  assert.equal(isMidCycleProgress(2, 2, 0.45), true);
  assert.equal(isMidCycleProgress(2, 2, TIMELINE_END_THRESHOLD), false);
  assert.equal(isMidCycleProgress(2, 2, 1), false);
  // 다른 사이클에 머물던 sync 값은 현재 사이클의 진행 중 상태로 오인하지 않음
  assert.equal(isMidCycleProgress(3, 2, 0.45), false);
});

test("snapProgress advances epoch to invalidate stale animation frames while setProgress preserves epoch", () => {
  const { timelineSync } = loadTimelineSync();
  const seen = [];
  const unsubscribe = timelineSync.subscribe((progress, cycle) => {
    seen.push({ progress, cycle });
  });

  const initialEpoch = timelineSync.getEpoch();
  timelineSync.setProgress(2, 0.4);
  assert.equal(timelineSync.getEpoch(), initialEpoch);
  const mid = timelineSync.getProgress();
  assert.equal(mid.cycle, 2);
  assert.equal(mid.progress, 0.4);

  timelineSync.snapProgress(2, 1);
  assert.equal(timelineSync.getEpoch(), initialEpoch + 1);
  const snapped = timelineSync.getProgress();
  assert.equal(snapped.cycle, 2);
  assert.equal(snapped.progress, 1);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].cycle, 2);
  assert.equal(seen[0].progress, 0.4);
  assert.equal(seen[1].cycle, 2);
  assert.equal(seen[1].progress, 1);

  unsubscribe();
});

for (const mode of ["pipeline", "single"]) {
  test(`(${mode}) PLAY from stopped ] advances forward cleanly and step-back never rewinds two cycles`, async () => {
    const rig = mountPlaybackRig(mode);
    const { React, root, Harness, tsMod, findButton, clickEv, getPlayback } = rig;
    const click = async (btn) => {
      await React.act(async () => {
        btn.dispatchEvent(clickEv());
      });
    };
    try {
      await React.act(async () => {
        root.render(React.createElement(React.StrictMode, null, React.createElement(Harness)));
      });
      const fwd = () => findButton("다음");
      const back = () => findButton("이전");
      const play = () => findButton("재생 (Play)") || findButton("일시정지 (Pause)");

      // 0 -> 1 -> 2 -> 3 -> 2 -> 1
      await click(fwd());
      await click(fwd());
      await click(fwd());
      assert.equal(getPlayback().currentCycle, 3);
      await click(back());
      assert.equal(getPlayback().currentCycle, 2);
      assert.equal(tsMod.getProgress().progress, 1);
      await click(back());
      assert.equal(getPlayback().currentCycle, 1);
      assert.equal(tsMod.getProgress().progress, 1);

      // 1] 정지 상태에서 PLAY 시 Cycle 1 재실행이 아니라 Cycle 2로 전진해야 함
      await click(play());
      assert.equal(getPlayback().isPlaying, true);
      assert.equal(getPlayback().currentCycle, 2);
      await React.act(async () => {
        tsMod.setProgress(2, 0.4);
      });
      // (1, 2] 재생 중 < 클릭 시 1]로 1단계만 복귀
      await click(back());
      assert.equal(getPlayback().isPlaying, false);
      assert.equal(getPlayback().currentCycle, 1);
      assert.equal(tsMod.getProgress().cycle, 1);
      assert.equal(tsMod.getProgress().progress, 1);

      // 1] -> PLAY -> (1, 2] 중간에서 > 스냅(2]) -> < (1])
      await click(play());
      assert.equal(getPlayback().currentCycle, 2);
      await React.act(async () => {
        tsMod.setProgress(2, 0.4);
      });
      await click(fwd());
      assert.equal(getPlayback().isPlaying, false);
      assert.equal(getPlayback().currentCycle, 2);
      assert.equal(tsMod.getProgress().progress, 1);
      await click(back());
      assert.equal(getPlayback().currentCycle, 1);
      assert.equal(tsMod.getProgress().progress, 1);

      // 마지막 사이클 (4, 5] 진행 중에는 > 활성화, 5] 도달 시 비활성화
      await React.act(async () => {
        getPlayback().handleJumpToCycle(4);
      });
      await click(play());
      assert.equal(getPlayback().currentCycle, 5);
      await React.act(async () => {
        tsMod.setProgress(5, 0.4);
      });
      assert.equal(getPlayback().isAtTimelineEnd, false);
      assert.equal(fwd().disabled, false);
      await click(fwd());
      assert.equal(getPlayback().currentCycle, 5);
      assert.equal(tsMod.getProgress().progress, 1);
      assert.equal(getPlayback().isAtTimelineEnd, true);
      assert.equal(fwd().disabled, true);
    } finally {
      await React.act(async () => {
        root.unmount();
      });
      rig.cleanup();
    }
  });
}

test("재생 중 스텝백(<) 시 rAF 루프가 바 원 위치를 next-1로 덮어쓰지 않아야 함", async () => {
  for (const relPath of [
    "../src/pages/Main/components/SingleInstructionFlow.tsx",
    "../src/pages/Main/components/PipelineVisualizer.tsx",
  ]) {
    const code = readFileSync(new URL(relPath, import.meta.url), "utf8");
    assert.match(
      code,
      /if\s*\(\s*!isPlaying\s*\|\|\s*!isSubstepPlaying\s*\)\s*\{\s*return;\s*\}/,
      `${relPath}의 rAF effect는 !isPlaying || !isSubstepPlaying을 가드해야 함`,
    );
    assert.match(
      code,
      /\},\s*\[isPlaying,\s*isSubstepPlaying,\s*playbackRevision,\s*flowDuration,\s*currentCycle\]\);/,
      `${relPath}의 rAF effect 의존성 배열에 isPlaying과 playbackRevision이 포함되어야 함`,
    );
  }

  const rig = mountPlaybackRig("single");
  const { React, root, container, Harness, tsMod, findButton, clickEv, getPlayback } = rig;
  const click = async (btn) => {
    await React.act(async () => {
      btn.dispatchEvent(clickEv());
    });
  };
  const getIndicatorLeft = () => {
    const stack = [container];
    while (stack.length) {
      const n = stack.shift();
      if (n.style && typeof n.style.left === "string" && n.style.left.endsWith("%")) {
        return n.style.left;
      }
      if (n.childNodes) stack.push(...n.childNodes);
    }
    return null;
  };

  try {
    await React.act(async () => {
      root.render(React.createElement(React.StrictMode, null, React.createElement(Harness)));
    });

    await React.act(async () => {
      getPlayback().handleJumpToCycle(4);
    });
    await click(findButton("재생 (Play)"));
    assert.equal(getPlayback().currentCycle, 5);
    assert.equal(getPlayback().isPlaying, true);
    await React.act(async () => {
      tsMod.setProgress(5, 0.4);
    });

    await click(findButton("이전"));
    assert.equal(getPlayback().isPlaying, false);
    assert.equal(getPlayback().currentCycle, 4);
    assert.equal(tsMod.getProgress().cycle, 4);
    assert.equal(tsMod.getProgress().progress, 1);
    assert.equal(getIndicatorLeft(), "80%");

    // 4] 정지 상태에서 PLAY 시 5로 정상 전진
    await click(findButton("재생 (Play)"));
    assert.equal(getPlayback().isPlaying, true);
    assert.equal(getPlayback().currentCycle, 5);
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    rig.cleanup();
  }
});
