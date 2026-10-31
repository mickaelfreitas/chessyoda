CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  rating integer NOT NULL DEFAULT 1400,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, rating)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'rating','')::int, 1400))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'play',
  external_id text,
  player_color text NOT NULL DEFAULT 'white',
  opponent text,
  opponent_elo integer,
  coach_mode text NOT NULL DEFAULT 'off',
  time_control text,
  result text,
  pgn text,
  moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  takebacks integer NOT NULL DEFAULT 0,
  blunders integer NOT NULL DEFAULT 0,
  mistakes integer NOT NULL DEFAULT 0,
  inaccuracies integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX games_user_external ON public.games(user_id, source, external_id) WHERE external_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own games" ON public.games FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.puzzles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
  fen text NOT NULL,
  played_san text NOT NULL,
  best_uci text NOT NULL,
  best_san text,
  best_line text,
  severity text NOT NULL DEFAULT 'mistake',
  mistake_type text NOT NULL DEFAULT 'missed_tactic',
  status text NOT NULL DEFAULT 'new',
  attempts integer NOT NULL DEFAULT 0,
  solved_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.puzzles TO authenticated;
GRANT ALL ON public.puzzles TO service_role;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own puzzles" ON public.puzzles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);