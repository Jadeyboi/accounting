import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { InventoryItem, InventoryHistory } from '@/types'
import QRCode from 'qrcode'
import QrScanner from 'qr-scanner'

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [history, setHistory] = useState<InventoryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [qrCodeDataURL, setQrCodeDataURL] = useState('')
  const [scanResult, setScanResult] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkQRModal, setShowBulkQRModal] = useState(false)
  const [bulkQRCodes, setBulkQRCodes] = useState<Array<{item: InventoryItem, qrCode: string}>>([])
  const [generatingBulkQR, setGeneratingBulkQR] = useState(false)

  // Predefined categories
  const predefinedCategories = [
    'Monitor',
    'PC/Desktop',
    'Laptop',
    'Console',
    'Printer',
    'Scanner',
    'Projector',
    'Router/Switch',
    'Server',
    'Tablet',
    'Phone',
    'Camera',
    'Audio Equipment',
    'Storage Device',
    'Accessories',
    'Furniture',
    'Other'
  ]

  // Asset tag prefixes
  const assetTagPrefixes = [
    'MON', // Monitor
    'PC',  // PC/Desktop
    'LAP', // Laptop
    'CON', // Console
    'PRT', // Printer
    'SCN', // Scanner
    'PRJ', // Projector
    'NET', // Network Equipment
    'SRV', // Server
    'TAB', // Tablet
    'PHN', // Phone
    'CAM', // Camera
    'AUD', // Audio
    'STG', // Storage
    'ACC', // Accessories
    'FUR', // Furniture
    'OTH'  // Other
  ]

  // Form states
  const [assetTag, setAssetTag] = useState('')
  const [assetTagPrefix, setAssetTagPrefix] = useState('MON')
  const [assetTagNumber, setAssetTagNumber] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [category, setCategory] = useState('Monitor')
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

  // Auto-generate asset tag when prefix or number changes
  useEffect(() => {
    if (assetTagPrefix && assetTagNumber) {
      const paddedNumber = assetTagNumber.padStart(3, '0')
      setAssetTag(`${assetTagPrefix}-${paddedNumber}`)
    }
  }, [assetTagPrefix, assetTagNumber])

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

  const categories = [...new Set([...predefinedCategories, ...items.map(item => item.category)])]

  // Handle item selection
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const selectAllItems = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)))
    }
  }

  // Generate bulk QR codes
  const generateBulkQRCodes = async () => {
    if (selectedItems.size === 0) {
      alert('Please select items to generate QR codes')
      return
    }

    setGeneratingBulkQR(true)
    const selectedItemsData = items.filter(item => selectedItems.has(item.id))
    const qrCodesData = []

    try {
      for (const item of selectedItemsData) {
        const qrData = JSON.stringify({
          id: item.id,
          asset_tag: item.asset_tag,
          description: item.item_description,
          category: item.category,
          brand: item.brand,
          model: item.model
        })
        
        const dataURL = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        
        qrCodesData.push({ item, qrCode: dataURL })
      }

      setBulkQRCodes(qrCodesData)
      setShowBulkQRModal(true)
    } catch (error) {
      console.error('Error generating bulk QR codes:', error)
      alert('Failed to generate QR codes')
    } finally {
      setGeneratingBulkQR(false)
    }
  }

  // Print bulk QR codes
  const printBulkQRCodes = () => {
    if (bulkQRCodes.length === 0) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const qrCodesHtml = bulkQRCodes.map(({ item, qrCode }) => `
        <div class="qr-container">
          <img src="/avensetech-logo.jpg" alt="Avensetech Logo" class="logo" />
          <div class="company-text">Property of Avensetech</div>
          <div class="qr-code">
            <img src="${qrCode}" alt="QR Code" />
          </div>
          <div class="item-info">
            <div class="asset-tag">${item.asset_tag || 'No Asset Tag'}</div>
            <div>${item.item_description}</div>
            <div>${item.brand || ''} ${item.model || ''}</div>
          </div>
        </div>
      `).join('')

      printWindow.document.write(`
        <html>
          <head>
            <title>Bulk QR Codes - ${bulkQRCodes.length} Items</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 10px; 
                margin: 0;
              }
              .qr-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 10px;
                page-break-inside: avoid;
              }
              .qr-container {
                border: 2px solid #000;
                padding: 10px;
                text-align: center;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .logo {
                width: 60px;
                height: auto;
                margin-bottom: 5px;
              }
              .company-text {
                font-size: 8px;
                font-weight: bold;
                color: #333;
                margin-bottom: 8px;
                text-transform: uppercase;
              }
              .qr-code {
                margin: 5px 0;
              }
              .qr-code img {
                width: 120px;
                height: 120px;
              }
              .item-info {
                margin-top: 5px;
                font-size: 9px;
                line-height: 1.2;
              }
              .asset-tag {
                font-weight: bold;
                font-size: 10px;
                margin-bottom: 3px;
              }
              @media print {
                .qr-container {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="qr-grid">
              ${qrCodesHtml}
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const resetForm = () => {
    setAssetTag('')
    setAssetTagPrefix('MON')
    setAssetTagNumber('')
    setItemDescription('')
    setCategory('Monitor')
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

  const generateQRCode = async (item: InventoryItem) => {
    try {
      const qrData = JSON.stringify({
        id: item.id,
        asset_tag: item.asset_tag,
        description: item.item_description,
        category: item.category,
        brand: item.brand,
        model: item.model
      })
      
      const dataURL = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      setQrCodeDataURL(dataURL)
      setSelectedItem(item)
      setShowQRModal(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
      alert('Failed to generate QR code')
    }
  }

  const startScanner = async () => {
    try {
      setShowScannerModal(true)
      setScanResult('')
      
      // Wait for modal to render
      setTimeout(async () => {
        if (videoRef.current) {
          try {
            // First, request camera permission explicitly
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                facingMode: 'environment' // Prefer back camera
              } 
            })
            
            // Set the stream to video element
            videoRef.current.srcObject = stream
            
            const qrScanner = new QrScanner(
              videoRef.current,
              (result) => {
                try {
                  const data = JSON.parse(result.data)
                  setScanResult(`Found item: ${data.description || 'Unknown'} (${data.asset_tag || 'No tag'})`)
                  
                  // Find and highlight the item
                  const foundItem = items.find(item => item.id === data.id)
                  if (foundItem) {
                    setSelectedItem(foundItem)
                    setShowDetailModal(true)
                    stopScanner()
                  }
                } catch (e) {
                  setScanResult(`QR Code content: ${result.data}`)
                }
              },
              {
                highlightScanRegion: true,
                highlightCodeOutline: true,
              }
            )
            
            qrScannerRef.current = qrScanner
            await qrScanner.start()
          } catch (error) {
            console.error('QR Scanner error:', error)
            setScanResult('Camera access denied or not available. Please allow camera access and try again.')
          }
        }
      }, 200)
    } catch (error) {
      console.error('Error starting scanner:', error)
      alert('Failed to start camera. Please check camera permissions.')
    }
  }

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    
    // Stop video stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    
    setShowScannerModal(false)
  }

  const downloadQRCode = () => {
    if (qrCodeDataURL && selectedItem) {
      const link = document.createElement('a')
      link.download = `QR_${selectedItem.asset_tag || selectedItem.id}.png`
      link.href = qrCodeDataURL
      link.click()
    }
  }

  const printQRCode = () => {
    if (qrCodeDataURL && selectedItem) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>QR Code - ${selectedItem.asset_tag || selectedItem.item_description}</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  text-align: center; 
                  padding: 20px; 
                  margin: 0;
                }
                .qr-container {
                  border: 2px solid #000;
                  padding: 15px;
                  display: inline-block;
                  margin: 20px;
                  max-width: 300px;
                }
                .logo {
                  width: 80px;
                  height: auto;
                  margin-bottom: 10px;
                }
                .company-text {
                  font-size: 10px;
                  font-weight: bold;
                  color: #333;
                  margin-bottom: 15px;
                  text-transform: uppercase;
                }
                .qr-code {
                  margin: 10px 0;
                }
                .item-info {
                  margin-top: 10px;
                  font-size: 11px;
                  line-height: 1.3;
                }
                .asset-tag {
                  font-weight: bold;
                  font-size: 12px;
                  margin-bottom: 5px;
                }
              </style>
            </head>
            <body>
              <div class="qr-container">
                <img src="/avensetech-logo.jpg" alt="Avensetech Logo" class="logo" />
                <div class="company-text">Property of Avensetech</div>
                <div class="qr-code">
                  <img src="${qrCodeDataURL}" alt="QR Code" />
                </div>
                <div class="item-info">
                  <div class="asset-tag">${selectedItem.asset_tag || 'No Asset Tag'}</div>
                  <div>${selectedItem.item_description}</div>
                  <div>${selectedItem.brand || ''} ${selectedItem.model || ''}</div>
                </div>
              </div>
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
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
    
    // Parse existing asset tag
    if (item.asset_tag && item.asset_tag.includes('-')) {
      const [prefix, number] = item.asset_tag.split('-')
      setAssetTagPrefix(prefix)
      setAssetTagNumber(number)
    } else {
      setAssetTagPrefix('MON')
      setAssetTagNumber('')
    }
    
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
        <div className="flex gap-2 flex-wrap">
          {selectedItems.size > 0 && (
            <>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {selectedItems.size} selected
              </span>
              <button
                onClick={generateBulkQRCodes}
                disabled={generatingBulkQR}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                {generatingBulkQR ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h5m0 0v5m0 0h5m0 0V4" />
                    </svg>
                    Bulk QR ({selectedItems.size})
                  </>
                )}
              </button>
            </>
          )}
          <button
            onClick={startScanner}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 4h5m0 0v5m0 0h5m0 0V4" />
            </svg>
            Scan QR
          </button>
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
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="selectAll"
            checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
            onChange={selectAllItems}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="selectAll" className="ml-2 text-sm text-gray-700">
            Select All ({filteredItems.length})
          </label>
        </div>
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
          <div key={item.id} className="glass rounded-xl p-4 space-y-3 relative">
            <div className="absolute top-3 left-3">
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={() => toggleItemSelection(item.id)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            
            <div className="flex justify-between items-start pl-8">
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
                onClick={() => generateQRCode(item)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs flex-1"
              >
                QR
              </button>
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset Tag Generator
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={assetTagPrefix}
                      onChange={(e) => setAssetTagPrefix(e.target.value)}
                      className="input-field flex-1"
                    >
                      {assetTagPrefixes.map(prefix => (
                        <option key={prefix} value={prefix}>{prefix}</option>
                      ))}
                    </select>
                    <span className="flex items-center text-gray-500">-</span>
                    <input
                      type="number"
                      placeholder="001"
                      value={assetTagNumber}
                      onChange={(e) => setAssetTagNumber(e.target.value)}
                      className="input-field flex-1"
                      min="1"
                      max="999"
                    />
                  </div>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={assetTag}
                      onChange={(e) => setAssetTag(e.target.value)}
                      className="input-field"
                      placeholder="Generated asset tag or enter manually"
                    />
                  </div>
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
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field"
                    required
                  >
                    {predefinedCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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

      {/* QR Code Display Modal */}
      {showQRModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 text-center">
            <div className="mb-4">
              <img 
                src="/avensetech-logo.jpg" 
                alt="Avensetech Logo" 
                className="mx-auto h-12 w-auto mb-2"
              />
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">{selectedItem.item_description}</p>
              <p className="text-xs text-gray-500">{selectedItem.asset_tag || 'No Asset Tag'}</p>
            </div>

            {qrCodeDataURL && (
              <div className="mb-6">
                <img 
                  src={qrCodeDataURL} 
                  alt="QR Code" 
                  className="mx-auto border-2 border-gray-200 rounded-lg"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowQRModal(false)}
                className="btn-secondary flex-1"
              >
                Close
              </button>
              <button
                onClick={downloadQRCode}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex-1"
              >
                Download
              </button>
              <button
                onClick={printQRCode}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex-1"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Scan QR Code</h3>
            
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600 mb-2">
                Point your camera at a QR code to scan
              </p>
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg border-2 border-gray-300"
                playsInline
                muted
                autoPlay
              />
            </div>

            {scanResult && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">{scanResult}</p>
              </div>
            )}

            <div className="text-xs text-gray-500 mb-4 text-center">
              Make sure to allow camera access when prompted by your browser
            </div>

            <div className="flex gap-3">
              <button
                onClick={stopScanner}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk QR Codes Modal */}
      {showBulkQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <img 
                  src="/avensetech-logo.jpg" 
                  alt="Avensetech Logo" 
                  className="h-8 w-auto mb-2"
                />
                <h3 className="text-xl font-bold text-gray-900">
                  Bulk QR Codes ({bulkQRCodes.length} items)
                </h3>
              </div>
              <button
                onClick={() => setShowBulkQRModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {bulkQRCodes.map(({ item, qrCode }) => (
                <div key={item.id} className="border-2 border-gray-200 rounded-lg p-3 text-center bg-white">
                  <img 
                    src="/avensetech-logo.jpg" 
                    alt="Avensetech Logo" 
                    className="w-12 h-auto mx-auto mb-1"
                  />
                  <div className="text-xs text-gray-600 mb-2">Property of Avensetech</div>
                  <img 
                    src={qrCode} 
                    alt="QR Code" 
                    className="w-24 h-24 mx-auto mb-2"
                  />
                  <div className="text-xs">
                    <div className="font-bold">{item.asset_tag || 'No Tag'}</div>
                    <div className="truncate">{item.item_description}</div>
                    <div className="text-gray-500">{item.brand} {item.model}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkQRModal(false)}
                className="btn-secondary flex-1"
              >
                Close
              </button>
              <button
                onClick={printBulkQRCodes}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex-1 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print All QR Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
