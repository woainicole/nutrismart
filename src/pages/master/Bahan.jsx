import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isViewOnly } from '../../lib/roles'
import { getBahan, createBahan, updateBahan, deleteBahan, getSupplier, createSupplier, updateSupplier, deleteSupplier } from '../../services/bahanService'
import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Bahan() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [tab, setTab] = useState('bahan')
  const [bahanData, setBahanData] = useState([])
  const [supplierData, setSupplierData] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formBahan, setFormBahan] = useState({ nama: '', satuan: '', stok_minimum: 0, supplier_id: '', alergen: [] })
  const [alergenInput, setAlergenInput] = useState('')
  const SARAN_ALERGEN = ['kacang', 'udang', 'telur', 'susu', 'ikan', 'ayam', 'gluten', 'kedelai']
  const [formSupplier, setFormSupplier] = useState({ nama: '', kontak: '' })
  const [deleting, setDeleting] = useState(null)
  const [deleteType, setDeleteType] = useState('bahan')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [b, s] = await Promise.all([getBahan(), getSupplier()])
      setBahanData(b)
      setSupplierData(s)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  // ===== Bahan =====
  function openAddBahan() {
    setEditing(null)
    setFormBahan({ nama: '', satuan: '', stok_minimum: 0, supplier_id: '', alergen: [] })
    setAlergenInput('')
    setTab('bahan')
    setModalOpen(true)
  }

  function openEditBahan(row) {
    setEditing(row)
    setFormBahan({ nama: row.nama, satuan: row.satuan, stok_minimum: row.stok_minimum, supplier_id: row.supplier_id ?? '', alergen: row.alergen ?? [] })
    setAlergenInput('')
    setTab('bahan')
    setModalOpen(true)
  }

  async function handleSubmitBahan(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        nama: formBahan.nama, satuan: formBahan.satuan,
        stok_minimum: Number(formBahan.stok_minimum),
        supplier_id: formBahan.supplier_id ? Number(formBahan.supplier_id) : null,
        alergen: formBahan.alergen,
      }
      if (editing) await updateBahan(editing.id, payload)
      else await createBahan(payload)
      toast.success(editing ? 'Bahan diperbarui' : 'Bahan ditambahkan')
      setModalOpen(false)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ===== Supplier =====
  function openAddSupplier() {
    setEditing(null)
    setFormSupplier({ nama: '', kontak: '' })
    setTab('supplier')
    setModalOpen(true)
  }

  function openEditSupplier(row) {
    setEditing(row)
    setFormSupplier({ nama: row.nama, kontak: row.kontak ?? '' })
    setTab('supplier')
    setModalOpen(true)
  }

  async function handleSubmitSupplier(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { nama: formSupplier.nama, kontak: formSupplier.kontak || null }
      if (editing) await updateSupplier(editing.id, payload)
      else await createSupplier(payload)
      toast.success(editing ? 'Supplier diperbarui' : 'Supplier ditambahkan')
      setModalOpen(false)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ===== Delete =====
  async function handleDelete() {
    setSaving(true)
    try {
      if (deleteType === 'bahan') await deleteBahan(deleting.id)
      else await deleteSupplier(deleting.id)
      toast.success(`${deleteType === 'bahan' ? 'Bahan' : 'Supplier'} dihapus`)
      setDeleting(null)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const colBahan = [
    { key: 'nama', label: 'Nama Bahan' },
    { key: 'satuan', label: 'Satuan' },
    { key: 'stok_minimum', label: 'Stok Min.' },
    { key: 'supplier', label: 'Supplier', render: r => r.supplier?.nama ?? '-' },
    { key: 'alergen', label: 'Alergen', render: r =>
      (r.alergen?.length > 0)
        ? <span className="flex flex-wrap gap-1">{r.alergen.map(a => <span key={a} className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded">{a}</span>)}</span>
        : <span className="text-gray-400">-</span>
    },
  ]
  const colSupplier = [
    { key: 'nama', label: 'Nama Supplier' },
    { key: 'kontak', label: 'Kontak', render: r => r.kontak ?? '-' },
  ]

  return (
    <div>
      <PageHeader title="Bahan & Supplier" />

      {/* Tab */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('bahan')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'bahan' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Bahan Makanan
        </button>
        <button onClick={() => setTab('supplier')} className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'supplier' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Supplier
        </button>
        {!viewOnly && (
          <Button size="sm" onClick={tab === 'bahan' ? openAddBahan : openAddSupplier} className="ml-auto">
            <Plus size={14} /> Tambah {tab === 'bahan' ? 'Bahan' : 'Supplier'}
          </Button>
        )}
      </div>

      {tab === 'bahan' ? (
        <DataTable columns={colBahan} data={bahanData} loading={loading} searchKeys={['nama']}
          actions={viewOnly ? null : row => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEditBahan(row)}><Pencil size={14} /></Button>
              <Button variant="ghost" size="sm" onClick={() => { setDeleting(row); setDeleteType('bahan') }}><Trash2 size={14} /></Button>
            </>
          )}
        />
      ) : (
        <DataTable columns={colSupplier} data={supplierData} loading={loading} searchKeys={['nama']}
          actions={viewOnly ? null : row => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEditSupplier(row)}><Pencil size={14} /></Button>
              <Button variant="ghost" size="sm" onClick={() => { setDeleting(row); setDeleteType('supplier') }}><Trash2 size={14} /></Button>
            </>
          )}
        />
      )}

      {/* Modal Bahan */}
      <Modal open={modalOpen && tab === 'bahan'} onClose={() => setModalOpen(false)} title={editing ? 'Edit Bahan' : 'Tambah Bahan'}>
        <form onSubmit={handleSubmitBahan} className="space-y-4">
          <FormField label="Nama" required>
            <input value={formBahan.nama} onChange={e => setFormBahan(f => ({ ...f, nama: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Satuan" required>
              <input value={formBahan.satuan} onChange={e => setFormBahan(f => ({ ...f, satuan: e.target.value }))} required placeholder="kg, liter, pcs" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
            <FormField label="Stok Minimum">
              <input type="number" step="0.01" value={formBahan.stok_minimum} onChange={e => setFormBahan(f => ({ ...f, stok_minimum: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
          </div>
          <FormField label="Supplier">
            <select value={formBahan.supplier_id} onChange={e => setFormBahan(f => ({ ...f, supplier_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Tanpa supplier</option>
              {supplierData.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </FormField>
          <FormField label="Alergen">
            <div className="flex flex-wrap gap-1 mb-1">
              {formBahan.alergen.map(a => (
                <span key={a} className="flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                  {a}
                  <button type="button" onClick={() => setFormBahan(f => ({ ...f, alergen: f.alergen.filter(x => x !== a) }))} className="hover:text-red-900">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                list="saran-alergen-bahan"
                value={alergenInput}
                onChange={e => setAlergenInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = alergenInput.trim().toLowerCase()
                    if (val && !formBahan.alergen.includes(val)) setFormBahan(f => ({ ...f, alergen: [...f.alergen, val] }))
                    setAlergenInput('')
                  }
                }}
                placeholder="Ketik lalu Enter"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <datalist id="saran-alergen-bahan">
                {SARAN_ALERGEN.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <p className="text-xs text-gray-400 mt-1">Saran: {SARAN_ALERGEN.join(', ')}</p>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Supplier */}
      <Modal open={modalOpen && tab === 'supplier'} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Tambah Supplier'}>
        <form onSubmit={handleSubmitSupplier} className="space-y-4">
          <FormField label="Nama" required>
            <input value={formSupplier.nama} onChange={e => setFormSupplier(f => ({ ...f, nama: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <FormField label="Kontak">
            <input value={formSupplier.kontak} onChange={e => setFormSupplier(f => ({ ...f, kontak: e.target.value }))} placeholder="Telepon / email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title={`Hapus ${deleteType === 'bahan' ? 'Bahan' : 'Supplier'}`} message={`Yakin hapus "${deleting?.nama}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} loading={saving} />
    </div>
  )
}

