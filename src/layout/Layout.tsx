import Header from "../components/Header";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-50 flex flex-col">
      <Header />
      <Outlet />
    </div>
  );
}
