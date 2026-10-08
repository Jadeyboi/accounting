import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import NotificationsBell from "@/components/NotificationsBell";
import { NavigationLoader } from "@/components/Loading";
import Home from "@/pages/Home";
import Monthly from "@/pages/Monthly";
import Reports from "@/pages/Reports";
import Payroll from "@/pages/Payroll";
import SalaryDeclaration from "@/pages/SalaryDeclaration";
import Savings from "@/pages/Savings";
import HMO from "@/pages/HMO";
import MonthlyExpenses from "@/pages/MonthlyExpenses";
import FinalPay from "@/pages/FinalPay";
import Projects from "@/pages/Projects";
import Invoice from "@/pages/Invoice";
import HRIS from "@/pages/HRIS";
import Leave from "@/pages/Leave";
import Inventory from "@/pages/Inventory";
import Loans from "@/pages/Loans";
import MoneyReceived from "@/pages/MoneyReceived";
import Login from "@/pages/Login";
import UserManagement from "@/pages/UserManagement";
import JobOpenings from "@/pages/JobOpenings";
import Oakridge from "@/pages/Oakridge";
import Profitability from "@/pages/Profitability";
import Affiliates from "@/pages/Affiliates";
import ChangePassword from "@/pages/ChangePassword";
import ActivityLogs from "@/pages/ActivityLogs";
import AccessDenied from "@/pages/AccessDenied";
import HRDashboard from "@/pages/HRDashboard";
import EmployeeDashboard from "@/pages/EmployeeDashboard";
import MyPayslips from "@/pages/MyPayslips";
import MyLeave from "@/pages/MyLeave";

// ── Navigation model ──────────────────────────────────────────────────────
// Each item: path, label, icon (inline SVG path data). Groups organize the
// features under their existing classifications with expandable sections.
type NavItem = { to: string; label: string; icon: string; end?: boolean };
type NavGroup = { id: string; label: string; items: NavItem[] };

// Heroicon-style single-path icons (24x24, stroke).
const ICON = {
  home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  cash: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  briefcase: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  receipt: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  gear: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  building: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  logs: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem("sidebarCollapsed") === "1");
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      const { data: roleData } = await supabase
        .from("users").select("role").eq("id", session.user.id).single();
      setUserRole(roleData?.role || null);
      try {
        const { data: flagData, error } = await supabase
          .from("users").select("must_change_password").eq("id", session.user.id).single();
        if (!error) setMustChangePassword(flagData?.must_change_password === true);
      } catch {
        setMustChangePassword(false);
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserRole(null);
  };

  // HR role — redirect / to HRDashboard, restrict all other routes
  const canAccess = (path: string): boolean => {
    if (userRole === "super_admin" || userRole === "admin") return true;
    if (userRole === "hr") {
      const hrRoutes = ["/payroll", "/salary-declaration", "/hris", "/leave", "/inventory", "/job-openings", "/activity-logs", "/users", "/final-pay", "/projects", "/hmo"];
      return hrRoutes.some((r) => path === r || path.startsWith(r));
    }
    if (userRole === "employee" || userRole === "user") {
      const employeeRoutes = ["/my-payslips", "/my-leave"];
      return employeeRoutes.some((r) => path === r || path.startsWith(r));
    }
    return false;
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebarCollapsed", c ? "0" : "1");
      return !c;
    });
  };

  // ── Grouped navigation, filtered by role/permissions ────────────────────
  const navGroups: NavGroup[] = useMemo(() => {
    const isEmployee = userRole === "employee" || userRole === "user";
    if (isEmployee) {
      return [{
        id: "me",
        label: "My Space",
        items: [
          { to: "/", label: "Dashboard", icon: ICON.home, end: true },
          { to: "/my-payslips", label: "My Payslips", icon: ICON.doc },
          { to: "/my-leave", label: "My Leave", icon: ICON.calendar },
        ],
      }];
    }

    const groups: NavGroup[] = [];

    // Dashboard / overview
    const overview: NavItem[] = [];
    if (userRole === "hr") overview.push({ to: "/hr-dashboard", label: "HR Dashboard", icon: ICON.home });
    if (canAccess("/") && userRole !== "hr") overview.push({ to: "/", label: "Home", icon: ICON.home, end: true });
    if (overview.length) groups.push({ id: "overview", label: "Overview", items: overview });

    // Finance
    const finance: NavItem[] = [
      { to: "/monthly", label: "Monthly", icon: ICON.cash },
      { to: "/reports", label: "Reports", icon: ICON.chart },
      { to: "/savings", label: "Savings", icon: ICON.cash },
      { to: "/money-received", label: "Money Received", icon: ICON.cash },
      { to: "/monthly-expenses", label: "Monthly Expenses", icon: ICON.cash },
      { to: "/invoice", label: "Invoice", icon: ICON.receipt },
      { to: "/profitability", label: "P&L", icon: ICON.chart },
      { to: "/oakridge", label: "Oakridge", icon: ICON.building },
      { to: "/affiliates", label: "Affiliates", icon: ICON.users },
    ].filter((i) => canAccess(i.to));
    if (finance.length) groups.push({ id: "finance", label: "Finance", items: finance });

    // Payroll & HR
    const hr: NavItem[] = [
      { to: "/payroll", label: "Payroll", icon: ICON.cash },
      { to: "/salary-declaration", label: "Salary Declaration", icon: ICON.doc },
      { to: "/hmo", label: "HMO", icon: ICON.shield },
      { to: "/final-pay", label: "Final Pay", icon: ICON.doc },
      { to: "/hris", label: "HRIS", icon: ICON.users },
      { to: "/leave", label: "Leave", icon: ICON.calendar },
      { to: "/job-openings", label: "Job Openings", icon: ICON.briefcase },
    ].filter((i) => canAccess(i.to));
    if (hr.length) groups.push({ id: "hr", label: "Payroll & HR", items: hr });

    // Operations
    const ops: NavItem[] = [
      { to: "/projects", label: "Projects", icon: ICON.briefcase },
      { to: "/inventory", label: "Inventory", icon: ICON.box },
      { to: "/loans", label: "Loans", icon: ICON.cash },
    ].filter((i) => canAccess(i.to));
    if (ops.length) groups.push({ id: "ops", label: "Operations", items: ops });

    // Administration
    const admin: NavItem[] = [];
    if (userRole === "super_admin" || userRole === "admin" || userRole === "hr") admin.push({ to: "/activity-logs", label: "Logs", icon: ICON.logs });
    if (userRole === "super_admin" || userRole === "hr") admin.push({ to: "/users", label: "Users", icon: ICON.gear });
    if (admin.length) groups.push({ id: "admin", label: "Administration", items: admin });

    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Expandable group state (all open by default).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isGroupOpen = (id: string) => openGroups[id] !== false;
  const toggleGroup = (id: string) => setOpenGroups((g) => ({ ...g, [id]: g[id] === false ? true : false }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-shimmer h-12 w-48 rounded"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Login onLogin={checkAuth} />;
  if (mustChangePassword) return <ChangePassword onDone={() => setMustChangePassword(false)} />;

  const navLinkClass = (isActive: boolean) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white shadow-sm"
        : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-200 dark:hover:bg-gray-800"
    } ${collapsed ? "justify-center" : ""}`;

  const Icon = ({ d }: { d: string }) => (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );

  // Sidebar inner content (shared by desktop fixed sidebar and mobile drawer).
  const SidebarContent = ({ onNavigate, isCollapsed }: { onNavigate?: () => void; isCollapsed: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`flex items-center gap-2 border-b border-gray-200 px-4 py-4 ${isCollapsed ? "justify-center px-2" : ""}`}>
        <img src="/logo.jpg" alt="Avensetech" className="h-9 w-9 rounded-lg object-contain shadow-sm" />
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="gradient-text truncate text-sm font-bold leading-tight">Avensetech</p>
            <p className="truncate text-[10px] text-gray-400">Accounting &amp; HR</p>
          </div>
        )}
      </div>

      {/* Scrollable menu */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.id}>
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="mb-1 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                <span>{group.label}</span>
                <svg className={`h-3.5 w-3.5 transition-transform ${isGroupOpen(group.id) ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {(isCollapsed || isGroupOpen(group.id)) && (
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    <Icon d={item.icon} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer: logout */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={() => { handleLogout(); onNavigate?.(); }}
          title={isCollapsed ? "Logout" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 ${isCollapsed ? "justify-center" : ""}`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NavigationLoader />
      <div className="flex min-h-screen bg-slate-100">
        {/* ── Desktop sidebar (fixed) ──────────────────────────────────── */}
        <aside
          className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ${collapsed ? "w-16" : "w-64"}`}
        >
          <SidebarContent isCollapsed={collapsed} />
          {/* Collapse / expand toggle */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="absolute -right-3 top-20 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow hover:bg-gray-50"
          >
            <svg className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </aside>

        {/* ── Mobile slide-out drawer ──────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl animate-slideIn">
              <SidebarContent isCollapsed={false} onNavigate={() => setMobileMenuOpen(false)} />
            </aside>
          </div>
        )}

        {/* ── Main content area ────────────────────────────────────────── */}
        <div className={`flex min-h-screen flex-1 flex-col transition-[margin] duration-200 ${collapsed ? "lg:ml-16" : "lg:ml-64"}`}>
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden rounded-lg border border-gray-200 bg-white p-2 text-blue-700 shadow-sm hover:bg-gray-50"
                aria-label="Open menu"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-sm font-bold text-gray-900 sm:text-base">Avensetech Software Development Services</h1>
                <p className="hidden text-xs text-gray-500 sm:block">Accounting &amp; HR Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 ring-1 ring-inset ring-blue-100">
                {userRole || "…"}
              </span>
              <NotificationsBell />
            </div>
          </header>

          {/* Routed content */}
          <main className="flex-1 p-3 sm:p-6">
            <Routes>
              {(userRole === "employee" || userRole === "user") && (
                <>
                  <Route path="/" element={<EmployeeDashboard />} />
                  <Route path="/my-payslips" element={<MyPayslips />} />
                  <Route path="/my-leave" element={<MyLeave />} />
                </>
              )}
              {userRole === "hr" && (
                <>
                  <Route path="/hr-dashboard" element={<HRDashboard />} />
                  <Route path="/" element={<HRDashboard />} />
                </>
              )}
              {userRole !== "hr" && userRole !== "employee" && userRole !== "user" && (
                <Route path="/" element={<Home />} />
              )}
              <Route path="/access-denied" element={<AccessDenied />} />
              {userRole !== "employee" && userRole !== "user" && (
                <>
                  <Route path="/monthly" element={<Monthly />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/savings" element={<Savings />} />
                  <Route path="/hmo" element={<HMO />} />
                  <Route path="/payroll" element={<Payroll />} />
                  <Route path="/salary-declaration" element={<SalaryDeclaration />} />
                  <Route path="/hris" element={<HRIS />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/final-pay" element={<FinalPay />} />
                  <Route path="/oakridge" element={<Oakridge />} />
                  <Route path="/profitability" element={<Profitability />} />
                  <Route path="/affiliates" element={<Affiliates />} />
                  <Route path="/leave" element={<Leave />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/loans" element={<Loans />} />
                  <Route path="/money-received" element={<MoneyReceived />} />
                  <Route path="/monthly-expenses" element={<MonthlyExpenses />} />
                  <Route path="/invoice" element={<Invoice />} />
                  <Route path="/invoice-history" element={<Invoice />} />
                  <Route path="/job-openings" element={<JobOpenings />} />
                </>
              )}
              {(userRole === "super_admin" || userRole === "admin" || userRole === "hr") && (
                <Route path="/activity-logs" element={<ActivityLogs />} />
              )}
              {(userRole === "super_admin" || userRole === "hr") && (
                <Route path="/users" element={<UserManagement />} />
              )}
              <Route path="*" element={userRole === "hr" ? <HRDashboard /> : (userRole === "employee" || userRole === "user") ? <EmployeeDashboard /> : <Home />} />
            </Routes>

            <footer className="mt-6 text-center text-xs text-gray-400">
              Built with React, Vite, Tailwind, and Supabase.
            </footer>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
