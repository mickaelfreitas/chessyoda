ALTER TABLE public.games ADD COLUMN IF NOT EXISTS skills_analyzed boolean NOT NULL DEFAULT false;
ALTER TABLE public.puzzles ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.puzzles ADD COLUMN IF NOT EXISTS first_try_success boolean;
CREATE TABLE public.game_learnings (game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE, user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending', content text, error_status integer, started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.game_learnings TO authenticated;
GRANT ALL ON public.game_learnings TO service_role;
ALTER TABLE public.game_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own learnings" ON public.game_learnings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.claim_game_learnings(p_game_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.games WHERE id=p_game_id AND user_id=p_user_id AND status='completed') THEN RETURN false; END IF;
 INSERT INTO public.game_learnings(game_id,user_id,status) VALUES(p_game_id,p_user_id,'pending') ON CONFLICT(game_id) DO UPDATE SET status='pending',started_at=now(),updated_at=now() WHERE game_learnings.status='failed' AND coalesce(game_learnings.error_status,0) NOT IN (403,404) OR (game_learnings.status='pending' AND game_learnings.started_at < now()-interval '5 minutes');
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_game_learnings(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_game_learnings(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.record_first_puzzle_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF OLD.attempts=0 AND NEW.attempts>0 THEN NEW.first_try_success := NEW.solved_count>OLD.solved_count; ELSE NEW.first_try_success := OLD.first_try_success; END IF; RETURN NEW; END $$;
CREATE TRIGGER first_puzzle_attempt BEFORE UPDATE ON public.puzzles FOR EACH ROW EXECUTE FUNCTION public.record_first_puzzle_attempt();