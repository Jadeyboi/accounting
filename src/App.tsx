import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import Monthly from '@/pages/Monthly'
import Reports from '@/pages/Reports'
import Payroll from '@/pages/Payroll'

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Accounting Tracker</h1>
              <p className="text-sm text-gray-600">Track cash in, cash out, expenses, and monthly summaries.</p>
            </div>
            <nav className="flex gap-3 text-sm">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${isActive ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'}`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/monthly"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${isActive ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'}`
                }
              >
                Monthly
              </NavLink>
              <NavLink
                to="/reports"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${isActive ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'}`
                }
              >
                Reports
              </NavLink>
              <NavLink
                to="/payroll"
                className={({ isActive }) =>
                  `rounded px-3 py-2 ${isActive ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'}`
                }
              >
                Payroll
              </NavLink>
            </nav>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/monthly" element={<Monthly />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="*" element={<Home />} />
        </Routes>

        <footer className="mt-8 text-center text-xs text-gray-500">
          Built with React, Vite, Tailwind, and Supabase.
        </footer>
      </div>
    </BrowserRouter>
  )
}
