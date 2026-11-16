import { getAuthSession, notifyAuthChanged, useAuthSession } from '@/api/authSession';
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMe } from "@/api/auth";
import type { UserMeResponse } from "@/type/auth";
import ThemeSwitch from "@/components/ThemeSwitch";
import { ArchLogo } from "@/components/ArchLogo";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthSession();
  const [profile, setProfile] = useState<{ epoch: number; user: UserMeResponse } | null>(null);
  const user = auth.authenticated && profile?.epoch === auth.epoch ? profile.user : null;

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!auth.authenticated) return;
    let active = true;
    getMe().then(data => {
      if (active && getAuthSession().epoch === auth.epoch) setProfile({ epoch: auth.epoch, user: data });
    }).catch(() => {
      if (!active || getAuthSession().epoch !== auth.epoch) return;
      localStorage.removeItem("access_token");
      localStorage.removeItem("token_type");
      notifyAuthChanged();
    });
    return () => { active = false; };
  }, [location.pathname, auth.authenticated, auth.epoch]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    notifyAuthChanged();
    localStorage.removeItem("token_type");
    setProfile(null);
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--ar-panel-bg)] border-b border-[var(--ar-border)] select-none transition-colors duration-150 shadow-xs">
      <div className="w-full px-4 h-12 flex justify-between items-center">
        {/* 좌측: 브랜드 로고 및 플랫폼명 (우상단 첨자 RV32I) */}
        <div className="flex items-center gap-6">
          <div 
            className="text-[var(--ar-accent)] hover:text-[var(--ar-accent-hover)] font-bold cursor-pointer tracking-tight flex items-center gap-2 group transition-colors duration-150" 
            onClick={() => navigate("/")}
            title="ArchReactor - RISC-V Pipeline Visualizer"
          >
            <ArchLogo className="w-[27px] h-[27px] text-current transition-colors duration-150 drop-shadow-xs" />
            
            <div className="relative inline-flex items-center select-none">
              <span 
                className="text-[20px] font-[900] tracking-tight leading-none"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                ArchReactor
              </span>
              
              {/* 우상단 첨자 RV32I */}
              <span className="text-[10px] font-bold font-mono text-gray-400 dark:text-gray-500 tracking-wider -top-1.5 -right-1 translate-x-1.5 -translate-y-1">
                RV32I
              </span>
            </div>
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
                <strong className="text-[var(--ar-accent)] font-semibold">{user.name}</strong>님
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
                className="text-xs font-semibold text-white bg-[var(--ar-accent)] hover:opacity-90 px-3 py-1 rounded transition-all cursor-pointer shadow-xs"
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
                    ? 'text-[var(--ar-accent)] font-bold'
                    : 'text-[#57606A] dark:text-[#858585] hover:text-[#24292F] dark:hover:text-[#CCCCCC]'
                }`}
              >
                로그인
              </button>
              <button 
                type="button"
                onClick={() => navigate("/signup")}
                className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--ar-accent)] hover:opacity-90 text-white transition-all cursor-pointer shadow-xs"
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
