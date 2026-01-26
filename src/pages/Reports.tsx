import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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
  const [savingsItems, setSavingsItems] = useState<any[]>([]);
  const [usdRate, setUsdRate] = useState<string>("56");
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string>("");

  const reportRef = useRef<HTMLDivElement | null>(null);

  // Fetch current USD to PHP rate
  const fetchCurrentRate = async () => {
    setIsLoadingRate(true);
    setRateError("");
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD"
      );
      if (!response.ok) throw new Error("Failed to fetch exchange rate");
      const data = await response.json();
      if (data.rates && data.rates.PHP) {
        setUsdRate(String(data.rates.PHP));
      } else {
        throw new Error("PHP rate not found in response");
      }
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      setRateError("Failed to fetch current rate");
    } finally {
      setIsLoadingRate(false);
    }
  };

  // Auto-fetch rate on component mount
  useEffect(() => {
    fetchCurrentRate();
  }, []);

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

      // Load savings total for the same period (only active savings)
      const { data: savingsData, error: savingsErr } = await supabase
        .from("savings")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (!cancel) {
        if (savingsErr) {
          // don't block reports on savings error; surface softly
          console.warn("Savings load error:", savingsErr.message);
          setSavingsTotal(0);
          setSavingsItems([]);
        } else {
          // Filter out paid savings (only show active ones)
          const activeSavings = (savingsData ?? []).filter(
            (row: any) => !row.status || row.status === 'active'
          );
          const sTotal = activeSavings.reduce(
            (sum: number, row: any) => sum + (row.amount ?? 0),
            0
          );
          setSavingsTotal(sTotal);
          setSavingsItems(activeSavings);
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

  const usd = (v: number) =>
    `$ ${v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const toUsd = (php: number) => {
    const rate = Number(usdRate);
    if (!rate || isNaN(rate) || rate <= 0) return 0;
    return php / rate;
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    
    const element = reportRef.current;
    document.body.classList.add("pdf-mode");
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        letterRendering: true,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth - 40; // 20pt margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let y = 20;
      
      if (imgHeight <= pageHeight - 40) {
        pdf.addImage(imgData, "PNG", 20, y, imgWidth, imgHeight);
      } else {
        let position = 0;
        const sliceHeight = (canvas.width * (pageHeight - 40)) / imgWidth;
        
        while (position < canvas.height) {
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = Math.min(sliceHeight, canvas.height - position);
          const sctx = slice.getContext("2d");
          
          if (sctx) {
            sctx.drawImage(
              canvas,
              0,
              position,
              canvas.width,
              slice.height,
              0,
              0,
              canvas.width,
              slice.height
            );
          }
          
          const sliceData = slice.toDataURL("image/png");
          pdf.addImage(
            sliceData,
            "PNG",
            20,
            20,
            imgWidth,
            (slice.height * imgWidth) / canvas.width
          );
          
          position += slice.height;
          if (position < canvas.height) pdf.addPage();
        }
      }
      
      const filename = `financial-report-${selectedMonthsText.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      document.body.classList.remove("pdf-mode");
    }
  };

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
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600" title="PHP per 1 USD">
              USD Rate
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={usdRate}
              onChange={(e) => setUsdRate(e.target.value)}
              className="w-24 rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="56.00"
              disabled={isLoadingRate}
            />
            <button
              onClick={fetchCurrentRate}
              disabled={isLoadingRate}
              className="rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white shadow hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
              title="Refresh current rate"
            >
              {isLoadingRate ? "..." : "↻"}
            </button>
          </div>
          {rateError && (
            <span className="text-xs text-red-600">{rateError}</span>
          )}
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
          <button
            onClick={exportPDF}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6 bg-white p-6 rounded-xl">
        {/* Report Header for PDF */}
        <div className="mb-6 text-center border-b border-slate-200 pb-4 print:block hidden">
          <h1 className="text-2xl font-bold text-slate-900">Financial Report</h1>
          <p className="text-sm text-slate-600 mt-1">Period: {selectedMonthsText}</p>
          <p className="text-xs text-slate-500 mt-1">
            Generated: {new Date().toLocaleDateString()} • 
            Exchange Rate: 1 USD = {Number(usdRate || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })} PHP
          </p>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Credit
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {money(totals.credit)}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              {usd(toUsd(totals.credit))}
            </div>
          </div>
          <div className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Debit
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {money(totals.debit)}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              {usd(toUsd(totals.debit))}
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
            <div className="text-sm text-slate-600 mt-1">
              {usd(toUsd(remaining))}
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
            <div className="text-sm text-slate-600 mt-1">
              {usd(toUsd(savingsTotal))}
            </div>
          </div>

          <div
            className={`rounded-xl border ${
              remaining - savingsTotal >= 0
                ? "border-emerald-300"
                : "border-rose-300"
            } bg-white p-4 shadow-sm sm:col-span-2`}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Remaining After Savings
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {money(remaining - savingsTotal)}
            </div>
            <div className="text-sm text-slate-600 mt-1">
              {usd(toUsd(remaining - savingsTotal))}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        {!loading && !error && items.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 text-lg font-semibold text-slate-900">
              Transaction Breakdown
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Category</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">Amount (PHP)</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">Amount (USD)</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-900">{transaction.date}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          transaction.type === 'in' 
                            ? 'bg-green-100 text-green-800' 
                            : transaction.type === 'out'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'in' ? 'Credit' : transaction.type === 'out' ? 'Debit' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{transaction.category || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-900">
                        {money(transaction.amount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {usd(toUsd(transaction.amount))}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-xs truncate">
                        {transaction.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-medium">
                    <td colSpan={3} className="px-3 py-2 text-slate-900">Total</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900">
                      {money(items.reduce((sum, t) => sum + (t.type === 'in' ? t.amount : -t.amount), 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                      {usd(toUsd(items.reduce((sum, t) => sum + (t.type === 'in' ? t.amount : -t.amount), 0)))}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Savings Breakdown Table */}
        {!loading && !error && savingsItems.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  Savings Breakdown
                </div>
                <div className="text-sm text-slate-600">
                  Period: {selectedMonthsText} • {savingsItems.length} entries
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-600">
                  {money(savingsTotal)}
                </div>
                <div className="text-sm text-slate-600">
                  {usd(toUsd(savingsTotal))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-indigo-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Description</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Account</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">Amount (PHP)</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {savingsItems.map((saving, index) => (
                    <tr key={saving.id || index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-900">{saving.date}</td>
                      <td className="px-3 py-2 text-slate-700">{saving.description || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{saving.account || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-900">
                        {money(saving.amount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {usd(toUsd(saving.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-indigo-300 bg-indigo-100 font-medium">
                    <td colSpan={3} className="px-3 py-2 text-slate-900">Total Savings</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900">
                      {money(savingsTotal)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                      {usd(toUsd(savingsTotal))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Savings Summary by Account */}
            {savingsItems.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 text-base font-semibold text-slate-900">
                  Savings by Account
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(
                    savingsItems.reduce((acc: Record<string, number>, saving) => {
                      const account = saving.account || 'Unspecified';
                      acc[account] = (acc[account] || 0) + saving.amount;
                      return acc;
                    }, {})
                  )
                    .sort(([, a], [, b]) => b - a) // Sort by amount descending
                    .map(([account, total]) => (
                      <div key={account} className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <div className="text-sm font-medium text-slate-700">{account}</div>
                        <div className="text-lg font-bold text-indigo-600">{money(total)}</div>
                        <div className="text-xs text-slate-600">{usd(toUsd(total))}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {((total / savingsTotal) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
