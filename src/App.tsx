import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoginPage from "./pages/Auth/Login";
import SignUpPage from "./pages/Auth/SignUp";
import MyPage from "./pages/My";
import NotFoundPage from "./pages/NotFound";
import Layout from "./layout/Layout";
import LandingPage from "./pages/Landing";

const MainPage = lazy(() => import("./pages/Main"));

function App() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex min-h-screen items-center justify-center text-sm text-slate-500"
        >
          작업 공간을 불러오는 중이에요…
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<Layout />}>
          <Route path="/simulator" element={<MainPage />} />
          <Route
            path="/pipeline"
            element={<Navigate to="/simulator" replace />}
          />
          <Route
            path="/management"
            element={<Navigate to="/simulator" replace />}
          />
          <Route
            path="/c-to-asm"
            element={<Navigate to="/simulator" replace />}
          />
          <Route
            path="/coming-soon"
            element={<Navigate to="/management" replace />}
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
