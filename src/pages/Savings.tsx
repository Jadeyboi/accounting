import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import type { Saving, GovtRemittance, GovtAgency, GovtCategory, GovtContribNotes, ThirteenthMonthNotes, ThirteenthMonthPayment } from "@/types";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import CuteLoader from "@/components/CuteLoader";
import { backfillGovtContributions } from "@/lib/payrollGovt";
import { backfillThirteenthMonth } from "@/lib/thirteenthMonth";

const peso = (v: number) =>
  `₱${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GOVT_SOURCES = ["payroll_ec", "payroll_er"];
const HMO_SOURCES = ["payroll_hmo_company", "payroll_hmo_employee"];
const T13_SOURCES = ["payroll_13th"];
const AUTO_SOURCES = [...GOVT_SOURCES, ...HMO_SOURCES, ...T13_SOURCES];

const AGENCIES: GovtAgency[] = ["SSS", "PAGIBIG", "PHILHEALTH", "BIR"];
const AGENCY_LABEL: Record<GovtAgency, string> = {
  SSS: "SSS",
  PAGIBIG: "Pag-IBIG",
  PHILHEALTH: "PhilHealth",
  BIR: "BIR (Withholding Tax)",
};

export default function Savings() {
  const [items, setItems] = useState<Saving[]>([]);
  const [govtItems, setGovtItems] = useState<Saving[]>([]);
  const [hmoItems, setHmoItems] = useState<Saving[]>([]);
  const [hmoPaid, setHmoPaid] = useState(0);
  const [t13Items, setT13Items] = useState<Saving[]>([]);
  const [t13Payments, setT13Payments] = useState<ThirteenthMonthPayment[]>([]);
  const [remittances, setRemittances] = useState<GovtRemittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const [paidItems, setPaidItems] = useState<Saving[]>([]);

  // Mark-as-Remitted modal state
  const [remitModal, setRemitModal] = useState<{
    category: GovtCategory;
    agency: GovtAgency;
    suggested: number;
  } | null>(null);
  const [remitDate, setRemitDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [remitCoverage, setRemitCoverage] = useState<string>(new Date().toISOString().slice(0, 7));
  const [remitReference, setRemitReference] = useState<string>("");
  const [remitAmount, setRemitAmount] = useState<number | "">("");
  const [remitNotes, setRemitNotes] = useState<string>("");
  const [showRemitHistory, setShowRemitHistory] = useState(false);

  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState<string>("");
  const [amount, setAmount] = useState<number | "">("");
  const [account, setAccount] = useState<string>("");

  // For dropdown: unique accounts from savings
  const [accountMode, setAccountMode] = useState<"select" | "new">("select");
  const uniqueAccounts = Array.from(
    new Set(
      items
        .map((it) => (typeof it.account === "string" ? it.account : ""))
        .filter((a) => a && a.trim() !== "")
    )
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    
    // Load all records (don't filter by status in query to avoid errors if column doesn't exist)
    const { data, error } = await supabase
      .from("savings")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    
    if (error) {
      setError(error.message);
    } else {
      // Filter out paid items on the client side
      const allItems = (data ?? []) as Saving[];
      const active = allItems.filter((item) => !item.status || item.status === "active");
      // Separate auto government-contribution + HMO + 13th-month rows from manual savings
      setGovtItems(active.filter((it) => GOVT_SOURCES.includes(it.source ?? "manual")));
      setHmoItems(active.filter((it) => HMO_SOURCES.includes(it.source ?? "manual")));
      setT13Items(active.filter((it) => T13_SOURCES.includes(it.source ?? "manual")));
      setItems(active.filter((it) => !AUTO_SOURCES.includes(it.source ?? "manual")));
    }

    // Load govt remittance history (table may not exist yet before migration — ignore errors)
    const { data: remitData } = await supabase
      .from("govt_remittances")
      .select("*")
      .order("remitted_date", { ascending: false });
    setRemittances((remitData ?? []) as GovtRemittance[]);

    // Load HMO remittance total (to compute HMO outstanding)
    const { data: hmoRemitData } = await supabase
      .from("hmo_remittances")
      .select("amount");
    setHmoPaid((hmoRemitData ?? []).reduce((a: number, r: any) => a + (r.amount ?? 0), 0));

    // Load 13th month payments (table may not exist before migration — ignore errors)
    const { data: t13PayData } = await supabase
      .from("thirteenth_month_payments")
      .select("*")
      .order("paid_date", { ascending: false });
    setT13Payments((t13PayData ?? []) as ThirteenthMonthPayment[]);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ── 13th month: backfill + record payment ──────────────────────────────
  const [t13Backfilling, setT13Backfilling] = useState(false);
  const runT13Backfill = async () => {
    if (!confirm("Scan all payslips and create missing 13th month accrual savings?\n\nAccrual = basic earned per cutoff ÷ 12. Existing entries are updated in place, not duplicated.")) return;
    setT13Backfilling(true);
    try {
      const res = await backfillThirteenthMonth();
      await logActivity("updated", "Savings", `13th month backfill (${res.created} created, ${res.updated} updated)`);
      alert(`Done.\n\nPayslips processed: ${res.processed}\nCreated: ${res.created}\nUpdated: ${res.updated}`);
      await load();
    } catch (err) {
      alert("13th month backfill failed: " + err);
    } finally {
      setT13Backfilling(false);
    }
  };

  const [t13PayModal, setT13PayModal] = useState<{ employeeId: string; employee: string; year: number; remaining: number } | null>(null);
  const [t13PayForm, setT13PayForm] = useState({ paid_date: new Date().toISOString().slice(0, 10), amount: "" as number | "", reference: "", is_final_pay: false });

  const openT13Pay = (row: { employeeId: string; employee: string; year: number; remaining: number }) => {
    setT13PayModal(row);
    setT13PayForm({
      paid_date: new Date().toISOString().slice(0, 10),
      amount: Math.max(0, Math.round((row.remaining + Number.EPSILON) * 100) / 100),
      reference: "",
      is_final_pay: false,
    });
  };

  const submitT13Payment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!t13PayModal) return;
    if (!t13PayForm.amount || Number(t13PayForm.amount) <= 0) return alert("Enter a positive amount");
    const { error } = await supabase.from("thirteenth_month_payments").insert({
      employee_id: t13PayModal.employeeId,
      year: t13PayModal.year,
      paid_date: t13PayForm.paid_date,
      amount: Number(t13PayForm.amount),
      reference: t13PayForm.reference || null,
      is_final_pay: t13PayForm.is_final_pay,
    });
    if (error) {
      alert("Error recording payment: " + error.message + "\n\nIf the table doesn't exist, run supabase/thirteenth-month-setup.sql first.");
      return;
    }
    await logActivity("created", "Savings", `13th month payment ${peso(Number(t13PayForm.amount))} to ${t13PayModal.employee} (${t13PayModal.year})`);
    setT13PayModal(null);
    await load();
  };

  const [recalcingGovt, setRecalcingGovt] = useState(false);
  const recalcGovt = async () => {
    if (!confirm("Recalculate all government contribution set-asides from the actual payslip deduction columns (SSS, Pag-IBIG, PhilHealth, Tax)?\n\nThis replaces amounts previously derived from base salary. Manual savings are not affected.")) return;
    setRecalcingGovt(true);
    try {
      const res = await backfillGovtContributions();
      await logActivity("updated", "Savings", `Recalculated govt contributions from payslips (${res.updated} updated, ${res.created} created, ${res.removed} removed)`);
      alert(`Done. Only payrolls from Oct 1, 2026 onward are tracked.\n\nPayslips processed: ${res.processed}\nRows updated: ${res.updated}\nRows created: ${res.created}\nOld pre-Oct rows removed: ${res.removed}`);
      await load();
    } catch (err) {
      alert("Recalculation failed: " + err);
    } finally {
      setRecalcingGovt(false);
    }
  };

  const pagination = usePagination(items);

  const total = items.reduce((s, it) => s + (it.amount ?? 0), 0);

  // ── Government contributions roll-up ────────────────────────────────────
  // Accumulate per category (EC/ER) and per agency from the breakdown stored in notes.
  const accrued: Record<GovtCategory, Record<GovtAgency, number>> = {
    EC: { SSS: 0, PAGIBIG: 0, PHILHEALTH: 0, BIR: 0 },
    ER: { SSS: 0, PAGIBIG: 0, PHILHEALTH: 0, BIR: 0 },
  };
  for (const it of govtItems) {
    const cat: GovtCategory = it.source === "payroll_er" ? "ER" : "EC";
    const notes = it.notes as GovtContribNotes | null;
    const b = notes?.breakdown ?? {};
    accrued[cat].SSS += b.sss ?? 0;
    accrued[cat].PAGIBIG += b.pagibig ?? 0;
    accrued[cat].PHILHEALTH += b.philhealth ?? 0;
    accrued[cat].BIR += b.tax ?? 0;
  }

  // Remitted totals per category/agency
  const remitted: Record<GovtCategory, Record<GovtAgency, number>> = {
    EC: { SSS: 0, PAGIBIG: 0, PHILHEALTH: 0, BIR: 0 },
    ER: { SSS: 0, PAGIBIG: 0, PHILHEALTH: 0, BIR: 0 },
  };
  for (const r of remittances) {
    if (remitted[r.category] && remitted[r.category][r.agency] !== undefined) {
      remitted[r.category][r.agency] += r.amount ?? 0;
    }
  }

  const catTotal = (m: Record<GovtAgency, number>) =>
    AGENCIES.reduce((s, a) => s + (m[a] ?? 0), 0);

  const govtAccruedTotal = catTotal(accrued.EC) + catTotal(accrued.ER);

  // ── HMO roll-up ─────────────────────────────────────────────────────────
  const hmoCompany = hmoItems
    .filter((it) => it.source === "payroll_hmo_company")
    .reduce((a, it) => a + (it.amount ?? 0), 0);
  const hmoEmployee = hmoItems
    .filter((it) => it.source === "payroll_hmo_employee")
    .reduce((a, it) => a + (it.amount ?? 0), 0);
  const hmoReserved = hmoCompany + hmoEmployee;
  const hmoRemaining = hmoReserved - hmoPaid;

  // ── 13th Month roll-up ──────────────────────────────────────────────────
  const t13Reserved = t13Items.reduce((a, it) => a + (it.amount ?? 0), 0);
  const t13Paid = t13Payments.reduce((a, p) => a + (p.amount ?? 0), 0);
  const t13Available = t13Reserved - t13Paid;

  // Per-employee + per-year breakdown of accrual (entitlement) and payments.
  interface T13Row {
    employeeId: string;
    employee: string;
    year: number;
    accrued: number;  // entitlement earned (sum of accruals)
    paid: number;     // amount already paid
    remaining: number;
  }
  const t13Breakdown: T13Row[] = (() => {
    const map = new Map<string, T13Row>();
    for (const it of t13Items) {
      const n = (it.notes as ThirteenthMonthNotes) ?? null;
      const empId = n?.employee_id ?? "unknown";
      const year = n?.year ?? new Date(it.date).getFullYear();
      const key = `${empId}::${year}`;
      if (!map.has(key)) {
        map.set(key, { employeeId: empId, employee: n?.employee ?? "Unknown", year, accrued: 0, paid: 0, remaining: 0 });
      }
      map.get(key)!.accrued += it.amount ?? 0;
    }
    for (const p of t13Payments) {
      const key = `${p.employee_id}::${p.year}`;
      if (!map.has(key)) {
        map.set(key, { employeeId: p.employee_id, employee: "Unknown", year: p.year, accrued: 0, paid: 0, remaining: 0 });
      }
      map.get(key)!.paid += p.amount ?? 0;
    }
    const rows = Array.from(map.values());
    for (const r of rows) r.remaining = Math.round((r.accrued - r.paid + Number.EPSILON) * 100) / 100;
    return rows.sort((a, b) => b.year - a.year || a.employee.localeCompare(b.employee));
  })();

  const overallTotal = total + govtAccruedTotal + hmoReserved + t13Reserved;

  const openRemitModal = (category: GovtCategory, agency: GovtAgency) => {
    const remaining = (accrued[category][agency] ?? 0) - (remitted[category][agency] ?? 0);
    const suggested = Math.max(0, Math.round((remaining + Number.EPSILON) * 100) / 100);
    setRemitModal({ category, agency, suggested });
    setRemitAmount(suggested);
    setRemitDate(new Date().toISOString().slice(0, 10));
    setRemitCoverage(new Date().toISOString().slice(0, 7));
    setRemitReference("");
    setRemitNotes("");
  };

  const submitRemittance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitModal) return;
    if (!remitAmount || Number(remitAmount) <= 0) return alert("Enter a positive amount");

    const { error } = await supabase.from("govt_remittances").insert({
      category: remitModal.category,
      agency: remitModal.agency,
      coverage_month: remitCoverage,
      remitted_date: remitDate,
      reference: remitReference || null,
      amount: Number(remitAmount),
      notes: remitNotes || null,
    });
    if (error) {
      alert(
        "Error recording remittance: " +
          error.message +
          "\n\nIf the table does not exist, run supabase/govt-contributions-setup.sql first."
      );
      return;
    }
    await logActivity(
      "created",
      "Savings",
      `Remitted ${remitModal.category} ${AGENCY_LABEL[remitModal.agency]} ${peso(Number(remitAmount))} (coverage ${remitCoverage})`
    );
    setRemitModal(null);
    await load();
  };

  const deleteRemittance = async (id: string) => {
    if (!confirm("Delete this remittance record? The amount will be added back to the remaining balance.")) return;
    const { error } = await supabase.from("govt_remittances").delete().eq("id", id);
    if (error) return alert(error.message);
    await load();
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert("Enter a positive amount");
    
    const payload: any = {
      date,
      description: description || null,
      amount: Number(amount),
      account: account || null,
    };
    
    // Only add status if we know the column exists (after migration)
    // This prevents errors before migration is run
    
    const { data, error } = await supabase
      .from("savings")
      .insert([payload])
      .select();
    if (error) return alert(error.message);
    await logActivity('created', 'Savings', `Added saving: ${description || 'No description'} — ₱${Number(amount).toLocaleString()}`)
    setDescription("");
    setAmount("");
    setAccount("");
    setAccountMode("select");
    await load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this saving entry?")) return;
    const item = items.find(i => i.id === id);
    const { error } = await supabase.from("savings").delete().eq("id", id);
    if (error) return alert(error.message);
    await logActivity('deleted', 'Savings', `Deleted saving: ${item?.description || 'No description'} — ₱${item?.amount?.toLocaleString() ?? '0'}`)
    await load();
  };

  const onMarkAsPaid = async (id: string) => {
    if (!confirm("Mark this saving as paid? This will create an expense transaction and remove it from the active list.")) return;
    
    try {
      // Get the saving details first
      const saving = items.find(item => item.id === id);
      if (!saving) {
        alert("Saving not found");
        return;
      }

      // Validate amount before creating transaction
      if (!saving.amount || saving.amount <= 0) {
        alert("Invalid saving amount. Cannot create transaction.");
        return;
      }

      // Create an expense transaction for the paid saving
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          date: new Date().toISOString().split('T')[0], // Today's date
          type: "expense",
          amount: Number(saving.amount), // Ensure it's a number
          category: "Savings Payment",
          note: `Paid: ${saving.description || 'Savings'} ${saving.account ? `(${saving.account})` : ''}`
        });

      if (transactionError) {
        alert("Error creating transaction: " + transactionError.message);
        return;
      }

      // Mark the saving as paid
      const { error } = await supabase
        .from("savings")
        .update({ status: "paid" })
        .eq("id", id);
      
      if (error) {
        // If error (likely because status column doesn't exist), show helpful message
        alert("Please run the database migration first. Go to Supabase SQL Editor and run the script in supabase/add-savings-status.sql");
        return;
      }
      
      await load();
      alert("Saving marked as paid and expense transaction created!");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const loadPaidHistory = async () => {
    const { data, error } = await supabase
      .from("savings")
      .select("*")
      .eq("status", "paid")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    
    if (error) {
      alert("Error loading paid history: " + error.message);
      return;
    }
    
    setPaidItems((data ?? []) as Saving[]);
    setShowPaidHistory(true);
  };

  const restoreSaving = async (id: string) => {
    if (!confirm("Restore this saving back to active list? Note: The expense transaction will remain in your records.")) return;
    
    try {
      const { error } = await supabase
        .from("savings")
        .update({ status: "active" })
        .eq("id", id);
      
      if (error) {
        alert("Error restoring saving: " + error.message);
        return;
      }
      
      await loadPaidHistory();
      await load();
      alert("Saving restored to active list!");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    date: string;
    description: string;
    amount: number | "";
    account: string;
    accountMode: "select" | "new";
  }>({
    date: "",
    description: "",
    amount: "",
    account: "",
    accountMode: "select",
  });

  const startEdit = (item: Saving) => {
    setEditId(item.id);
    setEditFields({
      date: item.date,
      description: item.description ?? "",
      amount: item.amount,
      account: item.account ?? "",
      accountMode: "select",
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFields({
      date: "",
      description: "",
      amount: "",
      account: "",
      accountMode: "select",
    });
  };

  const saveEdit = async () => {
    if (!editFields.amount || Number(editFields.amount) <= 0)
      return alert("Enter a positive amount");
    const { error } = await supabase
      .from("savings")
      .update({
        date: editFields.date,
        description: editFields.description || null,
        amount: Number(editFields.amount),
        account: editFields.account || null,
      })
      .eq("id", editId!);
    if (error) return alert(error.message);
    await logActivity('updated', 'Savings', `Updated saving: ${editFields.description || 'No description'} — ₱${Number(editFields.amount).toLocaleString()}`)
    cancelEdit();
    await load();
  };

  return (
    <div className="space-y-6">

      <CuteLoader
        show={recalcingGovt}
        message="Recalculating contributions"
        submessage="Reading each payslip and updating the reserve"
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="page-heading">Savings</h2>
          <p className="page-subheading">Record amounts saved and track totals.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadPaidHistory} className="btn-secondary">
            View Paid History
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total saved</p>
            <p className="text-xl font-bold tabular-nums text-gray-900">
              {peso(overallTotal)}
            </p>
            {(govtAccruedTotal > 0 || hmoReserved > 0 || t13Reserved > 0) && (
              <p className="mt-0.5 text-[11px] text-gray-400">
                Manual {peso(total)} · Govt {peso(govtAccruedTotal)} · HMO {peso(hmoReserved)} · 13th {peso(t13Reserved)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Government Contributions set-aside ───────────────────────────── */}
      <div className="panel p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Government Contributions &amp; Withholding Tax</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Auto set aside each payroll. EC = employee share (SSS, Pag-IBIG, PhilHealth, Tax). ER = employer share. Intended remittance: by the 16th of the following month.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={recalcGovt} disabled={recalcingGovt} className="btn-secondary disabled:opacity-50">
              {recalcingGovt ? "Recalculating…" : "Recalculate from Payslips"}
            </button>
            <button type="button" onClick={() => setShowRemitHistory(true)} className="btn-secondary">
              Remittance History
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {(["EC", "ER"] as GovtCategory[]).map((cat) => {
            const accruedTotal = catTotal(accrued[cat]);
            const remittedTotal = catTotal(remitted[cat]);
            const remaining = accruedTotal - remittedTotal;
            return (
              <div key={cat} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {cat === "EC" ? "Employee Contributions (EC)" : "Employer Contributions (ER)"}
                  </h4>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat === "EC" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {cat}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Accrued</p>
                    <p className="text-sm font-bold tabular-nums text-gray-900">{peso(accruedTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Remitted</p>
                    <p className="text-sm font-bold tabular-nums text-emerald-600">{peso(remittedTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Remaining</p>
                    <p className="text-sm font-bold tabular-nums text-amber-600">{peso(remaining)}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Agency</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Accrued</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Remaining</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {AGENCIES.filter((a) => !(cat === "ER" && a === "BIR")).map((a) => {
                        const acc = accrued[cat][a] ?? 0;
                        const rem = remitted[cat][a] ?? 0;
                        const left = acc - rem;
                        return (
                          <tr key={a}>
                            <td className="px-3 py-2 text-gray-700">{AGENCY_LABEL[a]}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">{peso(acc)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">{peso(left)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                disabled={left <= 0.005}
                                onClick={() => openRemitModal(cat, a)}
                                className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Mark Remitted
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── HMO Savings ────────────────────────────────────────────────── */}
      {hmoReserved > 0 && (
        <div className="panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">HMO</h3>
          <p className="mb-3 text-xs text-gray-400">
            Company-funded + employee-deducted premiums set aside each payroll. Manage enrollments on the HMO page.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-blue-600">Company Reserved</p>
              <p className="text-sm font-bold tabular-nums text-blue-900">{peso(hmoCompany)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-amber-600">Employee Collected</p>
              <p className="text-sm font-bold tabular-nums text-amber-900">{peso(hmoEmployee)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-emerald-600">Total Reserved</p>
              <p className="text-sm font-bold tabular-nums text-emerald-900">{peso(hmoReserved)}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Paid / Remaining</p>
              <p className="text-sm font-bold tabular-nums text-gray-900">{peso(hmoPaid)} / {peso(hmoRemaining)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 13th Month Pay ─────────────────────────────────────────────── */}
      <div className="panel p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">13th Month Pay</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Company-funded reserve. Accrual = basic earned per cutoff ÷ 12. Not deducted from employees.
            </p>
          </div>
          <button type="button" onClick={runT13Backfill} disabled={t13Backfilling} className="btn-secondary shrink-0 disabled:opacity-50">
            {t13Backfilling ? "Recalculating…" : "Recalculate from Payslips"}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-blue-600">Accrued (Entitlement)</p>
            <p className="text-sm font-bold tabular-nums text-blue-900">{peso(t13Reserved)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-emerald-600">Reserved in Savings</p>
            <p className="text-sm font-bold tabular-nums text-emerald-900">{peso(t13Reserved)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-amber-600">Paid</p>
            <p className="text-sm font-bold tabular-nums text-amber-900">{peso(t13Paid)}</p>
          </div>
          <div className="rounded-lg bg-white border border-gray-200 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Available Balance</p>
            <p className="text-sm font-bold tabular-nums text-gray-900">{peso(t13Available)}</p>
          </div>
        </div>

        {t13Breakdown.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">
            No 13th month accruals yet. Finalize payroll or click "Recalculate from Payslips".
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Employee</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Year</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Accrued</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Paid</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Remaining</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {t13Breakdown.map((r) => (
                  <tr key={`${r.employeeId}-${r.year}`}>
                    <td className="px-3 py-2 text-gray-800">{r.employee}</td>
                    <td className="px-3 py-2 text-gray-600">{r.year}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{peso(r.accrued)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{peso(r.paid)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-600">{peso(r.remaining)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={r.remaining <= 0.005}
                        onClick={() => openT13Pay(r)}
                        className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{peso(t13Breakdown.reduce((a, r) => a + r.accrued, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{peso(t13Breakdown.reduce((a, r) => a + r.paid, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">{peso(t13Breakdown.reduce((a, r) => a + r.remaining, 0))}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Add form ────────────────────────────────────────────────────── */}
      <form onSubmit={onCreate} className="panel p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Add Saving Entry</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="e.g. Emergency fund" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Amount</label>
            <input
              type="number" step="0.01"
              value={amount as any}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="input-field" placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Account</label>
            {accountMode === "select" ? (
              <select
                value={account}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setAccountMode("new"); setAccount(""); }
                  else setAccount(e.target.value);
                }}
                className="input-field"
              >
                <option value="">Select account…</option>
                {uniqueAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="__new__">+ Add new account…</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={account} onChange={(e) => setAccount(e.target.value)} className="input-field" placeholder="New account name" />
                <button type="button" className="btn-secondary shrink-0" onClick={() => setAccountMode("select")}>✕</button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <button type="submit" className="btn-primary">Save Entry</button>
        </div>
      </form>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="table-container">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Description</th>
              <th className="th-right">Amount</th>
              <th className="th">Account</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            )}
            {error && !loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-red-500">{error}</td></tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No savings recorded yet.</td></tr>
            )}
            {!loading && !error && pagination.pageItems.map((it) => (
              <tr key={it.id} className="table-row-hover">
                {editId === it.id ? (
                  <>
                    <td className="td">
                      <input type="date" value={editFields.date} onChange={(e) => setEditFields((f) => ({ ...f, date: e.target.value }))} className="input-field" />
                    </td>
                    <td className="td">
                      <input type="text" value={editFields.description} onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} className="input-field" />
                    </td>
                    <td className="td">
                      <input type="number" step="0.01" value={editFields.amount as any} onChange={(e) => setEditFields((f) => ({ ...f, amount: e.target.value === "" ? "" : Number(e.target.value) }))} className="input-field text-right" />
                    </td>
                    <td className="td">
                      {editFields.accountMode === "select" ? (
                        <select value={editFields.account} onChange={(e) => { if (e.target.value === "__new__") setEditFields((f) => ({ ...f, accountMode: "new", account: "" })); else setEditFields((f) => ({ ...f, account: e.target.value })); }} className="input-field">
                          <option value="">Select account…</option>
                          {uniqueAccounts.map((a) => <option key={a} value={a}>{a}</option>)}
                          <option value="__new__">+ Add new…</option>
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input type="text" value={editFields.account} onChange={(e) => setEditFields((f) => ({ ...f, account: e.target.value }))} className="input-field" placeholder="New account" />
                          <button type="button" className="btn-secondary shrink-0" onClick={() => setEditFields((f) => ({ ...f, accountMode: "select" }))}>✕</button>
                        </div>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button type="button" className="btn-primary" onClick={saveEdit}>Save</button>
                        <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="td whitespace-nowrap">{it.date}</td>
                    <td className="td">{it.description ?? ""}</td>
                    <td className="td-right">₱{it.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="td">{it.account ?? ""}</td>
                    <td className="td">
                      <div className="flex gap-2">
                        <button type="button" className="btn-success" onClick={() => onMarkAsPaid(it.id)}>Paid</button>
                        <button type="button" className="btn-secondary" onClick={() => startEdit(it)}>Edit</button>
                        <button type="button" className="btn-danger" onClick={() => onDelete(it.id)}>Delete</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={pagination.page} pageSize={pagination.pageSize}
          totalItems={pagination.totalItems} totalPages={pagination.totalPages}
          from={pagination.from} to={pagination.to}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* ── Mark as Remitted Modal ───────────────────────────────────────── */}
      {remitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submitRemittance} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                Mark Remitted · {remitModal.category} {AGENCY_LABEL[remitModal.agency]}
              </h3>
              <button type="button" onClick={() => setRemitModal(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Remaining balance for this agency: <span className="font-semibold">{peso(remitModal.suggested)}</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Remittance Date</label>
                  <input type="date" value={remitDate} onChange={(e) => setRemitDate(e.target.value)} className="input-field" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Coverage Month</label>
                  <input type="month" value={remitCoverage} onChange={(e) => setRemitCoverage(e.target.value)} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Amount Remitted</label>
                <input
                  type="number" step="0.01"
                  value={remitAmount as any}
                  onChange={(e) => setRemitAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input-field" placeholder="0.00" required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Reference No. (optional)</label>
                <input type="text" value={remitReference} onChange={(e) => setRemitReference(e.target.value)} className="input-field" placeholder="e.g. PRN / OR number" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Notes (optional)</label>
                <input type="text" value={remitNotes} onChange={(e) => setRemitNotes(e.target.value)} className="input-field" placeholder="Remarks" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button type="button" onClick={() => setRemitModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Record Remittance</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Remittance History Modal ─────────────────────────────────────── */}
      {showRemitHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Remittance History</h3>
              <button onClick={() => setShowRemitHistory(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {remittances.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No remittances recorded yet.</p>
              ) : (
                <div className="table-container">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="th">Date</th>
                        <th className="th">Category</th>
                        <th className="th">Agency</th>
                        <th className="th">Coverage</th>
                        <th className="th">Reference</th>
                        <th className="th-right">Amount</th>
                        <th className="th">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {remittances.map((r) => (
                        <tr key={r.id} className="table-row-hover">
                          <td className="td whitespace-nowrap">{r.remitted_date}</td>
                          <td className="td">{r.category}</td>
                          <td className="td">{AGENCY_LABEL[r.agency] ?? r.agency}</td>
                          <td className="td">{r.coverage_month}</td>
                          <td className="td">{r.reference ?? ""}</td>
                          <td className="td-right">{peso(r.amount)}</td>
                          <td className="td">
                            <button type="button" className="btn-danger" onClick={() => deleteRemittance(r.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowRemitHistory(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record 13th Month Payment Modal ──────────────────────────────── */}
      {t13PayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submitT13Payment} className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Record 13th Month Payment</h3>
              <button type="button" onClick={() => setT13PayModal(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t13PayModal.employee} · {t13PayModal.year} — unpaid balance <b>{peso(t13PayModal.remaining)}</b>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Payment Date</label>
                  <input type="date" value={t13PayForm.paid_date} onChange={(e) => setT13PayForm((f) => ({ ...f, paid_date: e.target.value }))} className="input-field" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Amount Paid</label>
                  <input type="number" step="0.01" value={t13PayForm.amount as any} onChange={(e) => setT13PayForm((f) => ({ ...f, amount: e.target.value === "" ? "" : Number(e.target.value) }))} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Reference (optional)</label>
                <input type="text" value={t13PayForm.reference} onChange={(e) => setT13PayForm((f) => ({ ...f, reference: e.target.value }))} className="input-field" placeholder="OR / voucher number" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={t13PayForm.is_final_pay} onChange={(e) => setT13PayForm((f) => ({ ...f, is_final_pay: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Final-pay settlement
              </label>
              <p className="text-[11px] text-gray-400">Supports partial payments. Records reduce the employee's unpaid balance and the Savings balance.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button type="button" onClick={() => setT13PayModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Record Payment</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Paid History Modal ───────────────────────────────────────────── */}
      {showPaidHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Paid Savings History</h3>
              <button onClick={() => setShowPaidHistory(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {paidItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No paid savings records yet.</p>
              ) : (
                <div className="table-container">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="th">Date</th>
                        <th className="th">Description</th>
                        <th className="th-right">Amount</th>
                        <th className="th">Account</th>
                        <th className="th">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {paidItems.map((it) => (
                        <tr key={it.id} className="table-row-hover">
                          <td className="td whitespace-nowrap">{it.date}</td>
                          <td className="td">{it.description ?? ""}</td>
                          <td className="td-right">₱{it.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="td">{it.account ?? ""}</td>
                          <td className="td">
                            <button type="button" className="btn-secondary" onClick={() => restoreSaving(it.id)}>Restore</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowPaidHistory(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
