export default function ComingSoonPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold tracking-wide mb-4">
          COMING SOON
        </span>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          코드를 전체 흐름으로 이해하기
        </h1>
        <p className="text-slate-600 text-sm leading-relaxed">
          C 코드의 변환과 CPU 실행을 연결해 컴퓨터 구조 개념을 정리하는 토탈 페이지입니다. 요약·설명 기능은 준비 중입니다.
        </p>
      </div>
    </div>
  );
}

