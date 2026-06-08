/**
 * Applique un fichier SQL de migration sur la base Supabase via une
 * connexion Postgres directe.
 *
 * Pré-requis : ajouter dans .env.local la ligne suivante
 *   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * Comment récupérer cette URL :
 *   1. Va sur https://supabase.com/dashboard/project/<ref>/settings/database
 *   2. Section "Connection string" → onglet "URI" → mode "Transaction pooler"
 *   3. Copie l'URI affichée (avec [YOUR-PASSWORD] remplacé par le vrai mot de passe DB)
 *
 * Usage :
 *   npx tsx scripts/apply-migration.ts <chemin/vers/fichier.sql>
 *
 * Exemple :
 *   npx tsx scripts/apply-migration.ts supabase/migrations/030_restore_missing_tables.sql
 */

import { Client } from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const DB_URL = process.env.SUPABASE_DB_URL

if (!DB_URL) {
  console.error('❌ SUPABASE_DB_URL manquant dans .env.local')
  console.error('')
  console.error('Procédure :')
  console.error('  1. Ouvre https://supabase.com/dashboard/project/<ref>/settings/database')
  console.error('  2. Section "Connection string" → onglet "URI" → mode "Transaction pooler"')
  console.error('  3. Copie l\'URI affichée, et remplace [YOUR-PASSWORD] par le mot de passe DB')
  console.error('  4. Ajoute dans .env.local :')
  console.error('     SUPABASE_DB_URL=postgresql://postgres.xxxxx:yyyyy@aws-0-zzz.pooler.supabase.com:6543/postgres')
  process.exit(1)
}

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('❌ Usage : npx tsx scripts/apply-migration.ts <chemin/vers/fichier.sql>')
  process.exit(1)
}

let sqlContent: string
try {
  sqlContent = readFileSync(resolve(process.cwd(), sqlFile), 'utf-8')
} catch (e: any) {
  console.error(`❌ Impossible de lire ${sqlFile} : ${e.message}`)
  process.exit(1)
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  })

  console.log(`📡 Connexion à la base Supabase ...`)
  await client.connect()
  console.log(`✅ Connecté.`)

  console.log(`📄 Application de ${sqlFile} (${sqlContent.length} octets, ${sqlContent.split('\n').length} lignes) ...`)

  try {
    await client.query('BEGIN')
    await client.query(sqlContent)
    await client.query('COMMIT')
    console.log(`\n🎉 Migration appliquée avec succès dans une transaction.`)
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(`\n❌ Erreur SQL (transaction annulée) : ${e.message}`)
    if (e.position) console.error(`   Position dans le fichier : caractère ${e.position}`)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch(e => {
  console.error(`\n❌ Erreur de connexion : ${e.message}`)
  console.error(`\nVérifie que SUPABASE_DB_URL dans .env.local est :`)
  console.error(`  - de la forme postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`)
  console.error(`  - le mot de passe est bien celui de la DB (Settings → Database), pas du compte Supabase`)
  process.exit(1)
})
