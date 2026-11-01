import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isViewOnly } from '../../lib/roles'
import { getMenu, createMenu, updateMenu, deleteMenu } from '../../services/menuService'
import { getJenisDiet } from '../../services/dietService'
import { getBahan } from '../../services/bahanService'
import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

const TEKSTUR = ['biasa', 'lunak', 'saring', 'cair']

export default function Menu() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [data, setData] = useState([])
  const [dietList, setDietList] = useState([])
  const [bahanList, setBahanList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nama: '', kalori: '', natrium: '', tekstur: 'biasa', mengandung_alergen: '' })
  const [selectedDiets, setSelectedDiets] = useState([])
  const [resepRows, setResepRows] = useState([]) // [{bahan_id, jumlah_per_porsi}]
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [m, d, b] = await Promise.all([getMenu(), getJenisDiet(), getBahan()])
      setData(m)
      setDietList(d)
      setBahanList(b)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditing(null)
    setForm({ nama: '', kalori: '', natrium: '', tekstur: 'biasa', mengandung_alergen: '' })
    setSelectedDiets([])
    setResepRows([])
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      nama: row.nama,
      kalori: row.kalori ?? '',
      natrium: row.natrium ?? '',
      tekstur: row.tekstur,
      mengandung_alergen: (row.mengandung_alergen || []).join(', '),
    })
    setSelectedDiets((row.menu_diet || []).map(md => md.jenis_diet_id))
    setResepRows((row.resep || []).map(r => ({
      bahan_id: String(r.bahan_id),
      jumlah_per_porsi: r.jumlah_per_porsi,
    })))
    setModalOpen(true)
  }

  function toggleDiet(id) {
    setSelectedDiets(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  function addResepRow() {
    setResepRows(prev => [...prev, { bahan_id: '', jumlah_per_porsi: '' }])
  }

  function removeResepRow(idx) {
    setResepRows(prev => prev.filter((_, i) => i !== idx))
  }

  function updateResepRow(idx, field, value) {
    setResepRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const menuData = {
        nama: form.nama,
        kalori: form.kalori ? Number(form.kalori) : null,
        natrium: form.natrium ? Number(form.natrium) : null,
        tekstur: form.tekstur,
        mengandung_alergen: form.mengandung_alergen
          ? form.mengandung_alergen.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          : [],
      }
      const resepItems = resepRows
        .filter(r => r.bahan_id && r.jumlah_per_porsi)
        .map(r => ({ bahan_id: Number(r.bahan_id), jumlah_per_porsi: Number(r.jumlah_per_porsi) }))

      if (editing) await updateMenu(editing.id, menuData, selectedDiets, resepItems)
      else await createMenu(menuData, selectedDiets, resepItems)
      toast.success(editing ? 'Menu diperbarui' : 'Menu ditambahkan')
      setModalOpen(false)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteMenu(deleting.id)
      toast.success('Menu dihapus')
      setDeleting(null)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'nama', label: 'Nama Menu' },
    { key: 'kalori', label: 'Kalori', render: r => r.kalori ?? '-' },
    { key: 'natrium', label: 'Natrium', render: r => r.natrium ?? '-' },
    { key: 'tekstur', label: 'Tekstur', render: r => <Badge color="info">{r.tekstur}</Badge> },
    { key: 'alergen', label: 'Alergen', render: r =>
      r.mengandung_alergen?.length > 0
        ? r.mengandung_alergen.map(a => <Badge key={a} color="danger">{a}</Badge>)
        : <span className="text-gray-400">-</span>
    },
    { key: 'diets', label: 'Diet', render: r =>
      (r.menu_diet || []).map(md => {
        const d = dietList.find(dl => dl.id === md.jenis_diet_id)
        return d ? <Badge key={d.id} color="success">{d.nama}</Badge> : null
      })
    },
  ]

  return (
    <div>
      <PageHeader title="Menu & Resep" action={viewOnly ? null : openAdd} actionLabel="Tambah Menu" actionIcon={Plus} />

      <DataTable columns={columns} data={data} loading={loading} searchKeys={['nama']}
        actions={viewOnly ? null : row => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}><Trash2 size={14} /></Button>
          </>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Menu' : 'Tambah Menu'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nama Menu" required>
            <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Kalori">
              <input type="number" value={form.kalori} onChange={e => setForm(f => ({ ...f, kalori: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
            <FormField label="Natrium">
              <input type="number" value={form.natrium} onChange={e => setForm(f => ({ ...f, natrium: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
            <FormField label="Tekstur">
              <select value={form.tekstur} onChange={e => setForm(f => ({ ...f, tekstur: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {TEKSTUR.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Alergen (pisah koma)">
            <input value={form.mengandung_alergen} onChange={e => setForm(f => ({ ...f, mengandung_alergen: e.target.value }))} placeholder="kacang, udang" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>

          {/* Diet multi-select */}
          <FormField label="Cocok untuk diet:">
            <div className="flex flex-wrap gap-2">
              {dietList.map(d => (
                <label key={d.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${selectedDiets.includes(d.id) ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                  <input type="checkbox" checked={selectedDiets.includes(d.id)} onChange={() => toggleDiet(d.id)} className="sr-only" />
                  {d.nama}
                </label>
              ))}
            </div>
          </FormField>

          {/* Resep editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Resep (Bahan per Porsi)</label>
              <Button type="button" size="sm" variant="secondary" onClick={addResepRow}>
                <Plus size={14} /> Tambah Bahan
              </Button>
            </div>
            {resepRows.length === 0 && <p className="text-xs text-gray-400">Belum ada bahan. Klik "Tambah Bahan".</p>}
            <div className="space-y-2">
              {resepRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={row.bahan_id} onChange={e => updateResepRow(idx, 'bahan_id', e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option value="">Pilih bahan</option>
                    {bahanList.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.satuan})</option>)}
                  </select>
                  <input type="number" step="0.001" min="0.001" placeholder="Jumlah" value={row.jumlah_per_porsi} onChange={e => updateResepRow(idx, 'jumlah_per_porsi', e.target.value)} className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => removeResepRow(idx)} className="p-1 text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Hapus Menu" message={`Yakin hapus menu "${deleting?.nama}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} loading={saving} />
    </div>
  )
}

