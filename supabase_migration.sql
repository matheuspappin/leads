-- ================================================
-- Lead Hunter — Supabase Migration
-- Execute este script no SQL Editor do Supabase
-- Dashboard > SQL Editor > New query > Paste > Run
-- ================================================

-- Tabela de configurações do usuário (API Key pessoal)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    google_api_key TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Tabela de buscas
CREATE TABLE IF NOT EXISTS public.searches (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query       TEXT NOT NULL,
    city        TEXT NOT NULL,
    total_leads INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tabela de leads
CREATE TABLE IF NOT EXISTS public.leads (
    id              BIGSERIAL PRIMARY KEY,
    search_id       BIGINT NOT NULL REFERENCES public.searches(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    place_id        TEXT NOT NULL,
    name            TEXT,
    address         TEXT,
    phone           TEXT,
    website         TEXT,
    rating          REAL DEFAULT 0,
    user_ratings    INTEGER DEFAULT 0,
    maps_url        TEXT,
    has_website     BOOLEAN DEFAULT FALSE,
    has_phone       BOOLEAN DEFAULT FALSE,
    score           INTEGER DEFAULT 0,
    score_reasons   JSONB DEFAULT '[]',
    lat             REAL,
    lng             REAL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Tabela de cache por usuário
CREATE TABLE IF NOT EXISTS public.search_cache (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cache_key   TEXT NOT NULL,
    data        JSONB NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    UNIQUE(user_id, cache_key)
);

-- ================================================
-- RLS (Row Level Security) — cada usuário só vê os seus dados
-- ================================================

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- searches
DROP POLICY IF EXISTS "Users can view own searches" ON public.searches;
CREATE POLICY "Users can view own searches" ON public.searches FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own searches" ON public.searches;
CREATE POLICY "Users can insert own searches" ON public.searches FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own searches" ON public.searches;
CREATE POLICY "Users can delete own searches" ON public.searches FOR DELETE USING (auth.uid() = user_id);

-- leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads;
CREATE POLICY "Users can insert own leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
CREATE POLICY "Users can delete own leads" ON public.leads FOR DELETE USING (auth.uid() = user_id);

-- search_cache
DROP POLICY IF EXISTS "Users can manage own cache" ON public.search_cache;
CREATE POLICY "Users can manage own cache" ON public.search_cache FOR ALL USING (auth.uid() = user_id);

-- ================================================
-- Indexes
-- ================================================
CREATE INDEX IF NOT EXISTS idx_searches_user_id ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_search_id ON public.leads(search_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_cache_user_key ON public.search_cache(user_id, cache_key);
