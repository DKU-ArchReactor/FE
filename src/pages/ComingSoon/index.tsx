export default function ComingSoonPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold tracking-wide mb-4">
          COMING SOON
        </span>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          구현 예정 페이지
        </h1>
        <p className="text-slate-600 text-sm leading-relaxed">
          추가적인 컴퓨터 구조 시각화 및 실습 기능이 이곳에 업데이트될 예정입니다.
        </p>
      </div>
    </div>
  );
}

