import { supabase } from '../lib/supabaseClient'

// ===== PENGAJUAN DIET =====

export async function getPengajuanDiet(filter = {}) {
  let q = supabase
    .from('pengajuan_diet')
    .select('*, pasien:pasien(nama, no_rm), diet_lama:jenis_diet!diet_lama_id(nama), diet_baru:jenis_diet!diet_baru_id(nama), pengaju:profiles!diajukan_oleh(nama), penyetuju:profiles!disetujui_oleh(nama)')
    .order('created_at', { ascending: false })
  if (filter.status) q = q.eq('status', filter.status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createPengajuanDiet(pengajuan) {
  const { data, error } = await supabase.from('pengajuan_diet').insert(pengajuan).select().single()
  if (error) throw error
  return data
}

export async function setujuiDiet(id) {
  const { error } = await supabase.rpc('setujui_pengajuan_diet', { p_id: id })
  if (error) throw error
}

export async function tolakDiet(id) {
  const { data, error } = await supabase
    .from('pengajuan_diet')
    .update({ status: 'ditolak' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ===== PENGAJUAN PEMBELIAN (T-19) =====

export async function getPengajuanPembelian(filter = {}) {
  let q = supabase
    .from('pengajuan_pembelian')
    .select('*, pengaju:profiles!diajukan_oleh(nama), items:pengajuan_pembelian_item(*, bahan:bahan_makanan(id, nama, satuan))')
    .order('created_at', { ascending: false })
  if (filter.status) q = q.eq('status', filter.status)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createPengajuanPembelian({ catatan, items }) {
  // 1. Dapatkan user id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Pengguna tidak terotentikasi')

  // 2. Insert header pengajuan
  const { data: pengajuan, error: errHeader } = await supabase
    .from('pengajuan_pembelian')
    .insert({
      diajukan_oleh: user.id,
      catatan: catatan || null,
      status: 'menunggu'
    })
    .select()
    .single()

  if (errHeader) throw errHeader

  // 3. Insert items
  if (items && items.length > 0) {
    const payloadItems = items.map(item => ({
      pengajuan_id: pengajuan.id,
      bahan_id: item.bahan_id,
      jumlah: Number(item.jumlah)
    }))

    const { error: errItems } = await supabase
      .from('pengajuan_pembelian_item')
      .insert(payloadItems)

    if (errItems) throw errItems
  }

  return pengajuan
}

export async function prosesStatusPembelian(id, status) {
  if (!['disetujui', 'ditolak'].includes(status)) {
    throw new Error('Status harus disetujui atau ditolak')
  }
  const { data, error } = await supabase
    .from('pengajuan_pembelian')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function terimaPembelianBarang(id, itemsWithExpiry) {
  // itemsWithExpiry: [{ bahan_id: 1, jumlah: 20, tgl_kedaluwarsa: '2026-12-31' }]
  const { error } = await supabase.rpc('terima_pembelian', {
    p_id: id,
    p_items: itemsWithExpiry
  })
  if (error) throw error
}

export async function getBahanMenipis() {
  const { data, error } = await supabase
    .from('v_stok_bahan')
    .select('*')
    .order('nama')
  if (error) throw error
  // Saring bahan yang stoknya di bawah stok_minimum
  return data.filter(b => Number(b.stok_total) < Number(b.stok_minimum))
}
