import { BrowserRouter, NavLink, Route, Routes, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NotificationsBell from "@/components/NotificationsBell";
import Home from "@/pages/Home";
import Monthly from "@/pages/Monthly";
import Reports from "@/pages/Reports";
import Payroll from "@/pages/Payroll";
import Savings from "@/pages/Savings";
import RequestFunds from "@/pages/RequestFunds";
import Invoice from "@/pages/Invoice";
import InvoiceHistory from "@/pages/InvoiceHistory";
import HRIS from "@/pages/HRIS";
import Leave from "@/pages/Leave";
import Inventory from "@/pages/Inventory";
import Login from "@/pages/Login";
import UserManagement from "@/pages/UserManagement";
import type { SyntheticEvent } from "react";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    
    if (session) {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
      setUserRole(data?.role || null);
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserRole(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-shimmer h-12 w-48 rounded"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={checkAuth} />;
  }

  function hideLogo(e: SyntheticEvent<HTMLImageElement>) {
    // use currentTarget which is correctly typed and avoids any inline casts
    e.currentTarget.style.display = "none";
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen p-2 sm:p-4">
        <div className="mx-auto max-w-6xl">
          <header className="glass animate-fadeIn mb-4 sm:mb-6 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <img
                  src="/logo.jpg"
                  alt="Avensetech logo"
                  className="h-16 w-16 sm:h-24 sm:w-24 lg:h-40 lg:w-40 rounded-xl object-contain shadow-lg"
                />
                <div>
                  <h1 className="gradient-text text-sm sm:text-lg lg:text-2xl font-bold">
                    Avensetech Software Development Services
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                    Accounting Tracker — Track cash in, cash out, expenses, and
                    monthly summaries.
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Role: {userRole || 'Loading...'}</p>
                </div>
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden rounded-lg bg-white p-2 shadow-md"
              >
                <svg className="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-4">
                <NotificationsBell />
                <nav className="flex flex-wrap gap-2 text-sm">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/monthly"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Monthly
                </NavLink>
                <NavLink
                  to="/reports"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Reports
                </NavLink>
                <NavLink
                  to="/savings"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Savings
                </NavLink>
                <NavLink
                  to="/payroll"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Payroll
                </NavLink>
                <NavLink
                  to="/hris"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  HRIS
                </NavLink>
                <NavLink
                  to="/leave"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Leave
                </NavLink>
                <NavLink
                  to="/inventory"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Inventory
                </NavLink>
                <NavLink
                  to="/request-funds"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Request Funds
                </NavLink>
                <NavLink
                  to="/invoice"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Invoice
                </NavLink>
                <NavLink
                  to="/invoice-history"
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-2 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  History
                </NavLink>
                {userRole === 'super_admin' && (
                  <NavLink
                    to="/users"
                    className={({ isActive }) =>
                      `rounded-lg px-4 py-2 font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                          : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                      }`
                    }
                  >
                    Users
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md"
                >
                  Logout
                </button>
                </nav>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
              <nav className="lg:hidden mt-4 flex flex-col gap-2 text-sm animate-slideIn">
                {/* Mobile Notifications */}
                <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                  <span className="font-medium text-blue-700">Notifications</span>
                  <NotificationsBell />
                </div>
                <NavLink
                  to="/"
                  end
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/monthly"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Monthly
                </NavLink>
                <NavLink
                  to="/reports"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Reports
                </NavLink>
                <NavLink
                  to="/savings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Savings
                </NavLink>
                <NavLink
                  to="/payroll"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Payroll
                </NavLink>
                <NavLink
                  to="/hris"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  HRIS
                </NavLink>
                <NavLink
                  to="/leave"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Leave
                </NavLink>
                <NavLink
                  to="/inventory"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Inventory
                </NavLink>
                <NavLink
                  to="/request-funds"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Request Funds
                </NavLink>
                <NavLink
                  to="/invoice"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  Invoice
                </NavLink>
                <NavLink
                  to="/invoice-history"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-4 py-3 font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                        : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                    }`
                  }
                >
                  History
                </NavLink>
                {userRole === 'super_admin' && (
                  <NavLink
                    to="/users"
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-lg px-4 py-3 font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                          : "bg-white text-blue-700 shadow-sm hover:shadow-md"
                      }`
                    }
                  >
                    Users
                  </NavLink>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-3 font-medium text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md text-left"
                >
                  Logout
                </button>
              </nav>
            )}
          </header>

          <main className="glass animate-scaleIn rounded-2xl p-4 sm:p-6 shadow-xl">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/monthly" element={<Monthly />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/hris" element={<HRIS />} />
              <Route path="/leave" element={<Leave />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/request-funds" element={<RequestFunds />} />
              <Route path="/invoice" element={<Invoice />} />
              <Route path="/invoice-history" element={<InvoiceHistory />} />
              {userRole === 'super_admin' && (
                <Route path="/users" element={<UserManagement />} />
              )}
              <Route path="*" element={<Home />} />
            </Routes>
          </main>

          <footer className="mt-4 sm:mt-6 text-center text-xs text-white opacity-80">
            Built with React, Vite, Tailwind, and Supabase.
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
