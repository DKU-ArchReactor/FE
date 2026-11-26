import { clearAuthTokens, getAuthSession, useAuthSession } from '@/api/authSession';
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMe } from "@/api/auth";
import type { UserMeResponse } from "@/type/auth";
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
      clearAuthTokens();
    });
    return () => { active = false; };
  }, [location.pathname, auth.authenticated, auth.epoch]);

  const handleLogout = () => {
    clearAuthTokens();
    setProfile(null);
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--ar-panel-bg)] border-b border-[var(--ar-border)] select-none transition-colors duration-150 shadow-xs">
      <div className="w-full px-3 md:px-4 h-11 md:h-12 flex justify-between items-center">
        {/* 좌측: 브랜드 로고 및 플랫폼명 (우상단 첨자 RV32I) */}
        <div className="flex items-center gap-4 md:gap-6 min-w-0">
          <div 
            className="text-[var(--ar-accent)] hover:text-[var(--ar-accent-hover)] font-bold cursor-pointer tracking-tight flex items-center gap-1.5 md:gap-2 group transition-colors duration-150 shrink-0" 
            onClick={() => navigate("/")}
            title="ArchReactor - RISC-V Pipeline Visualizer"
          >
            <ArchLogo className="w-[22px] h-[22px] md:w-[27px] md:h-[27px] text-current transition-colors duration-150 drop-shadow-xs shrink-0 ar-logo-wobble" />
            
            <div className="relative inline-flex items-center select-none">
              <span 
                className="text-[17px] md:text-[20px] font-[900] tracking-tight leading-none"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                ArchReactor
              </span>
              
              {/* 우상단 첨자 RV32I */}
              <span className="text-[9px] md:text-[10px] font-bold font-mono text-gray-400 tracking-wider -top-1.5 -right-1 translate-x-1 md:translate-x-1.5 -translate-y-1">
                RV32I
              </span>
            </div>
          </div>

          {isActive("/simulator") && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("ar-open-tutorial"))}
              title="화면 사용법 튜토리얼 보기"
              className="text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap text-[#57606A] hover:text-[#24292F]"
            >
              튜토리얼
            </button>
          )}
        </div>

        {/* 우측: 유저 메뉴 */}
        <nav className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/my")}
                title="마이페이지로 이동"
                className="text-xs font-medium text-[#24292F] hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap px-1 py-0.5 rounded"
              >
                <strong className="text-[var(--ar-accent)] font-semibold">{user.name}</strong>님
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex text-xs font-medium text-[#57606A] hover:text-[#CF222E] transition-colors cursor-pointer whitespace-nowrap px-1 py-0.5"
              >
                로그아웃
              </button>
              <button 
                type="button"
                onClick={() => navigate("/my")}
                className="hidden md:inline-flex text-xs font-semibold text-white bg-[var(--ar-accent)] hover:opacity-90 px-3 py-1 rounded transition-all cursor-pointer shadow-xs whitespace-nowrap"
              >
                마이페이지
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={() => navigate("/login")}
                className={`text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                  isActive('/login')
                    ? 'text-[var(--ar-accent)] font-bold'
                    : 'text-[#57606A] hover:text-[#24292F]'
                }`}
              >
                로그인
              </button>
              <button 
                type="button"
                onClick={() => navigate("/signup")}
                className="hidden md:inline-flex text-xs font-semibold px-2.5 py-1 rounded bg-[var(--ar-accent)] hover:opacity-90 text-white transition-all cursor-pointer shadow-xs whitespace-nowrap"
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
