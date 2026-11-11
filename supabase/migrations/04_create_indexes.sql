-- ================================================
-- 04: Create Indexes
-- ================================================

CREATE INDEX IF NOT EXISTS idx_searches_user_id ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_search_id ON public.leads(search_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_cache_user_key ON public.search_cache(user_id, cache_key);
