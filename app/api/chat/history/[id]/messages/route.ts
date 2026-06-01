import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth'
import { NextResponse, NextRequest } from 'next/server'

/**
 * app/api/chat/[id]/messages/route.ts
 * Récupère les messages d'une conversation spécifique.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getApiUser()
    if ('error' in authResult) return authResult.error

    const supabase = createClient()
    const { id } = params

    // Vérification d'accès — un super_admin lit tout, un responsable
    // d'agence lit les conversations de son agence, un conseiller lit
    // uniquement les siennes.
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('user_id, agency_id')
      .eq('id', id)
      .single()

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation non trouvée.' }, { status: 404 })
    }

    const { user } = authResult
    const canRead =
      user.role === 'super_admin' ||
      (user.role === 'responsable_agence' && conv.agency_id === user.agency_id) ||
      conv.user_id === user.id

    if (!canRead) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // Récupération des messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, created_at, model_used')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    return NextResponse.json(messages)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
