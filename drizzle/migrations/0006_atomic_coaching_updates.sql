ALTER TABLE public.game_learnings ADD COLUMN IF NOT EXISTS claim_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.puzzles ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz;
CREATE OR REPLACE FUNCTION public.record_first_puzzle_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF OLD.attempts=0 AND NEW.attempts>0 THEN NEW.first_try_success := NEW.solved_count>OLD.solved_count; NEW.first_attempt_at:=now(); ELSE NEW.first_try_success := OLD.first_try_success; NEW.first_attempt_at:=OLD.first_attempt_at; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.claim_game_learnings(p_game_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.games WHERE id=p_game_id AND user_id=p_user_id AND status='completed') THEN RETURN false; END IF;
 INSERT INTO public.game_learnings(game_id,user_id,status) VALUES(p_game_id,p_user_id,'pending') ON CONFLICT(game_id) DO UPDATE SET status='pending',claim_token=gen_random_uuid(),started_at=now(),updated_at=now() WHERE (game_learnings.status='failed' AND coalesce(game_learnings.error_status,0) NOT IN (403,404)) OR (game_learnings.status='pending' AND game_learnings.started_at < now()-interval '5 minutes');
 RETURN FOUND; END $$;
CREATE OR REPLACE FUNCTION public.merge_coaching_records(p_game_id uuid,p_records jsonb,p_skills boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE old_moves jsonb; merged jsonb; BEGIN
 SELECT moves INTO old_moves FROM public.games WHERE id=p_game_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game unavailable'; END IF;
 SELECT jsonb_agg(CASE WHEN patch.item IS NULL THEN original.item ELSE original.item || patch.item END ORDER BY original.ord) INTO merged FROM jsonb_array_elements(old_moves) WITH ORDINALITY original(item,ord) LEFT JOIN LATERAL (SELECT item FROM jsonb_array_elements(p_records) item WHERE item->>'ply'=original.item->>'ply' AND item->>'uci'=original.item->>'uci' LIMIT 1) patch ON true;
 UPDATE public.games SET moves=coalesce(merged,'[]'::jsonb),skills_analyzed=skills_analyzed OR p_skills WHERE id=p_game_id AND user_id=auth.uid(); END $$;
REVOKE ALL ON FUNCTION public.merge_coaching_records(uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merge_coaching_records(uuid,jsonb,boolean) TO authenticated,service_role;
GRANT SELECT ON public.game_learnings TO authenticated;
GRANT ALL ON public.game_learnings TO service_role;