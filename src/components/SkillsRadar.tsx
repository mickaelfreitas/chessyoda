import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { SKILL_DEFINITIONS, skillScores, type SkillGame, type SkillPuzzle } from "@/lib/skills";
import { completeSkillAnalysis } from "@/lib/post-game";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

export function SkillsRadar({ games, puzzles }: { games: SkillGame[]; puzzles: SkillPuzzle[] }) {
  const [view, setView] = useState("now");
  const [processing, setProcessing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const queryClient = useQueryClient();
  useEffect(() => {
    let stopped = false;
    const pending = games.filter((g) => !g.skills_analyzed);
    if (!pending.length) return;
    setProcessing(true); setFailed(false);
    void (async () => {
      try {
        for (const g of pending) { if (stopped) break; await completeSkillAnalysis(g.id); }
        await queryClient.invalidateQueries({ queryKey: ["skill-games"] });
        await queryClient.invalidateQueries({ queryKey: ["puzzles"] });
      } catch { if (!stopped) setFailed(true); }
      finally { if (!stopped) setProcessing(false); }
    })();
    return () => { stopped = true; };
  }, [games, queryClient, retry]);
  const cutoff = Date.now() - 28 * 86400000;
  const hasPast = games.some((g) => Date.parse(g.created_at) <= cutoff);
  const scores = useMemo(() => skillScores(games, puzzles, view === "past" ? Date.now() - 28 * 86400000 : Date.now()), [games, puzzles, view]);
  const data = scores.map((s) => ({ ...s, value: s.score ?? 0, lower: s.score === null ? 0 : s.low, upper: s.score === null ? 0 : s.high, label: `${s.axis} · ${s.score === null ? "Needs more data" : Math.round(s.score)}` }));
  const weakest = scores.filter((s) => s.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  return <section className="border-t border-border py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Skills</h2><Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="now">Now</TabsTrigger>{hasPast && <TabsTrigger value="past">4 weeks ago</TabsTrigger>}</TabsList></Tabs></div>
    {processing && <p className="mt-2 text-sm text-muted-foreground" role="status">Analyzing saved games…</p>}
    {failed && <div className="mt-2 flex items-center gap-3 text-sm"><span>Skills analysis unavailable</span><Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>Retry</Button></div>}
    <div className="h-80 w-full min-w-0 sm:h-96" aria-label="Six-axis skills radar">
      <ResponsiveContainer width="100%" height="100%"><RadarChart data={data} startAngle={90} endAngle={-270} outerRadius="61%">
        <PolarGrid stroke="var(--border)" gridType="polygon" />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
        <Radar name="Upper 80% bound" dataKey="upper" stroke="var(--primary)" strokeOpacity={0.35} strokeDasharray="4 4" fill="none" />
        <Radar name="Lower 80% bound" dataKey="lower" stroke="var(--primary)" strokeOpacity={0.35} strokeDasharray="4 4" fill="none" />
        <Radar name="Score" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.18} animationDuration={600} dot={{ r: 3, fill: "var(--muted-foreground)" }} />
        <Tooltip content={({ active, payload }) => {
          const s = payload?.[0]?.payload as typeof data[number] | undefined;
          if (!active || !s) return null;
          return <div className="max-w-64 border border-border bg-popover p-3 text-xs text-popover-foreground"><p>{s.label}</p><p className="mt-2">{SKILL_DEFINITIONS[s.axis]}</p><p className="mt-2">80% interval: {Math.round(s.low)}–{Math.round(s.high)}</p><p>Based on {s.count} positions</p></div>;
        }} />
      </RadarChart></ResponsiveContainer>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">{data.map((s) => <details key={s.axis} className="border-t border-border py-2"><summary className="cursor-pointer text-muted-foreground">{s.label}</summary><p className="mt-2">{SKILL_DEFINITIONS[s.axis]}</p><p className="mt-2">80% interval: {Math.round(s.low)}–{Math.round(s.high)} · Based on {s.count} positions</p></details>)}</div>
    {weakest && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><span>Your biggest opportunity: {weakest.axis}</span><Button asChild size="sm"><Link to="/puzzles" search={{ category: weakest.axis === "Consistency" ? "Tactics" : weakest.axis }}>Train this</Link></Button></div>}
  </section>;
}