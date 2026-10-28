export default function CToAsmPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-sky-100 shadow-sm p-8 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-sky-50 text-sky-600 text-xs font-semibold tracking-wide mb-4">
          COMING SOON
        </span>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          C → 어셈블리 변환 시각화
        </h1>
        <p className="text-slate-600 text-sm leading-relaxed">
          C 언어 소스 코드를 업로드하면 컴파일 과정을 거쳐 어셈블리어로 어떻게 변환되는지 단계별로 자세하게 비교·분석해 주는 페이지입니다. 현재 구현 준비 중입니다.
        </p>
      </div>
    </div>
  );
}

