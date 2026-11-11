-- ================================================
-- 03: Create Policies
-- ================================================

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
