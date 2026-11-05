import Header from "../components/Header";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#F8F8F8] dark:bg-[#181818] text-[#1E1E1E] dark:text-[#CCCCCC] flex flex-col font-sans transition-colors duration-150">
      <Header />
      <Outlet />
    </div>
  );
}
