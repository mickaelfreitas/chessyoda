REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.explanation_usage (
 user_id uuid NOT NULL,
 usage_date date NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
 PRIMARY KEY (user_id, usage_date)
);
GRANT SELECT ON public.explanation_usage TO authenticated;
GRANT ALL ON public.explanation_usage TO service_role;
ALTER TABLE public.explanation_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own explanation usage" ON public.explanation_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.explanation_cache (
 cache_key text PRIMARY KEY CHECK (length(cache_key) = 64),
 explanation text NOT NULL CHECK (length(explanation) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.explanation_cache TO authenticated;
GRANT ALL ON public.explanation_cache TO service_role;
ALTER TABLE public.explanation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in cache reads" ON public.explanation_cache FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE FUNCTION public.consume_explanation_allowance(p_user_id uuid, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE consumed integer;
BEGIN
 IF p_user_id IS NULL OR p_limit IS NULL OR p_limit <= 0 THEN RETURN false; END IF;
 INSERT INTO public.explanation_usage AS u (user_id, usage_date, used)
 VALUES (p_user_id, (now() AT TIME ZONE 'UTC')::date, 1)
 ON CONFLICT (user_id, usage_date) DO UPDATE SET used = u.used + 1 WHERE u.used < p_limit
 RETURNING used INTO consumed;
 RETURN consumed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_explanation_allowance(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_explanation_allowance(uuid, integer) TO service_role;
CREATE FUNCTION public.validate_puzzle_game_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.game_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.games WHERE id = NEW.game_id AND user_id = NEW.user_id) THEN
 RAISE EXCEPTION 'Invalid game reference';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_puzzle_game_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_puzzle_game_owner BEFORE INSERT OR UPDATE OF game_id, user_id ON public.puzzles FOR EACH ROW EXECUTE FUNCTION public.validate_puzzle_game_owner();