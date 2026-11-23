import { supabase } from '../lib/supabaseClient'

export async function getNextNoRm() {
  const { data, error } = await supabase.rpc('generate_no_rm')
  if (error) throw error
  return data // e.g. 'RM023'
}

export async function getKamarKosong(bangsalNama = '') {
  let q = supabase
    .from('kamar_integrasi')
    .select('id, bangsal, nomor')
    .eq('status', 'kosong')
    .order('bangsal').order('nomor')
  if (bangsalNama) q = q.eq('bangsal', bangsalNama)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getPasien(filter = {}) {
  let q = supabase.from('pasien').select('*, bangsal:bangsal(nama), diet:jenis_diet(nama)').order('nama')
  if (filter.bangsal_id) q = q.eq('bangsal_id', filter.bangsal_id)
  if (filter.status) q = q.eq('status', filter.status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createPasien(pasien) {
  // Alergi: trim + huruf kecil
  if (pasien.alergi && typeof pasien.alergi === 'string') {
    pasien.alergi = pasien.alergi.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }
  const { data, error } = await supabase.from('pasien').insert(pasien).select().single()
  if (error) throw error
  return data
}

export async function updatePasien(id, pasien) {
  if (pasien.alergi && typeof pasien.alergi === 'string') {
    pasien.alergi = pasien.alergi.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }
  const { data, error } = await supabase.from('pasien').update(pasien).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePasien(id) {
  const { error } = await supabase.from('pasien').delete().eq('id', id)
  if (error) throw error
}

