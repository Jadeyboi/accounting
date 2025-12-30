import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
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
import type { SyntheticEvent } from "react";

export default function App() {
  function hideLogo(e: SyntheticEvent<HTMLImageElement>) {
    // use currentTarget which is correctly typed and avoids any inline casts
    e.currentTarget.style.display = "none";
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen p-4">
        <div className="mx-auto max-w-6xl">
          <header className="glass animate-fadeIn mb-6 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src="/logo.jpg"
                  alt="Avensetech logo"
                  className="h-40 w-40 rounded-xl object-contain shadow-lg"
                />
                <div>
                  <h1 className="gradient-text text-2xl font-bold">
                    Avensetech Software Development Services
                  </h1>
                  <p className="text-sm text-gray-600">
                    Accounting Tracker — Track cash in, cash out, expenses, and
                    monthly summaries.
                  </p>
                </div>
              </div>
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
              </nav>
            </div>
          </header>

          <main className="glass animate-scaleIn rounded-2xl p-6 shadow-xl">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/monthly" element={<Monthly />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/hris" element={<HRIS />} />
              <Route path="/leave" element={<Leave />} />
              <Route path="/request-funds" element={<RequestFunds />} />
              <Route path="/invoice" element={<Invoice />} />
              <Route path="/invoice-history" element={<InvoiceHistory />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </main>

          <footer className="mt-6 text-center text-xs text-white opacity-80">
            Built with React, Vite, Tailwind, and Supabase.
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
