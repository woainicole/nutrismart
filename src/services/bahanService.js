import { supabase } from '../lib/supabaseClient'

export async function getBahan() {
  const { data, error } = await supabase
    .from('bahan_makanan')
    .select('*, supplier:supplier(nama)')
    .order('nama')
  if (error) throw error
  return data
}

export async function createBahan(bahan) {
  const { data, error } = await supabase.from('bahan_makanan').insert(bahan).select().single()
  if (error) throw error
  return data
}

export async function updateBahan(id, bahan) {
  const { data, error } = await supabase.from('bahan_makanan').update(bahan).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteBahan(id) {
  const { error } = await supabase.from('bahan_makanan').delete().eq('id', id)
  if (error) throw error
}

// ===== Supplier =====
export async function getSupplier() {
  const { data, error } = await supabase.from('supplier').select('*').order('nama')
  if (error) throw error
  return data
}

export async function createSupplier(supplier) {
  const { data, error } = await supabase.from('supplier').insert(supplier).select().single()
  if (error) throw error
  return data
}

export async function updateSupplier(id, supplier) {
  const { data, error } = await supabase.from('supplier').update(supplier).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('supplier').delete().eq('id', id)
  if (error) throw error
}

