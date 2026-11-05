import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "@/api/auth";
import type { UserMeResponse } from "@/type/auth";

const MyInfo = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<UserMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const fetchUserInfo = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setErrorMsg("로그인이 필요한 서비스입니다.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getMe();
        setUserInfo(data);
      } catch {
        setErrorMsg("사용자 정보를 불러오지 못했습니다. 다시 로그인해 주세요.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="col-span-1 md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center min-h-[260px]">
        <p className="text-sm text-slate-400">사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (errorMsg || !userInfo) {
    return (
      <div className="col-span-1 md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center text-center min-h-[260px] gap-4">
        <p className="text-sm text-slate-600">{errorMsg}</p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm shadow-sky-200 transition-all cursor-pointer"
        >
          로그인하러 가기
        </button>
      </div>
    );
  }

  const formattedCreatedAt = new Date(userInfo.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="col-span-1 md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
      <div className="flex flex-col items-center pb-5 border-b border-slate-100">
        <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xl font-bold mb-3">
          {userInfo.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-lg font-bold text-slate-800">{userInfo.name}</h2>
        <span className="mt-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-600 text-xs font-semibold">
          {userInfo.role}
        </span>
      </div>

      <div className="py-4 space-y-3 text-sm flex-1">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-xs">아이디</span>
          <span className="text-slate-700 font-medium">{userInfo.user_id}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-xs">이메일</span>
          <span className="text-slate-700 font-medium">{userInfo.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-xs">가입일</span>
          <span className="text-slate-700 font-medium">{formattedCreatedAt}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full mt-2 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
      >
        로그아웃
      </button>
    </div>
  );
};

export default MyInfo;
