import { supabase } from '../lib/supabaseClient'

export async function getPengaturan() {
  const { data, error } = await supabase.from('pengaturan').select('*').order('key')
  if (error) throw error
  return data
}

export async function updatePengaturan(key, value) {
  const { data, error } = await supabase
    .from('pengaturan')
    .update({ value })
    .eq('key', key)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, bangsal:bangsal(nama)')
    .order('nama')
  if (error) throw error
  return data
}

export async function updateProfile(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

