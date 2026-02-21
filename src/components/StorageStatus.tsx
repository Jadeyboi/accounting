import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StorageStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkStorage()
  }, [])

  const checkStorage = async () => {
    try {
      console.log('🔍 Checking storage configuration...')
      
      // Try to list buckets
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      
      console.log('📦 Buckets response:', { buckets, error: bucketsError })
      
      if (bucketsError) {
        console.error('❌ Cannot access storage:', bucketsError)
        setStatus('error')
        setMessage(`Cannot access storage: ${bucketsError.message}`)
        return
      }

      console.log('✅ Found buckets:', buckets?.map(b => b.name))

      // Check if receipts bucket exists
      const receiptsBucket = buckets?.find(b => b.name === 'receipts')
      
      if (!receiptsBucket) {
        console.error('❌ Receipts bucket not found in:', buckets?.map(b => b.name))
        setStatus('error')
        setMessage('Receipts bucket not found. Please create it in Supabase Dashboard.')
        return
      }

      console.log('✅ Receipts bucket found:', receiptsBucket)

      // Try to list files in receipts bucket
      const { error: listError } = await supabase.storage
        .from('receipts')
        .list('', { limit: 1 })

      console.log('📁 List files result:', { error: listError })

      if (listError) {
        console.error('❌ Cannot access receipts bucket:', listError)
        setStatus('error')
        setMessage(`Receipts bucket exists but not accessible: ${listError.message}`)
        return
      }

      console.log('✅ Storage is configured correctly!')
      setStatus('ok')
      setMessage('Storage is configured correctly')
    } catch (error) {
      console.error('❌ Storage check failed:', error)
      setStatus('error')
      setMessage(`Storage check failed: ${error}`)
    }
  }

  if (status === 'checking') {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="text-blue-800">Checking storage configuration...</span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-red-800 mb-1">Storage Configuration Issue</p>
            <p className="text-red-700 mb-2">{message}</p>
            <div className="text-xs text-red-600 space-y-1">
              <p className="font-medium">Quick Fix:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to Supabase Dashboard → Storage</li>
                <li>Click "New bucket"</li>
                <li>Name: <code className="bg-red-100 px-1 rounded">receipts</code></li>
                <li>Check "Public bucket"</li>
                <li>Click "Create"</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            <button
              onClick={checkStorage}
              className="mt-3 text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
            >
              Recheck Storage
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-green-800">{message}</span>
      </div>
    </div>
  )
}
