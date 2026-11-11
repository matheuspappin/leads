-- ================================================
-- 01: Create Tables
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
