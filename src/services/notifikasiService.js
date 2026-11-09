import { supabase } from '../lib/supabaseClient'

export async function getNotifikasi(limit = 50) {
  const { data, error } = await supabase
    .from('notifikasi')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getJumlahBelumDibaca() {
  const { count, error } = await supabase
    .from('notifikasi')
    .select('*', { count: 'exact', head: true })
    .is('dibaca_at', null)
  if (error) throw error
  return count || 0
}

export async function tandaiDibaca(ids) {
  if (!ids?.length) return
  const { error } = await supabase
    .from('notifikasi')
    .update({ dibaca_at: new Date().toISOString() })
    .in('id', ids)
    .is('dibaca_at', null)
  if (error) throw error
}

export async function tandaiDibacaRute(rute) {
  if (!rute) return
  const { error } = await supabase
    .from('notifikasi')
    .update({ dibaca_at: new Date().toISOString() })
    .eq('rute', rute)
    .is('dibaca_at', null)
  if (error) throw error
}

export async function tandaiSemuaDibaca() {
  const { error } = await supabase
    .from('notifikasi')
    .update({ dibaca_at: new Date().toISOString() })
    .is('dibaca_at', null)
  if (error) throw error
}

