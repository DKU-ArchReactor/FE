import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getPreviewState, stages } from "./previewState";

const instructions = [
  "addi t0, zero, 5",
  "addi t1, zero, 3",
  "add t2, t0, t1",
  "sw t2, 0(zero)",
];

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandMark() {
  return (
    <img
      className="landing-mark"
      src="/logo.png"
      width="28"
      height="28"
      alt=""
      aria-hidden="true"
    />
  );
}

export function ProductPreview() {
  const [mode, setMode] = useState<"single" | "pipeline">("single");
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { maxClock, completed, stored, values, explanation } = getPreviewState(
    mode,
    clock,
  );

  useEffect(() => {
    if (!playing || clock >= maxClock) return;
    const timer = window.setInterval(() => {
      setClock((value) => Math.min(maxClock, value + 1));
    }, 850);
    return () => window.clearInterval(timer);
  }, [playing, maxClock, clock]);

  const selectMode = (next: "single" | "pipeline") => {
    setMode(next);
    setClock(0);
    setPlaying(false);
  };
  const togglePlayback = () => {
    if (clock === maxClock) {
      setClock(0);
      setPlaying(true);
    } else setPlaying((value) => !value);
  };

  return (
    <div className="landing-product" id="preview">
      <div className="landing-product-bar">
        <div className="landing-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="landing-product-name">
          <BrandMark />
          <span>
            ArchReactor <span className="landing-muted">/ workspace</span>
          </span>
        </div>
        <span className="landing-preview-label">
          <span /> 인터랙티브 미리보기
        </span>
      </div>
      <div className="landing-product-toolbar">
        <div
          className="landing-mode-switch"
          role="group"
          aria-label="미리보기 실행 모드"
        >
          <button
            type="button"
            aria-pressed={mode === "single"}
            onClick={() => selectMode("single")}
          >
            Single-cycle
          </button>
          <button
            type="button"
            aria-pressed={mode === "pipeline"}
            onClick={() => selectMode("pipeline")}
          >
            5-stage pipeline
          </button>
        </div>
        <div className="landing-demo-controls">
          <button
            type="button"
            aria-label="미리보기 초기화"
            onClick={() => {
              setClock(0);
              setPlaying(false);
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 10a8 8 0 1 1 1 7M4 4v6h6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="landing-play"
            aria-label={
              playing && clock < maxClock
                ? "미리보기 일시정지"
                : "미리보기 재생"
            }
            onClick={togglePlayback}
          >
            {playing && clock < maxClock ? "Ⅱ" : "▶"}
          </button>
          <button
            type="button"
            aria-label="미리보기 한 클록 실행"
            disabled={clock === maxClock}
            onClick={() => {
              setPlaying(false);
              setClock((value) => Math.min(value + 1, maxClock));
            }}
          >
            ⏵|
          </button>
          <span>
            Clock <b aria-live="polite">{clock}</b>
            <span className="landing-muted"> / {maxClock}</span>
          </span>
        </div>
      </div>
      <div className="landing-demo-body">
        <div className="landing-demo-source">
          <div className="landing-pane-title">
            <span>
              <span className="landing-file-icon">⌘</span> example.s
            </span>
            <span>RISC-V</span>
          </div>
          <div className="landing-source-lines">
            <div className="landing-source-comment">
              # 작은 코드에서 시작하는 큰 이해
            </div>
            {instructions.map((instruction, index) => (
              <div
                className={`landing-code-line ${clock > 0 && (mode === "single" ? index === clock - 1 : index === Math.min(clock - 1, 3)) ? "is-current" : ""}`}
                key={instruction}
              >
                <span>{index + 1}</span>
                <code>
                  <b>{instruction.split(" ")[0]}</b>{" "}
                  {instruction.slice(instruction.indexOf(" ") + 1)}
                </code>
                {index < completed && (
                  <span className="landing-complete" aria-label="실행 완료">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="landing-source-note">
            <span className="landing-tiny-dot" />{" "}
            {mode === "single"
              ? "명령어 하나를, 한 클록에."
              : "여러 명령어를, 서로 다른 단계에서."}
          </div>
        </div>
        <div className="landing-demo-cpu">
          <div className="landing-pane-title">
            <span>Execution flow</span>
            <span>{mode === "single" ? "Single-cycle" : "Pipelined"}</span>
          </div>
          <div className="landing-cpu-flow">
            {stages.map((stage, index) => {
              const instruction =
                mode === "single" ? clock - 1 : clock - index - 1;
              const active = clock > 0 && instruction >= 0 && instruction < 4;
              return (
                <div
                  className={`landing-stage ${active ? "is-active" : ""}`}
                  style={
                    {
                      "--stage-color": [
                        "#4f75e8",
                        "#9875d9",
                        "#e5a04b",
                        "#49a88b",
                        "#dc7d97",
                      ][index],
                    } as CSSProperties
                  }
                  key={stage}
                >
                  <div className="landing-stage-box">
                    {stage}
                    <span>
                      {
                        ["Fetch", "Decode", "Execute", "Memory", "Write back"][
                          index
                        ]
                      }
                    </span>
                  </div>
                  <div className="landing-stage-instruction">
                    {active ? `I${instruction + 1}` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="landing-cpu-caption">
            <span className="landing-chip-icon">▦</span>
            <span>
              {mode === "single"
                ? "다섯 처리 단계를 한 클록 안에서 수행해요."
                : "명령어들이 겹쳐 실행되는 흐름을 확인해 보세요."}
            </span>
          </div>
          <div
            className="landing-demo-progress"
            role="progressbar"
            aria-label="미리보기 실행 진행률"
            aria-valuemin={0}
            aria-valuemax={maxClock}
            aria-valuenow={clock}
          >
            <span style={{ width: `${(clock / maxClock) * 100}%` }} />
          </div>
        </div>
        <div className="landing-demo-registers">
          <div className="landing-pane-title">
            <span>Registers</span>
            <span>32-bit</span>
          </div>
          {["t0", "t1", "t2"].map((register, index) => (
            <div
              className={`landing-register ${values[index] > 0 ? "has-value" : ""}`}
              key={register}
            >
              <span>
                {register}
                <small>x{index + 5}</small>
              </span>
              <code>{values[index]}</code>
            </div>
          ))}
          <div className="landing-demo-memory">
            <span>
              Memory <code>0x00000000</code>
            </span>
            <strong>{stored ? "0x00000008" : "0x00000000"}</strong>
          </div>
        </div>
      </div>
      <div
        className="landing-preview-explanation"
        aria-live="polite"
        aria-atomic="true"
      >
        <span aria-hidden="true">↳</span>
        <p>{explanation}</p>
      </div>
      <div className="landing-product-footer">
        <span>
          <span className="landing-tiny-dot" /> 포워딩을 가정한 개념 예시 · 실제
          엔진의 사이클 수와 다를 수 있어요
        </span>
        <Link to="/simulator?example=addition">
          덧셈 코드로 시작하기 <Arrow />
        </Link>
      </div>
    </div>
  );
}

export function WorkspacePreview() {
  const [opened, setOpened] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opened || !container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / 1440),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [opened]);

  return (
    <section
      className="landing-workspace landing-section"
      aria-labelledby="workspace-heading"
    >
      <div className="landing-workspace-heading">
        <div>
          <span className="landing-kicker">THE REAL WORKSPACE</span>
          <h2 id="workspace-heading">
            직접 사용할 화면도,
            <br />
            미리 만나보세요.
          </h2>
          <p>
            코드 작성부터 상태 관찰, 실행 흐름까지 이어지는 실제 작업
            공간이에요.
          </p>
        </div>
        <Link className="landing-text-link" to="/simulator?example=addition">
          예제로 작업 공간 열기 <Arrow />
        </Link>
      </div>
      {opened ? (
        <div
          className="landing-live-workspace"
          ref={container}
          aria-busy={!loaded}
        >
          {!loaded && (
            <span className="landing-workspace-loading" role="status">
              작업 공간을 불러오는 중이에요…
            </span>
          )}
          <iframe
            src="/simulator?example=addition"
            title="ArchReactor 실제 작업 공간 미리보기"
            tabIndex={-1}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            style={{ transform: `scale(${scale})`, opacity: loaded ? 1 : 0 }}
          />
          <Link
            className="landing-workspace-overlay"
            to="/simulator?example=addition"
            aria-label="미리보기를 나가 실제 시뮬레이터 열기"
          >
            <span>
              직접 사용해 보기 <Arrow />
            </span>
          </Link>
        </div>
      ) : (
        <button
          className="landing-workspace-reveal"
          type="button"
          onClick={() => setOpened(true)}
        >
          <span className="landing-workspace-play" aria-hidden="true">
            ↗
          </span>
          <strong>실제 작업 화면 불러오기</strong>
          <span>현재 시뮬레이터 화면을 이곳에서 미리 볼 수 있어요.</span>
          <small>클릭할 때만 불러와 첫 화면은 가볍게 유지해요.</small>
        </button>
      )}
      <span className="landing-workspace-note">
        실제 화면 미리보기 · 조작하려면 ‘작업 공간 열기’를 선택해 주세요.
      </span>
    </section>
  );
}
