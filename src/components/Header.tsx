import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMe } from "@/api/auth";
import type { UserMeResponse } from "@/type/auth";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [isAiDropdownOpen, setIsAiDropdownOpen] = useState(false);
  const aiDropdownRef = useRef<HTMLDivElement>(null);

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

  // 외부 클릭 시 AI 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
        setIsAiDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  // 3단계 뷰포트 내비게이션 아이템:
  // 1번: Compile -> Execution (/)
  // 2번: 5-Stage Pipeline (/pipeline)
  // 3번: Management (/management)
  const navItems =
    aspectTier === "superwide"
      ? []
      : aspectTier === "ultrawide"
      ? [
          {
            label: "Compile ➔ Pipeline",
            path: "/",
            active: location.pathname === "/" || location.pathname === "/pipeline" || location.pathname === "/c-to-asm",
          },
          {
            label: "Pipeline ➔ Management",
            path: "/management",
            active: location.pathname === "/management" || location.pathname === "/coming-soon",
          },
        ]
      : [
          {
            label: "Compile ➔ Execution",
            path: "/",
            active: isActive("/") || isActive("/c-to-asm"),
          },
          {
            label: "5-Stage Pipeline",
            path: "/pipeline",
            active: isActive("/pipeline"),
          },
          {
            label: "Management",
            path: "/management",
            active: isActive("/management") || isActive("/coming-soon"),
          },
        ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-sky-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <div 
            className="text-sky-600 font-bold text-2xl cursor-pointer tracking-tight flex items-center gap-2" 
            onClick={() => navigate("/")}
          >
            ArchReactor
          </div>
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  item.active
                    ? "bg-sky-50 text-sky-600 font-semibold"
                    : "text-slate-600 hover:text-sky-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex items-center gap-3">
          {/* AI 튜터 & 연동 드롭다운 버튼 (로그인 버튼 바로 왼쪽에 위치) */}
          <div className="relative" ref={aiDropdownRef}>
            <button
              type="button"
              onClick={() => setIsAiDropdownOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer border ${
                isAiDropdownOpen
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                  : "bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 border-indigo-200/80"
              }`}
            >
              <span className="text-sm">✨</span>
              <span>AI 어시스턴트</span>
              <span className={`text-[10px] transition-transform duration-200 ${isAiDropdownOpen ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {/* 상단에서 자연스럽게 아래로 드롭다운되는 AI 팝업창 */}
            {isAiDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-sky-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    <h3 className="text-xs font-bold text-slate-800">ArchReactor AI 도우미</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAiDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs p-1 rounded-md"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">생성형 AI 질의응답</h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-[260px]">
                    작성 중인 C 코드와 RISC-V 파이프라인에서 발생하는 데이터 해저드나 스톨 현상에 대해 AI에게 실시간으로 질문할 수 있습니다.
                  </p>
                  <div className="mt-4 w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 font-mono text-left">
                    💡 연동 안내: 현재 AI 백엔드 인터페이스 준비 중입니다.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {user ? (
            <>
              <span className="text-sm font-medium text-slate-700">
                <strong className="text-sky-600 font-semibold">{user.name}</strong>님
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
              >
                로그아웃
              </button>
              <button 
                type="button"
                onClick={() => navigate("/my")}
                className="text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 px-4 py-1.5 rounded-full shadow-md shadow-sky-200 transition-all active:scale-95 cursor-pointer"
              >
                마이페이지
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={() => navigate("/login")}
                className={`text-sm font-medium transition-colors hover:text-sky-600 cursor-pointer ${isActive('/login') ? 'text-sky-600' : 'text-slate-600'}`}
              >
                로그인
              </button>
              <button 
                type="button"
                onClick={() => navigate("/signup")}
                className={`text-sm font-medium transition-colors hover:text-sky-600 cursor-pointer ${isActive('/signup') ? 'text-sky-600' : 'text-slate-600'}`}
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
