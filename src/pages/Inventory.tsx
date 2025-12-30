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

  return (
    <div className="space-y-6">
      {/* ================= DETAILS MODAL ================= */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              Asset Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3">
                <p>
                  <span className="text-gray-600">Purchase Date:</span>{' '}
                  <strong>{formatDate(selectedItem.purchase_date)}</strong>
                </p>
                <p>
                  <span className="text-gray-600">Warranty Expiry:</span>{' '}
                  <strong>{formatDate(selectedItem.warranty_expiry)}</strong>
                </p>
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
    </div>
  )
}
