import { PAGE_SIZE_OPTIONS } from '@/hooks/usePagination'

interface PaginationProps {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  from: number
  to: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  from,
  to,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 rounded-b-xl">
      {/* Record count + page size */}
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span>
          Showing <span className="font-semibold text-gray-900">{from}–{to}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalItems}</span> records
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {PAGE_SIZE_OPTIONS.map(s => (
            <option key={s} value={s}>{s} per page</option>
          ))}
        </select>
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[2rem] rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      {/* Page X of Y */}
      <div className="text-sm text-gray-500 hidden sm:block">
        Page <span className="font-semibold text-gray-700">{page}</span> of{' '}
        <span className="font-semibold text-gray-700">{totalPages}</span>
      </div>
    </div>
  )
}
