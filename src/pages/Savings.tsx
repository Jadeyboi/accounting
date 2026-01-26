import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Saving } from "@/types";

export default function Savings() {
  const [items, setItems] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error } = await supabase
      .from("savings")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setItems((data ?? []) as Saving[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const total = items.reduce((s, it) => s + (it.amount ?? 0), 0);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert("Enter a positive amount");
    const { data, error } = await supabase
      .from("savings")
      .insert([
        {
          date,
          description: description || null,
          amount: Number(amount),
          account: account || null,
        },
      ])
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
        <div className="text-right">
          <div className="text-sm text-gray-500">Total saved</div>
          <div className="mt-1 text-2xl font-semibold">
            ₱ {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                          className="rounded bg-yellow-500 px-2 py-1 text-white"
                          onClick={() => startEdit(it)}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(it.id)}
                          className="rounded bg-red-600 px-2 py-1 text-white"
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
    </div>
  );
}
