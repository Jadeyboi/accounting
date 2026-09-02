import { useState, useEffect } from 'react'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/Pagination'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type Tab = 'maker' | 'history'

interface InvoiceItem {
  id: string
  description: string
  qty: number
  unitPrice: number
  amount: number // computed: qty * unitPrice
}

interface SavedClient {
  id: string
  name: string
  email: string
  address: string
}

interface SavedDescription {
  id: string
  text: string
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
  status: 'unpaid' | 'paid'
  createdAt: string
}

export default function Invoice() {
  const [activeTab, setActiveTab] = useState<Tab>('maker')

  // ── Maker state ──────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([{ id: '1', description: '', qty: 1, unitPrice: 0, amount: 0 }])

  // Saved clients and descriptions
  const [savedClients, setSavedClients] = useState<SavedClient[]>([])
  const [savedDescriptions, setSavedDescriptions] = useState<SavedDescription[]>([])
  const [showClientModal, setShowClientModal] = useState(false)
  const [showDescriptionModal, setShowDescriptionModal] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [logoDataUrl, setLogoDataUrl] = useState<string>('/avensetech-logo.jpg')

  // ── History state ─────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<SavedInvoice[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // ── Load persisted data from Supabase ──────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      await migrateLocalStorageToSupabase()
      await loadClients()
      await loadDescriptions()
      await loadInvoices()
    })()
    // Preload the logo as a base64 data URL so it renders reliably in the PDF (html2canvas)
    fetch('/avensetech-logo.jpg')
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader()
        reader.onloadend = () => setLogoDataUrl(reader.result as string)
        reader.readAsDataURL(blob)
      })
      .catch((err) => console.error('Failed to preload logo:', err))
  }, [])

  // One-time migration of any legacy localStorage data into Supabase.
  // Runs once per browser, then removes the old keys so it never repeats.
  const migrateLocalStorageToSupabase = async () => {
    if (localStorage.getItem('invoiceMigrationDone') === 'true') return

    try {
      // Clients
      const rawClients = localStorage.getItem('savedClients')
      if (rawClients) {
        const clients = JSON.parse(rawClients) as Array<{ name: string; email?: string; address?: string }>
        if (Array.isArray(clients) && clients.length > 0) {
          const rows = clients
            .filter((c) => c && c.name)
            .map((c) => ({ name: c.name, email: c.email || '', address: c.address || '' }))
          if (rows.length > 0) {
            const { error } = await supabase.from('invoice_clients').insert(rows)
            if (error) throw error
          }
        }
      }

      // Descriptions
      const rawDescriptions = localStorage.getItem('savedDescriptions')
      if (rawDescriptions) {
        const descriptions = JSON.parse(rawDescriptions) as Array<{ text: string }>
        if (Array.isArray(descriptions) && descriptions.length > 0) {
          const rows = descriptions
            .filter((d) => d && d.text)
            .map((d) => ({ text: d.text }))
          if (rows.length > 0) {
            const { error } = await supabase.from('invoice_descriptions').insert(rows)
            if (error) throw error
          }
        }
      }

      // Invoices (history)
      const rawInvoices = localStorage.getItem('savedInvoices')
      if (rawInvoices) {
        const invs = JSON.parse(rawInvoices) as SavedInvoice[]
        if (Array.isArray(invs) && invs.length > 0) {
          const rows = invs.map((inv) => ({
            invoice_number: inv.invoiceNumber || '',
            invoice_date: inv.invoiceDate || null,
            due_date: inv.dueDate || null,
            client_name: inv.clientName || '',
            client_email: inv.clientEmail || '',
            client_address: inv.clientAddress || '',
            items: inv.items || [],
            notes: inv.notes || '',
            terms: inv.terms || '',
            subtotal: inv.subtotal || 0,
            tax: inv.tax || 0,
            total: inv.total || 0,
            created_at: inv.createdAt || new Date().toISOString(),
          }))
          const { error } = await supabase.from('invoices').insert(rows)
          if (error) throw error
        }
      }

      // Mark done and clean up legacy keys so the migration never runs again
      localStorage.setItem('invoiceMigrationDone', 'true')
      localStorage.removeItem('savedClients')
      localStorage.removeItem('savedDescriptions')
      localStorage.removeItem('savedInvoices')
    } catch (err) {
      // Leave the legacy keys in place so the migration can be retried later
      console.error('Invoice localStorage migration failed:', err)
    }
  }

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('invoice_clients')
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      console.error('Error loading clients:', error)
      return
    }
    setSavedClients(
      (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email || '',
        address: c.address || '',
      }))
    )
  }

  const loadDescriptions = async () => {
    const { data, error } = await supabase
      .from('invoice_descriptions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error loading descriptions:', error)
      return
    }
    setSavedDescriptions((data || []).map((d) => ({ id: d.id, text: d.text })))
  }

  const mapInvoiceRow = (row: any): SavedInvoice => ({
    id: row.id,
    invoiceNumber: row.invoice_number || '',
    invoiceDate: row.invoice_date || '',
    dueDate: row.due_date || '',
    clientName: row.client_name || '',
    clientEmail: row.client_email || '',
    clientAddress: row.client_address || '',
    items: Array.isArray(row.items) ? row.items : [],
    notes: row.notes || '',
    terms: row.terms || '',
    subtotal: Number(row.subtotal) || 0,
    tax: Number(row.tax) || 0,
    total: Number(row.total) || 0,
    status: row.status === 'paid' ? 'paid' : 'unpaid',
    createdAt: row.created_at,
  })

  const loadInvoices = async (): Promise<SavedInvoice[]> => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error loading invoices:', error)
      return []
    }
    const rows = (data || []).map(mapInvoiceRow)
    setInvoices(rows)
    // Auto-generate the next invoice number from the highest existing one
    if (!invoiceNumber) setInvoiceNumber(computeNextInvoiceNumber(rows))
    return rows
  }

  // Compute the next invoice number based on the highest existing INV-#### number
  const computeNextInvoiceNumber = (list: SavedInvoice[]): string => {
    let maxNum = 0
    list.forEach((inv) => {
      const match = /(\d+)\s*$/.exec(inv.invoiceNumber || '')
      if (match) {
        const n = parseInt(match[1], 10)
        if (n > maxNum) maxNum = n
      }
    })
    return `INV-${String(maxNum + 1).padStart(4, '0')}`
  }

  // ── Client helpers ────────────────────────────────────────────────────────
  const saveClient = async () => {
    if (!clientName.trim()) { alert('Please enter a client name'); return }
    const { error } = await supabase.from('invoice_clients').insert({
      name: clientName,
      email: clientEmail,
      address: clientAddress,
    })
    if (error) {
      console.error('Error saving client:', error)
      alert('Failed to save client. Please try again.')
      return
    }
    await loadClients()
    alert('Client saved successfully!')
  }

  const loadClient = (client: SavedClient) => {
    setClientName(client.name)
    setClientEmail(client.email)
    setClientAddress(client.address)
    setShowClientModal(false)
  }

  const deleteClient = async (id: string) => {
    if (!confirm('Delete this client?')) return
    const { error } = await supabase.from('invoice_clients').delete().eq('id', id)
    if (error) {
      console.error('Error deleting client:', error)
      alert('Failed to delete client. Please try again.')
      return
    }
    await loadClients()
  }

  // ── Description helpers ───────────────────────────────────────────────────
  const saveDescription = async () => {
    if (!newDescription.trim()) { alert('Please enter a description'); return }
    const { error } = await supabase
      .from('invoice_descriptions')
      .insert({ text: newDescription })
    if (error) {
      console.error('Error saving description:', error)
      alert('Failed to save description. Please try again.')
      return
    }
    setNewDescription('')
    await loadDescriptions()
    alert('Description saved successfully!')
  }

  const loadDescription = (desc: SavedDescription) => {
    if (selectedItemId) updateItem(selectedItemId, 'description', desc.text)
    setShowDescriptionModal(false)
    setSelectedItemId(null)
  }

  const deleteDescription = async (id: string) => {
    if (!confirm('Delete this description?')) return
    const { error } = await supabase.from('invoice_descriptions').delete().eq('id', id)
    if (error) {
      console.error('Error deleting description:', error)
      alert('Failed to delete description. Please try again.')
      return
    }
    await loadDescriptions()
  }

  // ── Items helpers ─────────────────────────────────────────────────────────
  const addItem = () => {
    const newId = (Math.max(...items.map(i => parseInt(i.id)), 0) + 1).toString()
    setItems([...items, { id: newId, description: '', qty: 1, unitPrice: 0, amount: 0 }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      // Line amount is always qty * unit price
      updated.amount = (Number(updated.qty) || 0) * (Number(updated.unitPrice) || 0)
      return updated
    }))
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const tax = 0
  const total = subtotal + tax

  // ── Save / PDF ────────────────────────────────────────────────────────────
  const saveInvoiceToHistory = async (): Promise<SavedInvoice[] | null> => {
    const { error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate || null,
      due_date: dueDate || null,
      client_name: clientName,
      client_email: clientEmail,
      client_address: clientAddress,
      items,
      notes: '',
      terms: '',
      subtotal,
      tax,
      total,
    })
    if (error) {
      console.error('Error saving invoice:', error)
      alert('PDF downloaded, but saving to history failed. Please try again.')
      return null
    }
    const rows = await loadInvoices()
    return rows
  }

  const handlePrint = async () => {
    const invoiceElement = document.getElementById('invoice-content')
    if (!invoiceElement) { alert('Invoice content not found'); return }
    try {
      // Ensure the logo is an inline base64 data URL so html2canvas can render it
      let logoData = logoDataUrl
      if (!logoData.startsWith('data:')) {
        try {
          const res = await fetch('/avensetech-logo.jpg')
          const blob = await res.blob()
          logoData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        } catch (e) {
          console.error('Could not embed logo for PDF:', e)
        }
      }

      const clonedElement = invoiceElement.cloneNode(true) as HTMLElement
      clonedElement.querySelectorAll('.print\\:hidden').forEach(el => el.remove())
      clonedElement.querySelectorAll('.print\\:block').forEach(el => {
        (el as HTMLElement).style.display = 'block'
      })
      // Force the cloned logo to use the inline data URL
      const clonedLogo = clonedElement.querySelector('#invoice-logo') as HTMLImageElement | null
      if (clonedLogo && logoData.startsWith('data:')) clonedLogo.src = logoData

      clonedElement.style.position = 'absolute'
      clonedElement.style.left = '-9999px'
      document.body.appendChild(clonedElement)

      // Wait for the cloned logo image to finish decoding before capture
      if (clonedLogo && !clonedLogo.complete) {
        await new Promise<void>((resolve) => {
          clonedLogo.onload = () => resolve()
          clonedLogo.onerror = () => resolve()
        })
      }

      const canvas = await html2canvas(clonedElement, {
        scale: 2, useCORS: true, allowTaint: true, imageTimeout: 0, logging: false,
        backgroundColor: '#ffffff', windowWidth: 1200
      })
      document.body.removeChild(clonedElement)

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      // Filename: "<Client> - <InvoiceNumber>.pdf" for easy sorting/finding
      const safeClient = (clientName || 'Client').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ')
      const invNo = invoiceNumber || new Date().toISOString().split('T')[0]
      const filename = `${safeClient} - ${invNo}.pdf`
      pdf.save(filename)
      const savedRows = await saveInvoiceToHistory()
      if (savedRows) {
        alert('Invoice saved successfully!')
        // Reset the form and advance to the next auto-generated number
        // (use the freshly loaded list so the number increments correctly)
        startNewInvoice(savedRows)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  // Reset the form fields and assign the next auto-generated invoice number.
  // Optionally pass a fresh invoice list (e.g. right after saving) to avoid stale state.
  const startNewInvoice = (list?: SavedInvoice[]) => {
    setInvoiceNumber(computeNextInvoiceNumber(list ?? invoices))
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setClientName('')
    setClientEmail('')
    setClientAddress('')
    setItems([{ id: '1', description: '', qty: 1, unitPrice: 0, amount: 0 }])
  }

  const handleReset = () => {
    startNewInvoice()
  }

  // ── History helpers ───────────────────────────────────────────────────────
  const loadInvoiceIntoMaker = (invoice: SavedInvoice) => {
    setInvoiceNumber(invoice.invoiceNumber)
    setInvoiceDate(invoice.invoiceDate)
    setDueDate(invoice.dueDate)
    setClientName(invoice.clientName)
    setClientEmail(invoice.clientEmail)
    setClientAddress(invoice.clientAddress)
    // Normalize legacy items that may not have qty/unitPrice
    setItems(
      invoice.items.map((it) => {
        const qty = Number((it as InvoiceItem).qty) || 1
        const unitPrice =
          (it as InvoiceItem).unitPrice != null
            ? Number((it as InvoiceItem).unitPrice)
            : Number(it.amount) / (qty || 1)
        return {
          id: it.id,
          description: it.description,
          qty,
          unitPrice,
          amount: qty * unitPrice,
        }
      })
    )
    setActiveTab('maker')
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) {
      console.error('Error deleting invoice:', error)
      alert('Failed to delete invoice. Please try again.')
      return
    }
    await loadInvoices()
  }

  const toggleInvoiceStatus = async (invoice: SavedInvoice) => {
    const next = invoice.status === 'paid' ? 'unpaid' : 'paid'
    const { error } = await supabase.from('invoices').update({ status: next }).eq('id', invoice.id)
    if (error) {
      console.error('Error updating invoice status:', error)
      alert('Failed to update status. Please try again.')
      return
    }
    await loadInvoices()
  }

  // Derived helpers for status
  const isOverdue = (inv: SavedInvoice): boolean => {
    if (inv.status === 'paid' || !inv.dueDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(inv.dueDate)
    due.setHours(0, 0, 0, 0)
    return due.getTime() < today.getTime()
  }

  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pagination = usePagination(filteredInvoices)

  // ── History summary (computed across all invoices, not just the current page) ─
  const summary = invoices.reduce(
    (acc, inv) => {
      acc.totalAmount += inv.total
      if (inv.status === 'paid') {
        acc.paidCount += 1
        acc.paidAmount += inv.total
      } else {
        acc.unpaidCount += 1
        acc.unpaidAmount += inv.total
        if (isOverdue(inv)) {
          acc.overdueCount += 1
          acc.overdueAmount += inv.total
        }
      }
      return acc
    },
    {
      totalAmount: 0,
      paidCount: 0, paidAmount: 0,
      unpaidCount: 0, unpaidAmount: 0,
      overdueCount: 0, overdueAmount: 0,
    }
  )

  const money = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabClass = (tab: Tab) =>
    `px-6 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600 bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-700 bg-gray-50'
    }`

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 print:hidden">
        <button className={tabClass('maker')} onClick={() => setActiveTab('maker')}>
          📄 Invoice Maker
        </button>
        <button className={tabClass('history')} onClick={() => setActiveTab('history')}>
          🗂 History {invoices.length > 0 && <span className="ml-1 rounded-full bg-blue-100 px-2 text-xs text-blue-700">{invoices.length}</span>}
        </button>
      </div>

      {/* ── MAKER TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'maker' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between print:hidden">
            <h2 className="text-2xl font-bold text-gray-900">Invoice Maker</h2>
            <div className="flex gap-2">
              <button onClick={handleReset} className="rounded bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600">
                Reset
              </button>
              <button onClick={handlePrint} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
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
                  <button onClick={() => setShowClientModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h4 className="mb-2 font-semibold text-blue-900">Save Current Client</h4>
                  <p className="mb-3 text-sm text-blue-700">Fill in the client details in the invoice form, then click save.</p>
                  <button onClick={saveClient} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    💾 Save Current Client
                  </button>
                </div>
                <div className="space-y-3">
                  {savedClients.length === 0 ? (
                    <p className="text-center text-sm text-gray-500">No saved clients yet</p>
                  ) : (
                    savedClients.map((client) => (
                      <div key={client.id} className="flex items-start justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{client.name}</div>
                          <div className="text-sm text-gray-600">{client.email}</div>
                          <div className="text-sm text-gray-500">{client.address}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => loadClient(client)} className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600">Load</button>
                          <button onClick={() => deleteClient(client.id)} className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600">Delete</button>
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
                  <button onClick={() => { setShowDescriptionModal(false); setSelectedItemId(null) }} className="text-gray-500 hover:text-gray-700">✕</button>
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
                  <button onClick={saveDescription} className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
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
                          <button onClick={() => loadDescription(desc)} className="rounded bg-purple-500 px-3 py-1 text-sm text-white hover:bg-purple-600">Use</button>
                          <button onClick={() => deleteDescription(desc.id)} className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600">Delete</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Invoice Document */}
          <div id="invoice-content" className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg" style={{ maxWidth: '210mm', margin: '0 auto' }}>
            {/* Dark Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-10 py-6 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white p-2 shadow-md">
                    <img id="invoice-logo" src={logoDataUrl} alt="Avensetech Logo" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xl font-bold tracking-wide text-white">AVENSETECH</p>
                    <p className="mt-0.5 text-xs tracking-wide text-slate-300">Software Development Services</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-2 text-sm font-bold tracking-wide text-white shadow">
                  INVOICE {invoiceNumber || 'INV-0001'}
                </span>
                <div className="flex gap-10 text-right">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Issue Date</p>
                    <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-right text-sm font-semibold text-white focus:border-blue-400 focus:outline-none print:hidden" />
                    <p className="mt-1 hidden text-sm font-semibold text-white print:block">{invoiceDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Due Date</p>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-right text-sm font-semibold text-white focus:border-blue-400 focus:outline-none print:hidden" />
                    <p className="mt-1 hidden text-sm font-semibold text-white print:block">{dueDate || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* From / Bill To */}
            <div className="grid grid-cols-2 gap-12 px-10 py-8">
              {/* From */}
              <div>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">From</h3>
                <p className="text-lg font-bold text-gray-900">Avensetech</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  OIT2-806 Oakridge Business Park<br />
                  AS Fortuna, Banilad, Mandaue City<br />
                  Philippines<br />
                  09297246296 / (032) 234-1362
                </p>
              </div>

              {/* Bill To */}
              <div>
                <div className="mb-2 flex items-center justify-between print:block">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bill To</h3>
                  <button
                    type="button"
                    onClick={() => setShowClientModal(true)}
                    className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 print:hidden"
                  >
                    📋 Saved Clients
                  </button>
                </div>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client Name" className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden" />
                <p className="hidden text-lg font-bold text-gray-900 print:block">{clientName || 'Client Name'}</p>
                <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="Client Address" rows={3} className="mt-2 w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden" />
                <p className="mt-1 hidden whitespace-pre-line text-sm leading-relaxed text-gray-600 print:block">{clientAddress || 'Client Address'}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="px-10">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500">
                    <th className="rounded-l-md px-4 py-2 text-left font-bold">Description</th>
                    <th className="w-24 px-4 py-2 text-center font-bold">Qty</th>
                    <th className="w-32 px-4 py-2 text-right font-bold">Unit Price</th>
                    <th className="w-32 px-4 py-2 text-right font-bold">Amount</th>
                    <th className="w-10 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 align-top">
                      <td className="px-4 py-2">
                        <div className="flex gap-2 print:hidden">
                          <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="Item description" className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <button type="button" onClick={() => { setSelectedItemId(item.id); setShowDescriptionModal(true) }} className="rounded bg-purple-100 px-2 text-xs text-purple-700 hover:bg-purple-200" title="Load saved description">📝</button>
                        </div>
                        <p className="hidden py-1 text-sm font-semibold text-gray-900 print:block">{item.description || 'Item description'}</p>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input type="number" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)} min="0" step="1" className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden" />
                        <p className="hidden py-1 text-center text-sm text-gray-700 print:block">{item.qty}</p>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} min="0" step="0.01" placeholder="0.00" className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 print:hidden" />
                        <p className="hidden py-1 text-right text-sm text-gray-700 print:block">{money(item.unitPrice)}</p>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <p className="py-1 text-sm font-bold text-gray-900">{money(item.amount)}</p>
                      </td>
                      <td className="px-2 py-2 text-center print:hidden">
                        <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700" disabled={items.length === 1}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addItem} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 print:hidden">+ Add Item</button>
            </div>

            {/* Totals */}
            <div className="flex justify-end px-10 py-8">
              <div className="w-80 rounded-lg bg-gray-50 p-6">
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">Tax (0%)</span>
                  <span className="font-medium text-gray-900">{money(tax)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-gray-300 pt-3">
                  <span className="text-lg font-bold text-gray-900">TOTAL</span>
                  <span className="text-2xl font-extrabold text-gray-900">{money(total)}</span>
                </div>
              </div>
            </div>

            {/* Bank Transfer Details */}
            <div className="mx-10 mb-8 rounded-xl border border-gray-200 bg-gray-50 px-6 py-5">
              <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Bank Transfer Details</h4>
              <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Account Name</p>
                  <p className="text-sm font-medium text-gray-800">Avensetech Software Development Services</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Account Number</p>
                  <p className="text-sm font-medium text-gray-800">004744-0246-63</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Bank Name</p>
                  <p className="text-sm font-medium text-gray-800">Bank Of The Philippine Islands (BPI)</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Swift Code</p>
                  <p className="text-sm font-medium text-gray-800">BOPIPHMMXXX</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Bank Address</p>
                  <p className="text-sm font-medium text-gray-800">Astra Centre on A.S. Fortuna Street, Barangay Banilad, Mandaue City, 6014, Philippines</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-10 py-6 text-center">
              <p className="text-sm font-semibold text-gray-700">Thank you for your business!</p>
              <p className="mt-1 text-xs text-gray-500">Avensetech Software Development Services • OIT2-806, Oakridge Business Park, Banilad, Mandaue City, Cebu</p>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Invoice History</h2>
              <p className="text-sm text-gray-600">View and manage previously created invoices</p>
            </div>
            <button onClick={() => { startNewInvoice(); setActiveTab('maker') }} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + Create New Invoice
            </button>
          </div>

          {/* Summary cards */}
          {invoices.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Invoiced</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{money(summary.totalAmount)}</p>
                <p className="mt-1 text-xs text-gray-400">{invoices.length} invoice{invoices.length === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-green-600">Paid</p>
                <p className="mt-1 text-xl font-bold text-green-700">{money(summary.paidAmount)}</p>
                <p className="mt-1 text-xs text-green-500">{summary.paidCount} invoice{summary.paidCount === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Unpaid / Open</p>
                <p className="mt-1 text-xl font-bold text-blue-700">{money(summary.unpaidAmount)}</p>
                <p className="mt-1 text-xs text-blue-500">{summary.unpaidCount} invoice{summary.unpaidCount === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-red-600">Overdue</p>
                <p className="mt-1 text-xl font-bold text-red-700">{money(summary.overdueAmount)}</p>
                <p className="mt-1 text-xs text-red-500">{summary.overdueCount} past due date</p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); pagination.resetPage() }}
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
                <button onClick={() => { startNewInvoice(); setActiveTab('maker') }} className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Create Your First Invoice
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pagination.pageItems.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`rounded-lg border-2 p-6 shadow-sm transition-shadow hover:shadow-md ${
                      invoice.status === 'paid'
                        ? 'border-green-400 bg-green-100'
                        : isOverdue(invoice)
                        ? 'border-red-400 bg-red-100'
                        : 'border-blue-400 bg-blue-100'
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber || 'No Number'}</h3>
                        <p className="text-sm text-gray-600">{invoice.clientName || 'No Client'}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-200 text-green-800'
                            : isOverdue(invoice)
                            ? 'bg-red-200 text-red-800'
                            : 'bg-blue-200 text-blue-800'
                        }`}
                      >
                        {money(invoice.total)}
                      </span>
                    </div>

                    <div className="mb-4">
                      {invoice.status === 'paid' ? (
                        <span className="inline-flex items-center rounded-full bg-green-200 px-3 py-1 text-xs font-semibold text-green-800">● Paid</span>
                      ) : isOverdue(invoice) ? (
                        <span className="inline-flex items-center rounded-full bg-red-200 px-3 py-1 text-xs font-semibold text-red-800">● Overdue</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">● Unpaid</span>
                      )}
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

                    <div className="border-t border-gray-300/60 pt-4">
                      <div className="mb-3 max-h-20 overflow-y-auto text-xs text-gray-600">
                        {invoice.items.map((item, idx) => (
                          <div key={idx} className="truncate">• {item.description || 'No description'}</div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleInvoiceStatus(invoice)}
                          className={`flex-1 rounded border bg-white px-3 py-2 text-sm font-medium ${
                            invoice.status === 'paid'
                              ? 'border-blue-300 text-blue-700 hover:bg-blue-50'
                              : 'border-green-300 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {invoice.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                        <button
                          onClick={() => loadInvoiceIntoMaker(invoice)}
                          className="flex-1 rounded border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                          View/Edit
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          className="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Created: {new Date(invoice.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                totalPages={pagination.totalPages}
                from={pagination.from}
                to={pagination.to}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
