import { useState, useMemo, useEffect } from 'react'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 20

export interface PaginationState {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  from: number
  to: number
}

export interface UsePaginationReturn<T> extends PaginationState {
  pageItems: T[]
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  resetPage: () => void
}

export function usePagination<T>(
  items: T[],
  initialPageSize: number = DEFAULT_PAGE_SIZE
): UsePaginationReturn<T> {
  const [page, setPageRaw] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(initialPageSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Clamp page if items shrink (e.g. after filter)
  useEffect(() => {
    if (page > totalPages) setPageRaw(1)
  }, [totalPages, page])

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  )

  const setPage = (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages)))

  const setPageSize = (size: number) => {
    setPageSizeRaw(size)
    setPageRaw(1)
  }

  const resetPage = () => setPageRaw(1)

  return { page, pageSize, totalItems, totalPages, from, to, pageItems, setPage, setPageSize, resetPage }
}
