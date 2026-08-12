import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Products from "../pages/Products";
import Categories from "../pages/Categories";
import Units from "../pages/Units";
import Customers from "../pages/Customers";
import Suppliers from "../pages/Suppliers";
import Sales from "../pages/Sales";
import Orders from "../pages/Orders";
import Purchases from "../pages/Purchases";
import Inventory from "../pages/Inventory";
import Accounting from "../pages/Accounting";
import Employees from "../pages/Employees";
import Reports from "../pages/Reports";
import Settings from "../pages/Settings";
import Users from "../pages/Users";
import ZatcaQueue from "../pages/ZatcaQueue";
import ZatcaDailySync from "../pages/ZatcaDailySync";
import ZatcaTestCenter from "../pages/ZatcaTestCenter";
import Subscriptions from "../pages/Subscriptions";
import CloudBackup from "../pages/CloudBackup";

function withRole(module, element) {
  return <RoleRoute module={module}>{element}</RoleRoute>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={withRole("dashboard", <Dashboard />)} />
        <Route path="/products" element={withRole("products", <Products />)} />
        <Route path="/categories" element={withRole("products", <Categories />)} />
        <Route path="/units" element={withRole("products", <Units />)} />
        <Route path="/customers" element={withRole("customers", <Customers />)} />
        <Route path="/suppliers" element={withRole("suppliers", <Suppliers />)} />
        <Route path="/sales" element={withRole("sales", <Sales />)} />
        <Route path="/orders" element={withRole("sales", <Orders />)} />
        <Route path="/purchases" element={withRole("suppliers", <Purchases />)} />
        <Route path="/inventory" element={withRole("inventory", <Inventory />)} />
        <Route path="/accounting" element={withRole("accounting", <Accounting />)} />
        <Route path="/employees" element={withRole("accounting", <Employees />)} />
        <Route path="/expenses" element={<Navigate to="/accounting" replace />} />
        <Route path="/reports" element={withRole("reports", <Reports />)} />
        <Route path="/subscriptions" element={withRole("dashboard", <Subscriptions />)} />
        <Route path="/settings" element={withRole("settings", <Settings />)} />
        <Route path="/cloud-backup" element={withRole("settings", <CloudBackup />)} />
        <Route path="/zatca-sync" element={withRole("sales", <ZatcaDailySync />)} />
        <Route path="/zatca-queue" element={withRole("settings", <ZatcaQueue />)} />
        <Route path="/zatca-test" element={withRole("settings", <ZatcaTestCenter />)} />
        <Route path="/users" element={withRole("users", <Users />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
