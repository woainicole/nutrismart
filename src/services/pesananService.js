import { supabase } from '../lib/supabaseClient'

export async function getPesanan(tanggal, waktuMakan) {
  let q = supabase
    .from('pesanan_makan')
    .select('*, pasien:pasien(nama, no_rm, kamar, alergi, bangsal:bangsal(nama), diet:jenis_diet(nama)), menu:menu(nama)')
    .eq('tanggal', tanggal)
    .order('pasien_id')
  if (waktuMakan) q = q.eq('waktu_makan', waktuMakan)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function generatePesanan(tanggal) {
  const { data, error } = await supabase.rpc('generate_pesanan_harian', { p_tanggal: tanggal })
  if (error) throw error
  return data
}

export async function siapkanPesanan(tanggal, waktu) {
  const { error } = await supabase.rpc('siapkan_pesanan', { p_tanggal: tanggal, p_waktu: waktu })
  if (error) throw error
}

export async function updateStatusPesanan(id, status) {
  const { data, error } = await supabase
    .from('pesanan_makan')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSesiMakan(tanggal) {
  const { data, error } = await supabase
    .from('sesi_makan')
    .select('tanggal, waktu_makan, disiapkan_at, disiapkan_oleh')
    .eq('tanggal', tanggal)
  if (error) throw new Error(error.message)
  // Kembalikan sebagai map { pagi: {...}, siang: {...}, malam: {...} }
  const map = {}
  ;(data || []).forEach(s => { map[s.waktu_makan] = s })
  return map
}

export async function ubahStatusMassal(ids, status) {
  const { data, error } = await supabase.rpc('ubah_status_pesanan', { p_ids: ids, p_status: status })
  if (error) throw error
  return data // { diubah, dilewati }
}

export async function updateMenuPesanan(id, menuId) {
  const { data, error } = await supabase
    .from('pesanan_makan')
    .update({ menu_id: menuId, catatan: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

