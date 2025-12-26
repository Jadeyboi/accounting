import { useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface InvoiceItem {
  id: string
  description: string
  amount: number
}

interface SavedClient {
  name: string
  email: string
  address: string
}

interface SavedDescription {
  id: string
  text: string
}

export default function Invoice() {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', amount: 0 }
  ])
  
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('Payment due within 30 days')

  // Saved clients and descriptions
  const [savedClients, setSavedClients] = useState<SavedClient[]>([])
  const [savedDescriptions, setSavedDescriptions] = useState<SavedDescription[]>([])
  const [showClientModal, setShowClientModal] = useState(false)
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // Load saved data from localStorage
  useEffect(() => {
    const clients = localStorage.getItem('savedClients')
    const descriptions = localStorage.getItem('savedDescriptions')
    if (clients) setSavedClients(JSON.parse(clients))
    if (descriptions) setSavedDescriptions(JSON.parse(descriptions))
  }, [])

  const saveClient = () => {
    if (!clientName.trim()) {
      alert('Please enter a client name')
      return
    }
    const newClient: SavedClient = {
      name: clientName,
      email: clientEmail,
      address: clientAddress
    }
    const updated = [...savedClients, newClient]
    setSavedClients(updated)
    localStorage.setItem('savedClients', JSON.stringify(updated))
    alert('Client saved successfully!')
  }

  const loadClient = (client: SavedClient) => {
    setClientName(client.name)
    setClientEmail(client.email)
    setClientAddress(client.address)
    setShowClientModal(false)
  }

  const deleteClient = (index: number) => {
    if (confirm('Delete this client?')) {
      const updated = savedClients.filter((_, i) => i !== index)
      setSavedClients(updated)
      localStorage.setItem('savedClients', JSON.stringify(updated))
    }
  }

  const saveDescription = () => {
    if (!newDescription.trim()) {
      alert('Please enter a description')
      return
    }
    const newDesc: SavedDescription = {
      id: Date.now().toString(),
      text: newDescription
    }
    const updated = [...savedDescriptions, newDesc]
    setSavedDescriptions(updated)
    localStorage.setItem('savedDescriptions', JSON.stringify(updated))
    setNewDescription('')
    alert('Description saved successfully!')
  }

  const loadDescription = (desc: SavedDescription) => {
    if (selectedItemId) {
      updateItem(selectedItemId, 'description', desc.text)
    }
    setShowDescriptionModal(false)
    setSelectedItemId(null)
  }

  const deleteDescription = (id: string) => {
    if (confirm('Delete this description?')) {
      const updated = savedDescriptions.filter(d => d.id !== id)
      setSavedDescriptions(updated)
      localStorage.setItem('savedDescriptions', JSON.stringify(updated))
    }
  }

  const addItem = () => {
    const newId = (Math.max(...items.map(i => parseInt(i.id)), 0) + 1).toString()
    setItems([...items, { id: newId, description: '', amount: 0 }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const tax = 0 // No tax
  const total = subtotal + tax

  const saveInvoiceToHistory = () => {
    const invoice = {
      id: Date.now().toString(),
      invoiceNumber,
      invoiceDate,
      dueDate,
      clientName,
      clientEmail,
      clientAddress,
      items,
      notes,
      terms,
      subtotal,
      tax,
      total,
      createdAt: new Date().toISOString()
    }

    const saved = localStorage.getItem('savedInvoices')
    const invoices = saved ? JSON.parse(saved) : []
    invoices.push(invoice)
    localStorage.setItem('savedInvoices', JSON.stringify(invoices))
  }

  const handlePrint = async () => {
    const invoiceElement = document.getElementById('invoice-content')
    if (!invoiceElement) {
      alert('Invoice content not found')
      return
    }

    try {
      // Clone the invoice element to avoid modifying the original
      const clonedElement = invoiceElement.cloneNode(true) as HTMLElement
      
      // Remove all elements with print:hidden class from clone
      const hiddenElements = clonedElement.querySelectorAll('.print\\:hidden')
      hiddenElements.forEach(el => el.remove())
      
      // Show all print:block elements in clone
      const printOnlyElements = clonedElement.querySelectorAll('.print\\:block')
      printOnlyElements.forEach(el => {
        (el as HTMLElement).style.display = 'block'
      })

      // Temporarily add clone to document for rendering
      clonedElement.style.position = 'absolute'
      clonedElement.style.left = '-9999px'
      document.body.appendChild(clonedElement)

      // Generate canvas from the cloned invoice
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200
      })

      // Remove the clone
      document.body.removeChild(clonedElement)

      // Create PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // Generate filename
      const filename = invoiceNumber 
        ? `Invoice-${invoiceNumber}.pdf` 
        : `Invoice-${new Date().toISOString().split('T')[0]}.pdf`
      
      pdf.save(filename)
      
      // Save invoice to history
      saveInvoiceToHistory()
      alert('Invoice saved successfully!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const handleReset = () => {
    setInvoiceNumber('')
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setClientName('')
    setClientEmail('')
    setClientAddress('')
    setItems([{ id: '1', description: '', amount: 0 }])
    setNotes('')
    setTerms('Payment due within 30 days')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Invoice Maker</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowClientModal(true)}
            className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            📋 Saved Clients
          </button>
          <button
            onClick={() => setShowDescriptionModal(true)}
            className="rounded bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
          >
            📝 Saved Descriptions
          </button>
          <button
            onClick={handleReset}
            className="rounded bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
          >
            Reset
          </button>
          <button
            onClick={handlePrint}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save as PDF
          </button>
        </div>
      </div>

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:hidden">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Saved Clients</h3>
              <button
                onClick={() => setShowClientModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h4 className="mb-2 font-semibold text-blue-900">Save Current Client</h4>
              <p className="mb-3 text-sm text-blue-700">Fill in the client details in the invoice form, then click save.</p>
              <button
                onClick={saveClient}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                💾 Save Current Client
              </button>
            </div>

            <div className="space-y-3">
              {savedClients.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No saved clients yet</p>
              ) : (
                savedClients.map((client, index) => (
                  <div key={index} className="flex items-start justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-600">{client.email}</div>
                      <div className="text-sm text-gray-500">{client.address}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadClient(client)}
                        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteClient(index)}
                        className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Description Modal */}
      {showDescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:hidden">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Saved Descriptions</h3>
              <button
                onClick={() => { setShowDescriptionModal(false); setSelectedItemId(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h4 className="mb-2 font-semibold text-purple-900">Add New Description</h4>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter a description template (e.g., 'Website Development - Full Stack Application')"
                rows={3}
                className="mb-3 w-full rounded border border-purple-300 px-3 py-2 text-sm"
              />
              <button
                onClick={saveDescription}
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                💾 Save Description
              </button>
            </div>

            <div className="space-y-3">
              {savedDescriptions.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No saved descriptions yet</p>
              ) : (
                savedDescriptions.map((desc) => (
                  <div key={desc.id} className="flex items-start justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                    <div className="flex-1 text-sm text-gray-700">{desc.text}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadDescription(desc)}
                        className="rounded bg-purple-500 px-3 py-1 text-sm text-white hover:bg-purple-600"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => deleteDescription(desc.id)}
                        className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div id="invoice-content" className="rounded-lg border border-gray-200 bg-white shadow-lg" style={{ maxWidth: '210mm', margin: '0 auto' }}>
        {/* Header Section */}
        <div className="border-b-4 border-blue-600 bg-white p-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <img src="/avensetech-logo.jpg" alt="Avensetech Logo" className="h-24 w-24 rounded object-contain shadow-sm" />
              <div>
                <p className="mt-1 text-sm text-gray-600">2-806, Oakridge Business Park, Banilad, Mandaue City</p>
                <p className="text-sm text-gray-600">(032) 234-1362 • 09297246296</p>
              </div>
            </div>
            <div>
              <h2 className="text-right text-4xl font-bold text-blue-600">INVOICE</h2>
            </div>
          </div>
        </div>

        {/* Invoice Details and Bill To */}
        <div className="bg-gray-50 p-10">
          <div className="grid grid-cols-2 gap-12">
            {/* Bill To Section */}
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Bill To:</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client Name"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
                />
                <p className="hidden text-sm font-semibold text-gray-900 print:block">{clientName || 'Client Name'}</p>
                
                <textarea
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Client Address"
                  rows={3}
                  className="w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
                />
                <p className="hidden whitespace-pre-line text-sm text-gray-700 print:block">{clientAddress || 'Client Address'}</p>
              </div>
            </div>

          {/* Invoice Info */}
          <div className="space-y-3">
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <span className="text-xs font-bold uppercase text-gray-500">Invoice #:</span>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
                className="rounded border border-gray-300 bg-white px-3 py-2 text-right text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
              />
              <span className="hidden print:block"></span>
              <p className="hidden text-right text-sm font-semibold text-gray-900 print:block">{invoiceNumber || 'INV-001'}</p>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <span className="text-xs font-bold uppercase text-gray-500">Date:</span>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
              />
              <span className="hidden print:block"></span>
              <p className="hidden text-right text-sm text-gray-900 print:block">{invoiceDate}</p>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <span className="text-xs font-bold uppercase text-gray-500">Due Date:</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
              />
              <span className="hidden print:block"></span>
              <p className="hidden text-right text-sm text-gray-900 print:block">{dueDate || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="p-10">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Description</th>
                <th className="w-40 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-700">Amount</th>
                <th className="w-10 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-3">
                    <div className="flex gap-2 print:hidden">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => { setSelectedItemId(item.id); setShowDescriptionModal(true); }}
                        className="rounded bg-purple-100 px-2 text-xs text-purple-700 hover:bg-purple-200"
                        title="Load saved description"
                      >
                        📝
                      </button>
                    </div>
                    <p className="hidden py-1 text-sm text-gray-900 print:block">{item.description || 'Item description'}</p>
                  </td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
                    />
                    <p className="hidden py-1 text-sm font-medium text-gray-900 print:block">${item.amount.toFixed(2)}</p>
                  </td>
                  <td className="py-3 text-center print:hidden">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-800"
                      disabled={items.length === 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addItem}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 print:hidden"
          >
            + Add Item
          </button>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 p-10">
          <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between border-b border-gray-200 py-2 text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 py-2 text-sm">
              <span className="text-gray-600">Tax (0%):</span>
              <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-800 py-3">
              <span className="text-lg font-bold text-gray-900">Total:</span>
              <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes and Terms */}
        <div className="space-y-4 border-t border-gray-200 p-10">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or special instructions"
              rows={2}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
            />
            <p className="hidden whitespace-pre-line text-sm text-gray-700 print:block">{notes || 'No additional notes'}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-500">Terms & Conditions</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden"
            />
            <p className="hidden whitespace-pre-line text-sm text-gray-700 print:block">{terms}</p>
          </div>
        </div>
        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-100 p-6 text-center">
          <p className="text-xs text-gray-600">Thank you for your business!</p>
          <p className="mt-1 text-xs text-gray-500">Avensetech Software Development Services • 2-806, Oakridge Business Park, Banilad, Mandaue City</p>
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
