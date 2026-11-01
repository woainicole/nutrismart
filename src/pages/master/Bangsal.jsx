import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isViewOnly } from '../../lib/roles'
import { getBangsal, createBangsal, updateBangsal, deleteBangsal } from '../../services/dietService'
import DataTable from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Bangsal() {
  const { role } = useAuth()
  const viewOnly = isViewOnly(role, useLocation().pathname)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nama: '', lantai: '' })
  const [deleting, setDeleting] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try { setData(await getBangsal()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditing(null)
    setForm({ nama: '', lantai: '' })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({ nama: row.nama, lantai: row.lantai ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { nama: form.nama, lantai: form.lantai ? Number(form.lantai) : null }
      if (editing) await updateBangsal(editing.id, payload)
      else await createBangsal(payload)
      toast.success(editing ? 'Bangsal diperbarui' : 'Bangsal ditambahkan')
      setModalOpen(false)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteBangsal(deleting.id)
      toast.success('Bangsal dihapus')
      setDeleting(null)
      setLoading(true)
      await load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { key: 'nama', label: 'Nama' },
    { key: 'lantai', label: 'Lantai', render: r => r.lantai ?? '-' },
  ]

  return (
    <div>
      <PageHeader
        title="Bangsal"
        action={viewOnly ? null : openAdd}
        actionLabel="Tambah Bangsal"
        actionIcon={Plus}
      />

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKeys={['nama']}
        actions={viewOnly ? null : row => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(row)}><Trash2 size={14} /></Button>
          </>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Bangsal' : 'Tambah Bangsal'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nama Bangsal" required>
            <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <FormField label="Lantai">
            <input type="number" value={form.lantai} onChange={e => setForm(f => ({ ...f, lantai: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Hapus Bangsal" message={`Yakin hapus bangsal "${deleting?.nama}"?`} onConfirm={handleDelete} onCancel={() => setDeleting(null)} loading={saving} />
    </div>
  )
}

