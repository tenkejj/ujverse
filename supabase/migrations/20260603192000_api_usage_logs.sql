-- api_usage_logs: monitoring zużycia tokenów per request AI (asystent UJverse)
--
-- Wstawiane fire-and-forget z `api/chat.ts` przez `api/_lib/tokenUsage.ts`
-- (service-role klient). Tabela ma być TANIA do zapisu — pojedynczy INSERT
-- bez triggerów/RPC. Czytamy ją tylko w dashboardach analitycznych.
--
-- `user_id` jest nullable (anonimowe requesty są dozwolone). FK do `auth.users`
-- z `ON DELETE SET NULL` żeby usunięcie użytkownika nie wywaliło historii
-- zużycia (anonymizacja zamiast cascade).

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_logs_created_at_idx
  ON public.api_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_logs_user_id_created_at_idx
  ON public.api_usage_logs (user_id, created_at DESC);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Brak polityk dla `authenticated` / `anon` — odczyt tylko service role
-- (analityka po stronie backendu / dashboardu admina). Zapisy idą zawsze
-- przez service role z `tokenUsage.ts`, więc dodatkowe polityki nie są
-- potrzebne. Jeśli kiedyś chcemy odczyt per-user historii, dodać:
--
--   CREATE POLICY "api_usage_logs_select_own" ON public.api_usage_logs
--     FOR SELECT TO authenticated
--     USING (auth.uid() = user_id);
