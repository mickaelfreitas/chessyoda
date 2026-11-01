import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { gamesQuery, profileQuery, puzzlesQuery, learningsQuery, skillGamesQuery } from "@/lib/queries";
import { MISTAKE_TYPE_TEXT, type MistakeType } from "@/lib/coach";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RatingForecast } from "@/components/RatingForecast";
import { ratedResults, rollingBlunders } from "@/lib/rating-forecast";
import { KeyLearnings } from "@/components/KeyLearnings";
import { SkillsRadar } from "@/components/SkillsRadar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Progress — Chess Yoda" },
      { name: "description", content: "Track blunders, take-backs, puzzle accuracy and your most common mistakes." },
      { property: "og:title", content: "Progress — Chess Yoda" },
      { property: "og:description", content: "Track blunders, take-backs, puzzle accuracy and your most common mistakes." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(gamesQuery),
      context.queryClient.ensureQueryData(puzzlesQuery),
      context.queryClient.ensureQueryData(profileQuery),
      context.queryClient.ensureQueryData(learningsQuery),
      context.queryClient.ensureQueryData(skillGamesQuery),
    ]);
  },
  component: ProgressPage,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="font-display text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function ProgressPage() {
  const { data: games } = useSuspenseQuery(gamesQuery);
  const { data: puzzles } = useSuspenseQuery(puzzlesQuery);
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: learnings } = useSuspenseQuery(learningsQuery);
  const { data: skillGames } = useSuspenseQuery(skillGamesQuery);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [rating, setRating] = useState(String(profile?.rating ?? 1400));
  useEffect(() => {
    setName(profile?.display_name ?? "");
    setRating(String(profile?.rating ?? 1400));
  }, [profile]);

  const chrono = [...games].reverse();
  const blunderSeries = rollingBlunders(chrono).map((g, i) => ({ ...g, mistakes: chrono[i]?.mistakes ?? 0 }));
  const results = useMemo(() => ratedResults(games), [games]);
  const takebackSeries = chrono.filter((g) => g.source === "play" && g.coach_mode !== "off").map((g, i) => ({ n: i + 1, takebacks: g.takebacks }));
  const solved = puzzles.reduce((s, p) => s + p.solved_count, 0);
  const failed = puzzles.reduce((s, p) => s + p.failed_count, 0);
  const accuracy = solved + failed ? Math.round((solved / (solved + failed)) * 100) : 0;
  const avgBlunders = games.length ? (games.reduce((s, g) => s + g.blunders, 0) / games.length).toFixed(1) : "0";
  const types = (Object.keys(MISTAKE_TYPE_TEXT) as MistakeType[]).map((t) => ({
    type: MISTAKE_TYPE_TEXT[t],
    count: puzzles.filter((p) => p.mistake_type === t).length,
  }));

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ display_name: name, rating: Number(rating) || 1400 }).eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  const axis = { stroke: "var(--muted-foreground)", fontSize: 12 };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Progress</h1>
      <Tabs defaultValue="overview">
      <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="learnings">Learnings</TabsTrigger></TabsList>
      <TabsContent value="learnings" className="space-y-4">
        <Input aria-label="Search learnings" placeholder="Search learnings" value={search} onChange={(e) => setSearch(e.target.value)} />
        {learnings.filter((l) => l.content?.toLowerCase().includes(search.toLowerCase())).map((l) => <article key={l.game_id} className="border-t border-border py-4"><Button asChild variant="link" className="px-0"><Link to="/review/$gameId" params={{ gameId: l.game_id }}>{new Date(l.updated_at).toLocaleDateString()} · Review game</Link></Button><p className="whitespace-pre-line text-sm leading-relaxed">{l.content}</p></article>)}
        {!learnings.length && <p className="text-sm text-muted-foreground">No learnings yet.</p>}
      </TabsContent>
      <TabsContent value="overview" className="space-y-5">
      <RatingForecast results={results} />
      <SkillsRadar games={skillGames} puzzles={puzzles} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Games played" value={games.length} />
        <Stat label="Blunders / game" value={avgBlunders} />
        <Stat label="Puzzle accuracy" value={`${accuracy}%`} />
        <Stat label="Puzzles solved" value={puzzles.filter((p) => p.status === "solved").length} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Blunders & mistakes per game">
          <LineChart data={blunderSeries}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="n" {...axis} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip />
            <Line type="monotone" dataKey="blunders" stroke="var(--blunder)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="mistakes" stroke="var(--mistake)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="average" name="Last 10 games average" stroke="var(--primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Take-backs per coached game">
          <LineChart data={takebackSeries}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="n" {...axis} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip />
            <Line type="monotone" dataKey="takebacks" stroke="var(--primary)" strokeWidth={2} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Most common mistake types">
          <BarChart data={types}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="type" {...axis} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
        <form onSubmit={saveProfile} className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Your profile</h2>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />
          <Input type="number" min={400} max={3000} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="Rating" />
          <p className="text-xs text-muted-foreground">Your rating sets the level of the coach's explanations.</p>
          <Button type="submit">Save</Button>
        </form>
      </div>
      </TabsContent>
      </Tabs>
    </div>
  );
}
