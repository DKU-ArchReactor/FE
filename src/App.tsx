import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import MainPage from "./pages/Main";
const CToAsmPage = lazy(() => import("./pages/CToAsm"));
import ComingSoonPage from "./pages/ComingSoon";
import LoginPage from "./pages/Auth/Login";
import SignUpPage from "./pages/Auth/SignUp";
import MyPage from "./pages/My";
import Layout from "./layout/Layout";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/c-to-asm" element={<Suspense fallback={<p className="p-6 text-slate-500">컴파일 작업 공간을 불러오는 중…</p>}><CToAsmPage /></Suspense>} />
        <Route path="/coming-soon" element={<ComingSoonPage />} />
        <Route path="/total" element={<ComingSoonPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/my" element={<MyPage />} />
      </Route>
    </Routes>
  )
}

export default App
