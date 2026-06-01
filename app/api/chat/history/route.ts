import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * app/api/chat/history/route.ts
 * Liste les conversations visibles par l'utilisateur connecté.
 *
 * Périmètre par rôle :
 *   - super_admin        → toutes les conversations de toutes les agences
 *   - responsable_agence → toutes les conversations de son agence
 *   - conseiller         → ses propres conversations uniquement
 */

export async function GET() {
  try {
    const authResult = await getApiUser()
    if ('error' in authResult) return authResult.error

    const supabase = createClient()
    const { user } = authResult

    // Pour super_admin / responsable_agence, on joint users + agencies pour
    // afficher l'auteur et l'agence dans l'historique. Pour les conseillers,
    // on garde le payload léger d'origine.
    const isPrivileged = user.role === 'super_admin' || user.role === 'responsable_agence'

    let query = supabase
      .from('conversations')
      .select(
        isPrivileged
          ? 'id, title, created_at, user_id, agency_id, users(full_name), agencies(name)'
          : 'id, title, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (user.role === 'conseiller') {
      query = query.eq('user_id', user.id)
    } else if (user.role === 'responsable_agence') {
      query = query.eq('agency_id', user.agency_id)
    }
    // super_admin → aucun filtre, la RLS conversations_super_admin_all autorise tout

    const { data, error } = await query

    if (error) {
      console.error('[History API] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Normalise le payload pour le front
    const items = (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      author_name: row.users?.full_name ?? null,
      agency_name: row.agencies?.name ?? null,
    }))

    return NextResponse.json(items)
  } catch (error: any) {
    console.error('[History API] Exception:', error.message)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique.' },
      { status: 500 }
    )
  }
}
