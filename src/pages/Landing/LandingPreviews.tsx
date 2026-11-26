import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

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
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    setScale(el.getBoundingClientRect().width / 1440);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setScale(entry.contentRect.width / 1440);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
          <span /> 실제 작업 공간 미리보기
        </span>
      </div>

      <div
        className="landing-live-workspace landing-hero-live-workspace"
        ref={container}
        aria-busy={!loaded}
      >
        {!loaded && (
          <span className="landing-workspace-loading" role="status">
            작업 공간을 불러오는 중이에요…
          </span>
        )}
        <iframe
          src="/simulator?example=addition&tutorial=0"
          title="ArchReactor 실제 작업 공간 미리보기"
          tabIndex={-1}
          loading="eager"
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
    </div>
  );
}
