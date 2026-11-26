import React from "react";
import { useNavigate } from "react-router-dom";
import { ArchLogo } from "@/components/ArchLogo";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 min-h-[calc(100vh-48px)] w-full bg-[#F6F8FA] flex flex-col items-center justify-center px-4 py-12 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D0D7DE] shadow-sm p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#005FB8]/10 border border-[#005FB8]/20 flex items-center justify-center text-[#005FB8] mb-4">
          <ArchLogo className="w-8 h-8 text-current" />
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs font-bold tracking-wider mb-2">
          404 NOT FOUND
        </span>

        <h1 className="text-xl font-extrabold text-[#1F2328] tracking-tight mb-2">
          요청하신 페이지를 찾을 수 없습니다
        </h1>

        <p className="text-xs text-[#57606A] leading-relaxed mb-6 break-keep">
          입력하신 주소가 잘못되었거나 변경 혹은 삭제되어 요청하신 페이지를 열 수 없습니다. 아래 버튼을 눌러 시뮬레이터로 이동해 주세요.
        </p>

        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/simulator", { replace: true })}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--ar-accent)] hover:bg-[var(--ar-accent-hover)] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>홈으로 이동 (시뮬레이터)</span>
            <span aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#24292F] border border-[#D0D7DE] text-xs font-semibold transition-colors cursor-pointer"
          >
            소개 페이지 보기
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
