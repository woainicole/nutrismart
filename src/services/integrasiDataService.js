import { supabase } from '../lib/supabaseClient'

// ── Jadwal Operasi (dari AdmisiRS via tabel jadwal_operasi_integrasi) ──────────

export async function getJadwalOperasi({ tanggal, status } = {}) {
  let q = supabase
    .from('jadwal_operasi_integrasi')
    .select('*')
    .order('tanggal', { ascending: true })
    .order('jam',     { ascending: true })

  if (tanggal) q = q.eq('tanggal', tanggal)
  if (status)  q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ── Kamar Integrasi (dari AdmisiRS via tabel kamar_integrasi) ──────────────────

export async function getKamarIntegrasi({ bangsal } = {}) {
  let q = supabase
    .from('kamar_integrasi')
    .select('*')
    .order('bangsal')
    .order('nomor')

  if (bangsal) q = q.eq('bangsal', bangsal)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ── Log Integrasi ───────────────────────────────────────────────────────────────

export async function getIntegrasiLog({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('integrasi_log')
    .select('*')
    .order('dibuat_pada', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}
