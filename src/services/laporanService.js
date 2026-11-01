import { supabase } from '../lib/supabaseClient'

export async function getLaporanDistribusi(tglMulai, tglSelesai) {
  const { data, error } = await supabase
    .from('pesanan_makan')
    .select('tanggal, waktu_makan, status, pasien:pasien(bangsal:bangsal(nama))')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)
    .neq('status', 'dibatalkan')
  if (error) throw error
  return data
}

export async function getLaporanFoodWaste(tglMulai, tglSelesai) {
  const { data, error } = await supabase
    .from('v_food_waste')
    .select('*')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)
  if (error) throw error
  return data
}

export async function getLaporanPemakaian(tglMulai, tglSelesai) {
  const { data, error } = await supabase
    .from('pemakaian_bahan')
    .select('*, bahan:bahan_makanan(nama, satuan)')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)
    .order('tanggal')
  if (error) throw error
  return data
}

