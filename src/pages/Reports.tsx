import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  TimeSeriesScale,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  TimeSeriesScale
);

type Mode = "monthly" | "quarterly" | "yearly";

function formatYYYYMM(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const toISO = (x: Date) => x.toISOString().slice(0, 10);
  return { start: toISO(first), end: toISO(last) };
}

function quarterOf(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export default function Reports() {
  const [mode, setMode] = useState<Mode>("monthly");
  const [month, setMonth] = useState<string>(() => formatYYYYMM(new Date()));
  const [year, setYear] = useState<number>(new Date().getFullYear());
  // Custom quarterly: user selects the start month of the 3-month period
  const [quarterStartMonth, setQuarterStartMonth] = useState<number>(
    (quarterOf(new Date()) - 1) * 3 + 1
  ); // 1..12

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingsTotal, setSavingsTotal] = useState<number>(0);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      let start = "",
        end = "";
      if (mode === "monthly") {
        const r = monthRange(month);
        start = r.start;
        end = r.end;
      } else if (mode === "quarterly") {
        const sMonth = quarterStartMonth - 1; // 0-indexed month
        const startDate = new Date(year, sMonth, 1);
        const endDate = new Date(year, sMonth + 3, 0);
        start = startDate.toISOString().slice(0, 10);
        end = endDate.toISOString().slice(0, 10);
      } else {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 12, 0);
        start = startDate.toISOString().slice(0, 10);
        end = endDate.toISOString().slice(0, 10);
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (cancel) return;
      if (error) setError(error.message);
      else setItems((data ?? []) as Transaction[]);

      // Load savings total for the same period
      const { data: savingsData, error: savingsErr } = await supabase
        .from("savings")
        .select("amount, date")
        .gte("date", start)
        .lte("date", end);

      if (!cancel) {
        if (savingsErr) {
          // don't block reports on savings error; surface softly
          console.warn("Savings load error:", savingsErr.message);
          setSavingsTotal(0);
        } else {
          const sTotal = (savingsData ?? []).reduce(
            (sum: number, row: any) => sum + (row.amount ?? 0),
            0
          );
          setSavingsTotal(sTotal);
        }
      }
      setLoading(false);
    };
    load();
    return () => {
      cancel = true;
    };
  }, [mode, month, year, quarterStartMonth]);

  const { labels, creditData, debitData, remaining, totals } = useMemo(() => {
    const creditBy: Record<string, number> = {};
    const debitBy: Record<string, number> = {};

    const push = (k: string, t: Transaction) => {
      if (t.type === "in") creditBy[k] = (creditBy[k] ?? 0) + t.amount;
      else debitBy[k] = (debitBy[k] ?? 0) + t.amount;
    };

    if (mode === "monthly") {
      items.forEach((t) => push(t.date, t));
    } else if (mode === "quarterly") {
      items.forEach((t) => {
        const d = new Date(t.date + "T00:00:00");
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        push(key, t);
      });
    } else {
      items.forEach((t) => {
        const d = new Date(t.date + "T00:00:00");
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        push(key, t);
      });
    }

    const lab = Array.from(
      new Set([...Object.keys(creditBy), ...Object.keys(debitBy)])
    ).sort();
    const c = lab.map((k) => creditBy[k] ?? 0);
    const d = lab.map((k) => debitBy[k] ?? 0);
    const totalCredit = c.reduce((a, b) => a + b, 0);
    const totalDebit = d.reduce((a, b) => a + b, 0);
    const rem = totalCredit - totalDebit;

    return {
      labels: lab,
      creditData: c,
      debitData: d,
      remaining: rem,
      totals: { credit: totalCredit, debit: totalDebit },
    };
  }, [items, mode]);

  // Human-readable description of months in the selected period
  const selectedMonthsText = useMemo(() => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    if (mode === "monthly") {
      const [y, m] = month.split("-").map(Number);
      return `${monthNames[m - 1]} ${y}`;
    }
    if (mode === "quarterly") {
      const startIdx = quarterStartMonth - 1;
      const months = [
        monthNames[startIdx],
        monthNames[startIdx + 1],
        monthNames[startIdx + 2],
      ];
      return `${months.join(", ")} ${year}`;
    }
    // yearly
    return `Jan–Dec ${year}`;
  }, [mode, month, quarterStartMonth, year]);

  const money = (v: number) =>
    `₱ ${v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const barData = {
    labels,
    datasets: [
      {
        label: "Credit (In)",
        data: creditData,
        backgroundColor: "rgba(16, 185, 129, 0.6)",
        borderRadius: 6,
      },
      {
        label: "Debit (Out + Expense)",
        data: debitData,
        backgroundColor: "rgba(244, 63, 94, 0.6)",
        borderRadius: 6,
      },
    ],
  };

  const lineData = {
    labels,
    datasets: [
      {
        label: "Remaining (Cumulative)",
        data: labels.map(
          (_, i) =>
            creditData.slice(0, i + 1).reduce((a, b) => a + b, 0) -
            debitData.slice(0, i + 1).reduce((a, b) => a + b, 0)
        ),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.2)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-600">
            Visualize cash flow over time and summarize by period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <button
              className={`px-3 py-2 text-sm ${
                mode === "monthly"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setMode("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-3 py-2 text-sm ${
                mode === "quarterly"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setMode("quarterly")}
            >
              Quarterly
            </button>
            <button
              className={`px-3 py-2 text-sm ${
                mode === "yearly"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setMode("yearly")}
            >
              Yearly
            </button>
          </div>
          {mode === "monthly" && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          )}
          {mode !== "monthly" && (
            <>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
              {mode === "quarterly" && (
                <select
                  value={quarterStartMonth}
                  onChange={(e) => setQuarterStartMonth(Number(e.target.value))}
                  className="rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value={1}>Start: Jan</option>
                  <option value={2}>Start: Feb</option>
                  <option value={3}>Start: Mar</option>
                  <option value={4}>Start: Apr</option>
                  <option value={5}>Start: May</option>
                  <option value={6}>Start: Jun</option>
                  <option value={7}>Start: Jul</option>
                  <option value={8}>Start: Aug</option>
                  <option value={9}>Start: Sep</option>
                  <option value={10}>Start: Oct</option>
                  <option value={11}>Start: Nov</option>
                  <option value={12}>Start: Dec</option>
                </select>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Credit vs Debit
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Loading...</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : labels.length === 0 ? (
            <div className="text-sm text-slate-500">No data.</div>
          ) : (
            <Bar
              data={barData}
              options={{
                responsive: true,
                plugins: { legend: { position: "bottom" as const } },
              }}
            />
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Remaining (Cumulative)
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Loading...</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : labels.length === 0 ? (
            <div className="text-sm text-slate-500">No data.</div>
          ) : (
            <Line
              data={lineData}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total Credit
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {money(totals.credit)}
          </div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total Debit
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {money(totals.debit)}
          </div>
        </div>
        <div
          className={`rounded-xl border ${
            remaining >= 0 ? "border-emerald-200" : "border-rose-200"
          } bg-white p-4 shadow-sm`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Remaining
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {money(remaining)}
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Savings (Selected Period)
          </div>
          <div className="text-[11px] text-slate-500">
            Months: {selectedMonthsText}
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {money(savingsTotal)}
          </div>
        </div>

        <div
          className={`rounded-xl border ${
            remaining - savingsTotal >= 0
              ? "border-emerald-300"
              : "border-rose-300"
          } bg-white p-4 shadow-sm sm:col-span-3`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Remaining After Savings
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {money(remaining - savingsTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
