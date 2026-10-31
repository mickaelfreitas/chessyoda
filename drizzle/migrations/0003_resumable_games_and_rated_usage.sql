ALTER TABLE public.games ADD COLUMN status text NOT NULL DEFAULT 'completed' CHECK (status IN ('active', 'completed'));
ALTER TABLE public.games ADD COLUMN current_fen text;
ALTER TABLE public.games ADD COLUMN snapshot jsonb;
ALTER TABLE public.games ADD COLUMN hints_used integer NOT NULL DEFAULT 0 CHECK (hints_used >= 0);
ALTER TABLE public.games ADD COLUMN rated boolean NOT NULL DEFAULT false;
ALTER TABLE public.games ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.puzzles ADD COLUMN source_move_key text;
CREATE UNIQUE INDEX puzzles_source_move_unique ON public.puzzles (user_id, game_id, source_move_key) WHERE source_move_key IS NOT NULL;
CREATE INDEX games_active_owner_idx ON public.games(user_id, updated_at DESC) WHERE status='active';
CREATE FUNCTION public.enforce_game_rating_eligibility() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 NEW.rated := NEW.status='completed' AND NEW.source='play' AND NEW.takebacks=0 AND NEW.hints_used=0;
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_game_rating_eligibility() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_game_rating_eligibility BEFORE INSERT OR UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.enforce_game_rating_eligibility();
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;