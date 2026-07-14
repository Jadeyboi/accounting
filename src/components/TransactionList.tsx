import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activityLogger";
import type { Transaction } from "@/types";
import { usePagination } from "@/hooks/usePagination";
import Pagination from "@/components/Pagination";

interface Props {
  refreshKey: number;
  onChanged: () => void;
}

const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

export default function TransactionList({ refreshKey, onChanged }: Props) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (isCancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setItems((data ?? []) as Transaction[]);
      }
      setLoading(false);
    };
    load();
    return () => { isCancelled = true; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return items.filter(t => {
      const matchSearch = !searchTerm ||
        (t.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (t.note?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        t.amount.toString().includes(searchTerm)
      const matchType = filterType === 'all' || t.type === filterType
      const matchFrom = !filterDateFrom || t.date >= filterDateFrom
      const matchTo = !filterDateTo || t.date <= filterDateTo
      return matchSearch && matchType && matchFrom && matchTo
    })
  }, [items, searchTerm, filterType, filterDateFrom, filterDateTo])

  const onDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const t = items.find(x => x.id === id);
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { alert(error.message); } else {
      await logActivity('deleted', 'Transactions', `Deleted ${t?.type ?? ''} transaction: ₱${t?.amount?.toLocaleString() ?? '?'} — ${t?.category ?? ''} ${t?.note ?? ''}`)
      onChanged();
    }
  };

  const onBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected transaction(s)?`)) return;
    setBulkDeleting(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", Array.from(selectedIds));
    setBulkDeleting(false);
    if (error) { alert(error.message); return; }
    await logActivity('deleted', 'Transactions', `Bulk deleted ${selectedIds.size} transaction(s)`)
    setSelectedIds(new Set());
    onChanged();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (pagination.pageItems.every(t => selectedIds.has(t.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagination.pageItems.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagination.pageItems.forEach(t => next.add(t.id));
        return next;
      });
    }
  };

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    date: string; type: "in" | "out" | "expense"; amount: number | "";
    category: string; note: string; receipt: string; receiptFile?: File | null;
  }>({ date: "", type: "in", amount: "", category: "", note: "", receipt: "", receiptFile: null });

  const startEdit = (t: Transaction) => {
    setEditId(t.id);
    setEditFields({ date: t.date, type: t.type, amount: t.amount, category: t.category ?? "", note: t.note ?? "", receipt: t.receipt_url ?? "", receiptFile: null });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFields({ date: "", type: "in", amount: "", category: "", note: "", receipt: "", receiptFile: null });
  };

  const saveEdit = async () => {
    if (!editFields.amount || Number(editFields.amount) <= 0) return alert("Enter a positive amount");
    let receipt_url: string | null | undefined = undefined;
    if (editFields.receiptFile) {
      try {
        const fileExt = editFields.receiptFile.name.split(".").pop();
        const fileName = `receipt-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from("receipts").upload(fileName, editFields.receiptFile as File, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from("receipts").getPublicUrl(uploadData.path);
        receipt_url = publicData.publicUrl;
      } catch (err: any) { return alert(err.message || String(err)); }
    } else if (editFields.receipt === "") { receipt_url = null; }
    const payload: any = { date: editFields.date, type: editFields.type, amount: Number(editFields.amount), category: editFields.category || null, note: editFields.note || null };
    if (receipt_url !== undefined) payload.receipt_url = receipt_url;
    const { error } = await supabase.from("transactions").update(payload).eq("id", editId!);
    if (error) return alert(error.message);
    await logActivity('updated', 'Transactions', `Updated transaction: ${editFields.type} ₱${Number(editFields.amount).toLocaleString()} — ${editFields.category || ''} ${editFields.note || ''}`)
    cancelEdit();
    onChanged();
  };

  const pagination = usePagination(filtered);

  const allFilteredSelected = pagination.pageItems.length > 0 && pagination.pageItems.every(t => selectedIds.has(t.id));

  if (loading) return <div className="mt-4 text-sm text-slate-600">Loading...</div>;
  if (error) return <div className="mt-4 text-sm text-rose-600">{error}</div>;

  return (
    <div className="mt-4 space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); pagination.resetPage(); }}
          placeholder="Search category or note..."
          className="flex-1 min-w-40 rounded-lg border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); pagination.resetPage(); }}
          className="rounded-lg border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="in">Cash In</option>
          <option value="out">Cash Out</option>
          <option value="expense">Expense</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => { setFilterDateFrom(e.target.value); pagination.resetPage(); }}
          className="rounded-lg border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          title="From date"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => { setFilterDateTo(e.target.value); pagination.resetPage(); }}
          className="rounded-lg border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          title="To date"
        />
        {(searchTerm || filterType !== 'all' || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterDateFrom(''); setFilterDateTo(''); pagination.resetPage(); }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2">
          <span className="text-sm font-medium text-red-700">{selectedIds.size} transaction(s) selected</span>
          <button
            onClick={onBulkDelete}
            disabled={bulkDeleting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Date</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Type</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Category</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Note</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pagination.pageItems.map((t, idx) => (
              <tr key={t.id} className={`${selectedIds.has(t.id) ? 'bg-blue-50' : idx % 2 === 0 ? "bg-white" : "bg-slate-50 hover:bg-slate-100"}`}>
                {editId === t.id ? (
                  <>
                    <td className="px-3 py-2" />
                    <td className="px-4 py-2 text-sm">
                      <input type="date" value={editFields.date} onChange={(e) => setEditFields((f) => ({ ...f, date: e.target.value }))} className="w-full rounded border px-2 py-1" />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <select value={editFields.type} onChange={(e) => setEditFields((f) => ({ ...f, type: e.target.value as any }))} className="w-full rounded border px-2 py-1">
                        <option value="in">in</option>
                        <option value="out">out</option>
                        <option value="expense">expense</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      <input type="number" step="0.01" value={editFields.amount as any} onChange={(e) => setEditFields((f) => ({ ...f, amount: e.target.value === "" ? "" : Number(e.target.value) }))} className="w-full rounded border px-2 py-1 text-right" />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <input type="text" value={editFields.category} onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))} className="w-full rounded border px-2 py-1" />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div>
                        <input type="text" value={editFields.note} onChange={(e) => setEditFields((f) => ({ ...f, note: e.target.value }))} className="w-full rounded border px-2 py-1" />
                        <div className="mt-2 flex items-center gap-2">
                          {editFields.receipt ? <img src={editFields.receipt} alt="receipt" className="h-12 w-12 rounded object-cover border" /> : null}
                          <input type="file" accept="image/*" onChange={(e) => setEditFields((f) => ({ ...f, receiptFile: e.target.files?.[0] ?? null }))} />
                          {editFields.receipt && <button type="button" className="rounded bg-gray-200 px-2 py-1 text-xs" onClick={() => setEditFields((f) => ({ ...f, receipt: "", receiptFile: null }))}>Remove</button>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right flex gap-2">
                      <button type="button" className="rounded bg-blue-600 px-2 py-1 text-white" onClick={saveEdit}>Save</button>
                      <button type="button" className="rounded bg-gray-400 px-2 py-1 text-white" onClick={cancelEdit}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-800">{formatDate(t.date)}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={t.type === "in" ? "rounded bg-emerald-100 px-2 py-1 text-emerald-800" : t.type === "out" ? "rounded bg-amber-100 px-2 py-1 text-amber-800" : "rounded bg-rose-100 px-2 py-1 text-rose-800"}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-slate-900">
                      ₱ {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700">{t.category ?? ""}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <div>{t.note ?? ""}</div>
                        {t.receipt_url ? (
                          <a href={t.receipt_url} target="_blank" rel="noreferrer">
                            <img src={t.receipt_url} alt="receipt" className="h-8 w-8 rounded object-cover border" />
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right flex gap-2">
                      <button type="button" className="rounded bg-yellow-500 px-2 py-1 text-white" onClick={() => startEdit(t)}>Edit</button>
                      <button onClick={() => onDelete(t.id)} className="rounded-md bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100">Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  {items.length === 0 ? 'No transactions yet.' : 'No transactions match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        totalPages={pagination.totalPages}
        from={pagination.from}
        to={pagination.to}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}
