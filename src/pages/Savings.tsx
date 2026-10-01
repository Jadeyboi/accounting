import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import type { Saving } from "@/types";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";

export default function Savings() {
  const [items, setItems] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const [paidItems, setPaidItems] = useState<Saving[]>([]);

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
      setItems(allItems.filter(item => !item.status || item.status === 'active'));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const pagination = usePagination(items);

  const total = items.reduce((s, it) => s + (it.amount ?? 0), 0);

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
              ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
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
