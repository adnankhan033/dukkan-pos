import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import ZatcaSyncIndicator from "../components/zatca/ZatcaSyncIndicator";
import "./MainLayout.css";

export default function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <main className="main-content">
        <ZatcaSyncIndicator />
        <Outlet />
      </main>
    </div>
  );
}
