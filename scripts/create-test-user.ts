/**
 * Crée (ou réinitialise) le compte de test `testeur@start-academy.fr`.
 *
 * Pourquoi ce script :
 *   - Permet à un testeur externe d'accéder à l'app déployée (Vercel) sans avoir
 *     à passer par le flux d'inscription + validation admin (status='pending').
 *
 * Méthode :
 *   - Auth gérée par Supabase Auth → on utilise l'API admin (service role).
 *   - Le hachage du mot de passe est délégué à GoTrue (bcrypt), comme pour
 *     tous les autres comptes de l'application — aucune divergence de hash.
 *   - Le trigger Postgres `handle_new_user` (migration 016) crée le profil
 *     dans public.users avec status='pending'. On force ensuite status='active'
 *     pour que le testeur puisse accéder aux conversations.
 *
 * Tenant (agency_id) :
 *   - Par défaut : première agence active trouvée en base.
 *   - Override : variable d'environnement TEST_USER_AGENCY_ID=<uuid>.
 *
 * Idempotent : relancer le script remet le mot de passe à la valeur attendue.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local')
  process.exit(1)
}

const TEST_EMAIL = 'testeur@start-academy.fr'
const TEST_PASSWORD = 'Testeur123!'
const TEST_FULL_NAME = 'Testeur Démo'

const VALID_ROLES = ['super_admin', 'responsable_agence', 'conseiller'] as const
type Role = (typeof VALID_ROLES)[number]
const ENV_ROLE = process.env.TEST_USER_ROLE?.trim() as Role | undefined
if (ENV_ROLE && !VALID_ROLES.includes(ENV_ROLE)) {
  console.error(`❌ TEST_USER_ROLE invalide : "${ENV_ROLE}". Valeurs : ${VALID_ROLES.join(', ')}`)
  process.exit(1)
}
const TEST_ROLE: Role = ENV_ROLE ?? 'conseiller'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function resolveAgencyId(): Promise<string> {
  const override = process.env.TEST_USER_AGENCY_ID?.trim()
  if (override) {
    const { data, error } = await admin
      .from('agencies')
      .select('id, name')
      .eq('id', override)
      .maybeSingle()
    if (error) throw new Error(`Lecture agency override : ${error.message}`)
    if (!data) throw new Error(`Agence ${override} introuvable (TEST_USER_AGENCY_ID)`)
    console.log(`  • Agence forcée : ${data.name} (${data.id})`)
    return data.id
  }

  const { data, error } = await admin
    .from('agencies')
    .select('id, name')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Lecture agencies : ${error.message}`)
  if (!data) {
    throw new Error(
      "Aucune agence active en base. Crée d'abord une agence ou passe TEST_USER_AGENCY_ID=<uuid>.",
    )
  }
  console.log(`  • Agence cible : ${data.name} (${data.id})`)
  return data.id
}

async function findUserByEmail(email: string): Promise<string | null> {
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw new Error(`listUsers : ${error.message}`)
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found.id
    if (data.users.length < 50) return null
    page += 1
  }
}

async function main() {
  console.log(`Compte de test : ${TEST_EMAIL}`)
  const agencyId = await resolveAgencyId()

  const existing = await findUserByEmail(TEST_EMAIL)
  let userId: string

  if (existing) {
    console.log('  • Compte Auth existant → réinitialisation du mot de passe…')
    const { error } = await admin.auth.admin.updateUserById(existing, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_FULL_NAME, role: TEST_ROLE, agency_id: agencyId },
    })
    if (error) throw new Error(`updateUserById : ${error.message}`)
    userId = existing
  } else {
    console.log('  • Création du compte Auth (bcrypt via Supabase Auth)…')
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_FULL_NAME, role: TEST_ROLE, agency_id: agencyId },
    })
    if (error || !data.user) throw new Error(`createUser : ${error?.message ?? 'inconnu'}`)
    userId = data.user.id
  }

  // Le trigger handle_new_user crée la ligne avec status='pending'.
  // On force status='active' + role + agency_id en upsert pour garantir
  // l'état final, que la ligne ait été créée par le trigger ou non.
  const { error: upsertError } = await admin
    .from('users')
    .upsert(
      {
        id: userId,
        full_name: TEST_FULL_NAME,
        role: TEST_ROLE,
        agency_id: agencyId,
        status: 'active',
      },
      { onConflict: 'id' },
    )
  if (upsertError) throw new Error(`upsert public.users : ${upsertError.message}`)

  console.log('\n✅ Compte de test prêt :')
  console.log(`   email    : ${TEST_EMAIL}`)
  console.log(`   password : ${TEST_PASSWORD}`)
  console.log(`   role     : ${TEST_ROLE}`)
  console.log(`   status   : active`)
  console.log(`   agency   : ${agencyId}`)
}

main().catch(err => {
  console.error('\n❌ Erreur :', err.message ?? err)
  process.exit(1)
})
