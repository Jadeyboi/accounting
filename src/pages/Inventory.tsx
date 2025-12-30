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
  const [actionType, setActionType] = useState<
    'maintenance' | 'repair' | 'transfer' | 'status_change'
  >('maintenance')
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

    if (!error) setItems(data || [])
    setLoading(false)
  }

  const fetchHistory = async (inventoryId: string) => {
    const { data } = await supabase
      .from('inventory_history')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('action_date', { ascending: false })

    setHistory(data || [])
  }

  // ✅ FIX: Accept undefined safely
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'N/A'

    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}-${date.getFullYear()}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge-success">Active</span>
      case 'under_repair':
        return <span className="badge-warning">Under Repair</span>
      case 'disposed':
      case 'lost':
        return <span className="badge-danger">{status}</span>
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

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.asset_tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.model?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  const categories = [...new Set(items.map(item => item.category))]

  const resetForm = () => {
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
    setEditingItem(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
      
      if (!error) {
        fetchItems()
        setShowModal(false)
        resetForm()
      }
    } else {
      const { error } = await supabase
        .from('inventory')
        .insert([itemData])
      
      if (!error) {
        fetchItems()
        setShowModal(false)
        resetForm()
      }
    }
  }

  const handleEdit = (item: InventoryItem) => {
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
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)
      
      if (!error) {
        fetchItems()
      }
    }
  }

  const handleViewDetails = (item: InventoryItem) => {
    setSelectedItem(item)
    fetchHistory(item.id)
    setShowDetailModal(true)
  }

  const handleAddHistory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    const historyData = {
      inventory_id: selectedItem.id,
      action_type: actionType,
      description: actionDescription,
      performed_by: performedBy || null,
      action_date: new Date().toISOString(),
      cost: actionCost || null,
      notes: actionNotes || null,
    }

    const { error } = await supabase
      .from('inventory_history')
      .insert([historyData])
    
    if (!error) {
      fetchHistory(selectedItem.id)
      setActionDescription('')
      setPerformedBy('')
      setActionCost(0)
      setActionNotes('')
      setShowHistoryModal(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="btn-primary"
        >
          Add New Item
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="under_repair">Under Repair</option>
          <option value="disposed">Disposed</option>
          <option value="lost">Lost</option>
        </select>
        <div className="text-sm text-gray-600 flex items-center">
          Total Items: {filteredItems.length}
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="glass rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{item.item_description}</h3>
                {item.asset_tag && (
                  <p className="text-sm text-gray-600">Tag: {item.asset_tag}</p>
                )}
              </div>
              {getStatusBadge(item.status)}
            </div>
            
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">Category:</span> {item.category}</p>
              {item.brand && <p><span className="font-medium">Brand:</span> {item.brand}</p>}
              {item.model && <p><span className="font-medium">Model:</span> {item.model}</p>}
              {item.assigned_to && <p><span className="font-medium">Assigned to:</span> {item.assigned_to}</p>}
              {item.location && <p><span className="font-medium">Location:</span> {item.location}</p>}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleViewDetails(item)}
                className="btn-secondary text-xs flex-1"
              >
                Details
              </button>
              <button
                onClick={() => handleEdit(item)}
                className="btn-primary text-xs flex-1"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="btn-danger text-xs flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No inventory items found.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset Tag
                  </label>
                  <input
                    type="text"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warranty Expiry
                  </label>
                  <input
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="input-field"
                  >
                    <option value="active">Active</option>
                    <option value="under_repair">Under Repair</option>
                    <option value="disposed">Disposed</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="input-field"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              Asset Details: {selectedItem.item_description}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <p><span className="text-gray-600">Asset Tag:</span> <strong>{selectedItem.asset_tag || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Category:</span> <strong>{selectedItem.category}</strong></p>
                <p><span className="text-gray-600">Brand:</span> <strong>{selectedItem.brand || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Model:</span> <strong>{selectedItem.model || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Serial Number:</span> <strong>{selectedItem.serial_number || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Purchase Date:</span> <strong>{formatDate(selectedItem.purchase_date)}</strong></p>
                <p><span className="text-gray-600">Purchase Price:</span> <strong>{selectedItem.purchase_price ? `₱${selectedItem.purchase_price.toLocaleString()}` : 'N/A'}</strong></p>
              </div>
              <div className="space-y-3">
                <p><span className="text-gray-600">Supplier:</span> <strong>{selectedItem.supplier || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Warranty Expiry:</span> <strong>{formatDate(selectedItem.warranty_expiry)}</strong></p>
                <p><span className="text-gray-600">Assigned To:</span> <strong>{selectedItem.assigned_to || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Location:</span> <strong>{selectedItem.location || 'N/A'}</strong></p>
                <p><span className="text-gray-600">Status:</span> {getStatusBadge(selectedItem.status)}</p>
                <p><span className="text-gray-600">Condition:</span> <strong>{selectedItem.condition || 'N/A'}</strong></p>
                {selectedItem.notes && (
                  <p><span className="text-gray-600">Notes:</span> <strong>{selectedItem.notes}</strong></p>
                )}
              </div>
            </div>

            {/* History Section */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">History</h4>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="btn-primary text-sm"
                >
                  Add History
                </button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {history.map((record) => (
                  <div key={record.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{record.action_type.replace('_', ' ').toUpperCase()}</p>
                        <p className="text-sm text-gray-600">{record.description}</p>
                        {record.performed_by && (
                          <p className="text-xs text-gray-500">By: {record.performed_by}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{formatDate(record.action_date)}</p>
                        {record.cost && <p>₱{record.cost.toLocaleString()}</p>}
                      </div>
                    </div>
                    {record.notes && (
                      <p className="text-xs text-gray-600 mt-2">{record.notes}</p>
                    )}
                  </div>
                ))}
                {history.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No history records found.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
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

      {/* Add History Modal */}
      {showHistoryModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Add History Record</h3>

            <form onSubmit={handleAddHistory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="input-field"
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="repair">Repair</option>
                  <option value="transfer">Transfer</option>
                  <option value="status_change">Status Change</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performed By
                </label>
                <input
                  type="text"
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={actionCost}
                  onChange={(e) => setActionCost(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
