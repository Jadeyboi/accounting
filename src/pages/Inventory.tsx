import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { InventoryItem, InventoryHistory } from '@/types'

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<InventoryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Form states
  const [assetTag, setAssetTag] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [supplier, setSupplier] = useState('')
  const [warrantyExpiry, setWarrantyExpiry] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('active')
  const [condition, setCondition] = useState('good')
  const [notes, setNotes] = useState('')

  // History form states
  const [actionType, setActionType] = useState<'maintenance' | 'repair' | 'transfer' | 'status_change'>('maintenance')
  const [actionDescription, setActionDescription] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [actionCost, setActionCost] = useState(0)
  const [actionNotes, setActionNotes] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching inventory:', error)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const fetchHistory = async (inventoryId: string) => {
    const { data, error } = await supabase
      .from('inventory_history')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('action_date', { ascending: false })

    if (error) {
      console.error('Error fetching history:', error)
    } else {
      setHistory(data || [])
    }
  }

  const generateAssetTag = async () => {
    const prefix = category ? category.substring(0, 3).toUpperCase() : 'AST'
    const { data } = await supabase
      .from('inventory')
      .select('asset_tag')
      .like('asset_tag', `${prefix}-%`)
      .order('asset_tag', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      const lastTag = data[0].asset_tag
      const lastNum = parseInt(lastTag?.split('-')[1] || '0')
      return `${prefix}-${String(lastNum + 1).padStart(3, '0')}`
    }
    return `${prefix}-001`
  }

  const openModal = async (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item)
      setAssetTag(item.asset_tag || '')
      setItemDescription(item.item_description)
      setCategory(item.category)
      setBrand(item.brand || '')
      setModel(item.model || '')
      setSerialNumber(item.serial_number || '')
      setPurchaseDate(item.purchase_date || '')
      setPurchasePrice(item.purchase_price || 0)
      setSupplier(item.supplier || '')
      setWarrantyExpiry(item.warranty_expiry || '')
      setAssignedTo(item.assigned_to || '')
      setLocation(item.location || '')
      setStatus(item.status)
      setCondition(item.condition || 'good')
      setNotes(item.notes || '')
    } else {
      resetForm()
      const tag = await generateAssetTag()
      setAssetTag(tag)
    }
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingItem(null)
    setAssetTag('')
    setItemDescription('')
    setCategory('')
    setBrand('')
    setModel('')
    setSerialNumber('')
    setPurchaseDate('')
    setPurchasePrice(0)
    setSupplier('')
    setWarrantyExpiry('')
    setAssignedTo('')
    setLocation('')
    setStatus('active')
    setCondition('good')
    setNotes('')
  }

  const handleSave = async () => {
    if (!itemDescription || !category) {
      alert('Please fill in required fields')
      return
    }

    const itemData = {
      asset_tag: assetTag || null,
      item_description: itemDescription,
      category,
      brand: brand || null,
      model: model || null,
      serial_number: serialNumber || null,
      purchase_date: purchaseDate || null,
      purchase_price: purchasePrice || null,
      supplier: supplier || null,
      warranty_expiry: warrantyExpiry || null,
      assigned_to: assignedTo || null,
      location: location || null,
      status,
      condition: condition || null,
      notes: notes || null,
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
    if (!confirm('Are you sure you want to delete this asset?')) return

    const { error } = await supabase.from('inventory').delete().eq('id', id)

    if (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    } else {
      fetchItems()
    }
  }

  const openHistoryModal = async (item: InventoryItem) => {
    setSelectedItem(item)
    setActionType('maintenance')
    setActionDescription('')
    setPerformedBy('')
    setActionCost(0)
    setActionNotes('')
    setShowHistoryModal(true)
  }

  const handleAddHistory = async () => {
    if (!selectedItem || !actionDescription) {
      alert('Please fill in required fields')
      return
    }

    const { error } = await supabase.from('inventory_history').insert([
      {
        inventory_id: selectedItem.id,
        action_type: actionType,
        description: actionDescription,
        performed_by: performedBy || null,
        action_date: new Date().toISOString().split('T')[0],
        cost: actionCost || null,
        notes: actionNotes || null,
      },
    ])

    if (error) {
      console.error('Error adding history:', error)
      alert('Failed to add history')
    } else {
      setShowHistoryModal(false)
      alert('History record added successfully')
    }
  }

  const openDetailModal = async (item: InventoryItem) => {
    setSelectedItem(item)
    await fetchHistory(item.id)
    setShowDetailModal(true)
  }

  const categories = Array.from(new Set(items.map((item) => item.category)))

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.item_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.asset_tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      categoryFilter === 'all' || item.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const totalAssets = filteredItems.length
  const totalValue = filteredItems.reduce(
    (sum, item) => sum + (item.purchase_price || 0),
    0
  )
  const activeAssets = items.filter((item) => item.status === 'active').length

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge-success">Active</span>
      case 'under_repair':
        return <span className="badge-warning">Under Repair</span>
      case 'disposed':
        return <span className="badge-danger">Disposed</span>
      case 'lost':
        return <span className="badge-danger">Lost</span>
      default:
        return <span className="badge-info">{status}</span>
    }
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
            Asset Inventory
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track office equipment and devices
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          + Add Asset
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-600">Total Assets</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600">
            {totalAssets}
          </div>
        </div>
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-600">Total Value</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">
            ₱{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-600">Active Assets</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-purple-600">
            {activeAssets}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search assets..."
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="under_repair">Under Repair</option>
            <option value="disposed">Disposed</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass rounded-xl p-4 sm:p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-3 text-left font-semibold text-gray-700">
                Asset Tag
              </th>
              <th className="pb-3 text-left font-semibold text-gray-700">
                Description
              </th>
              <th className="pb-3 text-left font-semibold text-gray-700 mobile-hide">
                Category
              </th>
              <th className="pb-3 text-left font-semibold text-gray-700 mobile-hide">
                Serial Number
              </th>
              <th className="pb-3 text-left font-semibold text-gray-700 mobile-hide">
                Assigned To
              </th>
              <th className="pb-3 text-center font-semibold text-gray-700">
                Status
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
                  <div className="font-medium text-blue-600">
                    {item.asset_tag || 'N/A'}
                  </div>
                </td>
                <td className="py-3">
                  <div className="font-medium text-gray-900">
                    {item.item_description}
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.brand} {item.model}
                  </div>
                </td>
                <td className="py-3 text-gray-600 mobile-hide">
                  {item.category}
                </td>
                <td className="py-3 text-gray-600 mobile-hide">
                  {item.serial_number || '-'}
                </td>
                <td className="py-3 text-gray-600 mobile-hide">
                  {item.assigned_to || '-'}
                </td>
                <td className="py-3 text-center">
                  {getStatusBadge(item.status)}
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openDetailModal(item)}
                      className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openHistoryModal(item)}
                      className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200"
                    >
                      Log
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
            No assets found. Add your first asset!
          </div>
        )}
      </div>

      {/* Add/Edit Asset Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              {editingItem ? 'Edit Asset' : 'Add New Asset'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Asset Tag
                  </label>
                  <input
                    type="text"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    placeholder="e.g., PC-001, MON-002"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="e.g., Dell Desktop Computer"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  >
                    <option value="">Select Category</option>
                    <option value="Computer">Computer</option>
                    <option value="Monitor">Monitor</option>
                    <option value="TV">TV</option>
                    <option value="Printer">Printer</option>
                    <option value="Peripherals">Peripherals (Mouse, Keyboard)</option>
                    <option value="Kitchen Appliance">Kitchen Appliance</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Network Equipment">Network Equipment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Dell, HP, Samsung"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g., OptiPlex 7090"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Purchase Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Warranty Expiry
                  </label>
                  <input
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Assigned To
                  </label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Employee name or department"
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
                    placeholder="e.g., Office Floor 2, Meeting Room"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  >
                    <option value="active">Active</option>
                    <option value="under_repair">Under Repair</option>
                    <option value="disposed">Disposed</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
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
                {editingItem ? 'Update Asset' : 'Add Asset'}
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

      {/* Add History/Log Modal */}
      {showHistoryModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              Add Maintenance/History Log
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Asset: {selectedItem.item_description}
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) =>
                    setActionType(e.target.value as any)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="repair">Repair</option>
                  <option value="transfer">Transfer</option>
                  <option value="status_change">Status Change</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="Describe the action taken..."
                  rows={3}
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
                  Cost (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={actionCost}
                  onChange={(e) => setActionCost(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleAddHistory} className="btn-primary flex-1">
                Add Log
              </button>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              Asset Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Basic Information */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 border-b pb-2">
                  Basic Information
                </h4>
                <div>
                  <span className="text-sm text-gray-600">Asset Tag:</span>
                  <p className="font-medium text-blue-600">
                    {selectedItem.asset_tag || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Description:</span>
                  <p className="font-medium">{selectedItem.item_description}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Category:</span>
                  <p className="font-medium">{selectedItem.category}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Brand:</span>
                  <p className="font-medium">{selectedItem.brand || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Model:</span>
                  <p className="font-medium">{selectedItem.model || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Serial Number:</span>
                  <p className="font-medium">{selectedItem.serial_number || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Status:</span>
                  <p className="mt-1">{getStatusBadge(selectedItem.status)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Condition:</span>
                  <p className="font-medium capitalize">
                    {selectedItem.condition || '-'}
                  </p>
                </div>
              </div>

              {/* Purchase & Assignment */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 border-b pb-2">
                  Purchase & Assignment
                </h4>
                <div>
                  <span className="text-sm text-gray-600">Purchase Date:</span>
                  <p className="font-medium">
                    {formatDate(selectedItem.purchase_date)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Purchase Price:</span>
                  <p className="font-medium text-green-600">
                    ₱{(selectedItem.purchase_price || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Supplier:</span>
                  <p className="font-medium">{selectedItem.supplier || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Warranty Expiry:</span>
                  <p className="font-medium">
                    {formatDate(selectedItem.warranty_expiry)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Assigned To:</span>
                  <p className="font-medium">{selectedItem.assigned_to || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Location:</span>
                  <p className="font-medium">{selectedItem.location || '-'}</p>
                </div>
                {selectedItem.notes && (
                  <div>
                    <span className="text-sm text-gray-600">Notes:</span>
                    <p className="font-medium text-sm">{selectedItem.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* History */}
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 border-b pb-2 mb-4">
                Maintenance & History Log
              </h4>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((log) => (
                    <div
                      key={log.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="badge-info capitalize">
                              {log.action_type.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-gray-600">
                              {formatDate(log.action_date)}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mb-1">
                            {log.description}
                          </p>
                          {log.performed_by && (
                            <p className="text-sm text-gray-600">
                              By: {log.performed_by}
                            </p>
                          )}
                          {log.cost && log.cost > 0 && (
                            <p className="text-sm text-green-600 font-medium">
                              Cost: ₱{log.cost.toFixed(2)}
                            </p>
                          )}
                          {log.notes && (
                            <p className="text-sm text-gray-500 mt-1">
                              {log.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No history records yet
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  openModal(selectedItem)
                }}
                className="btn-primary flex-1"
              >
                Edit Asset
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="btn-secondary flex-1"
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
