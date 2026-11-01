import { supabase } from '../lib/supabaseClient'

export async function getBangsal() {
  const { data, error } = await supabase.from('bangsal').select('*').order('nama')
  if (error) throw error
  return data
}

export async function createBangsal(bangsal) {
  const { data, error } = await supabase.from('bangsal').insert(bangsal).select().single()
  if (error) throw error
  return data
}

export async function updateBangsal(id, bangsal) {
  const { data, error } = await supabase.from('bangsal').update(bangsal).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteBangsal(id) {
  const { error } = await supabase.from('bangsal').delete().eq('id', id)
  if (error) throw error
}

// ===== Jenis Diet =====
export async function getJenisDiet() {
  const { data, error } = await supabase.from('jenis_diet').select('*').order('nama')
  if (error) throw error
  return data
}

export async function createJenisDiet(diet) {
  const { data, error } = await supabase.from('jenis_diet').insert(diet).select().single()
  if (error) throw error
  return data
}

export async function updateJenisDiet(id, diet) {
  const { data, error } = await supabase.from('jenis_diet').update(diet).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteJenisDiet(id) {
  const { error } = await supabase.from('jenis_diet').delete().eq('id', id)
  if (error) throw error
}

