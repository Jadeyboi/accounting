import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TransactionType } from "@/types";

interface Props {
  onCreated: () => void;
}

export default function TransactionForm({ onCreated }: Props) {
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [type, setType] = useState<TransactionType>("in");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    setLoading(true);

    let receipt_url: string | null = null;

    if (receiptFile) {
      // If an upload proxy is configured, POST to it. Otherwise upload directly to Supabase storage.
      try {
        const rf = receiptFile as File;
        const uploadProxy =
          (import.meta.env.VITE_UPLOAD_PROXY_URL as string) || "";
        if (uploadProxy) {
          const fd = new FormData();
          fd.append("file", rf);
          const resp = await fetch(
            `${uploadProxy.replace(/\/$/, "")}/upload-receipt`,
            { method: "POST", body: fd }
          );
          if (!resp.ok) {
            const txt = await resp.text();
            setError(`Upload proxy failed: ${txt}`);
            setLoading(false);
            return;
          }
          const j = await resp.json();
          receipt_url = j.publicUrl || null;
        } else {
          // ensure receipts bucket exists (list with empty path)
          const { error: listErr } = await supabase.storage
            .from("receipts")
            .list("", { limit: 1 });
          if (listErr) {
            console.error('Storage bucket error:', listErr);
            setError(
              `Storage bucket 'receipts' not found or not accessible. Please create it in Supabase Dashboard:\n\n` +
              `1. Go to Storage → New bucket\n` +
              `2. Name: receipts\n` +
              `3. Check "Public bucket"\n` +
              `4. Click Create\n\n` +
              `Error details: ${listErr.message || String(listErr)}`
            );
            setLoading(false);
            return;
          }

          const fileExt = rf.name.includes(".")
            ? rf.name.split(".").pop()
            : "bin";
          const fileName = `receipt-${Date.now()}.${fileExt}`;
          const { data: uploadData, error: uploadError } =
            await supabase.storage.from("receipts").upload(fileName, rf, {
              cacheControl: "3600",
              upsert: false,
              contentType: rf.type || "application/octet-stream",
            });

          if (uploadError) {
            console.error('Upload error details:', uploadError);
            const errorMsg = (uploadError as any)?.message || String(uploadError);
            setError(
              `Upload failed: ${errorMsg}\n\n` +
              `Common causes:\n` +
              `- Bucket 'receipts' doesn't exist (create it in Supabase Dashboard)\n` +
              `- Bucket is not public or lacks proper policies\n` +
              `- File size exceeds bucket limit\n` +
              `- Invalid file type\n\n` +
              `See STORAGE_SETUP_GUIDE.md for detailed setup instructions.`
            );
            setLoading(false);
            return;
          }

          if (!uploadData || !uploadData.path) {
            setError("Unexpected upload result");
            setLoading(false);
            return;
          }

          const { data: publicData } = supabase.storage
            .from("receipts")
            .getPublicUrl(uploadData.path);
          receipt_url = (publicData as any)?.publicUrl ?? null;
        }
      } catch (err: any) {
        setError(err?.message || String(err));
        setLoading(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      date,
      type,
      amount: amt,
      category: category || null,
      note: note || null,
      receipt_url: receipt_url,
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setAmount("");
    setCategory("");
    setNote("");
    setReceiptFile(null);
    onCreated();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Add Transaction
        </h3>
        <span className="text-xs text-slate-500">Quick entry</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="in">Cash In</option>
            <option value="out">Cash Out</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Amount</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-slate-500">
              ₱
            </span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-r-md border border-slate-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Category</label>
          <input
            type="text"
            placeholder="e.g. Salary, Supplies"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Note</label>
          <input
            type="text"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">
            Receipt (photo)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4">
        <button
          disabled={loading}
          type="submit"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Add Transaction"}
        </button>
      </div>
    </form>
  );
}
