import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isViewOnly } from '../../lib/roles'
import { getJenisDiet, createJenisDiet, updateJenisDiet, deleteJenisDiet } from '../../services/dietService'
import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const TEKSTUR_OPTIONS = ['biasa', 'lunak', 'saring', 'cair']

export default function JenisDiet() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nama: '', kalori_maks_per_makan: '', natrium_maks_per_makan: '', tekstur: 'biasa' })
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try { setData(await getJenisDiet()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditing(null)
    setForm({ nama: '', kalori_maks_per_makan: '', natrium_maks_per_makan: '', tekstur: 'biasa' })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      nama: row.nama,
      kalori_maks_per_makan: row.kalori_maks_per_makan ?? '',
      natrium_maks_per_makan: row.natrium_maks_per_makan ?? '',
      tekstur: row.tekstur,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        nama: form.nama,
        kalori_maks_per_makan: form.kalori_maks_per_makan ? Number(form.kalori_maks_per_makan) : null,
        natrium_maks_per_makan: form.natrium_maks_per_makan ? Number(form.natrium_maks_per_makan) : null,
        tekstur: form.tekstur,
      }
      if (editing) await updateJenisDiet(editing.id, payload)
      else await createJenisDiet(payload)
      toast.success(editing ? 'Diet diperbarui' : 'Diet ditambahkan')
      setModalOpen(false)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteJenisDiet(deleting.id)
      toast.success('Diet dihapus')
      setDeleting(null)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'nama', label: 'Nama Diet' },
    { key: 'kalori_maks_per_makan', label: 'Maks Kalori/Makan', render: r => r.kalori_maks_per_makan ?? '-' },
    { key: 'natrium_maks_per_makan', label: 'Maks Natrium/Makan', render: r => r.natrium_maks_per_makan ?? '-' },
    { key: 'tekstur', label: 'Tekstur', render: r => <Badge color="info">{r.tekstur}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="Jenis Diet" action={viewOnly ? null : openAdd} actionLabel="Tambah Diet" actionIcon={Plus} />

      <DataTable columns={columns} data={data} loading={loading} searchKeys={['nama']}
        actions={viewOnly ? null : row => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}><Trash2 size={14} /></Button>
          </>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Jenis Diet' : 'Tambah Jenis Diet'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nama Diet" required>
            <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Maks Kalori/Makan">
              <input type="number" value={form.kalori_maks_per_makan} onChange={e => setForm(f => ({ ...f, kalori_maks_per_makan: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
            <FormField label="Maks Natrium/Makan">
              <input type="number" value={form.natrium_maks_per_makan} onChange={e => setForm(f => ({ ...f, natrium_maks_per_makan: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </FormField>
          </div>
          <FormField label="Tekstur" required>
            <select value={form.tekstur} onChange={e => setForm(f => ({ ...f, tekstur: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {TEKSTUR_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Hapus Jenis Diet" message={`Yakin hapus diet "${deleting?.nama}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} loading={saving} />
    </div>
  )
}

