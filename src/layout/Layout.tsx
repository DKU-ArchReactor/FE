import Header from "../components/Header";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[var(--ar-canvas-bg)] text-[var(--ar-text-primary)] flex flex-col font-sans transition-colors duration-150">
      <Header />
      <Outlet />
    </div>
  );
}
