-- ================================================
-- 02: Enable Row Level Security (RLS)
-- ================================================

-- Habilita RLS em todas as tabelas (Obrigatório para segurança no Supabase)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
