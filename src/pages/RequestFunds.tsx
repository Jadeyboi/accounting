import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from '@/lib/supabase';
import type { FundRequestHistory, FundRequestGroup } from '@/types';

type Status = "N/A" | "Partially Paid" | "Fully Paid";
type RequestType = "whole_month" | "half_month" | "one_time";

interface RequestItem {
  id: string;
  description: string;
  amount: number | "";
  requestType: RequestType;
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
  console.log('🚀 RequestFunds component loaded - NEW VERSION with database support - v2');
  
  const [items, setItems] = useState<RequestItem[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [requestType, setRequestType] = useState<RequestType>("whole_month");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<Status>("N/A");
  const [usdRate, setUsdRate] = useState<string>("56");
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([]);
  const [fundHistory, setFundHistory] = useState<FundRequestHistory[]>([]);
  const [historyError, setHistoryError] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [groupName, setGroupName] = useState<string>("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<SavedGroup | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<FundRequestHistory | null>(null);
  const [showSaveHistoryModal, setShowSaveHistoryModal] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<string>("");
  const [historyNotes, setHistoryNotes] = useState<string>("");

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

  // Load from localStorage and database
  useEffect(() => {
    // Load current items from localStorage (these are temporary/working items)
    const raw = localStorage.getItem("request-funds-items");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {}
    }
    
    // Load saved groups and history from database
    loadSavedGroups();
    loadFundHistory();
  }, []);

  const loadSavedGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('fund_request_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Convert database format to component format
      const groups: SavedGroup[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        createdAt: item.created_at,
        items: item.items
      }));
      
      setSavedGroups(groups);
    } catch (error) {
      console.error('Error loading saved groups:', error);
    }
  };

  const loadFundHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    
    try {
      console.log('Loading fund history from database...');
      
      // First check if table exists by trying a simple count
      const { count, error: countError } = await supabase
        .from('fund_request_history')
        .select('*', { count: 'exact', head: true });
        
      console.log('Table count check:', { count, error: countError });
      
      if (countError) {
        if (countError.message.includes('relation "public.fund_request_history" does not exist')) {
          setHistoryError('Database tables not set up. Please run the setup script.');
          return;
        }
        throw countError;
      }

      const { data, error } = await supabase
        .from('fund_request_history')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Fund history query result:', { data, error, count: data?.length });

      if (error) throw error;
      
      // Convert database format to component format
      const history: FundRequestHistory[] = (data || []).map(item => ({
        id: item.id,
        period: item.period,
        periodLabel: item.period_label,
        createdAt: item.created_at,
        items: item.items,
        totalMonthly: item.total_monthly,
        totalHalfMonth: item.total_half_month,
        totalOneTime: item.total_one_time,
        totalAmount: item.total_amount,
        usdRate: item.usd_rate,
        notes: item.notes
      }));
      
      console.log('Converted history:', history);
      setFundHistory(history);
      
      if (history.length === 0) {
        setHistoryError('No history records found in database. Save some history first.');
      }
    } catch (error: any) {
      console.error('Error loading fund history:', error);
      setHistoryError(`Database error: ${error.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Persist current items to localStorage only (working data)
  useEffect(() => {
    localStorage.setItem("request-funds-items", JSON.stringify(items));
  }, [items]);

  // Groups and history are now saved to database, not localStorage

  const addItem = () => {
    if (!description.trim()) return alert("Enter a description");
    
    let monthlyAmt = 0;
    let halfMonthAmt = 0;
    let itemAmount = 0;

    if (requestType === "whole_month") {
      monthlyAmt = amount ? Number(amount) : 0;
      halfMonthAmt = monthlyAmt / 2;
      itemAmount = monthlyAmt;
    } else if (requestType === "half_month") {
      halfMonthAmt = amount ? Number(amount) : 0;
      monthlyAmt = halfMonthAmt * 2;
      itemAmount = halfMonthAmt;
    } else { // one_time
      itemAmount = amount ? Number(amount) : 0;
      monthlyAmt = 0;
      halfMonthAmt = 0;
    }

    if (isNaN(itemAmount) || itemAmount <= 0) return alert("Enter a valid amount");

    const it: RequestItem = {
      id: crypto.randomUUID(),
      description: description.trim(),
      amount: itemAmount,
      requestType,
      monthlyAmount: monthlyAmt,
      halfMonthAmount: halfMonthAmt,
      remarks: remarks.trim(),
      status,
    };
    setItems((prev) => [...prev, it]);
    setDescription("");
    setAmount("");
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

  const confirmSaveGroup = async () => {
    if (!groupName.trim()) {
      return alert("Please enter a group name");
    }
    
    try {
      const selectedItemsData = items.filter((it) => selectedItems.has(it.id));
      
      const { error } = await supabase
        .from('fund_request_groups')
        .insert({
          name: groupName.trim(),
          items: selectedItemsData
        });

      if (error) throw error;

      // Reload groups from database
      await loadSavedGroups();

      setGroupName("");
      setShowGroupModal(false);
      setSelectedItems(new Set());
      alert("Group saved successfully!");
    } catch (error: any) {
      console.error('Error saving group:', error);
      alert(`Error saving group: ${error.message}`);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    
    try {
      const { error } = await supabase
        .from('fund_request_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      // Reload groups from database
      await loadSavedGroups();
      alert("Group deleted successfully!");
    } catch (error: any) {
      console.error('Error deleting group:', error);
      alert(`Error deleting group: ${error.message}`);
    }
  };

  const showGroupItems = (group: SavedGroup) => {
    setViewingGroup(group);
  };

  const closeGroupView = () => {
    setViewingGroup(null);
  };

  const saveToHistory = () => {
    if (items.length === 0) {
      return alert("No items to save to history");
    }
    // Auto-generate period based on current date
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setHistoryPeriod(defaultPeriod);
    setHistoryNotes("");
    setShowSaveHistoryModal(true);
  };

  const confirmSaveHistory = async () => {
    if (!historyPeriod.trim()) {
      return alert("Please enter a period");
    }

    try {
      console.log('Saving history to database...');
      
      // Check if period already exists
      const { data: existingData } = await supabase
        .from('fund_request_history')
        .select('id')
        .eq('period', historyPeriod.trim())
        .single();

      console.log('Existing data check:', existingData);

      if (existingData) {
        if (!confirm("A record for this period already exists. Do you want to overwrite it?")) {
          return;
        }
      }

      // Parse period to create label
      const [year, month] = historyPeriod.split('-');
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const periodLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

      const historyRecord = {
        period: historyPeriod.trim(),
        period_label: periodLabel,
        items: items,
        total_monthly: totals.monthly,
        total_half_month: totals.half,
        total_one_time: totals.oneTime,
        total_amount: totals.overall,
        usd_rate: Number(usdRate) || 56,
        notes: historyNotes.trim() || null,
      };

      console.log('History record to save:', historyRecord);

      let error;
      if (existingData) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('fund_request_history')
          .update(historyRecord)
          .eq('id', existingData.id);
        error = updateError;
        console.log('Update result:', { error: updateError });
      } else {
        // Insert new record
        const { error: insertError, data: insertData } = await supabase
          .from('fund_request_history')
          .insert(historyRecord);
        error = insertError;
        console.log('Insert result:', { error: insertError, data: insertData });
      }

      if (error) throw error;

      // Reload history from database
      await loadFundHistory();

      setShowSaveHistoryModal(false);
      setHistoryPeriod("");
      setHistoryNotes("");
      alert("Successfully saved to history!");
    } catch (error: any) {
      console.error('Error saving history:', error);
      alert(`Error saving history: ${error.message}`);
    }
  };

  const deleteHistory = async (historyId: string) => {
    if (!confirm("Are you sure you want to delete this history record?")) return;
    
    try {
      const { error } = await supabase
        .from('fund_request_history')
        .delete()
        .eq('id', historyId);

      if (error) throw error;

      // Reload history from database
      await loadFundHistory();
      alert("History record deleted successfully!");
    } catch (error: any) {
      console.error('Error deleting history:', error);
      alert(`Error deleting history: ${error.message}`);
    }
  };

  const viewHistory = (history: FundRequestHistory) => {
    setViewingHistory(history);
    setShowHistoryModal(true);
  };

  const closeHistoryView = () => {
    setViewingHistory(null);
    setShowHistoryModal(false);
  };

  const loadFromHistory = (history: FundRequestHistory) => {
    if (items.length > 0) {
      if (!confirm("This will replace your current items. Continue?")) {
        return;
      }
    }
    
    // Load items from history
    const historyItems = history.items.map(item => ({
      ...item,
      id: crypto.randomUUID(), // Generate new IDs to avoid conflicts
    }));
    
    setItems(historyItems);
    setUsdRate(String(history.usdRate));
    closeHistoryView();
    alert("Items loaded from history!");
  };

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    description: string;
    amount: string;
    requestType: RequestType;
    remarks: string;
    status: Status;
  }>({
    description: "",
    amount: "",
    requestType: "whole_month",
    remarks: "",
    status: "N/A",
  });

  const startEdit = (it: RequestItem) => {
    setEditId(it.id);
    setEditFields({
      description: it.description,
      amount: String(Number(it.amount) || 0),
      requestType: it.requestType,
      remarks: it.remarks,
      status: it.status,
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFields({
      description: "",
      amount: "",
      requestType: "whole_month",
      remarks: "",
      status: "N/A",
    });
  };

  const saveEdit = () => {
    if (!editId) return;
    if (!editFields.description.trim()) return alert("Enter a description");
    
    const itemAmount = editFields.amount ? Number(editFields.amount) : 0;
    if (isNaN(itemAmount) || itemAmount <= 0) return alert("Enter a valid amount");

    let monthlyAmt = 0;
    let halfMonthAmt = 0;

    if (editFields.requestType === "whole_month") {
      monthlyAmt = itemAmount;
      halfMonthAmt = itemAmount / 2;
    } else if (editFields.requestType === "half_month") {
      halfMonthAmt = itemAmount;
      monthlyAmt = itemAmount * 2;
    } else { // one_time
      monthlyAmt = 0;
      halfMonthAmt = 0;
    }

    setItems((prev) =>
      prev.map((x) =>
        x.id === editId
          ? {
              ...x,
              description: editFields.description.trim(),
              amount: itemAmount,
              requestType: editFields.requestType,
              monthlyAmount: monthlyAmt,
              halfMonthAmount: halfMonthAmt,
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
    const oneTime = items.reduce(
      (s, it) => it.requestType === 'one_time' ? s + (Number(it.amount) || 0) : s,
      0
    );
    return { monthly, half, oneTime, overall: monthly + half + oneTime };
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
        <div className="flex items-center gap-2">
          <button
            onClick={saveToHistory}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
          >
            Save to History
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-purple-700"
          >
            View History
          </button>
          <button
            onClick={exportPDF}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
          >
            Save as PDF
          </button>
        </div>
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
            <label className="block text-sm text-slate-600">Request Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="whole_month">Whole Month</option>
              <option value="half_month">Half Month</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600">
              {requestType === "whole_month" ? "Monthly Amount" : 
               requestType === "half_month" ? "Half-Month Amount" : 
               "Amount"}
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  <th className="p-2">Type</th>
                  <th className="p-2 text-right text-slate-900">Amount</th>
                  <th className="p-2 text-right text-slate-900">Amount (USD)</th>
                  <th className="p-2 text-right text-slate-900">Monthly</th>
                  <th className="p-2 text-right text-slate-900">Monthly (USD)</th>
                  <th className="p-2 text-right text-slate-900">Half-Month</th>
                  <th className="p-2 text-right text-slate-900">Half (USD)</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Remarks</th>
                  <th className="p-2 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isEditing = editId === it.id;
                  if (isEditing) {
                    const itemAmount = editFields.amount ? Number(editFields.amount) : 0;
                    let monthlyPhp = 0;
                    let halfPhp = 0;
                    
                    if (editFields.requestType === "whole_month") {
                      monthlyPhp = itemAmount;
                      halfPhp = itemAmount / 2;
                    } else if (editFields.requestType === "half_month") {
                      halfPhp = itemAmount;
                      monthlyPhp = itemAmount * 2;
                    }

                    return (
                      <tr key={it.id} className="border-b border-slate-100 bg-yellow-50">
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
                            onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={editFields.requestType}
                            onChange={(e) => setEditFields((f) => ({ ...f, requestType: e.target.value as RequestType }))}
                            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="whole_month">Whole Month</option>
                            <option value="half_month">Half Month</option>
                            <option value="one_time">One-time</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          <input
                            type="number"
                            step="0.01"
                            value={editFields.amount}
                            onChange={(e) => setEditFields((f) => ({ ...f, amount: e.target.value }))}
                            className="w-full rounded-md border-slate-300 text-right font-normal shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd(toUsd(itemAmount))}
                        </td>
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
                        <td className="p-2">
                          <select
                            value={editFields.status}
                            onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value as Status }))}
                            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="N/A">N/A</option>
                            <option value="Partially Paid">Partially Paid</option>
                            <option value="Fully Paid">Fully Paid</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editFields.remarks}
                            onChange={(e) => setEditFields((f) => ({ ...f, remarks: e.target.value }))}
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

                  const getRequestTypeLabel = (type: RequestType) => {
                    switch (type) {
                      case "whole_month": return "Whole Month";
                      case "half_month": return "Half Month";
                      case "one_time": return "One-time";
                      default: return type;
                    }
                  };

                  return (
                    <tr key={it.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                      <td className="p-2 print:hidden">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(it.id)}
                          onChange={() => toggleItemSelection(it.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="p-2 text-slate-900">{it.description}</td>
                      <td className="p-2 text-slate-900">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          it.requestType === 'whole_month' ? 'bg-blue-100 text-blue-800' :
                          it.requestType === 'half_month' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {getRequestTypeLabel(it.requestType)}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {money(Number(it.amount) || 0)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                        {usd(toUsd(Number(it.amount) || 0))}
                      </td>
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
                  <td className="p-2"></td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {money(totals.oneTime)}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {usd(toUsd(totals.oneTime))}
                  </td>
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

      {/* Save to History Modal */}
      {showSaveHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Save Current Request to History
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-2">
                Period (YYYY-MM)
              </label>
              <input
                type="month"
                value={historyPeriod}
                onChange={(e) => setHistoryPeriod(e.target.value)}
                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={historyNotes}
                onChange={(e) => setHistoryNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Additional notes about this request period..."
              />
            </div>
            <div className="mb-4 rounded-lg bg-blue-50 p-3">
              <div className="text-sm text-blue-800">
                <strong>Summary:</strong>
                <div className="mt-1 text-xs">
                  • {items.length} items
                  • Monthly: {money(totals.monthly)}
                  • Half-Month: {money(totals.half)}
                  • One-time: {money(totals.oneTime)}
                  • Total: {money(totals.overall)}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveHistoryModal(false);
                  setHistoryPeriod("");
                  setHistoryNotes("");
                }}
                className="rounded-md bg-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveHistory}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Save to History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History List Modal */}
      {showHistoryModal && !viewingHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Fund Request History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-md bg-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Close
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-8">
                <div className="text-slate-500 mb-2">Loading history...</div>
              </div>
            ) : fundHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-slate-500 mb-2">No history records found</div>
                {historyError ? (
                  <div className="text-sm text-red-600 mb-2">{historyError}</div>
                ) : (
                  <div className="text-sm text-slate-400">Save your current request to create the first history record</div>
                )}
                <button
                  onClick={loadFundHistory}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {fundHistory
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((history) => (
                    <div
                      key={history.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{history.periodLabel}</div>
                          <div className="text-sm text-slate-600 mt-1">
                            {history.items.length} items • Created {new Date(history.createdAt).toLocaleDateString()}
                          </div>
                          {history.notes && (
                            <div className="text-sm text-slate-500 mt-1 italic">"{history.notes}"</div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <div className="text-slate-500">Monthly</div>
                              <div className="font-medium text-slate-900">{money(history.totalMonthly)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Half-Month</div>
                              <div className="font-medium text-slate-900">{money(history.totalHalfMonth)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">One-time</div>
                              <div className="font-medium text-slate-900">{money(history.totalOneTime)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Total</div>
                              <div className="font-semibold text-slate-900">{money(history.totalAmount)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => viewHistory(history)}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => loadFromHistory(history)}
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                          >
                            Load Items
                          </button>
                          <button
                            onClick={() => deleteHistory(history.id)}
                            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View History Details Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-6xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {viewingHistory.periodLabel} - Fund Request Details
                </h3>
                <p className="text-sm text-slate-500">
                  {viewingHistory.items.length} items • Created {new Date(viewingHistory.createdAt).toLocaleDateString()}
                  {viewingHistory.notes && ` • ${viewingHistory.notes}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadFromHistory(viewingHistory)}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Load Items
                </button>
                <button
                  onClick={closeHistoryView}
                  className="rounded-md bg-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-slate-500">Monthly Total</div>
                <div className="text-lg font-semibold text-slate-900">{money(viewingHistory.totalMonthly)}</div>
                <div className="text-xs text-slate-600">{usd(viewingHistory.totalMonthly / viewingHistory.usdRate)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500">Half-Month Total</div>
                <div className="text-lg font-semibold text-slate-900">{money(viewingHistory.totalHalfMonth)}</div>
                <div className="text-xs text-slate-600">{usd(viewingHistory.totalHalfMonth / viewingHistory.usdRate)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500">One-time Total</div>
                <div className="text-lg font-semibold text-slate-900">{money(viewingHistory.totalOneTime)}</div>
                <div className="text-xs text-slate-600">{usd(viewingHistory.totalOneTime / viewingHistory.usdRate)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-500">Grand Total</div>
                <div className="text-xl font-bold text-slate-900">{money(viewingHistory.totalAmount)}</div>
                <div className="text-xs text-slate-600">{usd(viewingHistory.totalAmount / viewingHistory.usdRate)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="p-2">Description</th>
                    <th className="p-2">Type</th>
                    <th className="p-2 text-right text-slate-900">Amount</th>
                    <th className="p-2 text-right text-slate-900">Amount (USD)</th>
                    <th className="p-2 text-right text-slate-900">Monthly</th>
                    <th className="p-2 text-right text-slate-900">Monthly (USD)</th>
                    <th className="p-2 text-right text-slate-900">Half-Month</th>
                    <th className="p-2 text-right text-slate-900">Half (USD)</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingHistory.items.map((item) => {
                    const getRequestTypeLabel = (type: RequestType) => {
                      switch (type) {
                        case "whole_month": return "Whole Month";
                        case "half_month": return "Half Month";
                        case "one_time": return "One-time";
                        default: return type;
                      }
                    };

                    return (
                      <tr key={item.id} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                        <td className="p-2 text-slate-900">{item.description}</td>
                        <td className="p-2 text-slate-900">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            item.requestType === 'whole_month' ? 'bg-blue-100 text-blue-800' :
                            item.requestType === 'half_month' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {getRequestTypeLabel(item.requestType)}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(Number(item.amount) || 0)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd((Number(item.amount) || 0) / viewingHistory.usdRate)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(Number(item.monthlyAmount) || 0)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd((Number(item.monthlyAmount) || 0) / viewingHistory.usdRate)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {money(Number(item.halfMonthAmount) || 0)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-slate-900">
                          {usd((Number(item.halfMonthAmount) || 0) / viewingHistory.usdRate)}
                        </td>
                        <td className="p-2">{item.status}</td>
                        <td className="p-2">{item.remarks || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium bg-slate-100">
                    <td className="p-2 text-slate-900">Totals</td>
                    <td className="p-2"></td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {money(viewingHistory.totalOneTime)}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {usd(viewingHistory.totalOneTime / viewingHistory.usdRate)}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {money(viewingHistory.totalMonthly)}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {usd(viewingHistory.totalMonthly / viewingHistory.usdRate)}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {money(viewingHistory.totalHalfMonth)}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {usd(viewingHistory.totalHalfMonth / viewingHistory.usdRate)}
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
