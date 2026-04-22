import { useNavigate } from "react-router-dom";

const LoginForm = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-sky-100/50 p-8 border border-slate-100">
      <div className="text-center mb-8">
        <p className="text-2xl font-bold text-slate-900 mb-2">
          <span className="text-sky-600 font-bold text-2xl cursor-pointer tracking-tight" >ArchReactor</span>에 오신 것을 환영합니다
        </p>
        <p className="text-slate-500 text-sm">이메일과 비밀번호를 입력하여 로그인하세요.</p>
      </div>
      
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
          <input 
            type="email" 
            placeholder="name@company.com" 
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
          />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
          </div>
          <input 
            type="password" 
            placeholder="••••••••" 
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
          />
        </div>
        
        <button 
          type="submit"
          className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow-md shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
        >
          로그인
        </button>
      </form>
      
      <div className="mt-6 text-center text-sm text-slate-500">
        계정이 없으신가요? <button onClick={() => navigate('/signup')} className="text-sky-600 hover:text-sky-700 font-semibold ml-1 cursor-pointer">회원가입</button>
      </div>
    </div>
  );
};

export default LoginForm;
