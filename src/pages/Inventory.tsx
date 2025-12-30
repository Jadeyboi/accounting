import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { InventoryItem, InventoryTransaction } from '@/types'

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Form states
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [unit, setUnit] = useState('pcs')
  const [unitPrice, setUnitPrice] = useState(0)
  const [location, setLocation] = useState('')
  const [supplier, setSupplier] = useState('')
  const [minimumStock, setMinimumStock] = useState(0)
  const [notes, setNotes] = useState('')

  // Transaction form states
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in')
  const [transactionQuantity, setTransactionQuantity] = useState(0)
  const [transactionReason, setTransactionReason] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [transactionNotes, setTransactionNotes] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('item_name')

    if (error) {
      console.error('Error fetching inventory:', error)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const fetchTransactions = async (inventoryId: string) => {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('transaction_date', { ascending: false })

    if (error) {
      console.error('Error fetching transactions:', error)
    } else {
      setTransactions(data || [])
    }
  }

  const openModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item)
      setItemName(item.item_name)
      setCategory(item.category)
      setQuantity(item.quantity)
      setUnit(item.unit)
      setUnitPrice(item.unit_price)
      setLocation(item.location || '')
      setSupplier(item.supplier || '')
      setMinimumStock(item.minimum_stock)
      setNotes(item.notes || '')
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingItem(null)
    setItemName('')
    setCategory('')
    setQuantity(0)
    setUnit('pcs')
    setUnitPrice(0)
    setLocation('')
    setSupplier('')
    setMinimumStock(0)
    setNotes('')
  }

  const handleSave = async () => {
    if (!itemName || !category) {
      alert('Please fill in required fields')
      return
    }

    const itemData = {
      item_name: itemName,
      category,
      quantity,
      unit,
      unit_price: unitPrice,
      location: location || null,
      supplier: supplier || null,
      minimum_stock: minimumStock,
      notes: notes || null,
      last_restocked: quantity > 0 ? new Date().toISOString().split('T')[0] : null,
    }

    if (editingItem) {
      const { error } = await supabase
        .from('inventory')
        .update(itemData)
        .eq('id', editingItem.id)

      if (error) {
        console.error('Error updating item:', error)
        alert('Failed to update item')
      }
    } else {
      const { error } = await supabase.from('inventory').insert([itemData])

      if (error) {
        console.error('Error adding item:', error)
        alert('Failed to add item')
      }
    }

    setShowModal(false)
    resetForm()
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    const { error } = await supabase.from('inventory').delete().eq('id', id)

    if (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    } else {
      fetchItems()
    }
  }

  const openTransactionModal = (item: InventoryItem) => {
    setSelectedItemId(item.id)
    setTransactionType('in')
    setTransactionQuantity(0)
    setTransactionReason('')
    setPerformedBy('')
    setTransactionNotes('')
    setShowTransactionModal(true)
  }

  const handleTransaction = async () => {
    if (!selectedItemId || transactionQuantity <= 0) {
      alert('Please enter a valid quantity')
      return
    }

    const item = items.find((i) => i.id === selectedItemId)
    if (!item) return

    const newQuantity =
      transactionType === 'in'
        ? item.quantity + transactionQuantity
        : item.quantity - transactionQuantity

    if (newQuantity < 0) {
      alert('Insufficient stock')
      return
    }

    // Update inventory quantity
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        quantity: newQuantity,
        last_restocked:
          transactionType === 'in'
            ? new Date().toISOString().split('T')[0]
            : item.last_restocked,
      })
      .eq('id', selectedItemId)

    if (updateError) {
      console.error('Error updating inventory:', updateError)
      alert('Failed to update inventory')
      return
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('inventory_transactions')
      .insert([
        {
          inventory_id: selectedItemId,
          transaction_type: transactionType,
          quantity: transactionQuantity,
          reason: transactionReason || null,
          performed_by: performedBy || null,
          transaction_date: new Date().toISOString().split('T')[0],
          notes: transactionNotes || null,
        },
      ])

    if (transactionError) {
      console.error('Error recording transaction:', transactionError)
    }

    setShowTransactionModal(false)
    fetchItems()
  }

  const openHistoryModal = async (item: InventoryItem) => {
    setSelectedItemId(item.id)
    await fetchTransactions(item.id)
    setShowHistoryModal(true)
  }

  const categories = Array.from(new Set(items.map((item) => item.category)))

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const totalValue = filteredItems.reduce(
    (sum, item) => sum + (item.total_value || 0),
    0
  )
  const lowStockItems = items.filter(
    (item) => item.quantity <= item.minimum_stock
  ).length

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading-shimmer h-12 w-48 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Office Inventory
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage office supplies and equipment
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          + Add Item
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-600">Total Items</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600">
            {filteredItems.length}
          </div>
        </div>
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-600">Total Value</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">
            ₱{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-600">Low Stock</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-red-600">
            {lowStockItems}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass rounded-xl p-4 sm:p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-3 text-left font-semibold text-gray-700">
                Item Name
              </th>
              <th className="pb-3 text-left font-semibold text-gray-700 mobile-hide">
                Category
              </th>
              <th className="pb-3 text-right font-semibold text-gray-700">
                Quantity
              </th>
              <th className="pb-3 text-right font-semibold text-gray-700 mobile-hide">
                Unit Price
              </th>
              <th className="pb-3 text-right font-semibold text-gray-700 mobile-hide">
                Total Value
              </th>
              <th className="pb-3 text-center font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                className="border-b border-gray-100 table-row-hover"
              >
                <td className="py-3">
                  <div className="font-medium text-gray-900">
                    {item.item_name}
                  </div>
                  <div className="text-xs text-gray-500 sm:hidden">
                    {item.category}
                  </div>
                  {item.quantity <= item.minimum_stock && (
                    <span className="badge-danger text-xs mt-1">
                      Low Stock
                    </span>
                  )}
                </td>
                <td className="py-3 text-gray-600 mobile-hide">
                  {item.category}
                </td>
                <td className="py-3 text-right">
                  <span className="font-medium text-gray-900">
                    {item.quantity}
                  </span>
                  <span className="text-gray-500 ml-1">{item.unit}</span>
                </td>
                <td className="py-3 text-right text-gray-600 mobile-hide">
                  ₱{item.unit_price.toFixed(2)}
                </td>
                <td className="py-3 text-right font-medium text-gray-900 mobile-hide">
                  ₱{(item.total_value || 0).toFixed(2)}
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openTransactionModal(item)}
                      className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      Stock
                    </button>
                    <button
                      onClick={() => openHistoryModal(item)}
                      className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      History
                    </button>
                    <button
                      onClick={() => openModal(item)}
                      className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No items found. Add your first inventory item!
          </div>
        )}
      </div>

      {/* Add/Edit Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Category *
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Office Supplies, Electronics"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  >
                    <option value="pcs">Pieces</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="set">Set</option>
                    <option value="unit">Unit</option>
                    <option value="ream">Ream</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Unit Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Minimum Stock Alert
                  </label>
                  <input
                    type="number"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Storage Room A"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleSave} className="btn-primary flex-1">
                {editingItem ? 'Update Item' : 'Add Item'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              Stock Transaction
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Transaction Type
                </label>
                <select
                  value={transactionType}
                  onChange={(e) =>
                    setTransactionType(e.target.value as 'in' | 'out')
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                >
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <input
                  type="number"
                  value={transactionQuantity}
                  onChange={(e) => setTransactionQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Reason
                </label>
                <input
                  type="text"
                  value={transactionReason}
                  onChange={(e) => setTransactionReason(e.target.value)}
                  placeholder="e.g., Purchase, Usage, Damaged"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Performed By
                </label>
                <input
                  type="text"
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={transactionNotes}
                  onChange={(e) => setTransactionNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleTransaction} className="btn-primary flex-1">
                Submit
              </button>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              Transaction History
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-left font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="pb-3 text-left font-semibold text-gray-700">
                      Type
                    </th>
                    <th className="pb-3 text-right font-semibold text-gray-700">
                      Quantity
                    </th>
                    <th className="pb-3 text-left font-semibold text-gray-700">
                      Reason
                    </th>
                    <th className="pb-3 text-left font-semibold text-gray-700">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600">
                        {formatDate(txn.transaction_date)}
                      </td>
                      <td className="py-3">
                        {txn.transaction_type === 'in' ? (
                          <span className="badge-success">Stock In</span>
                        ) : (
                          <span className="badge-danger">Stock Out</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {txn.quantity}
                      </td>
                      <td className="py-3 text-gray-600">
                        {txn.reason || '-'}
                      </td>
                      <td className="py-3 text-gray-600">
                        {txn.performed_by || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {transactions.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  No transaction history
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
