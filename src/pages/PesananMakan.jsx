import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { isViewOnly } from '../lib/roles'
import { useLocation } from 'react-router-dom'
import {
  getPesanan, generatePesanan, siapkanPesanan, getSesiMakan,
  updateStatusPesanan, updateMenuPesanan, ubahStatusMassal
} from '../services/pesananService'
import { getMenu } from '../services/menuService'
import { hariIni, formatTanggalLengkap } from '../lib/format'
import DataTable from '../components/ui/DataTable'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { RefreshCw, ChefHat, CheckCheck, Truck, X, Tag } from 'lucide-react'

const WAKTU = ['pagi', 'siang', 'malam']
const NEXT_STATUS = { disiapkan: 'siap', siap: 'terkirim' }
// Warna chip menu
const CHIP_COLORS = ['bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700', 'bg-purple-100 text-purple-700']

export default function PesananMakan() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [tanggal, setTanggal] = useState(hariIni())
  const [waktu, setWaktu] = useState('pagi')
  const [data, setData] = useState([])
  const [menuList, setMenuList] = useState([])
  const [sesiMap, setSesiMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  // T-32: filter menu + bulk
  const [filterMenu, setFilterMenu] = useState(null) // null = semua
  const [selected, setSelected] = useState(new Set()) // set of pesanan ids
  const [confirmBulk, setConfirmBulk] = useState(null) // { status, label }
  const [showPrintLabels, setShowPrintLabels] = useState(false)

  useEffect(() => { load() }, [tanggal, waktu])
  // Reset pilihan saat filter/tanggal/waktu berubah
  useEffect(() => { setSelected(new Set()); setFilterMenu(null) }, [tanggal, waktu])

  async function load() {
    setLoading(true)
    try {
      const [p, m, sesi] = await Promise.all([getPesanan(tanggal, waktu), getMenu(), getSesiMakan(tanggal)])
      setData(p)
      setMenuList(m)
      setSesiMap(sesi)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    setActionLoading(true)
    try {
      const count = await generatePesanan(tanggal)
      toast.success(`${count} pesanan di-generate/sinkronkan`)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setActionLoading(false) }
  }

  async function handleSiapkan() {
    setActionLoading(true)
    try {
      await siapkanPesanan(tanggal, waktu)
      toast.success('Sesi berhasil disiapkan — stok terpotong')
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setActionLoading(false) }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      await updateStatusPesanan(id, newStatus)
      toast.success(`Status diubah ke ${newStatus}`)
      await load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleMenuPengganti(id, menuId) {
    try {
      await updateMenuPesanan(id, menuId)
      toast.success('Menu pengganti dipilih')
      await load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleBulkStatus(status) {
    if (selected.size === 0) return
    setActionLoading(true)
    try {
      const ids = [...selected]
      const result = await ubahStatusMassal(ids, status)
      toast.success(`${result.diubah} diubah, ${result.dilewati} dilewati`)
      setSelected(new Set())
      setConfirmBulk(null)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setActionLoading(false) }
  }

  // Chip menu: hitung distribusi menu dari data saat ini
  const menuChips = useMemo(() => {
    const counts = {}
    data.forEach(r => {
      const nama = r.menu?.nama ?? '—'
      counts[nama] = (counts[nama] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [data])

  // Data setelah filter chip menu
  const filteredData = useMemo(() => {
    if (!filterMenu) return data
    return data.filter(r => (r.menu?.nama ?? '—') === filterMenu)
  }, [data, filterMenu])

  // Checkbox helpers — hanya baris disiapkan/siap/terkirim bisa dipilih
  function isSelectable(row) {
    return ['disiapkan', 'siap', 'terkirim'].includes(row.status)
  }
  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    const selectable = filteredData.filter(isSelectable).map(r => r.id)
    const allSelected = selectable.every(id => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(selectable))
  }
  const selectableIds = filteredData.filter(isSelectable).map(r => r.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))

  const canGenerate = ['admin', 'ahli_gizi'].includes(role)
  const canSiapkan = ['admin', 'koki'].includes(role)
  const canBulk = ['admin', 'koki'].includes(role)
  const sesiAktif = sesiMap[waktu] ?? null
  const tanpamenu = data.filter(r => r.menu_id === null && r.status === 'menunggu').length

  // Label cetak: selected rows jika ada, else filteredData (max 200)
  const labelData = useMemo(() => {
    const src = selected.size > 0
      ? filteredData.filter(r => selected.has(r.id))
      : filteredData
    return src.slice(0, 200)
  }, [filteredData, selected])

  // Auto-print + auto-close after print
  useEffect(() => {
    if (showPrintLabels) {
      const timer = setTimeout(() => { window.print() }, 200)
      window.onafterprint = () => setShowPrintLabels(false)
      return () => { clearTimeout(timer); window.onafterprint = null }
    }
  }, [showPrintLabels])

  const columns = [
    // Checkbox (hanya koki/admin)
    ...(canBulk && !viewOnly ? [{
      key: '_check',
      label: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          className="cursor-pointer accent-emerald-600" title="Pilih semua" />
      ),
      render: row => isSelectable(row)
        ? <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)}
            className="cursor-pointer accent-emerald-600" />
        : <input type="checkbox" disabled className="cursor-not-allowed opacity-30" title={`Status ${row.status} tidak bisa dipilih`} />
    }] : []),
    { key: 'bangsal', label: 'Bangsal', render: r => r.pasien?.bangsal?.nama ?? '-' },
    { key: 'kamar', label: 'Kamar', render: r => r.pasien?.kamar ?? '-' },
    { key: 'pasien', label: 'Pasien', render: r => (
      <div>
        <p className="font-medium">{r.pasien?.nama}</p>
        <p className="text-xs text-gray-500">{r.pasien?.no_rm}</p>
      </div>
    )},
    { key: 'diet', label: 'Diet', render: r => r.pasien?.diet?.nama ?? '-' },
    { key: 'alergi', label: 'Alergi', render: r => {
      const alergi = r.pasien?.alergi || []
      const konflikMatch = r.catatan && r.catatan.match(/^Konflik alergi \(([^)]+)\)/)
      const konflik = konflikMatch ? konflikMatch[1].split(',').map(s => s.trim()) : []
      return (
        <div className="flex flex-wrap gap-1">
          {alergi.length > 0
            ? alergi.map(a => <Badge key={a} color="danger">{a}</Badge>)
            : <span className="text-gray-400">-</span>}
          {konflik.map(k => !alergi.includes(k) && <Badge key={k} color="danger">{k}</Badge>)}
        </div>
      )
    }},
    { key: 'menu', label: 'Menu', render: r => {
      if (!r.menu_id && r.catatan) {
        return (
          <div>
            <p className="text-xs text-yellow-600 mb-1">{r.catatan}</p>
            {(role === 'ahli_gizi' || role === 'admin') ? (
              <select
                onChange={e => e.target.value && handleMenuPengganti(r.id, Number(e.target.value))}
                className="border border-yellow-300 bg-yellow-50 rounded px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="">Pilih menu pengganti</option>
                {menuList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            ) : null}
          </div>
        )
      }
      return r.menu?.nama ?? '-'
    }},
    { key: 'status', label: 'Status', render: r => <Badge color={r.status}>{r.status}</Badge> },
    // Aksi per baris (hanya bila tidak bulk)
    ...(!canBulk || viewOnly ? [] : []),
  ]

  return (
    <div>
      <PageHeader title="Pesanan Makan" subtitle="Generate, siapkan, dan kelola pesanan harian" />

      {/* Filter tanggal + waktu */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-1">
          {WAKTU.map(w => (
            <button key={w} onClick={() => setWaktu(w)}
              className={`px-3 py-2 text-sm rounded-lg font-medium capitalize ${waktu === w ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {w}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">{formatTanggalLengkap(tanggal)}</span>
      </div>

      {/* Lencana status sesi */}
      <div className="mb-3">
        {sesiAktif
          ? <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">✓ Sesi sudah disiapkan</span>
          : <span className="inline-flex items-center gap-1 text-sm text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">Belum disiapkan</span>
        }
      </div>

      {/* Banner pesanan tanpa menu */}
      {tanpamenu > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          ⚠ {tanpamenu} pesanan belum punya menu. Selesaikan konflik alergi sebelum menyiapkan sesi.
        </div>
      )}

      {/* Tombol aksi */}
      {!viewOnly && (
        <div className="flex flex-wrap gap-2 mb-4">
          {canGenerate && (
            <Button onClick={handleGenerate} disabled={actionLoading} variant="secondary">
              <RefreshCw size={16} /> Generate / Sinkronkan
            </Button>
          )}
          {canSiapkan && (
            <Button
              onClick={handleSiapkan}
              disabled={actionLoading || !!sesiAktif}
              title={sesiAktif ? 'Sesi sudah disiapkan' : undefined}
            >
              <ChefHat size={16} /> Siapkan Sesi Ini
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowPrintLabels(true)} title="Cetak label nampan">
            <Tag size={16} /> Cetak Label
          </Button>
        </div>
      )}

      {/* Chip filter menu + rekap produksi */}
      {menuChips.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={() => setFilterMenu(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${!filterMenu ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              Semua ({data.length})
            </button>
            {menuChips.map(([nama, jumlah], i) => (
              <div key={nama} className="flex items-center gap-1">
                <button
                  onClick={() => setFilterMenu(filterMenu === nama ? null : nama)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${filterMenu === nama ? 'bg-emerald-600 text-white border-emerald-600' : `${CHIP_COLORS[i % CHIP_COLORS.length]} border-transparent hover:opacity-80`}`}
                >
                  {nama} ({jumlah})
                </button>
                {/* Pintasan pilih semua menu ini */}
                {canBulk && !viewOnly && (
                  <button
                    onClick={() => {
                      const ids = filteredData.filter(r => (r.menu?.nama ?? '—') === nama && isSelectable(r)).map(r => r.id)
                      setSelected(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next })
                      setFilterMenu(nama)
                    }}
                    className="text-xs text-gray-400 hover:text-emerald-600 px-1"
                    title={`Pilih semua ${nama}`}
                  >
                    +semua
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* Rekap produksi */}
          <p className="text-xs text-gray-400">
            Rekap: {menuChips.map(([n, j]) => `${n} ×${j}`).join(' · ')}
          </p>
        </div>
      )}

      {/* Bulk action bar */}
      {canBulk && !viewOnly && selected.size > 0 && (
        <div className="mb-3 sticky top-16 z-10 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="text-sm font-medium text-emerald-800">{selected.size} dipilih</span>
          <Button size="sm" onClick={() => selected.size > 20 ? setConfirmBulk({ status: 'siap', label: 'Tandai Siap' }) : handleBulkStatus('siap')} disabled={actionLoading}>
            <CheckCheck size={14} /> Tandai Siap
          </Button>
          <Button size="sm" onClick={() => selected.size > 20 ? setConfirmBulk({ status: 'terkirim', label: 'Tandai Terkirim' }) : handleBulkStatus('terkirim')} disabled={actionLoading}>
            <Truck size={14} /> Tandai Terkirim
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredData}
        loading={loading}
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        searchKeys={[
          'pasien.nama', 'pasien.no_rm', 'pasien.kamar',
          row => row.pasien?.bangsal?.nama ?? '',
          row => row.menu?.nama ?? '',
          row => row.pasien?.diet?.nama ?? '',
          'status', 'catatan'
        ]}
        actions={!viewOnly && !canBulk ? row => {
          const next = NEXT_STATUS[row.status]
          if (!next) return null
          return (
            <Button size="sm" variant="ghost" onClick={() => handleStatusChange(row.id, next)}>
              {next}
            </Button>
          )
        } : undefined}
      />

      <ConfirmDialog
        open={!!confirmBulk}
        title={`Konfirmasi ${confirmBulk?.label}`}
        message={`${selected.size} pesanan akan diubah statusnya menjadi "${confirmBulk?.status}". Lanjutkan?`}
        onConfirm={() => handleBulkStatus(confirmBulk?.status)}
        onCancel={() => setConfirmBulk(null)}
        loading={actionLoading}
      />

      {/* Label cetak nampan — tampil saat showPrintLabels */}
      {showPrintLabels && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto p-4">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <h2 className="font-bold text-gray-800">Label Nampan — {formatTanggalLengkap(tanggal)} ({waktu})</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowPrintLabels(false)}>Tutup</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {labelData.map(r => (
              <div key={r.id} className="border border-gray-800 rounded p-3 text-xs break-inside-avoid">
                <p className="font-bold text-base text-gray-900 mb-1">{r.pasien?.nama}</p>
                <p className="text-gray-600">RM: {r.pasien?.no_rm}</p>
                <p className="text-gray-600">Bangsal: {r.pasien?.bangsal?.nama ?? '-'} · Kamar: {r.pasien?.kamar ?? '-'}</p>
                <p className="text-gray-600 capitalize mt-1">{waktu} · {formatTanggalLengkap(tanggal)}</p>
                <p className="font-medium text-gray-800 mt-1">Menu: {r.menu?.nama ?? '—'}</p>
                <p className="text-gray-600">Diet: {r.pasien?.diet?.nama ?? '-'}</p>
                {(r.pasien?.alergi?.length > 0) && (
                  <p className="text-red-600 font-semibold mt-1">⚠ Alergi: {r.pasien.alergi.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
          {labelData.length === 0 && (
            <p className="text-gray-400 text-center py-10">Tidak ada pesanan untuk dicetak</p>
          )}
        </div>
      )}
    </div>
  )
}
