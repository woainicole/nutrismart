import { supabase } from '../lib/supabaseClient'

// Ambil riwayat makan seorang pasien dalam rentang tanggal
export async function getRiwayatMakan(pasienId, tglMulai, tglSelesai) {
  const { data, error } = await supabase
    .from('v_riwayat_makan')
    .select('*')
    .eq('pasien_id', pasienId)
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)
    .order('tanggal', { ascending: false })
    .order('waktu_makan')
  if (error) throw error
  return data
}

// Ambil daftar pengajuan diet yang disetujui untuk seorang pasien
export async function getRiwayatDietPasien(pasienId) {
  const { data, error } = await supabase
    .from('pengajuan_diet')
    .select('*, diet_lama:diet_lama_id(nama), diet_baru:diet_baru_id(nama), penyetuju:disetujui_oleh(nama)')
    .eq('pasien_id', pasienId)
    .eq('status', 'disetujui')
    .order('tanggal_berlaku', { ascending: false })
  if (error) throw error
  return data
}

