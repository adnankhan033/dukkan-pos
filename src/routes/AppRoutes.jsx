import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import Login from "../pages/Login";
import Setup from "../pages/Setup";
import ActivationRoute from "./ActivationRoute";
import DefaultRedirect from "./DefaultRedirect";
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
import AccountingCash from "../pages/AccountingCash";
import AccountingPartners from "../pages/AccountingPartners";
import AccountingJournals from "../pages/AccountingJournals";
import Employees from "../pages/Employees";
import Reports from "../pages/Reports";
import DailyClose from "../pages/DailyClose";
import Settings from "../pages/Settings";
import Users from "../pages/Users";
import ZatcaQueue from "../pages/ZatcaQueue";
import ZatcaDailySync from "../pages/ZatcaDailySync";
import ZatcaTestCenter from "../pages/ZatcaTestCenter";
import Subscriptions from "../pages/Subscriptions";
import CloudBackup from "../pages/CloudBackup";
import StoreCards from "../pages/StoreCards";
import Wholesale from "../pages/Wholesale";
import WholesalePriceLists from "../pages/WholesalePriceLists";

function withRole(module, element) {
  return <RoleRoute module={module}>{element}</RoleRoute>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/setup" element={<Setup />} />
        <Route path="/activate" element={<Navigate to="/setup" replace />} />
        <Route
          path="/login"
          element={
            <ActivationRoute>
              <Login />
            </ActivationRoute>
          }
        />
      </Route>

      <Route
        element={
          <ActivationRoute>
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          </ActivationRoute>
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
        <Route path="/purchases" element={withRole("purchasing", <Purchases />)} />
        <Route path="/inventory" element={withRole("inventory", <Inventory />)} />
        <Route path="/wholesale" element={withRole("wholesale", <Wholesale />)} />
        <Route path="/wholesale/price-lists" element={withRole("wholesale", <WholesalePriceLists />)} />
        <Route path="/accounting" element={<Navigate to="/accounting/receive" replace />} />
        <Route path="/accounting/receive" element={withRole("cash_bank", <AccountingCash mode="receive" />)} />
        <Route path="/accounting/pay" element={withRole("cash_bank", <AccountingCash mode="pay" />)} />
        <Route path="/accounting/expenses" element={withRole("expenses", <Accounting />)} />
        <Route path="/accounting/partners" element={withRole("partners", <AccountingPartners />)} />
        <Route path="/accounting/journals" element={withRole("accounting", <AccountingJournals />)} />
        <Route path="/accounting/reports" element={<Navigate to="/accounting/journals" replace />} />
        <Route path="/employees" element={withRole("expenses", <Employees />)} />
        <Route path="/expenses" element={<Navigate to="/accounting/expenses" replace />} />
        <Route path="/reports" element={withRole("reports", <Reports />)} />
        <Route path="/daily-close" element={withRole("reports", <DailyClose />)} />
        <Route path="/subscriptions" element={withRole("users", <Subscriptions />)} />
        <Route path="/settings" element={withRole("settings", <Settings />)} />
        <Route path="/store-cards" element={withRole("settings", <StoreCards />)} />
        <Route path="/cloud-backup" element={withRole("settings", <CloudBackup />)} />
        <Route path="/zatca-sync" element={withRole("sales", <ZatcaDailySync />)} />
        <Route path="/zatca-queue" element={withRole("settings", <ZatcaQueue />)} />
        <Route path="/zatca-test" element={withRole("settings", <ZatcaTestCenter />)} />
        <Route path="/users" element={withRole("users", <Users />)} />
        <Route path="/vendor-branding" element={<Navigate to="/settings" replace />} />
      </Route>

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
