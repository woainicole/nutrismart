import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import Spinner from './Spinner'
import EmptyState from './EmptyState'

export default function DataTable({
  columns, data, loading, searchKeys = [], actions, emptyMessage,
  pageSize = 10,
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Filter berdasarkan pencarian
  const filtered = useMemo(() => {
    if (!search.trim() || !searchKeys.length) return data || []
    const q = search.toLowerCase()
    return (data || []).filter(row =>
      searchKeys.some(key => {
        const val = row[key]
        if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(q))
        return String(val ?? '').toLowerCase().includes(q)
      })
    )
  }, [data, search, searchKeys])

  // Paginasi
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  // Reset halaman kalau pencarian berubah
  const handleSearch = val => {
    setSearch(val)
    setPage(0)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      {/* Search bar */}
      {searchKeys.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}>
                  <EmptyState message={emptyMessage || 'Belum ada data'} />
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-gray-700">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginasi */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-500">
            {filtered.length} data, halaman {page + 1} / {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

