import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getMe } from "@/api/auth";
import type { UserMeResponse } from "@/type/auth";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserMeResponse | null>(null);

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

  const navItems = [
    { label: "C → 어셈블리 변환", path: "/c-to-asm" },
    { label: "파이프라인 시각화", path: "/" },
    { label: "구현 예정", path: "/coming-soon" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-sky-100 shadow-sm">
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
                  isActive(item.path)
                    ? "bg-sky-50 text-sky-600 font-semibold"
                    : "text-slate-600 hover:text-sky-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <nav className="flex items-center gap-5">
          {user ? (
            <>
              <span className="text-sm font-medium text-slate-700">
                <strong className="text-sky-600 font-semibold">{user.name}</strong>님 반갑습니다.
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
                className="text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded-full shadow-md shadow-sky-200 transition-all active:scale-95 cursor-pointer"
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
