import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import Spinner from './Spinner'
import EmptyState from './EmptyState'

// Resolve dot-notation path OR call function: 'pasien.nama' -> row.pasien?.nama
function deepGet(obj, path) {
  if (typeof path === 'function') return path(obj)
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

export default function DataTable({
  columns, data, loading, searchKeys = [], actions, emptyMessage,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSizeState, setPageSizeState] = useState(pageSize)

  // Filter — supports dot-notation paths, function keys, and fallback to all primitives
  const filtered = useMemo(() => {
    if (!search.trim()) return data || []
    const q = search.toLowerCase().trim()
    const keys = searchKeys.length > 0 ? searchKeys : null
    return (data || []).filter(row => {
      if (keys) {
        return keys.some(key => {
          const val = deepGet(row, key)
          if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(q))
          return String(val ?? '').toLowerCase().includes(q)
        })
      }
      // Fallback: semua nilai primitif level 1 (termasuk satu level nested object)
      return Object.values(row).some(val => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return Object.values(val).some(v => typeof v !== 'object' && String(v ?? '').toLowerCase().includes(q))
        }
        if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(q))
        return String(val ?? '').toLowerCase().includes(q)
      })
    })
  }, [data, search, searchKeys])

  // Paginasi
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSizeState))
  const paged = filtered.slice(page * pageSizeState, (page + 1) * pageSizeState)

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

  const colSpan = columns.length + (actions ? 1 : 0)

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
            {paged.length === 0 && search.trim() ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="py-8 text-center">
                    <p className="text-gray-500 text-sm">
                      Tidak ada hasil untuk &ldquo;<span className="font-medium">{search}</span>&rdquo;
                    </p>
                    <button
                      onClick={() => handleSearch('')}
                      className="mt-2 text-sm text-emerald-600 hover:underline"
                    >
                      Hapus pencarian
                    </button>
                  </div>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
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
      {(totalPages > 1 || filtered.length !== (data || []).length) && (
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">
              Menampilkan {filtered.length === 0 ? 0 : page * pageSizeState + 1}–{Math.min((page + 1) * pageSizeState, filtered.length)} dari {filtered.length}
              {filtered.length !== (data || []).length ? ` (dari total ${(data || []).length})` : ''}
            </p>
            <select
              value={pageSizeState}
              onChange={e => { setPageSizeState(Number(e.target.value)); setPage(0) }}
              className="text-xs border border-gray-300 rounded px-1 py-0.5"
            >
              {pageSizeOptions.map(s => <option key={s} value={s}>{s}/hal</option>)}
            </select>
          </div>
          {totalPages > 1 && (
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
          )}
        </div>
      )}
    </div>
  )
}
