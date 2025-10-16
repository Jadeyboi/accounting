import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

interface Props {
  refreshKey: number;
  onChanged: () => void;
}

export default function TransactionList({ refreshKey, onChanged }: Props) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      isCancelled = true;
    };
  }, [refreshKey]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      onChanged();
    }
  };

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    date: string;
    type: "in" | "out" | "expense";
    amount: number | "";
    category: string;
    note: string;
    receipt: string;
    receiptFile?: File | null;
  }>({
    date: "",
    type: "in",
    amount: "",
    category: "",
    note: "",
    receipt: "",
    receiptFile: null,
  });

  const startEdit = (t: Transaction) => {
    setEditId(t.id);
    setEditFields({
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category ?? "",
      note: t.note ?? "",
      receipt: t.receipt_url ?? "",
      receiptFile: null,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFields({
      date: "",
      type: "in",
      amount: "",
      category: "",
      note: "",
      receipt: "",
      receiptFile: null,
    });
  };

  const saveEdit = async () => {
    if (!editFields.amount || Number(editFields.amount) <= 0)
      return alert("Enter a positive amount");

    let receipt_url: string | null | undefined = undefined;

    if (editFields.receiptFile) {
      try {
        const fileExt = editFields.receiptFile.name.split(".").pop();
        const fileName = `receipt-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(fileName, editFields.receiptFile as File, {
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage
          .from("receipts")
          .getPublicUrl(uploadData.path);
        receipt_url = publicData.publicUrl;
      } catch (err: any) {
        return alert(err.message || String(err));
      }
    } else if (editFields.receipt === "") {
      // cleared by user
      receipt_url = null;
    }

    const payload: any = {
      date: editFields.date,
      type: editFields.type,
      amount: Number(editFields.amount),
      category: editFields.category || null,
      note: editFields.note || null,
    };
    if (receipt_url !== undefined) payload.receipt_url = receipt_url;

    const { error } = await supabase
      .from("transactions")
      .update(payload)
      .eq("id", editId!);
    if (error) return alert(error.message);
    cancelEdit();
    onChanged();
  };

  if (loading)
    return <div className="mt-4 text-sm text-slate-600">Loading...</div>;
  if (error) return <div className="mt-4 text-sm text-rose-600">{error}</div>;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Date
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Type
            </th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
              Amount
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Category
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Note
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((t, idx) => (
            <tr
              key={t.id}
              className={
                idx % 2 === 0 ? "bg-white" : "bg-slate-50 hover:bg-slate-100"
              }
            >
              {editId === t.id ? (
                <>
                  <td className="px-4 py-2 text-sm">
                    <input
                      type="date"
                      value={editFields.date}
                      onChange={(e) =>
                        setEditFields((f) => ({ ...f, date: e.target.value }))
                      }
                      className="w-full rounded border px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <select
                      value={editFields.type}
                      onChange={(e) =>
                        setEditFields((f) => ({
                          ...f,
                          type: e.target.value as any,
                        }))
                      }
                      className="w-full rounded border px-2 py-1"
                    >
                      <option value="in">in</option>
                      <option value="out">out</option>
                      <option value="expense">expense</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right text-sm">
                    <input
                      type="number"
                      step="0.01"
                      value={editFields.amount as any}
                      onChange={(e) =>
                        setEditFields((f) => ({
                          ...f,
                          amount:
                            e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      className="w-full rounded border px-2 py-1 text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <input
                      type="text"
                      value={editFields.category}
                      onChange={(e) =>
                        setEditFields((f) => ({
                          ...f,
                          category: e.target.value,
                        }))
                      }
                      className="w-full rounded border px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div>
                      <input
                        type="text"
                        value={editFields.note}
                        onChange={(e) =>
                          setEditFields((f) => ({ ...f, note: e.target.value }))
                        }
                        className="w-full rounded border px-2 py-1"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        {editFields.receipt ? (
                          <img
                            src={editFields.receipt}
                            alt="receipt"
                            className="h-12 w-12 rounded object-cover border"
                          />
                        ) : null}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              receiptFile: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        {editFields.receipt && (
                          <button
                            type="button"
                            className="rounded bg-gray-200 px-2 py-1 text-xs"
                            onClick={() =>
                              setEditFields((f) => ({
                                ...f,
                                receipt: "",
                                receiptFile: null,
                              }))
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-2 py-1 text-white"
                      onClick={saveEdit}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded bg-gray-400 px-2 py-1 text-white"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2 text-sm text-slate-800">{t.date}</td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={
                        t.type === "in"
                          ? "rounded bg-emerald-100 px-2 py-1 text-emerald-800"
                          : t.type === "out"
                          ? "rounded bg-amber-100 px-2 py-1 text-amber-800"
                          : "rounded bg-rose-100 px-2 py-1 text-rose-800"
                      }
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-medium text-slate-900">
                    ₱{" "}
                    {t.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-700">
                    {t.category ?? ""}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <div>{t.note ?? ""}</div>
                      {t.receipt_url ? (
                        <a
                          href={t.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={t.receipt_url}
                            alt="receipt"
                            className="h-8 w-8 rounded object-cover border"
                          />
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-yellow-500 px-2 py-1 text-white"
                      onClick={() => startEdit(t)}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="rounded-md bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                No transactions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
