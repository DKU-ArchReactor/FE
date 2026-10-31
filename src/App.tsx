import { Routes, Route } from "react-router-dom";
import MainPage from "./pages/Main";
import CToAsmPage from "./pages/CToAsm";
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
        <Route path="/c-to-asm" element={<CToAsmPage />} />
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
