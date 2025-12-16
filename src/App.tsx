import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import Monthly from "@/pages/Monthly";
import Reports from "@/pages/Reports";
import Payroll from "@/pages/Payroll";
import Savings from "@/pages/Savings";
import RequestFunds from "@/pages/RequestFunds";
import Invoice from "@/pages/Invoice";
import type { SyntheticEvent } from "react";

export default function App() {
  function hideLogo(e: SyntheticEvent<HTMLImageElement>) {
    // use currentTarget which is correctly typed and avoids any inline casts
    e.currentTarget.style.display = "none";
  }

  return (
    <BrowserRouter>
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/logo.jpg"
                alt="Avensetech logo"
                className="h-40 w-40 object-contain"
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Avensetech Software Development Services
                </h1>
                <p className="text-sm text-gray-600">
                  Accounting Tracker — Track cash in, cash out, expenses, and
                  monthly summaries.
                </p>
              </div>
            </div>
            <nav className="flex gap-3 text-sm">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/monthly"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Monthly
              </NavLink>
              <NavLink
                to="/reports"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Reports
              </NavLink>
              <NavLink
                to="/savings"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Savings
              </NavLink>
              <NavLink
                to="/payroll"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Payroll
              </NavLink>
              <NavLink
                to="/request-funds"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Request Funds
              </NavLink>
              <NavLink
                to="/invoice"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-blue-700 hover:bg-blue-50"
                  }`
                }
              >
                Invoice
              </NavLink>
            </nav>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/monthly" element={<Monthly />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/request-funds" element={<RequestFunds />} />
          <Route path="/invoice" element={<Invoice />} />
          <Route path="*" element={<Home />} />
        </Routes>

        <footer className="mt-8 text-center text-xs text-gray-500">
          Built with React, Vite, Tailwind, and Supabase.
        </footer>
      </div>
    </BrowserRouter>
  );
}
