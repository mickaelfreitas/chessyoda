REVOKE ALL ON public.explanation_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.explanation_usage TO authenticated;
GRANT ALL ON public.explanation_usage TO service_role;
REVOKE ALL ON public.explanation_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.explanation_cache TO authenticated;
GRANT ALL ON public.explanation_cache TO service_role;