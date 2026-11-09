import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { learningExamples } from "@/data/learningExamples";
import { getPreviewState } from "./previewState";
import "./landing.css";

const stages = ["IF", "ID", "EX", "MEM", "WB"];
const instructions = [
  "addi t0, zero, 5",
  "addi t1, zero, 3",
  "add t2, t0, t1",
  "sw t2, 0(zero)",
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
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

function ReactorMark() {
  return (
    <svg
      className="landing-mark"
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="38" height="38" rx="12" fill="#2563eb" />
      <path
        d="M11 25 20 10l9 15M15 20h10"
        stroke="white"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="29" r="2" fill="#b9d5ff" />
    </svg>
  );
}

function ProductPreview() {
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
          <ReactorMark />
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

function WorkspacePreview() {
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

const questions = [
  [
    "설치나 로그인 없이 사용할 수 있나요?",
    "네. 브라우저에서 바로 코드를 작성하고 컴파일·시뮬레이션을 체험할 수 있어요. 작성한 소스를 계정에 저장하고 다시 불러오려면 로그인해 주세요.",
  ],
  [
    "어떤 코드와 명령어를 실행할 수 있나요?",
    "C 코드를 RISC-V 어셈블리로 컴파일하거나 어셈블리를 직접 작성해 실행할 수 있어요. 시뮬레이터는 RV32IM 명령어 집합을 기반으로 동작합니다.",
  ],
  [
    "싱글 사이클과 파이프라인은 어떻게 다른가요?",
    "싱글 사이클은 하나의 명령어를 한 클록에 처리해요. 5단계 파이프라인은 여러 명령어를 서로 다른 단계에서 겹쳐 실행합니다. 실행 모드를 바꾸면서 레지스터·메모리와 사이클별 흐름을 살펴볼 수 있어요.",
  ],
  [
    "컴퓨터구조를 처음 배워도 사용할 수 있나요?",
    "작은 덧셈 코드부터 시작해 보세요. 한 단계씩 실행하면서 명령어가 처리되는 흐름과 레지스터·메모리 값의 변화를 함께 확인할 수 있어요. 교육용 모델이므로 사이클 수를 실제 CPU의 실행 시간으로 해석하지는 않습니다.",
  ],
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const legacyFileId =
    new URLSearchParams(location.search).get("fileId") ||
    (location.state as { fileId?: string } | null)?.fileId;

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  if (legacyFileId)
    return (
      <Navigate
        to={`/simulator?fileId=${encodeURIComponent(legacyFileId)}`}
        state={location.state}
        replace
      />
    );

  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main">
        본문으로 이동
      </a>
      <header className="landing-header">
        <div className="landing-nav-wrap">
          <Link to="/" className="landing-brand" aria-label="ArchReactor 홈">
            <ReactorMark />
            ArchReactor<span className="landing-brand-dot">.</span>
          </Link>
          <nav
            className={`landing-nav ${menuOpen ? "is-open" : ""}`}
            id="landing-navigation"
            aria-label="메인 메뉴"
          >
            <a href="#features" onClick={() => setMenuOpen(false)}>
              주요 기능
            </a>
            <a href="#examples" onClick={() => setMenuOpen(false)}>
              예제로 시작하기
            </a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>
              자주 묻는 질문
            </a>
          </nav>
          <div className="landing-nav-actions">
            <Link className="landing-login" to="/login">
              로그인
            </Link>
            <Link className="landing-button landing-nav-start" to="/simulator">
              시작하기 <Arrow />
            </Link>
            <button
              className="landing-menu-toggle"
              type="button"
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
              aria-controls="landing-navigation"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-grid" aria-hidden="true" />
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="landing-tiny-dot" /> 코드를 넘어, 컴퓨터의
              안쪽으로 <span>↗</span>
            </div>
            <h1 id="landing-title">
              코드 한 줄이,
              <br />
              <span>CPU의 흐름이 되는 순간.</span>
            </h1>
            <p>
              C·RISC-V 코드를 실행하며 레지스터, 메모리,
              <br className="landing-mobile-break" /> 파이프라인의 변화를 한눈에
              확인하세요.
            </p>
            <div className="landing-hero-actions">
              <Link
                to="/simulator?example=addition"
                className="landing-button landing-button-primary"
              >
                예제로 바로 시작하기 <Arrow />
              </Link>
              <a
                className="landing-button landing-button-secondary"
                href="#examples"
              >
                다른 예제 살펴보기 <span aria-hidden="true">↓</span>
              </a>
            </div>
            <span className="landing-no-install">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m3 8 3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              설치 없이 · 로그인 없이 · 브라우저에서 바로
            </span>
          </div>
          <div className="landing-preview-wrap">
            <ProductPreview />
          </div>
          <div className="landing-technology">
            <span>BUILT FOR UNDERSTANDING</span>
            <div>
              <b>RISC-V</b>
              <span>RV32IM</span>
              <i />
              <b>C & Assembly</b>
              <i />
              <b>Single-cycle</b>
              <i />
              <b>5-stage Pipeline</b>
            </div>
          </div>
        </section>

        <section
          className="landing-examples landing-section"
          id="examples"
          aria-labelledby="examples-heading"
        >
          <div className="landing-section-intro">
            <span className="landing-kicker">START SMALL, SEE MORE</span>
            <h2 id="examples-heading">
              무엇부터 할지 고민된다면,
              <br />
              작은 예제 하나로 시작하세요.
            </h2>
            <p>
              코드는 미리 준비해 둘게요. 작업 공간에서 ‘컴파일’을 눌러 실행해
              보세요.
            </p>
          </div>
          <div className="landing-example-grid">
            {learningExamples.map((example, index) => (
              <Link
                className="landing-example-card"
                key={example.id}
                to={`/simulator?example=${example.id}`}
              >
                <span className="landing-example-top">
                  <span>{example.category}</span>
                  <code>0{index + 1}</code>
                </span>
                <h3>{example.title}</h3>
                <p>{example.description}</p>
                <span className="landing-example-bottom">
                  <code>{example.result}</code>
                  <span>
                    이 코드로 시작 <Arrow />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <WorkspacePreview />

        <section
          className="landing-features landing-section"
          id="features"
          aria-labelledby="features-heading"
        >
          <div className="landing-section-intro">
            <span className="landing-kicker">
              LESS GUESSING, MORE UNDERSTANDING
            </span>
            <h2 id="features-heading">
              외우던 컴퓨터구조를,
              <br />
              이제 눈으로 이해하세요.
            </h2>
            <p>코드와 하드웨어 사이의 빈칸을 채우는 경험.</p>
          </div>
          <div className="landing-feature-row">
            <div className="landing-feature-copy">
              <span className="landing-feature-number">
                01 / FROM CODE TO EXECUTION
              </span>
              <h3>
                내가 작성한 코드,
                <br />
                어떻게 실행될까요?
              </h3>
              <p>
                C 코드가 어셈블리가 되고, 명령어가 CPU를 움직이는 과정까지.
                흩어져 있던 개념을 하나의 작업 공간에서 연결해 보세요.
              </p>
              <Link
                className="landing-text-link"
                to="/simulator?example=addition"
              >
                첫 코드 실행해 보기 <Arrow />
              </Link>
            </div>
            <div
              className="landing-code-illustration"
              aria-label="C 코드의 덧셈이 RISC-V 명령어로 실행되는 예시"
            >
              <div className="landing-mini-editor">
                <div>
                  <span className="landing-file-dot" /> main.c{" "}
                  <span>C SOURCE</span>
                </div>
                <pre>
                  <span>int</span> main() {"{"}
                  {"\n"}
                  {"  "}
                  <span>int</span> a = <b>5</b>;{"\n"}
                  {"  "}
                  <span>int</span> b = <b>3</b>;{"\n"}
                  {"  "}
                  <em>return</em> a + b;{"\n"}
                  {"}"}
                </pre>
              </div>
              <span className="landing-convert-arrow" aria-hidden="true">
                ↓
              </span>
              <div className="landing-asm-result">
                <span>RISC-V / 실행 과정 중</span>
                <code>
                  <b>add</b> a5, a4, a5
                </code>
                <div>
                  5 <span>+</span> 3 <span>→</span> <strong>8</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="landing-feature-row landing-feature-reverse">
            <div className="landing-pipeline-illustration">
              <div className="landing-illustration-caption">
                <span className="landing-tiny-dot" /> 서로 다른 실행 방식, 같은
                계산
              </div>
              <div className="landing-comparison-label">
                <b>Single-cycle</b>
                <span>한 클록에 하나의 명령어</span>
              </div>
              <div className="landing-single-timeline">
                {[1, 2, 3, 4].map((number) => (
                  <span key={number}>I{number}</span>
                ))}
              </div>
              <div className="landing-comparison-label">
                <b>5-stage pipeline</b>
                <span>단계별로 겹쳐지는 명령어</span>
              </div>
              <div className="landing-pipeline-timeline">
                {[0, 1, 2].map((row) => (
                  <div key={row}>
                    {Array.from({ length: row }, (_, index) => (
                      <i key={`empty-${index}`} />
                    ))}
                    {stages.map((stage, index) => (
                      <span
                        style={{ opacity: 1 - row * 0.2 }}
                        key={stage}
                        className={`landing-timeline-stage stage-${index}`}
                      >
                        {stage}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <span className="landing-illustration-footnote">
                실행 방식 이해를 위한 개념도
              </span>
            </div>
            <div className="landing-feature-copy">
              <span className="landing-feature-number">
                02 / TWO WAYS TO UNDERSTAND
              </span>
              <h3>
                하나씩 실행하고,
                <br />
                나란히 비교해 보세요.
              </h3>
              <p>
                싱글 사이클로 명령어의 동작을 익히고, 파이프라인으로 실행이
                겹쳐지는 원리를 살펴보세요. 스톨과 포워딩도 흐름 안에서 이해할
                수 있어요.
              </p>
              <a className="landing-text-link" href="#preview">
                두 실행 모드 살펴보기 <Arrow />
              </a>
            </div>
          </div>
          <div className="landing-detail-features">
            {[
              [
                "↗",
                "변하는 값을 놓치지 않게",
                "레지스터와 메모리의 변화를 확인하며 코드가 만든 결과를 따라가세요.",
              ],
              [
                "▥",
                "클록 하나까지 차근차근",
                "한 단계씩 이동하거나 재생하면서 명령어의 실행 순서와 단계를 살펴보세요.",
              ],
              [
                "⌘",
                "작성부터 실행까지 한곳에서",
                "C와 어셈블리를 작성하고, 컴파일한 결과를 바로 시뮬레이션하세요.",
              ],
            ].map(([icon, title, text]) => (
              <article key={title}>
                <span className="landing-detail-icon" aria-hidden="true">
                  {icon}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="landing-how"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="landing-section">
            <div className="landing-section-intro">
              <span className="landing-kicker">YOUR FIRST SIMULATION</span>
              <h2 id="how-heading">
                궁금했던 코드에서,
                <br />
                이해하는 순간까지 세 단계.
              </h2>
            </div>
            <div className="landing-steps">
              {[
                [
                  "01",
                  "코드를 준비하세요",
                  "C 코드나 RISC-V 어셈블리를 작성해 보세요. 작은 덧셈 예제부터 시작해도 좋아요.",
                  "write",
                ],
                [
                  "02",
                  "컴파일하고 실행하세요",
                  "실행 모드를 선택하고 컴파일하세요. 브라우저에서 바로 결과를 확인할 수 있어요.",
                  "compile",
                ],
                [
                  "03",
                  "흐름을 따라가 보세요",
                  "클록을 하나씩 이동하며 레지스터, 메모리, 실행 단계가 어떻게 바뀌는지 살펴보세요.",
                  "understand",
                ],
              ].map(([number, title, text, word]) => (
                <article key={number}>
                  <div className="landing-step-top">
                    <span>{number}</span>
                    <code>{word}()</code>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="landing-faq landing-section"
          id="faq"
          aria-labelledby="faq-heading"
        >
          <div>
            <span className="landing-kicker">A FEW THINGS TO KNOW</span>
            <h2 id="faq-heading">
              시작하기 전에
              <br />
              궁금한 점이 있나요?
            </h2>
            <p>
              처음이라도 괜찮아요.
              <br />
              여기서부터 하나씩 알아가면 돼요.
            </p>
          </div>
          <div className="landing-faq-list">
            {questions.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-cta-wrap">
          <div className="landing-cta">
            <div className="landing-cta-orbit" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span className="landing-kicker">MAKE THE INVISIBLE VISIBLE</span>
            <h2>
              이해의 시작은,
              <br />한 번의 실행으로.
            </h2>
            <p>나만의 컴퓨터구조 실험실, ArchReactor.</p>
            <Link className="landing-button" to="/simulator">
              지금 시작하기 <Arrow />
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Link to="/" className="landing-brand">
            <ReactorMark />
            ArchReactor<span className="landing-brand-dot">.</span>
          </Link>
          <p>코드와 컴퓨터구조를 연결하는 시뮬레이터</p>
        </div>
        <nav aria-label="하단 메뉴">
          <a
            href="https://github.com/DKU-ArchReactor"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <Arrow diagonal />
          </a>
          <a href="#faq">자주 묻는 질문</a>
          <Link to="/simulator">
            시뮬레이터 <Arrow />
          </Link>
        </nav>
        <span className="landing-copyright">
          © {new Date().getFullYear()} ArchReactor
        </span>
      </footer>
    </div>
  );
}
