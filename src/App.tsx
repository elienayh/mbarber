import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TenantLayout } from "./components/layout/TenantLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Home } from "./pages/Home";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { AuthCallbackPage } from "./pages/auth/AuthCallbackPage";
import { ProfileOnboardingPage } from "./pages/onboarding/ProfileOnboardingPage";
import { TenantOnboardingPage } from "./pages/onboarding/TenantOnboardingPage";
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
import { SimulationChat } from "./pages/public/SimulationChat";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing & Public Portal */}
        <Route path="/" element={<Home />} />

        {/* Simulação Interativa (Sem vínculo com barbearia, dados fictícios) */}
        <Route path="/simulacao" element={<SimulationChat />} />
        <Route path="/simular" element={<SimulationChat />} />

        {/* Auth Routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Onboarding & Configuração de Perfil / Barbearia */}
        <Route
          path="/onboarding/perfil"
          element={
            <ProtectedRoute allowIncompleteProfile allowIncompleteTenant>
              <ProfileOnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/perfil"
          element={
            <ProtectedRoute allowIncompleteProfile allowIncompleteTenant>
              <ProfileOnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/barbearia"
          element={
            <ProtectedRoute allowIncompleteTenant>
              <TenantOnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Backoffice da Barbearia (Tenant) — requer autenticação + perfil completo + barbearia configurada */}
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
          <Route path="/servicos" element={<ProtectedRoute allowedRoles={["owner", "admin", "receptionist"]}><ServicesPage /></ProtectedRoute>} />
          <Route path="/profissionais" element={<ProtectedRoute allowedRoles={["owner", "admin"]}><ProfessionalsPage /></ProtectedRoute>} />
          <Route path="/financeiro" element={<ProtectedRoute allowedRoles={["owner", "admin"]}><FinancialPage /></ProtectedRoute>} />
          <Route path="/estoque" element={<ProtectedRoute allowedRoles={["owner", "admin", "receptionist"]}><StockPage /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute allowedRoles={["owner", "admin"]}><ReportsPage /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={["owner", "admin"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="/configuracoes/assinatura" element={<ProtectedRoute allowedRoles={["owner"]}><SettingsPage /></ProtectedRoute>} />
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
