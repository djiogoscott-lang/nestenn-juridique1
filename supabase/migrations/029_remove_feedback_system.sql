-- Migration 029 : suppression du système de feedback (👍/👎)
-- Décision client (2026-05-19) : focus sur le chatbot juridique pur,
-- suppression des fonctionnalités annexes pour réduire la surface produit.
--
-- Effets :
--   - Drop des policies RLS feedback (002 + 028)
--   - Drop table public.feedback_reviews
--   - Tout le code applicatif (UI 👍/👎, /api/feedback, /api/admin/feedback-report,
--     /admin/dashboard) a été supprimé dans le même commit

DROP POLICY IF EXISTS "agents_insert_own_feedback"        ON public.feedback_reviews;
DROP POLICY IF EXISTS "admins_read_all_feedbacks"         ON public.feedback_reviews;
DROP POLICY IF EXISTS "super_admins_read_all_feedbacks"   ON public.feedback_reviews;

DROP TABLE IF EXISTS public.feedback_reviews CASCADE;
