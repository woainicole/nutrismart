import { supabase } from '../lib/supabaseClient'

export async function getStokBahan() {
  const { data, error } = await supabase.from('v_stok_bahan').select('*').order('nama')
  if (error) throw error
  return data
}

export async function getStokBatch(filter = {}) {
  let q = supabase.from('stok_batch')
    .select('*, bahan:bahan_makanan(nama, satuan)')
    .gt('jumlah_sisa', 0)
    .order('tgl_kedaluwarsa')
  if (filter.bahan_id) q = q.eq('bahan_id', filter.bahan_id)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createStokBatch(batch) {
  const { data, error } = await supabase.from('stok_batch').insert(batch).select().single()
  if (error) throw error
  return data
}

export async function getNearExpiry() {
  const { data, error } = await supabase.from('v_near_expiry').select('*').order('tgl_kedaluwarsa')
  if (error) throw error
  return data
}

