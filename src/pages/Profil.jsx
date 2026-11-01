import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { ROLE_LABEL } from '../lib/roles'
import PageHeader from '../components/ui/PageHeader'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'

export default function Profil() {
  const { profile } = useAuth()
  const [nama, setNama] = useState(profile?.nama || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleUpdateNama(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({ nama }).eq('id', profile.id)
      if (error) throw error
      toast.success('Nama diperbarui')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (password.length < 6) return toast.error('Password minimal 6 karakter')
    if (password !== confirmPassword) return toast.error('Password tidak cocok')
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Password berhasil diubah')
      setPassword('')
      setConfirmPassword('')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Profil" />

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <p className="text-sm text-gray-500 mb-1">Role</p>
        <Badge color="info">{ROLE_LABEL[profile?.role] || profile?.role}</Badge>
        {profile?.bangsal_id && (
          <p className="text-sm text-gray-500 mt-3">Bangsal: <span className="text-gray-700">{profile?.bangsal?.nama ?? '-'}</span></p>
        )}
      </div>

      <form onSubmit={handleUpdateNama} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-gray-700">Ubah Nama</h3>
        <FormField label="Nama">
          <input value={nama} onChange={e => setNama(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </FormField>
        <Button type="submit" disabled={saving}><Save size={16} /> Simpan</Button>
      </form>

      <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-700">Ganti Password</h3>
        <FormField label="Password Baru">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </FormField>
        <FormField label="Konfirmasi Password">
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </FormField>
        <Button type="submit" disabled={saving}><Save size={16} /> Ubah Password</Button>
      </form>
    </div>
  )
}

