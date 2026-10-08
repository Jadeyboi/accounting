import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import { CuteLoader, LOADING_MESSAGES } from "@/components/Loading";
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

type Mode = "monthly" | "quarterly" | "yearly" | "custom";

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

  // Custom mode: select specific months across multiple years
  const [selectedMonthYears, setSelectedMonthYears] = useState<Set<string>>(
    new Set([`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`])
  );
  const [showCustomSelector, setShowCustomSelector] = useState(false);
  const [customYearRange, setCustomYearRange] = useState<number[]>([
    new Date().getFullYear() - 1,
    new Date().getFullYear() + 1
  ]);

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingsTotal, setSavingsTotal] = useState<number>(0);
  const [savingsItems, setSavingsItems] = useState<any[]>([]);
  const [usdRate, setUsdRate] = useState<string>("56");
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const reportRef = useRef<HTMLDivElement | null>(null);

  const txPagination = usePagination(items);
  const savingsPagination = usePagination(savingsItems);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const toggleMonthYear = (yearMonth: string) => {
    const newSelected = new Set(selectedMonthYears);
    if (newSelected.has(yearMonth)) {
      newSelected.delete(yearMonth);
    } else {
      newSelected.add(yearMonth);
    }
    setSelectedMonthYears(newSelected);
  };

  const selectAllMonthsInRange = () => {
    const newSelected = new Set<string>();
    for (let year = customYearRange[0]; year <= customYearRange[1]; year++) {
      for (let month = 1; month <= 12; month++) {
        newSelected.add(`${year}-${String(month).padStart(2, '0')}`);
      }
    }
    setSelectedMonthYears(newSelected);
  };

  const clearAllMonths = () => {
    setSelectedMonthYears(new Set());
  };

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
      } else if (mode === "yearly") {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 12, 0);
        start = startDate.toISOString().slice(0, 10);
        end = endDate.toISOString().slice(0, 10);
      } else if (mode === "custom") {
        if (selectedMonthYears.size === 0) {
          setItems([]);
          setSavingsTotal(0);
          setSavingsItems([]);
          setLoading(false);
          return;
        }
        // For custom mode, find the earliest and latest selected month
        const sortedMonthYears = Array.from(selectedMonthYears).sort();
        const [firstYear, firstMonth] = sortedMonthYears[0].split('-').map(Number);
        const [lastYear, lastMonth] = sortedMonthYears[sortedMonthYears.length - 1].split('-').map(Number);
        
        const startDate = new Date(firstYear, firstMonth - 1, 1);
        const endDate = new Date(lastYear, lastMonth, 0);
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
      
      // Filter transactions to only include selected months in custom mode
      let filteredData = data ?? [];
      if (mode === "custom" && selectedMonthYears.size > 0) {
        filteredData = filteredData.filter((t: Transaction) => {
          const d = new Date(t.date + "T00:00:00");
          const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return selectedMonthYears.has(yearMonth);
        });
      }
      
      if (error) setError(error.message);
      else setItems(filteredData as Transaction[]);

      // Savings accumulate over time, so always load ALL savings (not just the
      // selected report period) — savings is for the entire duration.
      const { data: savingsData, error: savingsErr } = await supabase
        .from("savings")
        .select("*")
        .order("date", { ascending: true});

      if (!cancel) {
        if (savingsErr) {
          // don't block reports on savings error; surface softly
          console.warn("Savings load error:", savingsErr.message);
          setSavingsTotal(0);
          setSavingsItems([]);
        } else {
          // Filter out paid savings (only show active ones). No date/month filter —
          // savings represents the running total across all months.
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
  }, [mode, month, year, quarterStartMonth, selectedMonthYears]);

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
    if (mode === "custom") {
      if (selectedMonthYears.size === 0) return `No months selected`;
      const sorted = Array.from(selectedMonthYears).sort();
      const formatted = sorted.map(ym => {
        const [y, m] = ym.split('-').map(Number);
        return `${monthNames[m - 1]} ${y}`;
      }).join(", ");
      return formatted;
    }
    // yearly
    return `Jan–Dec ${year}`;
  }, [mode, month, quarterStartMonth, year, selectedMonthYears]);

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
    if (exporting) return;
    if (items.length === 0 && savingsItems.length === 0) {
      alert("No data to export for the selected period.");
      return;
    }
    setExporting(true);
    try {
      const rate = Number(usdRate) || 0;
      const fmtPhp = (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtUsd = (v: number) =>
        rate > 0 ? (v / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

      // Landscape A4 for wide tables so no columns are cut off.
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 32;
      const rowHeight = 18;
      const headerHeight = 22;

      // Footer page numbers are stamped at the very end once total pages are known.
      const stampTitle = (title: string, subtitle?: string) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.setTextColor(15, 23, 42);
        pdf.text(title, margin, margin + 6);
        if (subtitle) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 116, 139);
          pdf.text(subtitle, margin, margin + 22);
        }
      };

      /**
       * Draw a table across as many pages as needed.
       * columns: { header, width (pt), align }  — widths should sum to usable width.
       * rows: string[][] matching columns.
       * Returns nothing; advances the PDF cursor and adds pages.
       */
      const drawTable = (
        title: string,
        subtitle: string,
        columns: { header: string; width: number; align: "left" | "right" }[],
        rows: string[][],
        totalRow?: string[]
      ) => {
        let y = margin + 36;
        stampTitle(title, subtitle);

        const drawHeader = () => {
          pdf.setFillColor(241, 245, 249);
          pdf.rect(margin, y, columns.reduce((a, c) => a + c.width, 0), headerHeight, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(51, 65, 85);
          let x = margin;
          for (const col of columns) {
            const tx = col.align === "right" ? x + col.width - 6 : x + 6;
            pdf.text(col.header, tx, y + 15, { align: col.align });
            x += col.width;
          }
          y += headerHeight;
        };

        drawHeader();
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 41, 59);

        for (const row of rows) {
          // New page if the next row would overflow (leave room for footer).
          if (y + rowHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin + 10;
            drawHeader();
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(30, 41, 59);
          }
          let x = margin;
          pdf.setFontSize(8.5);
          for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const tx = col.align === "right" ? x + col.width - 6 : x + 6;
            // Truncate long text to the column width.
            let text = row[i] ?? "";
            const maxChars = Math.floor(col.width / 4.6);
            if (text.length > maxChars) text = text.slice(0, maxChars - 1) + "…";
            pdf.text(text, tx, y + 13, { align: col.align });
            x += col.width;
          }
          pdf.setDrawColor(226, 232, 240);
          pdf.line(margin, y + rowHeight, margin + columns.reduce((a, c) => a + c.width, 0), y + rowHeight);
          y += rowHeight;
        }

        if (totalRow) {
          if (y + rowHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin + 10;
            drawHeader();
          }
          pdf.setFillColor(226, 232, 240);
          pdf.rect(margin, y, columns.reduce((a, c) => a + c.width, 0), rowHeight, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          let x = margin;
          for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const tx = col.align === "right" ? x + col.width - 6 : x + 6;
            pdf.text(totalRow[i] ?? "", tx, y + 13, { align: col.align });
            x += col.width;
          }
          y += rowHeight;
        }
      };

      const usableWidth = pageWidth - margin * 2;

      // ── Page 1: Summary ────────────────────────────────────────────────
      stampTitle("Financial Report", `Period: ${selectedMonthsText}`);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString()}   •   Exchange Rate: 1 USD = ${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} PHP`,
        margin,
        margin + 40
      );

      const summary: [string, number][] = [
        ["Total Credit (In)", totals.credit],
        ["Total Debit (Out + Expense)", totals.debit],
        ["Remaining", remaining],
        ["Total Savings (All Time)", savingsTotal],
        ["Remaining After Savings", remaining - savingsTotal],
      ];
      let sy = margin + 70;
      pdf.setFontSize(11);
      for (const [label, val] of summary) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(51, 65, 85);
        pdf.text(label, margin, sy);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text(`PHP ${fmtPhp(val)}    (USD ${fmtUsd(val)})`, margin + 260, sy);
        sy += 22;
      }

      // ── Transactions table (ALL filtered records) ──────────────────────
      if (items.length > 0) {
        pdf.addPage();
        const txColumns = [
          { header: "Date", width: usableWidth * 0.12, align: "left" as const },
          { header: "Type", width: usableWidth * 0.12, align: "left" as const },
          { header: "Category", width: usableWidth * 0.2, align: "left" as const },
          { header: "Amount (PHP)", width: usableWidth * 0.17, align: "right" as const },
          { header: "Amount (USD)", width: usableWidth * 0.14, align: "right" as const },
          { header: "Note", width: usableWidth * 0.25, align: "left" as const },
        ];
        const txRows = items.map((t) => [
          t.date,
          t.type === "in" ? "Credit" : t.type === "out" ? "Debit" : "Expense",
          t.category || "-",
          fmtPhp(t.amount),
          fmtUsd(t.amount),
          t.note || "-",
        ]);
        const net = items.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
        const txTotal = ["Total", "", "", fmtPhp(net), fmtUsd(net), ""];
        drawTable("Transaction Breakdown", `${items.length} records • ${selectedMonthsText}`, txColumns, txRows, txTotal);
      }

      // ── Savings table (ALL filtered records) ───────────────────────────
      if (savingsItems.length > 0) {
        pdf.addPage();
        const svColumns = [
          { header: "Date", width: usableWidth * 0.15, align: "left" as const },
          { header: "Description", width: usableWidth * 0.33, align: "left" as const },
          { header: "Account", width: usableWidth * 0.22, align: "left" as const },
          { header: "Amount (PHP)", width: usableWidth * 0.15, align: "right" as const },
          { header: "Amount (USD)", width: usableWidth * 0.15, align: "right" as const },
        ];
        const svRows = savingsItems.map((s) => [
          s.date ?? "",
          s.description || "-",
          s.account || "-",
          fmtPhp(s.amount ?? 0),
          fmtUsd(s.amount ?? 0),
        ]);
        const svTotal = ["Total Savings", "", "", fmtPhp(savingsTotal), fmtUsd(savingsTotal)];
        drawTable("Savings Breakdown", `${savingsItems.length} entries • all time`, svColumns, svRows, svTotal);
      }

      // ── Page numbers on every page ─────────────────────────────────────
      const pageCount = pdf.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        pdf.setPage(p);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 14, { align: "right" });
        pdf.text("Avensetech — Financial Report", margin, pageHeight - 14);
      }

      const filename = `financial-report-${selectedMonthsText.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;
      pdf.save(filename);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      alert(`Error generating PDF: ${error?.message ?? error}. Please try again.`);
    } finally {
      setExporting(false);
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
      <CuteLoader show={exporting} message={LOADING_MESSAGES.exporting} submessage="Building your full report PDF" />
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
            <button
              className={`px-3 py-2 text-sm ${
                mode === "custom"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => {
                setMode("custom");
                setShowCustomSelector(true);
              }}
            >
              Custom
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
          {(mode === "quarterly" || mode === "yearly") && (
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
          {mode === "custom" && (
            <>
              <button
                onClick={() => setShowCustomSelector(!showCustomSelector)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
              >
                {showCustomSelector ? 'Hide' : 'Select'} Months ({selectedMonthYears.size})
              </button>
            </>
          )}
          <button
            onClick={exportPDF}
            disabled={exporting || loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Custom Month Selector */}
      {mode === "custom" && showCustomSelector && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Select Months Across Years
            </h3>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-600">Year Range:</label>
              <select
                value={customYearRange[0]}
                onChange={(e) => setCustomYearRange([Number(e.target.value), customYearRange[1]])}
                className="text-xs rounded border-slate-300 py-1"
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const y = new Date().getFullYear() + 2 - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <span className="text-slate-600">to</span>
              <select
                value={customYearRange[1]}
                onChange={(e) => setCustomYearRange([customYearRange[0], Number(e.target.value)])}
                className="text-xs rounded border-slate-300 py-1"
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const y = new Date().getFullYear() + 2 - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <span className="text-slate-400 mx-2">|</span>
              <button
                onClick={selectAllMonthsInRange}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Select All
              </button>
              <span className="text-slate-400">|</span>
              <button
                onClick={clearAllMonths}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
          
          {/* Display months grouped by year */}
          <div className="space-y-4">
            {Array.from({ length: customYearRange[1] - customYearRange[0] + 1 }).map((_, yearIndex) => {
              const year = customYearRange[1] - yearIndex; // Display newest year first
              return (
                <div key={year} className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-sm font-semibold text-slate-700 mb-2">{year}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {monthNames.map((name, monthIndex) => {
                      const monthNum = monthIndex + 1;
                      const yearMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
                      const isSelected = selectedMonthYears.has(yearMonth);
                      return (
                        <label
                          key={yearMonth}
                          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-50 text-slate-700 hover:bg-blue-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleMonthYear(yearMonth)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium">{name.slice(0, 3)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {selectedMonthYears.size === 0 && (
            <div className="mt-3 text-sm text-amber-700 bg-amber-100 border border-amber-200 rounded-md p-2">
              ⚠️ Please select at least one month to generate the report
            </div>
          )}
          {selectedMonthYears.size > 0 && (
            <div className="mt-3 text-sm text-green-700 bg-green-100 border border-green-200 rounded-md p-2">
              ✓ {selectedMonthYears.size} month(s) selected: {selectedMonthsText}
            </div>
          )}
        </div>
      )}

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
              Total Savings (All Time)
            </div>
            <div className="text-[11px] text-slate-500">
              Across all months
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
                  {txPagination.pageItems.map((transaction) => (
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
            <div className="no-print">
              <Pagination
                page={txPagination.page}
                pageSize={txPagination.pageSize}
                totalItems={txPagination.totalItems}
                totalPages={txPagination.totalPages}
                from={txPagination.from}
                to={txPagination.to}
                onPageChange={txPagination.setPage}
                onPageSizeChange={txPagination.setPageSize}
              />
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
                  All time • {savingsItems.length} entries
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
                  {savingsPagination.pageItems.map((saving, index) => (
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
            <div className="no-print">
              <Pagination
                page={savingsPagination.page}
                pageSize={savingsPagination.pageSize}
                totalItems={savingsPagination.totalItems}
                totalPages={savingsPagination.totalPages}
                from={savingsPagination.from}
                to={savingsPagination.to}
                onPageChange={savingsPagination.setPage}
                onPageSizeChange={savingsPagination.setPageSize}
              />
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
