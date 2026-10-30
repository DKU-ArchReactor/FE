import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { signup } from "@/api/auth";
import type { SignupRequest, ValidationErrorResponse } from "@/type/auth";

const SignUpPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupRequest>({
    user_id: "",
    email: "",
    password: "",
    name: "",
  });
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      await signup(formData);
      navigate("/login", { replace: true });
    } catch (error) {
      if (axios.isAxiosError<ValidationErrorResponse>(error)) {
        const detail = error.response?.data?.detail;
        if (Array.isArray(detail) && detail.length > 0) {
          setErrorMsg(detail.map((d) => d.msg).join(", "));
        } else if (typeof detail === "string") {
          setErrorMsg(detail);
        } else {
          setErrorMsg("회원가입에 실패했습니다. 입력 정보를 다시 확인해 주세요.");
        }
      } else {
        setErrorMsg("서버와 통신 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-sky-100/50 p-8 border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">회원가입</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          ArchReactor 서비스를 이용하기 위해 계정을 생성해 주세요.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="user_id" className="block text-xs font-semibold text-slate-700 mb-1">
              아이디
            </label>
            <input
              id="user_id"
              name="user_id"
              type="text"
              required
              value={formData.user_id}
              onChange={handleChange}
              placeholder="사용할 아이디를 입력하세요"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
              이름
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="이름을 입력하세요"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호 (8자 이상)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 mt-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white font-semibold text-sm shadow-md shadow-sky-200 transition-all cursor-pointer"
          >
            {isLoading ? "처리 중..." : "회원가입"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          이미 계정이 있으신가요?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-sky-600 font-semibold hover:underline cursor-pointer"
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
