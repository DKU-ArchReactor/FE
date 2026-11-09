import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMe } from "@/api/auth";
import type { UserMeResponse } from "@/type/auth";
import ThemeSwitch from "@/components/ThemeSwitch";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserMeResponse | null>(null);

  const [aspectTier, setAspectTier] = useState<"normal" | "ultrawide" | "superwide">(() => {
    if (typeof window === "undefined") return "normal";
    const ratio = window.innerWidth / Math.max(1, window.innerHeight);
    if (ratio >= 32 / 9) return "superwide";
    if (ratio >= 21 / 9) return "ultrawide";
    return "normal";
  });

  useEffect(() => {
    const checkAspectRatio = () => {
      const ratio = window.innerWidth / Math.max(1, window.innerHeight);
      if (ratio >= 32 / 9) setAspectTier("superwide");
      else if (ratio >= 21 / 9) setAspectTier("ultrawide");
      else setAspectTier("normal");
    };
    checkAspectRatio();
    window.addEventListener("resize", checkAspectRatio);
    return () => window.removeEventListener("resize", checkAspectRatio);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      return;
    }

    getMe()
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_type");
        setUser(null);
      });
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    setUser(null);
    navigate("/login");
  };

  // 우측 3단계 뷰포트 내비게이션 아이템:
  // 1: State -> /
  // 2: Timing -> /pipeline
  // 3: Pipeline -> /management
  const navItems =
    aspectTier === "superwide"
      ? []
      : aspectTier === "ultrawide"
      ? [
          {
            label: "State ➔ Timing",
            path: "/",
            active: location.pathname === "/" || location.pathname === "/pipeline",
          },
          {
            label: "Timing ➔ Pipeline",
            path: "/management",
            active: location.pathname === "/management",
          },
        ]
      : [
          {
            label: "State",
            path: "/",
            active: isActive("/"),
          },
          {
            label: "Timing",
            path: "/pipeline",
            active: isActive("/pipeline"),
          },
          {
            label: "Pipeline",
            path: "/management",
            active: isActive("/management"),
          },
        ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--ar-panel-bg)] border-b border-[var(--ar-border)] select-none transition-colors duration-150 shadow-xs">
      <div className="w-full px-4 h-12 flex justify-between items-center">
        {/* 좌측: 로고 및 뷰포트 내비게이션 탭 */}
        <div className="flex items-center gap-6">
          <div 
            className="text-[#005FB8] dark:text-[#007ACC] font-bold text-lg cursor-pointer tracking-tight flex items-center gap-2 group" 
            onClick={() => navigate("/")}
            title="ArchReactor - RISC-V Pipeline Visualizer"
          >
            <img 
              src="/logo.png" 
              alt="ArchReactor Logo" 
              className="w-7 h-7 object-contain transition-transform duration-200 group-hover:scale-105" 
            />
            <span className="font-extrabold tracking-tight">ArchReactor</span>
          </div>

          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                  item.active
                    ? "bg-[var(--ar-header-bg)] text-[var(--ar-accent)] border-[var(--ar-border)] shadow-xs"
                    : "border-transparent text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 우측: 테마 토글 스위치 + 유저 메뉴 */}
        <nav className="flex items-center gap-2">
          {/* 테마 토글 스위치 (VS Code Light / Dark 슬라이딩 스위치) */}
          <ThemeSwitch />

          <div className="h-3.5 w-px bg-[#D0D7DE] dark:border-[#3E3E42] mx-0.5" />

          {user ? (
            <>
              <span className="text-xs font-medium text-[#24292F] dark:text-[#CCCCCC]">
                <strong className="text-[#005FB8] dark:text-[#007ACC] font-semibold">{user.name}</strong>님
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-medium text-[#57606A] dark:text-[#858585] hover:text-[#CF222E] dark:hover:text-[#F85149] transition-colors cursor-pointer"
              >
                로그아웃
              </button>
              <button 
                type="button"
                onClick={() => navigate("/my")}
                className="text-xs font-semibold text-white bg-[#005FB8] dark:bg-[#007ACC] hover:bg-[#004C99] dark:hover:bg-[#0062A3] px-3 py-1 rounded transition-colors cursor-pointer"
              >
                마이페이지
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={() => navigate("/login")}
                className={`text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                  isActive('/login')
                    ? 'text-[#005FB8] dark:text-[#007ACC] font-bold'
                    : 'text-[#57606A] dark:text-[#858585] hover:text-[#24292F] dark:hover:text-[#CCCCCC]'
                }`}
              >
                로그인
              </button>
              <button 
                type="button"
                onClick={() => navigate("/signup")}
                className="text-xs font-semibold px-2.5 py-1 rounded bg-[#005FB8] dark:bg-[#007ACC] hover:bg-[#004C99] dark:hover:bg-[#0062A3] text-white transition-colors cursor-pointer"
              >
                회원가입
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
