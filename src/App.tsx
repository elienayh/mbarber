import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TenantLayout } from "./components/layout/TenantLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Home } from "./pages/Home";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { DashboardPage } from "./pages/tenant/DashboardPage";
import { AgendaPage } from "./pages/tenant/AgendaPage";
import { ClientsPage } from "./pages/tenant/ClientsPage";
import { ServicesPage } from "./pages/tenant/ServicesPage";
import { ProfessionalsPage } from "./pages/tenant/ProfessionalsPage";
import { FinancialPage } from "./pages/tenant/FinancialPage";
import { StockPage } from "./pages/tenant/StockPage";
import { ReportsPage } from "./pages/tenant/ReportsPage";
import { SettingsPage } from "./pages/tenant/SettingsPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { TenantsListPage } from "./pages/admin/TenantsListPage";
import { PlansPage } from "./pages/admin/PlansPage";
import { AuditPage } from "./pages/admin/AuditPage";
import { PublicChat } from "./pages/public/PublicChat";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing & Public Portal */}
        <Route path="/" element={<Home />} />

        {/* Auth Routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Backoffice da Barbearia (Tenant) — requer autenticação */}
        <Route
          element={
            <ProtectedRoute>
              <TenantLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/servicos" element={<ServicesPage />} />
          <Route path="/profissionais" element={<ProfessionalsPage />} />
          <Route path="/financeiro" element={<FinancialPage />} />
          <Route path="/estoque" element={<StockPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="/configuracoes/assinatura" element={<SettingsPage />} />
        </Route>

        {/* Painel Administrativo SaaS (Super Admin) — requer autenticação + is_platform_admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="tenants" element={<TenantsListPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="subscriptions" element={<TenantsListPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="support" element={<AdminDashboardPage />} />
        </Route>

        {/* Chat Público de Agendamento (Mobile-First) */}
        <Route path="/:slug" element={<PublicChat />} />
        <Route path="/:slug/agendamento/:id" element={<PublicChat />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
