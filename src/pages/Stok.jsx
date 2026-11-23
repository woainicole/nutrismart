import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isViewOnly } from '../lib/roles'
import { useLocation } from 'react-router-dom'
import { getStokBahan, getStokBatch, createStokBatch } from '../services/stokService'
import { getBahan } from '../services/bahanService'
import { formatTanggal } from '../lib/format'
import { supabase } from '../lib/supabaseClient'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import FormField from '../components/ui/FormField'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'

export default function Stok() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [tab, setTab] = useState('ringkasan')
  const [stokBahan, setStokBahan] = useState([])
  const [batches, setBatches] = useState([])
  const [bahanList, setBahanList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ bahan_id: '', jumlah_sisa: '', tgl_kedaluwarsa: '' })

  // Kebutuhan tab state
  const [kebutuhanData, setKebutuhanData] = useState([])
  const [tglKebutuhan, setTglKebutuhan] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [loadingKebutuhan, setLoadingKebutuhan] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [sb, bt, bl] = await Promise.all([getStokBahan(), getStokBatch(), getBahan()])
      setStokBahan(sb)
      setBatches(bt)
      setBahanList(bl)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function loadKebutuhan() {
    setLoadingKebutuhan(true)
    try {
      const { data, error } = await supabase.rpc('kebutuhan_bahan', { p_tanggal: tglKebutuhan })
      if (error) throw error
      setKebutuhanData(data || [])
    } catch (e) { toast.error(e.message) }
    finally { setLoadingKebutuhan(false) }
  }

  async function handleBuang(id) {
    if (!confirm('Yakin ingin membuang batch ini? Jumlah sisa akan dikurangi menjadi 0.')) return
    try {
      const { error } = await supabase.from('stok_batch').update({ jumlah_sisa: 0 }).eq('id', id)
      if (error) throw error
      toast.success('Batch dibuang')
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleBuangSemuaKadaluwarsa() {
    if (!confirm('Yakin buang SEMUA stok yang sudah melewati tanggal kedaluwarsa? Tindakan ini tidak bisa dibatalkan.')) return
    try {
      const { data, error } = await supabase.rpc('buang_batch_kadaluwarsa')
      if (error) throw error
      toast.success(`${data} batch kadaluwarsa berhasil dibuang`)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await createStokBatch({
        bahan_id: Number(form.bahan_id),
        jumlah_sisa: Number(form.jumlah_sisa),
        tgl_kedaluwarsa: form.tgl_kedaluwarsa,
      })
      toast.success('Barang masuk berhasil dicatat')
      setModalOpen(false)
      setForm({ bahan_id: '', jumlah_sisa: '', tgl_kedaluwarsa: '' })
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
  }

  function stokStatus(row) {
    if (row.stok_total <= 0) return <Badge color="habis">Habis</Badge>
    if (row.stok_total < row.stok_minimum) return <Badge color="menipis">Menipis</Badge>
    return <Badge color="aman">Aman</Badge>
  }

  const colRingkasan = [
    { key: 'nama', label: 'Bahan' },
    { key: 'satuan', label: 'Satuan' },
    { key: 'stok_total', label: 'Total Stok' },
    { key: 'stok_minimum', label: 'Minimum' },
    { key: 'status', label: 'Status', render: stokStatus },
  ]

  const colBatch = [
    { key: 'bahan', label: 'Bahan', render: r => r.bahan?.nama },
    { key: 'jumlah_sisa', label: 'Sisa' },
    { key: 'satuan', label: 'Satuan', render: r => r.bahan?.satuan },
    { key: 'tgl_masuk', label: 'Masuk', render: r => formatTanggal(r.tgl_masuk) },
    { key: 'tgl_kedaluwarsa', label: 'Kedaluwarsa', render: r => {
      const today = new Date().toISOString().slice(0, 10)
      const diff = Math.ceil((new Date(r.tgl_kedaluwarsa) - new Date(today)) / 86400000)
      return (
        <span className={diff <= 3 ? 'text-red-600 font-medium' : ''}>
          {formatTanggal(r.tgl_kedaluwarsa)} {diff <= 3 && `(${diff} hari)`}
        </span>
      )
    }},
    ...(!viewOnly ? [{ key: 'aksi', label: '', render: r => {
      const today = new Date().toISOString().slice(0, 10)
      return r.tgl_kedaluwarsa < today && r.jumlah_sisa > 0
        ? <button onClick={() => handleBuang(r.id)} className="text-xs text-red-600 hover:underline font-medium">Buang</button>
        : null
    }}] : []),
  ]

  const colKebutuhan = [
    { key: 'nama_bahan', label: 'Bahan' },
    { key: 'satuan', label: 'Satuan' },
    { key: 'kebutuhan', label: 'Kebutuhan' },
    { key: 'stok', label: 'Stok' },
    { key: 'kekurangan', label: 'Kekurangan', render: row =>
      row.kekurangan > 0
        ? <span className="font-semibold text-red-600">{row.kekurangan}</span>
        : <span className="text-gray-400">—</span>
    },
  ]

  const tabDefs = [
    { key: 'ringkasan', label: 'Ringkasan Stok' },
    { key: 'batch', label: 'Batch FEFO' },
    { key: 'kebutuhan', label: 'Proyeksi Kebutuhan' },
  ]

  return (
    <div>
      <PageHeader
        title="Stok"
        subtitle="Ringkasan stok dan batch bahan makanan"
        action={viewOnly ? null : () => setModalOpen(true)}
        actionLabel="Barang Masuk"
        actionIcon={Plus}
      />

      {/* Tab */}
      <div className="flex gap-2 mb-4">
        {tabDefs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              tab === t.key ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ringkasan' && (
        <DataTable columns={colRingkasan} data={stokBahan} loading={loading} searchKeys={['nama']} />
      )}

      {tab === 'batch' && (
        <>
          {batches.some(b => b.tgl_kedaluwarsa < new Date().toISOString().slice(0, 10) && b.jumlah_sisa > 0) && (
            <div className="mb-3 flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-700 font-medium">
                ⚠️ Ada stok yang sudah melewati tanggal kedaluwarsa
              </span>
              {!viewOnly && (
                <button
                  onClick={handleBuangSemuaKadaluwarsa}
                  className="flex items-center gap-1.5 text-xs text-red-600 border border-red-300 bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Buang Semua Kadaluwarsa
                </button>
              )}
            </div>
          )}
          <DataTable columns={colBatch} data={batches} loading={loading} searchKeys={['bahan.nama']} />
        </>
      )}

      {tab === 'kebutuhan' && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-gray-600">Tanggal</label>
            <input
              type="date"
              value={tglKebutuhan}
              onChange={e => setTglKebutuhan(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <Button onClick={loadKebutuhan}>Tampilkan</Button>
          </div>
          {loadingKebutuhan ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <>
              {kebutuhanData.some(r => r.kekurangan > 0) && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  ⚠️ Ada {kebutuhanData.filter(r => r.kekurangan > 0).length} bahan dengan stok kurang
                </div>
              )}
              <p className="text-xs text-gray-400 mb-2 italic">Perkiraan — belum menghitung pesanan konflik alergi</p>
              <DataTable
                columns={colKebutuhan}
                data={kebutuhanData}
                searchKeys={['nama_bahan']}
                pageSize={25}
              />
            </>
          )}
        </>
      )}

      {/* Modal barang masuk */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Barang Masuk">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Bahan" required>
            <select
              value={form.bahan_id}
              onChange={e => setForm(f => ({ ...f, bahan_id: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Pilih bahan</option>
              {bahanList.map(b => (
                <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>
              ))}
            </select>
          </FormField>
          <FormField label="Jumlah" required>
            <input
              type="number" step="0.01" min="0.01"
              value={form.jumlah_sisa}
              onChange={e => setForm(f => ({ ...f, jumlah_sisa: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Tanggal Kedaluwarsa" required>
            <input
              type="date"
              value={form.tgl_kedaluwarsa}
              onChange={e => setForm(f => ({ ...f, tgl_kedaluwarsa: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
