import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import type {
  Employee, HmoEnrollment, HmoDependent, HmoBill, HmoRemittance,
  HmoBillingCycle, HmoCoverageType, Saving,
} from "@/types";
import {
  toMonthly, toQuarterly, backfillHmoSavings,
  HMO_PROVIDER, HMO_PLAN_QUARTERLY, PRINCIPAL_DEFAULT_PLAN, DEPENDENT_DEFAULT_PLAN,
  type HmoPlan,
} from "@/lib/hmo";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";
import CuteLoader from "@/components/CuteLoader";
import ModalPortal from "@/components/ModalPortal";

const peso = (v: number) =>
  `₱${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

type Tab = "enrollments" | "calculator" | "reserve" | "bills";

// ─── Form-level dependent row (local state) ──────────────────────────────
interface FormDep {
  id?: string; // set when editing an existing dependent
  name: string;
  relationship: string;
  plan: HmoPlan;
  premium: number; // quarterly
  coverage_start: string;
  coverage_end: string;
  effective_date: string;
  isCompanyCovered: boolean;
}

const blankDep = (): FormDep => ({
  name: "", relationship: "", plan: DEPENDENT_DEFAULT_PLAN,
  premium: HMO_PLAN_QUARTERLY[DEPENDENT_DEFAULT_PLAN],
  coverage_start: "", coverage_end: "", effective_date: today(),
  isCompanyCovered: false,
});

export default function HMO() {
  const [tab, setTab] = useState<Tab>("enrollments");
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [enrollments, setEnrollments] = useState<HmoEnrollment[]>([]);
  const [dependents, setDependents] = useState<HmoDependent[]>([]);
  const [bills, setBills] = useState<HmoBill[]>([]);
  const [remittances, setRemittances] = useState<HmoRemittance[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [emp, enr, dep, bil, rem, sav] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("hmo_enrollments").select("*").eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("hmo_dependents").select("*").eq("status", "active"),
      supabase.from("hmo_bills").select("*").order("due_date", { ascending: false }),
      supabase.from("hmo_remittances").select("*").order("paid_date", { ascending: false }),
      supabase.from("savings").select("*").eq("account", "HMO"),
    ]);
    if (emp.error) setError(emp.error.message);
    setAllEmployees((emp.data ?? []) as Employee[]);
    setEnrollments((enr.data ?? []) as HmoEnrollment[]);
    setDependents((dep.data ?? []) as HmoDependent[]);
    setBills((bil.data ?? []) as HmoBill[]);
    setRemittances((rem.data ?? []) as HmoRemittance[]);
    setSavings((sav.data ?? []) as Saving[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Active employees only (not terminated/resigned/separated) for new enrollments
  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => !e.status || e.status === "active" || e.status === "probationary" || e.status === "regular"),
    [allEmployees]
  );

  const empName = (id: string) => allEmployees.find((e) => e.id === id)?.name ?? "Unknown";
  const depsFor = (enrollmentId: string) => dependents.filter((d) => d.enrollment_id === enrollmentId);

  // ── Per-employee HMO breakdown (monthly) ───────────────────────────────
  interface Row {
    enrollment: HmoEnrollment;
    principalMonthly: number;
    companyDepMonthly: number;
    employeeDepMonthly: number;
    companyMonthly: number;
    employeeMonthly: number;
    totalMonthly: number;
  }
  const rows: Row[] = useMemo(() => {
    return enrollments.map((enr) => {
      const principalMonthly = toMonthly(enr.principal_premium, enr.billing_cycle);
      let companyDepMonthly = 0;
      let employeeDepMonthly = 0;
      for (const d of depsFor(enr.id)) {
        const m = toMonthly(d.premium, d.billing_cycle);
        if (d.coverage_type === "company") companyDepMonthly += m;
        else employeeDepMonthly += m;
      }
      const companyMonthly = principalMonthly + companyDepMonthly;
      const employeeMonthly = employeeDepMonthly;
      return {
        enrollment: enr,
        principalMonthly,
        companyDepMonthly,
        employeeDepMonthly,
        companyMonthly,
        employeeMonthly,
        totalMonthly: companyMonthly + employeeMonthly,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, dependents]);

  const grand = useMemo(() => {
    return rows.reduce(
      (a, r) => ({
        principal: a.principal + r.principalMonthly,
        companyDep: a.companyDep + r.companyDepMonthly,
        employeeDep: a.employeeDep + r.employeeDepMonthly,
        company: a.company + r.companyMonthly,
        employee: a.employee + r.employeeMonthly,
        total: a.total + r.totalMonthly,
      }),
      { principal: 0, companyDep: 0, employeeDep: 0, company: 0, employee: 0, total: 0 }
    );
  }, [rows]);

  // ── Savings balances ───────────────────────────────────────────────────
  const companyReserved = savings.filter((s) => s.source === "payroll_hmo_company").reduce((a, s) => a + (s.amount ?? 0), 0);
  const employeeCollected = savings.filter((s) => s.source === "payroll_hmo_employee").reduce((a, s) => a + (s.amount ?? 0), 0);
  const totalReserved = companyReserved + employeeCollected;
  const totalPaid = remittances.reduce((a, r) => a + (r.amount ?? 0), 0);
  const outstanding = totalReserved - totalPaid;

  const [backfilling, setBackfilling] = useState(false);
  const runBackfill = async () => {
    if (!confirm("Scan all finalized payslips and create missing HMO savings entries?\n\nThis will backfill company allocations and employee deductions that weren't saved at payroll time. Existing entries are not duplicated.")) return;
    setBackfilling(true);
    try {
      const result = await backfillHmoSavings();
      alert(`Backfill complete.\n\nPayslips scanned: ${result.processed}\nNew savings entries created: ${result.created}`);
      await load();
    } catch (err) {
      alert("Backfill failed: " + err);
    } finally {
      setBackfilling(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Combined enrollment form (principal + dependents) ─────────────────
  // ═══════════════════════════════════════════════════════════════════════
  const [showForm, setShowForm] = useState(false);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);

  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formPlan, setFormPlan] = useState<HmoPlan>(PRINCIPAL_DEFAULT_PLAN);
  const [formPremium, setFormPremium] = useState(HMO_PLAN_QUARTERLY[PRINCIPAL_DEFAULT_PLAN]);
  const [formCoverageStart, setFormCoverageStart] = useState("");
  const [formCoverageEnd, setFormCoverageEnd] = useState("");
  const [formEffectiveDate, setFormEffectiveDate] = useState(today());
  const [formProration, setFormProration] = useState<"none" | "daily" | "monthly">("none");
  const [formNotes, setFormNotes] = useState("");
  const [formDeps, setFormDeps] = useState<FormDep[]>([]);

  // Live calculation from form state
  const formCalc = useMemo(() => {
    const principalQtr = Number(formPremium) || 0;
    const principalMo = r2(principalQtr / 3);

    let companyDepQtr = 0;
    let employeeDepQtr = 0;
    for (const d of formDeps) {
      const q = Number(d.premium) || 0;
      if (d.isCompanyCovered) companyDepQtr += q;
      else employeeDepQtr += q;
    }
    companyDepQtr = r2(companyDepQtr);
    employeeDepQtr = r2(employeeDepQtr);

    const companyQtr = r2(principalQtr + companyDepQtr);
    const companyMo = r2(companyQtr / 3);
    const employeeQtr = employeeDepQtr;
    const employeeMo = r2(employeeQtr / 3);
    const totalQtr = r2(companyQtr + employeeQtr);
    const totalMo = r2(totalQtr / 3);
    const totalDepQtr = r2(companyDepQtr + employeeDepQtr);

    return { principalQtr, principalMo, totalDepQtr, companyQtr, companyMo, employeeQtr, employeeMo, totalQtr, totalMo };
  }, [formPremium, formDeps]);

  const openNew = () => {
    setEditingEnrollmentId(null);
    setFormEmployeeId("");
    setFormPlan(PRINCIPAL_DEFAULT_PLAN);
    setFormPremium(HMO_PLAN_QUARTERLY[PRINCIPAL_DEFAULT_PLAN]);
    setFormCoverageStart(""); setFormCoverageEnd("");
    setFormEffectiveDate(today());
    setFormProration("none"); setFormNotes("");
    setFormDeps([]);
    setShowForm(true);
  };

  const openEdit = (enr: HmoEnrollment) => {
    setEditingEnrollmentId(enr.id);
    setFormEmployeeId(enr.employee_id);
    // Determine plan from premium (reverse-map)
    const plan = Object.entries(HMO_PLAN_QUARTERLY).find(([, v]) => v === enr.principal_premium)?.[0] as HmoPlan | undefined;
    setFormPlan(plan ?? PRINCIPAL_DEFAULT_PLAN);
    setFormPremium(enr.principal_premium);
    setFormCoverageStart(enr.coverage_start ?? "");
    setFormCoverageEnd(enr.coverage_end ?? "");
    setFormEffectiveDate(enr.effective_date);
    setFormProration(enr.proration as any);
    setFormNotes(enr.notes ?? "");
    // Load existing dependents into the form
    const eDeps = depsFor(enr.id);
    setFormDeps(
      eDeps.map((d) => ({
        id: d.id,
        name: d.name,
        relationship: d.relationship ?? "",
        plan: (Object.entries(HMO_PLAN_QUARTERLY).find(([, v]) => v === d.premium)?.[0] ?? DEPENDENT_DEFAULT_PLAN) as HmoPlan,
        premium: d.premium,
        coverage_start: d.coverage_start ?? "",
        coverage_end: d.coverage_end ?? "",
        effective_date: d.effective_date,
        isCompanyCovered: d.coverage_type === "company",
      }))
    );
    setShowForm(true);
  };

  const addDep = () => setFormDeps((prev) => [...prev, blankDep()]);
  const removeDep = (i: number) => setFormDeps((prev) => prev.filter((_, j) => j !== i));

  const updateDep = (i: number, patch: Partial<FormDep>) => {
    setFormDeps((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  };

  /** When a dependent is set as company-covered, unset all others. */
  const setCompanyCoveredDep = (i: number) => {
    setFormDeps((prev) => prev.map((d, j) => ({ ...d, isCompanyCovered: j === i })));
  };

  /** When plan changes, auto-fill premium. */
  const handlePlanChange = (plan: HmoPlan) => {
    setFormPlan(plan);
    setFormPremium(HMO_PLAN_QUARTERLY[plan]);
  };

  const handleDepPlanChange = (i: number, plan: HmoPlan) => {
    updateDep(i, { plan, premium: HMO_PLAN_QUARTERLY[plan] });
  };

  // ── Save enrollment + all dependents in one go ─────────────────────────
  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId) return alert("Select an employee");

    // Enforce max 1 company-covered dependent
    const companyCoveredCount = formDeps.filter((d) => d.isCompanyCovered).length;
    if (companyCoveredCount > 1) return alert("Only one dependent can be company-covered.");

    // Principal payload
    const enrPayload: any = {
      employee_id: formEmployeeId,
      provider: HMO_PROVIDER,
      plan: formPlan,
      principal_premium: Number(formPremium) || 0,
      billing_cycle: "quarterly" as HmoBillingCycle,
      coverage_start: formCoverageStart || null,
      coverage_end: formCoverageEnd || null,
      effective_date: formEffectiveDate,
      proration: formProration,
      notes: formNotes || null,
      status: "active",
    };

    let enrollmentId: string;

    if (editingEnrollmentId) {
      // Update principal
      const { error } = await supabase.from("hmo_enrollments").update(enrPayload).eq("id", editingEnrollmentId);
      if (error) return alert(error.message);
      enrollmentId = editingEnrollmentId;
      await logActivity("updated", "HMO", `Updated HMO enrollment for ${empName(formEmployeeId)}`);
    } else {
      const { data, error } = await supabase.from("hmo_enrollments").insert(enrPayload).select("id").single();
      if (error) return alert(error.message);
      enrollmentId = data.id;
      await logActivity("created", "HMO", `Enrolled ${empName(formEmployeeId)} in HMO (${HMO_PROVIDER} ${formPlan})`);
    }

    // ── Sync dependents (upsert existing, insert new, soft-delete removed) ──
    const existingDeps = depsFor(enrollmentId);
    const formDepIds = formDeps.filter((d) => d.id).map((d) => d.id!);
    // Soft-delete removed dependents
    for (const ed of existingDeps) {
      if (!formDepIds.includes(ed.id)) {
        await supabase.from("hmo_dependents").update({ status: "ended", coverage_end: today() }).eq("id", ed.id);
      }
    }
    // Upsert dependents
    for (const d of formDeps) {
      if (!d.name.trim()) continue;
      const depPayload: any = {
        enrollment_id: enrollmentId,
        name: d.name.trim(),
        relationship: d.relationship || null,
        premium: Number(d.premium) || 0,
        billing_cycle: "quarterly" as HmoBillingCycle,
        coverage_type: (d.isCompanyCovered ? "company" : "employee") as HmoCoverageType,
        coverage_start: d.coverage_start || null,
        coverage_end: d.coverage_end || null,
        effective_date: d.effective_date,
        status: "active",
      };
      if (d.id) {
        await supabase.from("hmo_dependents").update(depPayload).eq("id", d.id);
      } else {
        await supabase.from("hmo_dependents").insert(depPayload);
      }
    }

    setShowForm(false);
    await load();
  };

  const endEnrollment = async (enr: HmoEnrollment) => {
    if (!confirm(`End HMO enrollment for ${empName(enr.employee_id)}? Historical records are preserved.`)) return;
    await supabase.from("hmo_enrollments").update({ status: "ended", coverage_end: today() }).eq("id", enr.id);
    // Soft-end all dependents
    for (const d of depsFor(enr.id)) {
      await supabase.from("hmo_dependents").update({ status: "ended", coverage_end: today() }).eq("id", d.id);
    }
    await logActivity("deleted", "HMO", `Ended HMO enrollment for ${empName(enr.employee_id)}`);
    await load();
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Bills / Mark as Paid ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  const [showBillModal, setShowBillModal] = useState(false);
  const [billForm, setBillForm] = useState({
    provider: HMO_PROVIDER, invoice_number: "", coverage_start: "", coverage_end: "",
    due_date: "", amount_due: "" as number | "", notes: "",
  });

  const saveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("hmo_bills").insert({
      provider: HMO_PROVIDER,
      invoice_number: billForm.invoice_number || null,
      coverage_start: billForm.coverage_start || null,
      coverage_end: billForm.coverage_end || null,
      due_date: billForm.due_date || null,
      amount_due: Number(billForm.amount_due) || 0,
      notes: billForm.notes || null,
    });
    if (error) return alert(error.message);
    await logActivity("created", "HMO", `Recorded HMO bill ${billForm.invoice_number || ""} (${peso(Number(billForm.amount_due) || 0)})`);
    setShowBillModal(false);
    setBillForm({ provider: HMO_PROVIDER, invoice_number: "", coverage_start: "", coverage_end: "", due_date: "", amount_due: "", notes: "" });
    await load();
  };

  const [payModal, setPayModal] = useState<HmoBill | null>(null);
  const [payForm, setPayForm] = useState({ paid_date: today(), amount: "" as number | "", reference: "", notes: "" });

  const paidForBill = (billId: string) =>
    remittances.filter((r) => r.bill_id === billId).reduce((a, r) => a + (r.amount ?? 0), 0);

  const openPay = (bill: HmoBill) => {
    setPayModal(bill);
    const remaining = Math.max(0, (bill.amount_due ?? 0) - paidForBill(bill.id));
    setPayForm({ paid_date: today(), amount: r2(remaining), reference: "", notes: "" });
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    if (!payForm.amount || Number(payForm.amount) <= 0) return alert("Enter a positive amount");
    const coverage = payModal.coverage_start && payModal.coverage_end
      ? `${payModal.coverage_start} – ${payModal.coverage_end}`
      : (payModal.invoice_number ?? "");
    const { error } = await supabase.from("hmo_remittances").insert({
      bill_id: payModal.id,
      provider: payModal.provider,
      coverage_period: coverage || null,
      paid_date: payForm.paid_date,
      amount: Number(payForm.amount),
      reference: payForm.reference || null,
      notes: payForm.notes || null,
    });
    if (error) return alert(error.message);
    await logActivity("created", "HMO", `Paid HMO bill ${payModal.invoice_number || ""} ${peso(Number(payForm.amount))}`);
    setPayModal(null);
    await load();
  };

  const billPagination = usePagination(bills);

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Render ───────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      <CuteLoader
        show={backfilling}
        message="Reconciling HMO reserve"
        submessage="Scanning payslips and linking savings entries"
      />
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="page-heading">HMO</h2>
          <p className="page-subheading">
            Maxicare — company covers principal + one dependent. Additional dependents are deducted from the employee via payroll.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Principal (mo)" value={peso(grand.principal)} tone="blue" />
        <SummaryCard label="Company Dep (mo)" value={peso(grand.companyDep)} tone="blue" />
        <SummaryCard label="Employee Dep (mo)" value={peso(grand.employeeDep)} tone="amber" />
        <SummaryCard label="Company Total (mo)" value={peso(grand.company)} tone="blue" />
        <SummaryCard label="Employee Total (mo)" value={peso(grand.employee)} tone="amber" />
        <SummaryCard label="Overall HMO (mo)" value={peso(grand.total)} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Company Reserved" value={peso(companyReserved)} tone="blue" />
        <SummaryCard label="Employee Collected" value={peso(employeeCollected)} tone="amber" />
        <SummaryCard label="Total HMO Savings" value={peso(totalReserved)} tone="emerald" />
        <SummaryCard label="Paid / Outstanding" value={`${peso(totalPaid)} / ${peso(outstanding)}`} tone="rose" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {([["enrollments", "Enrollments"], ["calculator", "Calculator"], ["reserve", "Reserve & Collections"], ["bills", "Bills & Payments"]] as [Tab, string][]).map(
          ([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >{label}</button>
          )
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {/* ════════════════ Enrollments tab ═══════════════════════════════════ */}
      {tab === "enrollments" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNew} className="btn-primary">+ New Enrollment</button>
          </div>

          {enrollments.length === 0 && !showForm && (
            <div className="panel p-8 text-center text-sm text-gray-400">No HMO enrollments yet.</div>
          )}

          {/* ── Enrollment list (cards) ─────────────────────────────────────── */}
          {rows.map((r) => (
            <div key={r.enrollment.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{empName(r.enrollment.employee_id)}</h3>
                  <p className="text-xs text-gray-500">
                    {r.enrollment.provider} · {r.enrollment.plan ?? "—"} · quarterly {peso(r.enrollment.principal_premium)}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Effective {r.enrollment.effective_date}
                    {r.enrollment.coverage_start ? ` · ${r.enrollment.coverage_start}` : ""}
                    {r.enrollment.coverage_end ? ` – ${r.enrollment.coverage_end}` : ""}
                    {r.enrollment.proration !== "none" ? ` · proration: ${r.enrollment.proration}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => openEdit(r.enrollment)}>Edit</button>
                  <button className="btn-danger" onClick={() => endEnrollment(r.enrollment)}>End</button>
                </div>
              </div>

              {/* Per-employee monthly totals */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 text-center">
                <MiniStat label="Principal" value={peso(r.principalMonthly)} />
                <MiniStat label="Co. Dep" value={peso(r.companyDepMonthly)} />
                <MiniStat label="Emp. Dep" value={peso(r.employeeDepMonthly)} />
                <MiniStat label="Company" value={peso(r.companyMonthly)} />
                <MiniStat label="Employee" value={peso(r.employeeMonthly)} />
                <MiniStat label="Total" value={peso(r.totalMonthly)} strong />
              </div>

              {/* Dependents */}
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Dependent</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Relationship</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Coverage</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Premium (qtr)</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Monthly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depsFor(r.enrollment.id).length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-gray-400">No dependents.</td></tr>
                    )}
                    {depsFor(r.enrollment.id).map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 text-gray-800">{d.name}</td>
                        <td className="px-3 py-2 text-gray-600">{d.relationship ?? ""}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            d.coverage_type === "company" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {d.coverage_type === "company" ? "Company-covered" : "Employee-paid"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{peso(d.premium)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">{peso(toMonthly(d.premium, d.billing_cycle))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ Calculator tab ═══════════════════════════════════ */}
      {tab === "calculator" && !loading && (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Employee</th>
                <th className="th-right">Principal</th>
                <th className="th-right">Co. Dep</th>
                <th className="th-right">Emp. Dep</th>
                <th className="th-right">Company (mo)</th>
                <th className="th-right">Employee (mo)</th>
                <th className="th-right">Total (mo)</th>
                <th className="th-right">Total (qtr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No active enrollments.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.enrollment.id} className="table-row-hover">
                  <td className="td font-medium text-gray-900">{empName(r.enrollment.employee_id)}</td>
                  <td className="td-right">{peso(r.principalMonthly)}</td>
                  <td className="td-right">{peso(r.companyDepMonthly)}</td>
                  <td className="td-right">{peso(r.employeeDepMonthly)}</td>
                  <td className="td-right">{peso(r.companyMonthly)}</td>
                  <td className="td-right">{peso(r.employeeMonthly)}</td>
                  <td className="td-right font-medium">{peso(r.totalMonthly)}</td>
                  <td className="td-right">{peso(r.totalMonthly * 3)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="td">All employees</td>
                  <td className="td-right">{peso(grand.principal)}</td>
                  <td className="td-right">{peso(grand.companyDep)}</td>
                  <td className="td-right">{peso(grand.employeeDep)}</td>
                  <td className="td-right">{peso(grand.company)}</td>
                  <td className="td-right">{peso(grand.employee)}</td>
                  <td className="td-right">{peso(grand.total)}</td>
                  <td className="td-right">{peso(grand.total * 3)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ════════════════ Reserve & Collections tab ═════════════════════ */}
      {tab === "reserve" && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">HMO Reserve Breakdown</h3>
              <p className="text-xs text-gray-400">Each row traces to a finalized payroll entry. Company allocations are from enrollment; employee collections are from actual payslip deductions.</p>
            </div>
            <button onClick={runBackfill} disabled={backfilling} className="btn-primary disabled:opacity-50">
              {backfilling ? "Scanning…" : "Reconcile / Backfill Missing"}
            </button>
          </div>

          {/* Reconciliation formula */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-sm">
            <h4 className="mb-1 font-semibold text-blue-800">Reconciliation</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 text-gray-700">
              <span>Company funds reserved</span><span className="text-right tabular-nums font-medium">{peso(companyReserved)}</span>
              <span>Employee deductions collected</span><span className="text-right tabular-nums font-medium">{peso(employeeCollected)}</span>
              <div className="col-span-2 my-1 border-t border-blue-200" />
              <span className="font-semibold">Total HMO reserve</span><span className="text-right tabular-nums font-bold">{peso(totalReserved)}</span>
              <span>Less: provider payments</span><span className="text-right tabular-nums font-medium text-red-600">({peso(totalPaid)})</span>
              <div className="col-span-2 my-1 border-t border-blue-200" />
              <span className="font-semibold">Available balance</span><span className="text-right tabular-nums font-bold text-emerald-700">{peso(outstanding)}</span>
            </div>
          </div>

          {/* Detailed source entries */}
          <div className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Payroll Period</th>
                  <th className="th">Coverage</th>
                  <th className="th">Type</th>
                  <th className="th-right">Company</th>
                  <th className="th-right">Employee</th>
                  <th className="th">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {savings.filter(s => s.source === 'payroll_hmo_company' || s.source === 'payroll_hmo_employee').length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No HMO reserve entries. Run "Reconcile / Backfill Missing" to create entries for existing payslips.</td></tr>
                )}
                {/* Group by payslip_id so company+employee appear on same conceptual row */}
                {(() => {
                  const hmoSavings = savings.filter(s => s.source === 'payroll_hmo_company' || s.source === 'payroll_hmo_employee');
                  // Group by payslip_id
                  const grouped = new Map<string, { company?: typeof hmoSavings[0]; employee?: typeof hmoSavings[0] }>();
                  for (const s of hmoSavings) {
                    const key = s.payslip_id ?? s.id;
                    if (!grouped.has(key)) grouped.set(key, {});
                    const g = grouped.get(key)!;
                    if (s.source === 'payroll_hmo_company') g.company = s;
                    else g.employee = s;
                  }
                  return Array.from(grouped.entries()).map(([key, g]) => {
                    const ref = g.company ?? g.employee!;
                    const notes: any = ref.notes ?? {};
                    return (
                      <tr key={key} className="table-row-hover">
                        <td className="td font-medium text-gray-900">{notes.employee ?? "—"}</td>
                        <td className="td whitespace-nowrap text-gray-600">{notes.period ?? "—"}</td>
                        <td className="td whitespace-nowrap">{notes.coverage ?? "—"}</td>
                        <td className="td">
                          {g.company && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 mr-1">Company</span>}
                          {g.employee && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Employee</span>}
                        </td>
                        <td className="td-right tabular-nums">{g.company ? peso(g.company.amount) : "—"}</td>
                        <td className="td-right tabular-nums">{g.employee ? peso(g.employee.amount) : "—"}</td>
                        <td className="td whitespace-nowrap text-gray-500">{ref.date}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              {savings.filter(s => s.source === 'payroll_hmo_company' || s.source === 'payroll_hmo_employee').length > 0 && (
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="td" colSpan={4}>Totals</td>
                    <td className="td-right tabular-nums">{peso(companyReserved)}</td>
                    <td className="td-right tabular-nums">{peso(employeeCollected)}</td>
                    <td className="td"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ Bills & Payments tab ════════════════════════════ */}
      {tab === "bills" && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowBillModal(true)} className="btn-primary">+ New Bill</button>
          </div>
          <div className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="th">Provider</th>
                  <th className="th">Invoice</th>
                  <th className="th">Coverage</th>
                  <th className="th">Due</th>
                  <th className="th-right">Amount</th>
                  <th className="th-right">Paid</th>
                  <th className="th-right">Balance</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {bills.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No bills recorded.</td></tr>
                )}
                {billPagination.pageItems.map((b) => {
                  const paid = paidForBill(b.id);
                  const bal = (b.amount_due ?? 0) - paid;
                  return (
                    <tr key={b.id} className="table-row-hover">
                      <td className="td">{b.provider}</td>
                      <td className="td">{b.invoice_number ?? ""}</td>
                      <td className="td whitespace-nowrap">{b.coverage_start ?? ""}{b.coverage_end ? ` – ${b.coverage_end}` : ""}</td>
                      <td className="td whitespace-nowrap">{b.due_date ?? ""}</td>
                      <td className="td-right">{peso(b.amount_due)}</td>
                      <td className="td-right text-emerald-600">{peso(paid)}</td>
                      <td className="td-right font-medium text-amber-600">{peso(bal)}</td>
                      <td className="td">
                        <button disabled={bal <= 0.005} onClick={() => openPay(b)}
                          className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >Mark as Paid</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={billPagination.page} pageSize={billPagination.pageSize}
              totalItems={billPagination.totalItems} totalPages={billPagination.totalPages}
              from={billPagination.from} to={billPagination.to}
              onPageChange={billPagination.setPage} onPageSizeChange={billPagination.setPageSize}
            />
          </div>

          {/* Payment history */}
          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Payment History</h3>
            {remittances.length === 0 ? (
              <p className="text-sm text-gray-400">No payments recorded yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Date</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Provider</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Coverage</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">Reference</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-gray-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {remittances.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{r.paid_date}</td>
                        <td className="px-3 py-2 text-gray-700">{r.provider ?? ""}</td>
                        <td className="px-3 py-2 text-gray-600">{r.coverage_period ?? ""}</td>
                        <td className="px-3 py-2 text-gray-600">{r.reference ?? ""}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900">{peso(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════ Enrollment form modal ════════════════════════════ */}
      {showForm && (
        <Modal title={editingEnrollmentId ? "Edit Enrollment" : "New HMO Enrollment"} onClose={() => setShowForm(false)} wide>
          <form onSubmit={saveForm} className="space-y-5 p-6">
            {/* ── Employee + Provider ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Employee">
                <select className="input-field" value={formEmployeeId} disabled={!!editingEnrollmentId}
                  onChange={(e) => setFormEmployeeId(e.target.value)} required>
                  <option value="">Select employee…</option>
                  {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Field>
              <Field label="Provider">
                <input className="input-field bg-gray-100" value={HMO_PROVIDER} readOnly />
              </Field>
            </div>

            {/* ── Principal plan + premium ────────────────────────────────── */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
              <h4 className="mb-2 text-sm font-semibold text-blue-800">Principal Member</h4>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Plan">
                  <select className="input-field" value={formPlan} onChange={(e) => handlePlanChange(e.target.value as HmoPlan)}>
                    <option value="Platinum">Platinum</option>
                    <option value="Gold">Gold</option>
                  </select>
                </Field>
                <Field label="Quarterly Premium">
                  <input type="number" step="0.01" className="input-field" value={formPremium}
                    onChange={(e) => setFormPremium(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Monthly Equivalent">
                  <input className="input-field bg-gray-100 font-medium" readOnly value={peso(r2((Number(formPremium) || 0) / 3))} />
                </Field>
              </div>
            </div>

            {/* ── Coverage dates + proration ──────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              <Field label="Coverage Start"><input type="date" className="input-field" value={formCoverageStart} onChange={(e) => setFormCoverageStart(e.target.value)} /></Field>
              <Field label="Coverage End"><input type="date" className="input-field" value={formCoverageEnd} onChange={(e) => setFormCoverageEnd(e.target.value)} /></Field>
              <Field label="Effective Date"><input type="date" className="input-field" value={formEffectiveDate} onChange={(e) => setFormEffectiveDate(e.target.value)} required /></Field>
              <Field label="Proration">
                <select className="input-field" value={formProration} onChange={(e) => setFormProration(e.target.value as any)}>
                  <option value="none">None (full premium)</option>
                  <option value="daily">Daily proration</option>
                  <option value="monthly">Monthly proration</option>
                </select>
              </Field>
            </div>

            {/* ── Dependents ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">Dependents</h4>
                <button type="button" onClick={addDep} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  + Add Dependent
                </button>
              </div>

              {formDeps.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">No dependents. Click "Add Dependent" to include one.</p>
              )}

              <div className="space-y-3">
                {formDeps.map((d, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                      <Field label="Name">
                        <input className="input-field" value={d.name} onChange={(e) => updateDep(i, { name: e.target.value })} />
                      </Field>
                      <Field label="Relationship">
                        <input className="input-field" value={d.relationship} onChange={(e) => updateDep(i, { relationship: e.target.value })} placeholder="e.g. spouse, child" />
                      </Field>
                      <div className="pt-5">
                        <button type="button" onClick={() => removeDep(i)} className="text-rose-500 hover:text-rose-700 text-lg leading-none">✕</button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-3">
                      <Field label="Plan">
                        <select className="input-field" value={d.plan} onChange={(e) => handleDepPlanChange(i, e.target.value as HmoPlan)}>
                          <option value="Platinum">Platinum</option>
                          <option value="Gold">Gold</option>
                        </select>
                      </Field>
                      <Field label="Qtr Premium">
                        <input type="number" step="0.01" className="input-field" value={d.premium}
                          onChange={(e) => updateDep(i, { premium: Number(e.target.value) || 0 })} />
                      </Field>
                      <Field label="Monthly">
                        <input className="input-field bg-gray-100" readOnly value={peso(r2((Number(d.premium) || 0) / 3))} />
                      </Field>
                      <Field label="Payment">
                        <div className="mt-1 flex gap-2 text-xs">
                          <label
                            className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2 py-1 transition-colors ${
                              d.isCompanyCovered
                                ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`dep-cover-${i}`}
                              checked={d.isCompanyCovered}
                              onChange={() => setCompanyCoveredDep(i)}
                              className="h-3.5 w-3.5 accent-red-600"
                            />
                            <span className="font-medium">Company</span>
                          </label>
                          <label
                            className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-2 py-1 transition-colors ${
                              !d.isCompanyCovered
                                ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`dep-cover-${i}`}
                              checked={!d.isCompanyCovered}
                              onChange={() => updateDep(i, { isCompanyCovered: false })}
                              className="h-3.5 w-3.5 accent-red-600"
                            />
                            <span className="font-medium">Employee</span>
                          </label>
                        </div>
                      </Field>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <Field label="Coverage Start"><input type="date" className="input-field" value={d.coverage_start} onChange={(e) => updateDep(i, { coverage_start: e.target.value })} /></Field>
                      <Field label="Coverage End"><input type="date" className="input-field" value={d.coverage_end} onChange={(e) => updateDep(i, { coverage_end: e.target.value })} /></Field>
                      <Field label="Effective Date"><input type="date" className="input-field" value={d.effective_date} onChange={(e) => updateDep(i, { effective_date: e.target.value })} /></Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Live calculation panel ──────────────────────────────────── */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <h4 className="mb-2 text-sm font-semibold text-emerald-800">Calculated Totals</h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <Row2 label="Principal (qtr)" value={peso(formCalc.principalQtr)} />
                <Row2 label="Principal (mo)" value={peso(formCalc.principalMo)} />
                <Row2 label="All Dependents (qtr)" value={peso(formCalc.totalDepQtr)} />
                <Row2 label="All Dependents (mo)" value={peso(r2(formCalc.totalDepQtr / 3))} />
                <div className="col-span-2 my-1 border-t border-emerald-200" />
                <Row2 label="Company-covered (qtr)" value={peso(formCalc.companyQtr)} sub="Principal + company dependent" />
                <Row2 label="Company-covered (mo)" value={peso(formCalc.companyMo)} />
                <Row2 label="Employee-paid (qtr)" value={peso(formCalc.employeeQtr)} sub="Additional dependents → payroll deduction" />
                <Row2 label="Employee-paid (mo)" value={peso(formCalc.employeeMo)} />
                <div className="col-span-2 my-1 border-t border-emerald-200" />
                <Row2 label="Overall Total (qtr)" value={peso(formCalc.totalQtr)} bold />
                <Row2 label="Overall Total (mo)" value={peso(formCalc.totalMo)} bold />
              </div>
            </div>

            {/* ── Notes + actions ─────────────────────────────────────────── */}
            <Field label="Notes (optional)">
              <input className="input-field" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </Field>

            <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Enrollment</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Bill modal ──────────────────────────────────────────────────── */}
      {showBillModal && (
        <Modal title="New HMO Bill" onClose={() => setShowBillModal(false)}>
          <form onSubmit={saveBill} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Provider"><input className="input-field bg-gray-100" value={HMO_PROVIDER} readOnly /></Field>
              <Field label="Invoice No."><input className="input-field" value={billForm.invoice_number} onChange={(e) => setBillForm((f) => ({ ...f, invoice_number: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Coverage Start"><input type="date" className="input-field" value={billForm.coverage_start} onChange={(e) => setBillForm((f) => ({ ...f, coverage_start: e.target.value }))} /></Field>
              <Field label="Coverage End"><input type="date" className="input-field" value={billForm.coverage_end} onChange={(e) => setBillForm((f) => ({ ...f, coverage_end: e.target.value }))} /></Field>
              <Field label="Due Date"><input type="date" className="input-field" value={billForm.due_date} onChange={(e) => setBillForm((f) => ({ ...f, due_date: e.target.value }))} /></Field>
            </div>
            <Field label="Amount Due"><input type="number" step="0.01" className="input-field" value={billForm.amount_due as any} onChange={(e) => setBillForm((f) => ({ ...f, amount_due: e.target.value === "" ? "" : Number(e.target.value) }))} /></Field>
            <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
              <button type="button" className="btn-secondary" onClick={() => setShowBillModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Bill</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Payment modal ───────────────────────────────────────────────── */}
      {payModal && (
        <Modal title="Mark as Paid" onClose={() => setPayModal(null)}>
          <form onSubmit={submitPayment} className="space-y-4 p-6">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {payModal.provider}{payModal.invoice_number ? ` · ${payModal.invoice_number}` : ""} — remaining{" "}
              <b>{peso(Math.max(0, (payModal.amount_due ?? 0) - paidForBill(payModal.id)))}</b>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment Date"><input type="date" className="input-field" value={payForm.paid_date} onChange={(e) => setPayForm((f) => ({ ...f, paid_date: e.target.value }))} required /></Field>
              <Field label="Amount Paid"><input type="number" step="0.01" className="input-field" value={payForm.amount as any} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value === "" ? "" : Number(e.target.value) }))} required /></Field>
            </div>
            <Field label="Reference (optional)"><input className="input-field" value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} /></Field>
            <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
              <button type="button" className="btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Record Payment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────
function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" | "emerald" | "rose" }) {
  const toneMap: Record<string, string> = {
    blue: "border-blue-100 bg-blue-50/50",
    amber: "border-amber-100 bg-amber-50/50",
    emerald: "border-emerald-100 bg-emerald-50/50",
    rose: "border-rose-100 bg-rose-50/50",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-xs tabular-nums ${strong ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{value}</p>
    </div>
  );
}

function Row2({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <span className={`${bold ? "font-semibold text-emerald-900" : "text-gray-700"}`}>{label}</span>
        {sub && <span className="ml-1 text-[10px] text-gray-400">({sub})</span>}
      </div>
      <span className={`tabular-nums ${bold ? "font-bold text-emerald-900" : "font-medium text-gray-900"}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 top-0 left-0 z-50 flex h-screen w-screen items-center justify-center bg-black/50 p-0 sm:p-4"
        style={{ position: "fixed" }}
      >
        <div className={`${wide ? "max-w-4xl" : "max-w-2xl"} flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl`}>
          {/* Sticky header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Scrollable body (children include the form + its sticky footer) */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
