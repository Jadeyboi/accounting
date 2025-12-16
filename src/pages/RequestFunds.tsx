import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Status = "N/A" | "Partially Paid" | "Fully Paid";

interface RequestItem {
  id: string;
  description: string;
  monthlyAmount: number | "";
  halfMonthAmount: number | "";
  remarks: string;
  status: Status;
  groupId?: string;
}

interface SavedGroup {
  id: string;
  name: string;
  createdAt: string;
  items: RequestItem[];
}

export default function RequestFunds() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [description, setDescription] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState<string>("");
  const [halfMonthAmount, setHalfMonthAmount] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<Status>("N/A");
  const [usdRate, setUsdRate] = useState<string>("56");
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [groupName, setGroupName] = useState<string>("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<SavedGroup | null>(null);

  const printableRef = useRef<HTMLDivElement | null>(null);

  // Fetch current USD to PHP rate
  const fetchCurrentRate = async () => {
    setIsLoadingRate(true);
    setRateError("");
    try {
      // Using exchangerate-api.com (free tier, no API key required)
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

  // Load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("request-funds-items");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {}
    }
    const groupsRaw = localStorage.getItem("request-funds-groups");
    if (groupsRaw) {
      try {
        const parsed = JSON.parse(groupsRaw);
        if (Array.isArray(parsed)) setSavedGroups(parsed);
      } catch {}
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("request-funds-items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("request-funds-groups", JSON.stringify(savedGroups));
  }, [savedGroups]);

  const addItem = () => {
    const m = monthlyAmount ? Number(monthlyAmount) : 0;
    const h = m / 2;
    if (!description.trim()) return alert("Enter a description");
    if (isNaN(m) || isNaN(h)) return alert("Invalid amounts");
    const it: RequestItem = {
      id: crypto.randomUUID(),
      description: description.trim(),
      monthlyAmount: m,
      halfMonthAmount: h,
      remarks: remarks.trim(),
      status,
    };
    setItems((prev) => [...prev, it]);
    setDescription("");
    setMonthlyAmount("");
    setHalfMonthAmount("");
    setRemarks("");
    setStatus("N/A");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const saveSelectedAsGroup = () => {
    if (selectedItems.size === 0) {
      return alert("Please select at least one item to save as a group");
    }
    setShowGroupModal(true);
  };

  const confirmSaveGroup = () => {
    if (!groupName.trim()) {
      return alert("Please enter a group name");
    }
    const selectedItemsData = items.filter((it) => selectedItems.has(it.id));
    const newGroup: SavedGroup = {
      id: crypto.randomUUID(),
      name: groupName.trim(),
      createdAt: new Date().toISOString(),
      items: selectedItemsData,
    };
    setSavedGroups((prev) => [...prev, newGroup]);
    setGroupName("");
    setShowGroupModal(false);
    setSelectedItems(new Set());
  };

  const deleteGroup = (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    setSavedGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const showGroupItems = (group: SavedGroup) => {
    setViewingGroup(group);
  };

  const closeGroupView = () => {
    setViewingGroup(null);
  };

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    description: string;
    monthlyAmount: string;
    halfMonthAmount: string;
    remarks: string;
    status: Status;
  }>({
    description: "",
    monthlyAmount: "",
    halfMonthAmount: "",
    remarks: "",
    status: "N/A",
  });

  const startEdit = (it: RequestItem) => {
    const m = Number(it.monthlyAmount) || 0;
    setEditId(it.id);
    setEditFields({
      description: it.description,
      monthlyAmount: String(m),
      halfMonthAmount: String(Number(it.halfMonthAmount) || 0 || m / 2),
      remarks: it.remarks,
      status: it.status,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFields({
      description: "",
      monthlyAmount: "",
      halfMonthAmount: "",
      remarks: "",
      status: "N/A",
    });
  };

  const saveEdit = () => {
    if (!editId) return;
    const m = editFields.monthlyAmount ? Number(editFields.monthlyAmount) : 0;
    const h = m / 2;
    if (!editFields.description.trim()) return alert("Enter a description");
    if (isNaN(m) || isNaN(h)) return alert("Invalid amounts");
    setItems((prev) =>
      prev.map((x) =>
        x.id === editId
          ? {
              ...x,
              description: editFields.description.trim(),
              monthlyAmount: m,
              halfMonthAmount: h,
              remarks: editFields.remarks.trim(),
              status: editFields.status,
            }
          : x
      )
    );
    cancelEdit();
  };

  const totals = useMemo(() => {
    const monthly = items.reduce(
      (s, it) => s + (Number(it.monthlyAmount) || 0),
      0
    );
    const half = items.reduce(
      (s, it) => s + (Number(it.halfMonthAmount) || 0),
      0
    );
    return { monthly, half, overall: monthly + half };
  }, [items]);

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
    if (!printableRef.current) return;
    const node = printableRef.current;
    document.body.classList.add("pdf-mode");
    const canvas = await html2canvas(node, {
      scale: 4,
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
      const sliceHeight = (canvas.width * (pageHeight - 40)) / imgWidth; // proportional slice
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

    pdf.save(`request-funds-${Date.now()}.pdf`);
    document.body.classList.remove("pdf-mode");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">
            Request Funds
          </h2>
          <p className="text-sm text-slate-600">
            Prepare a request with monthly and half-month items, remarks, and
            status.
          </p>
          {selectedItems.size > 0 && (
            <div className="mt-2">
              <button
                onClick={saveSelectedAsGroup}
                className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-purple-700"
              >
                Save {selectedItems.size} Selected as Group
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600" title="PHP per 1 USD">
            USD Rate (PHP → USD)
          </label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={usdRate}
            onChange={(e) => setUsdRate(e.target.value)}
            className="w-28 rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="56.00"
            disabled={isLoadingRate}
          />
          <button
            onClick={fetchCurrentRate}
            disabled={isLoadingRate}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
            title="Refresh current rate"
          >
            {isLoadingRate ? "..." : "↻"}
          </button>
          {rateError && (
            <span className="text-xs text-red-600">{rateError}</span>
          )}
        </div>
        <button
          onClick={exportPDF}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
        >
          Save as PDF
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-600">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g. Utilities, Internet, Supplies"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">
              Monthly Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => {
                const val = e.target.value;
                setMonthlyAmount(val);
                const num = val ? Number(val) : 0;
                if (!isNaN(num)) setHalfMonthAmount(String(num / 2));
                else setHalfMonthAmount("");
              }}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">
              Half-Month Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={halfMonthAmount}
              readOnly
              className="mt-1 w-full cursor-not-allowed rounded-md border-slate-300 bg-slate-50 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="N/A">N/A</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Fully Paid">Fully Paid</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-600">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Optional notes"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={addItem}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            Add Item
          </button>
        </div>
      </div>

      <div
        ref={printableRef}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-[13px] leading-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Request Funds Summary
            </div>
            <div className="text-xs text-slate-500">
              Generated: {new Date().toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Exchange Rate (Today)</div>
            <div className="text-sm font-medium text-slate-700">
              1 USD ={" "}
              {Number(usdRate || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}{" "}
              PHP
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-slate-500">No items added.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="p-2 print:hidden w-10">
                    <input
                      type="checkbox"
                      checked={
                        items.length > 0 && selectedItems.size === items.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems(new Set(items.map((it) => it.id)));
                        } else {
                          setSelectedItems(new Set());
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right text-slate-900">Monthly</th>
                  <th className="p-2 text-right text-slate-900">
                    Monthly (USD)
                  </th>
                  <th className="p-2 text-right text-slate-900">Half-Month</th>
                  <th className="p-2 text-right text-slate-900">Half (USD)</th>
                  <th className="p-2 text-right text-slate-900">Total</th>
                  <th className="p-2 text-right text-slate-900">Total (USD)</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Remarks</th>
                  <th className="p-2 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isEditing = editId === it.id;
                  if (isEditing) {
                    const monthlyPhp = editFields.monthlyAmount
                      ? Number(editFields.monthlyAmount)
                      : 0;
                    const halfPhp = monthlyPhp / 2;
                    const totalPhp = monthlyPhp + halfPhp;
                    return (
                      <tr
                        key={it.id}
                        className="border-b border-slate-100 bg-yellow-50"
                      >
                        <td className="p-2 print:hidden">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(it.id)}
                            onChange={() => toggleItemSelection(it.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="p-2 text-slate-900">
                          <input
                            type="text"
                            value={editFields.description}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                description: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          <input
                            type="number"
                            step="0.01"
                            value={editFields.monthlyAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditFields((f) => ({
                                ...f,
                                monthlyAmount: val,
                                halfMonthAmount: val
                                  ? String(Number(val) / 2)
                                  : "",
                              }));
                            }}
                            className="w-full rounded-md border-slate-300 text-right font-normal shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(monthlyPhp))}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          <input
                            type="number"
                            step="0.01"
                            value={String(halfPhp)}
                            readOnly
                            className="w-full cursor-not-allowed rounded-md border-slate-300 bg-slate-100 text-right font-normal shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(halfPhp))}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(totalPhp)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(totalPhp))}
                        </td>
                        <td className="p-2">
                          <select
                            value={editFields.status}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                status: e.target.value as Status,
                              }))
                            }
                            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="N/A">N/A</option>
                            <option value="Partially Paid">
                              Partially Paid
                            </option>
                            <option value="Fully Paid">Fully Paid</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editFields.remarks}
                            onChange={(e) =>
                              setEditFields((f) => ({
                                ...f,
                                remarks: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 space-x-2 whitespace-nowrap print:hidden">
                          <button
                            onClick={saveEdit}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-md bg-slate-500 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={it.id}
                      className="border-b border-slate-100 odd:bg-white even:bg-slate-50"
                    >
                      <td className="p-2 print:hidden">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(it.id)}
                          onChange={() => toggleItemSelection(it.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="p-2 text-slate-900">{it.description}</td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {money(Number(it.monthlyAmount) || 0)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {usd(toUsd(Number(it.monthlyAmount) || 0))}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {money(Number(it.halfMonthAmount) || 0)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {usd(toUsd(Number(it.halfMonthAmount) || 0))}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {money(
                          (Number(it.monthlyAmount) || 0) +
                            (Number(it.halfMonthAmount) || 0)
                        )}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {usd(
                          toUsd(
                            (Number(it.monthlyAmount) || 0) +
                              (Number(it.halfMonthAmount) || 0)
                          )
                        )}
                      </td>
                      <td className="p-2">{it.status}</td>
                      <td className="p-2">{it.remarks || ""}</td>
                      <td className="p-2 space-x-2 whitespace-nowrap print:hidden">
                        <button
                          onClick={() => startEdit(it)}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeItem(it.id)}
                          className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-medium bg-slate-100">
                  <td className="p-2 print:hidden"></td>
                  <td className="p-2 text-slate-900">Totals</td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {money(totals.monthly)}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {usd(toUsd(totals.monthly))}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {money(totals.half)}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {usd(toUsd(totals.half))}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {money(totals.overall)}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {usd(toUsd(totals.overall))}
                  </td>
                  <td className="p-2" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Saved Groups Section */}
      {savedGroups.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">
            Saved Groups
          </h3>
          <div className="space-y-2">
            {savedGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{group.name}</div>
                  <div className="text-xs text-slate-500">
                    {group.items.length} items • Created{" "}
                    {new Date(group.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => showGroupItems(group)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Show Items
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Name Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Save Selected Items as Group
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmSaveGroup();
                }}
                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="e.g., Monthly Expenses Oct 2025"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setGroupName("");
                }}
                className="rounded-md bg-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveGroup}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Save Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Group Items Modal */}
      {viewingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {viewingGroup.name}
                </h3>
                <p className="text-sm text-slate-500">
                  {viewingGroup.items.length} items • Created{" "}
                  {new Date(viewingGroup.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={closeGroupView}
                className="rounded-md bg-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Close
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right text-slate-900">Monthly</th>
                    <th className="p-2 text-right text-slate-900">
                      Monthly (USD)
                    </th>
                    <th className="p-2 text-right text-slate-900">
                      Half-Month
                    </th>
                    <th className="p-2 text-right text-slate-900">
                      Half (USD)
                    </th>
                    <th className="p-2 text-right text-slate-900">Total</th>
                    <th className="p-2 text-right text-slate-900">
                      Total (USD)
                    </th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingGroup.items.map((it) => {
                    const monthlyPhp = Number(it.monthlyAmount) || 0;
                    const halfPhp = Number(it.halfMonthAmount) || 0;
                    const totalPhp = monthlyPhp + halfPhp;
                    return (
                      <tr
                        key={it.id}
                        className="border-b border-slate-100 odd:bg-white even:bg-slate-50"
                      >
                        <td className="p-2 text-slate-900">{it.description}</td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(monthlyPhp)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(monthlyPhp))}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(halfPhp)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(halfPhp))}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(totalPhp)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(totalPhp))}
                        </td>
                        <td className="p-2">{it.status}</td>
                        <td className="p-2">{it.remarks || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium bg-slate-100">
                    <td className="p-2 text-slate-900">Totals</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {money(
                        viewingGroup.items.reduce(
                          (s, it) => s + (Number(it.monthlyAmount) || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {usd(
                        toUsd(
                          viewingGroup.items.reduce(
                            (s, it) => s + (Number(it.monthlyAmount) || 0),
                            0
                          )
                        )
                      )}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {money(
                        viewingGroup.items.reduce(
                          (s, it) => s + (Number(it.halfMonthAmount) || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {usd(
                        toUsd(
                          viewingGroup.items.reduce(
                            (s, it) => s + (Number(it.halfMonthAmount) || 0),
                            0
                          )
                        )
                      )}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {money(
                        viewingGroup.items.reduce(
                          (s, it) =>
                            s +
                            (Number(it.monthlyAmount) || 0) +
                            (Number(it.halfMonthAmount) || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {usd(
                        toUsd(
                          viewingGroup.items.reduce(
                            (s, it) =>
                              s +
                              (Number(it.monthlyAmount) || 0) +
                              (Number(it.halfMonthAmount) || 0),
                            0
                          )
                        )
                      )}
                    </td>
                    <td className="p-2" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
