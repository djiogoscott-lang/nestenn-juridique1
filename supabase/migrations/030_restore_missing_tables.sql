-- =============================================================================
-- Nestenn Juridique — Migration 030 : Restauration des tables manquantes
-- Fichier : 030_restore_missing_tables.sql
-- Date    : 2026-06-01
-- =============================================================================
-- Contexte :
--   Diagnostic pré-prod a révélé que les tables `conversations`, `messages` et
--   `document_contents` n'existaient pas en base, ce qui faisait planter le
--   chat (impossible de stocker une conversation) et vidait l'historique +
--   les analytics. Hypothèse : DROP TABLE manuel ciblé pour nettoyer la base
--   de test sans relancer les migrations après.
--
-- Ce script :
--   1. Recrée les 3 tables avec toutes leurs colonnes accumulées au fil des 29
--      migrations précédentes (001 base + 015 analytics + 018 sub_domain + 025
--      model_used + 028 document_contents + ajustements).
--   2. Recrée les index attendus par les requêtes du code.
--   3. Recrée les triggers (updated_at, increment_message_count).
--   4. Recrée les policies RLS finales (équivalent migration 016 + 028).
--   5. Recrée les vues analytics (analytics_by_domain, analytics_by_agency,
--      top_questions, analytics_pain_points).
--
-- 100 % idempotent : safe à re-exécuter, n'efface aucune donnée existante,
-- n'écrase aucune table déjà présente.
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- 1.1 conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agency_id       uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    title           text,
    message_count   integer     DEFAULT 0,
    domain          text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    last_message_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.conversations IS
    'Fils de discussion IA. Un fil = un contexte juridique continu.';
COMMENT ON COLUMN public.conversations.domain IS
    'Domaine juridique principal de la conversation (propagé depuis le 1er message).';


-- 1.2 messages
CREATE TABLE IF NOT EXISTS public.messages (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id         uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role                    text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content                 text        NOT NULL,
    tokens_used             integer,
    dila_context_available  boolean     DEFAULT false,
    domain                  text,
    sub_domain              text,
    topic                   text,
    sources_count           integer     DEFAULT 0,
    response_mode           text        CHECK (response_mode IN ('sourced', 'free')),
    model_used              text        DEFAULT 'anthropic/claude-sonnet-4-6',
    created_at              timestamptz DEFAULT now()
);

COMMENT ON TABLE public.messages IS 'Tous les messages d''une conversation.';
COMMENT ON COLUMN public.messages.domain IS 'Domaine juridique détecté côté serveur.';
COMMENT ON COLUMN public.messages.sub_domain IS 'Sous-domaine classifié async par LLM léger (analytics).';
COMMENT ON COLUMN public.messages.topic IS 'Topic métier déduit depuis le texte (analytics).';
COMMENT ON COLUMN public.messages.response_mode IS 'sourced = répondu avec sources RAG, free = répondu sans (filtré).';
COMMENT ON COLUMN public.messages.model_used IS 'Modèle LLM utilisé pour la réponse assistant.';


-- 1.3 document_contents (PDF uploads)
CREATE TABLE IF NOT EXISTS public.document_contents (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_path          text        NOT NULL,
    content            text        NOT NULL,
    extraction_method  text        CHECK (extraction_method IN ('pdf_parse', 'vision_ocr')),
    created_at         timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.document_contents IS
    'Texte extrait des PDF uploadés via /api/documents/process. Strict owner-only via RLS.';


-- =============================================================================
-- 2. INDEX
-- =============================================================================

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id          ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agency_id        ON public.conversations(agency_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at  ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_domain           ON public.conversations(domain);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id  ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at       ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_domain           ON public.messages(domain);
CREATE INDEX IF NOT EXISTS idx_messages_sub_domain       ON public.messages(sub_domain);
CREATE INDEX IF NOT EXISTS idx_messages_created_domain   ON public.messages(created_at DESC, domain) WHERE role = 'user';
CREATE INDEX IF NOT EXISTS idx_messages_model_used       ON public.messages(model_used) WHERE role = 'assistant';

-- document_contents
CREATE INDEX IF NOT EXISTS idx_document_contents_user_id            ON public.document_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_contents_file_path          ON public.document_contents(file_path);
CREATE INDEX IF NOT EXISTS idx_document_contents_extraction_method  ON public.document_contents(extraction_method);


-- =============================================================================
-- 3. TRIGGERS
-- =============================================================================

-- 3.1 updated_at sur conversations
DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3.2 increment_message_count sur messages
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE conversations
    SET
        message_count   = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at      = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_increment_count ON public.messages;
CREATE TRIGGER trg_messages_increment_count
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION increment_message_count();


-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- Modèle final (post-migration 016) :
--   super_admin         → accès TOTAL à toutes les tables
--   responsable_agence  → lecture des données de son agence
--   conseiller          → ses propres conversations uniquement
-- =============================================================================

ALTER TABLE public.conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_contents ENABLE ROW LEVEL SECURITY;


-- 4.1 conversations
DROP POLICY IF EXISTS "conversations_super_admin_all"          ON public.conversations;
DROP POLICY IF EXISTS "conversations_responsable_own_agency"   ON public.conversations;
DROP POLICY IF EXISTS "conversations_own"                      ON public.conversations;

CREATE POLICY "conversations_super_admin_all" ON public.conversations FOR ALL
    USING (get_user_role() = 'super_admin')
    WITH CHECK (get_user_role() = 'super_admin');

CREATE POLICY "conversations_responsable_own_agency" ON public.conversations FOR SELECT
    USING (get_user_role() = 'responsable_agence' AND agency_id = get_user_agency_id());

CREATE POLICY "conversations_own" ON public.conversations FOR ALL
    USING (user_id = auth.uid() AND get_user_status() = 'active')
    WITH CHECK (user_id = auth.uid() AND get_user_status() = 'active');


-- 4.2 messages
DROP POLICY IF EXISTS "messages_super_admin_all"             ON public.messages;
DROP POLICY IF EXISTS "messages_responsable_own_agency"      ON public.messages;
DROP POLICY IF EXISTS "messages_own_conversations"           ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own_conversations"    ON public.messages;

CREATE POLICY "messages_super_admin_all" ON public.messages FOR ALL
    USING (get_user_role() = 'super_admin')
    WITH CHECK (get_user_role() = 'super_admin');

CREATE POLICY "messages_responsable_own_agency" ON public.messages FOR SELECT
    USING (
        get_user_role() = 'responsable_agence'
        AND EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = conversation_id AND c.agency_id = get_user_agency_id()
        )
    );

CREATE POLICY "messages_own_conversations" ON public.messages FOR SELECT
    USING (
        get_user_status() = 'active'
        AND EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "messages_insert_own_conversations" ON public.messages FOR INSERT
    WITH CHECK (
        get_user_status() = 'active'
        AND EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );


-- 4.3 document_contents (équivalent migration 028)
DROP POLICY IF EXISTS "document_contents_super_admin_all"  ON public.document_contents;
DROP POLICY IF EXISTS "document_contents_owner_select"     ON public.document_contents;
DROP POLICY IF EXISTS "document_contents_owner_insert"     ON public.document_contents;
DROP POLICY IF EXISTS "document_contents_owner_delete"     ON public.document_contents;

CREATE POLICY "document_contents_super_admin_all" ON public.document_contents FOR ALL
    USING (get_user_role() = 'super_admin')
    WITH CHECK (get_user_role() = 'super_admin');

CREATE POLICY "document_contents_owner_select" ON public.document_contents FOR SELECT
    USING (user_id = auth.uid() AND get_user_status() = 'active');

CREATE POLICY "document_contents_owner_insert" ON public.document_contents FOR INSERT
    WITH CHECK (user_id = auth.uid() AND get_user_status() = 'active');

CREATE POLICY "document_contents_owner_delete" ON public.document_contents FOR DELETE
    USING (user_id = auth.uid() AND get_user_status() = 'active');


-- =============================================================================
-- 5. VUES ANALYTICS
-- =============================================================================

CREATE OR REPLACE VIEW public.analytics_by_domain AS
SELECT
    date_trunc('day', m.created_at)::date AS day,
    m.domain,
    COUNT(*)                                              AS question_count,
    COUNT(*) FILTER (WHERE m.response_mode = 'sourced')   AS sourced_count,
    COUNT(*) FILTER (WHERE m.response_mode = 'free')      AS free_count
FROM public.messages m
WHERE m.role = 'user' AND m.domain IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

CREATE OR REPLACE VIEW public.analytics_by_agency AS
SELECT
    a.name              AS agency_name,
    a.slug              AS agency_slug,
    m.domain,
    COUNT(*)            AS question_count,
    MAX(m.created_at)   AS last_question
FROM public.messages m
JOIN public.conversations c ON c.id = m.conversation_id
JOIN public.agencies a      ON a.id = c.agency_id
WHERE m.role = 'user'
GROUP BY 1, 2, 3
ORDER BY 4 DESC;

CREATE OR REPLACE VIEW public.top_questions AS
SELECT
    m.domain,
    LEFT(m.content, 100) AS question_preview,
    COUNT(*)             AS ask_count,
    MAX(m.created_at)    AS last_asked
FROM public.messages m
WHERE m.role = 'user' AND m.domain IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) >= 2
ORDER BY 3 DESC
LIMIT 50;

CREATE OR REPLACE VIEW public.analytics_pain_points AS
SELECT
    m.domain,
    m.sub_domain,
    COUNT(*)            AS question_count,
    MAX(m.created_at)   AS last_asked
FROM public.messages m
WHERE m.role = 'user' AND m.sub_domain IS NOT NULL
GROUP BY 1, 2
ORDER BY 3 DESC;


-- =============================================================================
-- FIN DE LA MIGRATION 030_restore_missing_tables.sql
-- =============================================================================
