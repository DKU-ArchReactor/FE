import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { learningExamples } from "@/data/learningExamples";
import { ArchLogo } from "@/components/ArchLogo";
import { Arrow, BrandMark, ProductPreview } from "./LandingPreviews";
import "./landing.css";

const questions = [
  [
    "설치나 로그인 없이 사용할 수 있나요?",
    "네. 브라우저 접속만으로 환경 설정 없이 C 코드 작성과 RISC-V 크로스 컴파일, 5단계 파이프라인 시뮬레이션까지 즉시 체험할 수 있어요. 작성한 소스를 계정에 영구 저장하려면 로그인해 주세요.",
  ],
  [
    "어떤 코드와 명령어를 실행할 수 있나요?",
    "C 코드를 RISC-V 어셈블리로 실시간 변환하거나 어셈블리를 직접 작성해 실행할 수 있어요. RV32I 기본 37종 정수 명령어를 완벽히 지원하며, 표준 시뮬레이터(Spike)와의 교차 검증을 통해 레지스터 및 메모리 상태 100% 비트 일치를 보장합니다.",
  ],
  [
    "싱글 사이클과 파이프라인은 어떻게 다른가요?",
    "싱글 사이클은 하나의 명령어를 한 클록에 처리해요. 5단계 파이프라인은 IF-ID-EX-MEM-WB 단계를 통해 여러 명령어를 겹쳐 실행합니다. 데이터 포워딩, 로드-사용 스톨, 분기 플러시 등 실제 하드웨어의 해저드 제어 메커니즘을 시각적으로 관찰할 수 있어요.",
  ],
  [
    "내장 튜터와 AI 에이전트는 어떻게 다른가요?",
    "화면 좌측 하단의 '내장 튜터'는 클릭한 코드 라인과 사이클 상태를 오차 없이 1:1로 즉각 설명해주는 규칙 기반 교육 모듈입니다. 우상단 플로팅 팝업의 'AI 에이전트'는 단국대 GPU 클라우드(DKU SOLID-LLM)와 연동되어 복잡한 해저드 원인을 심층 분석하고 최적화 예제 코드까지 생성해 주는 대화형 어시스턴트입니다.",
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
          <Link to="/" className="landing-brand group" aria-label="ArchReactor 홈">
            <ArchLogo className="landing-mark w-[22px] h-[22px] md:w-[27px] md:h-[27px] text-current transition-colors duration-150 drop-shadow-xs shrink-0 ar-logo-wobble" />
            <div className="landing-brand-text">
              <span className="landing-brand-title">ArchReactor</span>
              <span className="landing-brand-badge">RV32I</span>
            </div>
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
              시작하기
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
              AI가 작성한 코드의 하드웨어 병목과 의존성을 직접 검증하세요.
              <br className="landing-mobile-break" /> C·RISC-V 코드를 실행하며 레지스터,
              메모리, 파이프라인의 변화를 한눈에 확인합니다.
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
            <span>BUILT FOR DEEP UNDERSTANDING</span>
            <div>
              <b>RISC-V</b>
              <span>RV32I 37종</span>
              <i />
              <b>C ↔ ASM 1:N 매핑</b>
              <i />
              <b>Single & 5-Stage</b>
              <i />
              <b>DKU SOLID-LLM 튜터</b>
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
              className="landing-code-illustration landing-real-shot-card"
              aria-label="C 코드의 덧셈이 RISC-V 명령어로 실행되는 예시"
            >
              <div className="landing-illustration-caption">
                <span className="landing-tiny-dot" /> C 소스 코드 ↔ RISC-V 어셈블리 1:N 매핑 및 실시간 튜터
              </div>
              <div className="landing-real-shot-frame">
                <img
                  src="/landing/feature-code-mapping.png"
                  alt="ArchReactor 실제 C 소스 코드, RISC-V 어셈블리 매핑 및 튜터 해설 화면"
                  loading="lazy"
                  className="landing-real-shot-img"
                />
              </div>
              <span className="landing-illustration-footnote">
                실제 시뮬레이터 에디터 및 튜터 화면
              </span>
            </div>
          </div>
          <div className="landing-feature-row landing-feature-reverse">
            <div
              className="landing-pipeline-illustration landing-real-shot-card"
              aria-label="5단계 파이프라인 데이터패스 시각화 화면"
            >
              <div className="landing-illustration-caption">
                <span className="landing-tiny-dot" /> IF · ID · EX · MEM · WB 5단계 파이프라인 데이터패스 회로도
              </div>
              <div className="landing-real-shot-frame">
                <img
                  src="/landing/feature-datapath.png"
                  alt="ArchReactor 실제 5단계 파이프라인 하드웨어 데이터패스 회로도 화면"
                  loading="lazy"
                  className="landing-real-shot-img"
                />
              </div>
              <span className="landing-illustration-footnote">
                실제 시뮬레이터 데이터패스 시각화 화면
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

          {/* 03: 대화형 AI 어시스턴트 & 예제 코드 추천 */}
          <div className="landing-feature-row">
            <div className="landing-feature-copy">
              <span className="landing-feature-number">
                03 / INTERACTIVE AI ASSISTANT
              </span>
              <h3>
                궁금한 개념과 예제 코드,
                <br />
                대화하듯 물어보세요.
              </h3>
              <p>
                현재 작성 중인 C·어셈블리 코드와 실행 중인 사이클의 레지스터·메모리 스냅샷을 자동으로 첨부해 질문할 수 있습니다. 추천 질문 칩으로 코드 흐름부터 해저드·CPI 분석까지 즉시 확인해 보세요.
              </p>
              <Link
                className="landing-text-link"
                to="/simulator"
              >
                AI 어시스턴트와 실습하기 <Arrow />
              </Link>
            </div>

            <div
              className="landing-chat-illustration landing-real-shot-card"
              aria-label="AI 어시스턴트와 대화 및 예제 코드 추천 일러스트"
            >
              <div className="landing-illustration-caption">
                <span className="landing-tiny-dot" /> 코드·사이클 컨텍스트 첨부 및 추천 질문 칩
              </div>
              <div className="landing-real-shot-frame">
                <img
                  src="/landing/feature-ai-assistant.png"
                  alt="ArchReactor 실제 AI 어시스턴트 팝업 화면"
                  loading="lazy"
                  className="landing-real-shot-img"
                />
              </div>
              <span className="landing-illustration-footnote">
                실제 AI 어시스턴트 플로팅 창 화면
              </span>
            </div>
          </div>

          {/* 04: 해저드 진단 & CPI 성능 분석 */}
          <div className="landing-feature-row landing-feature-reverse">
            <div
              className="landing-hazard-illustration landing-real-shot-card"
              aria-label="해저드 감지 및 CPI 성능 분석 일러스트"
            >
              <div className="landing-illustration-caption">
                <span className="landing-tiny-dot" /> 멀티사이클 타이밍 다이어그램 & 실시간 CPI 성능 지표
              </div>
              <div className="landing-real-shot-frame">
                <img
                  src="/landing/feature-metrics-timing.png"
                  alt="ArchReactor 실제 멀티사이클 파이프라인 타이밍 다이어그램 및 CPI 성능 분석 화면"
                  loading="lazy"
                  className="landing-real-shot-img"
                />
              </div>
              <span className="landing-illustration-footnote">
                실제 멀티사이클 타이밍 & CPI 분석 화면
              </span>
            </div>
            <div className="landing-feature-copy">
              <span className="landing-feature-number">
                04 / HAZARD & CPI PROFILING
              </span>
              <h3>
                해저드 3종 자동 감지와
                <br />
                정량적 CPI 성능 분석.
              </h3>
              <p>
                RAW 데이터 의존성 포워딩, Load-Use 스톨, 분기 예측 실패 플러시까지
                하드웨어 제어 동작을 실시간으로 포착하고, 총 사이클 수와 CPI 지표를
                통해 코드의 성능 효율을 수치로 평가할 수 있습니다.
              </p>
              <Link className="landing-text-link" to="/simulator">
                파이프라인 진단 시작하기 <Arrow />
              </Link>
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
            <BrandMark />
            ArchReactor
          </Link>
          <p>코드와 컴퓨터구조를 연결하는 시뮬레이터 · 단국대학교 캡스톤 디자인 (팀 포크레인)</p>
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
          © {new Date().getFullYear()} ArchReactor. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
