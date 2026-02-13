import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Saving } from "@/types";

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
    setDescription("");
    setAmount("");
    setAccount("");
    setAccountMode("select");
    await load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this saving entry?")) return;
    const { error } = await supabase.from("savings").delete().eq("id", id);
    if (error) return alert(error.message);
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
    cancelEdit();
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Savings</h2>
          <p className="text-sm text-gray-600">
            Record amounts saved and track totals.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadPaidHistory}
            className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            View Paid History
          </button>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total saved</div>
            <div className="mt-1 text-2xl font-semibold">
              ₱ {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={onCreate}
        className="grid grid-cols-1 gap-3 sm:grid-cols-4"
      >
        <div>
          <label className="block text-sm text-gray-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount as any}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Account</label>
          {accountMode === "select" ? (
            <select
              value={account}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setAccountMode("new");
                  setAccount("");
                } else {
                  setAccount(e.target.value);
                }
              }}
              className="mt-1 w-full rounded border px-3 py-2"
              size={Math.min(5, uniqueAccounts.length + 2)} // scrollable if >5
              style={{ maxHeight: "120px", overflowY: "auto" }}
            >
              <option value="">Select account...</option>
              {uniqueAccounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value="__new__">Add new account...</option>
            </select>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder="Enter new account name"
              />
              <button
                type="button"
                className="mt-1 rounded bg-gray-200 px-2 py-1 text-xs"
                onClick={() => setAccountMode("select")}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="sm:col-span-4">
          <button className="mt-2 rounded bg-blue-600 px-4 py-2 text-white">
            Save
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Date
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Description
              </th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                Amount
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Account
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-600"
                >
                  Loading...
                </td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-red-600"
                >
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No savings recorded.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              items.map((it) => (
                <tr key={it.id}>
                  {editId === it.id ? (
                    <>
                      <td className="px-4 py-2 text-sm">
                        <input
                          type="date"
                          value={editFields.date}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              date: e.target.value,
                            }))
                          }
                          className="w-full rounded border px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <input
                          type="text"
                          value={editFields.description}
                          onChange={(e) =>
                            setEditFields((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          className="w-full rounded border px-2 py-1"
                        />
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
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            }))
                          }
                          className="w-full rounded border px-2 py-1 text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {editFields.accountMode === "select" ? (
                          <select
                            value={editFields.account}
                            onChange={(e) => {
                              if (e.target.value === "__new__") {
                                setEditFields((f) => ({
                                  ...f,
                                  accountMode: "new",
                                  account: "",
                                }));
                              } else {
                                setEditFields((f) => ({
                                  ...f,
                                  account: e.target.value,
                                }));
                              }
                            }}
                            className="w-full rounded border px-2 py-1"
                            size={Math.min(5, uniqueAccounts.length + 2)}
                            style={{ maxHeight: "120px", overflowY: "auto" }}
                          >
                            <option value="">Select account...</option>
                            {uniqueAccounts.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                            <option value="__new__">Add new account...</option>
                          </select>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={editFields.account}
                              onChange={(e) =>
                                setEditFields((f) => ({
                                  ...f,
                                  account: e.target.value,
                                }))
                              }
                              className="w-full rounded border px-2 py-1"
                              placeholder="Enter new account name"
                            />
                            <button
                              type="button"
                              className="rounded bg-gray-200 px-2 py-1 text-xs"
                              onClick={() =>
                                setEditFields((f) => ({
                                  ...f,
                                  accountMode: "select",
                                }))
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm flex gap-2">
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
                      <td className="px-4 py-2 text-sm text-gray-800">
                        {it.date}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {it.description ?? ""}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                        ₱{" "}
                        {it.amount.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {it.account ?? ""}
                      </td>
                      <td className="px-4 py-2 text-sm flex gap-2">
                        <button
                          type="button"
                          className="rounded bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                          onClick={() => onMarkAsPaid(it.id)}
                        >
                          Paid
                        </button>
                        <button
                          type="button"
                          className="rounded bg-yellow-500 px-2 py-1 text-white hover:bg-yellow-600"
                          onClick={() => startEdit(it)}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(it.id)}
                          className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paid History Modal */}
      {showPaidHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Paid Savings History</h3>
              <button
                onClick={() => setShowPaidHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {paidItems.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No paid savings records yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Description
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Account
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paidItems.map((it) => (
                      <tr key={it.id} className="bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-800">
                          {it.date}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {it.description ?? ""}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                          ₱{" "}
                          {it.amount.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {it.account ?? ""}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            type="button"
                            className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                            onClick={() => restoreSaving(it.id)}
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowPaidHistory(false)}
                className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
