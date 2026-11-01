import { supabase } from '../lib/supabaseClient'

export async function getPengembalian(tanggal, waktuMakan) {
  let q = supabase
    .from('pengembalian_makanan')
    .select('*, pesanan:pesanan_makan(tanggal, waktu_makan, pasien:pasien(nama, no_rm, bangsal:bangsal(nama)), menu:menu(nama))')
    .order('created_at', { ascending: false })
  // Filter via pesanan
  const { data, error } = await q
  if (error) throw error
  // Filter client-side kalau ada filter tanggal/waktu
  let filtered = data || []
  if (tanggal) filtered = filtered.filter(r => r.pesanan?.tanggal === tanggal)
  if (waktuMakan) filtered = filtered.filter(r => r.pesanan?.waktu_makan === waktuMakan)
  return filtered
}

export async function getPesananTerkirimTanpaPengembalian(tanggal, waktuMakan) {
  // Pesanan terkirim yang belum ada pengembalian
  const { data: pesanan, error: e1 } = await supabase
    .from('pesanan_makan')
    .select('*, pasien:pasien(nama, no_rm, bangsal:bangsal(nama)), menu:menu(nama)')
    .eq('tanggal', tanggal)
    .eq('waktu_makan', waktuMakan)
    .eq('status', 'terkirim')

  if (e1) throw e1

  const { data: existing, error: e2 } = await supabase
    .from('pengembalian_makanan')
    .select('pesanan_id')
  if (e2) throw e2

  const existingIds = new Set((existing || []).map(r => r.pesanan_id))
  return (pesanan || []).filter(p => !existingIds.has(p.id))
}

export async function createPengembalian(pengembalian) {
  const { data, error } = await supabase.from('pengembalian_makanan').insert(pengembalian).select().single()
  if (error) throw error
  return data
}

