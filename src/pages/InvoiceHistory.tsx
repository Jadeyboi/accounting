import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface InvoiceItem {
  id: string
  description: string
  amount: number
}

interface SavedInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientName: string
  clientEmail: string
  clientAddress: string
  items: InvoiceItem[]
  notes: string
  terms: string
  subtotal: number
  tax: number
  total: number
  createdAt: string
}

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState<SavedInvoice[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = () => {
    const saved = localStorage.getItem('savedInvoices')
    if (saved) {
      const parsed = JSON.parse(saved)
      setInvoices(parsed.sort((a: SavedInvoice, b: SavedInvoice) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ))
    }
  }

  const deleteInvoice = (id: string) => {
    if (confirm('Delete this invoice?')) {
      const updated = invoices.filter(inv => inv.id !== id)
      setInvoices(updated)
      localStorage.setItem('savedInvoices', JSON.stringify(updated))
    }
  }

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoice History</h2>
          <p className="text-sm text-gray-600">View and manage previously created invoices</p>
        </div>
        <button
          onClick={() => navigate('/invoice')}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create New Invoice
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by invoice number or client name..."
          className="w-full rounded-md border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">
            {searchTerm ? 'No invoices found matching your search' : 'No invoices saved yet'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => navigate('/invoice')}
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Your First Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber || 'No Number'}</h3>
                  <p className="text-sm text-gray-600">{invoice.clientName || 'No Client'}</p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                  ${invoice.total.toFixed(2)}
                </span>
              </div>

              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium text-gray-900">{invoice.invoiceDate}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due:</span>
                    <span className="font-medium text-gray-900">{invoice.dueDate}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Items:</span>
                  <span className="font-medium text-gray-900">{invoice.items.length}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="mb-3 max-h-20 overflow-y-auto text-xs text-gray-600">
                  {invoice.items.map((item, idx) => (
                    <div key={idx} className="truncate">• {item.description || 'No description'}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/invoice?load=${invoice.id}`)}
                    className="flex-1 rounded bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    View/Edit
                  </button>
                  <button
                    onClick={() => deleteInvoice(invoice.id)}
                    className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                Created: {new Date(invoice.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
