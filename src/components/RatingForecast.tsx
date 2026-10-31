import { useEffect, useMemo, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { forecastRating, ratingHistory, FORECAST_UNLOCK_GAMES, type RatedResult } from "@/lib/rating-forecast";
export function RatingForecast({ results }: { results: RatedResult[] }) {
  const history = useMemo(() => ratingHistory(results), [results]);
  const [forecast, setForecast] = useState<ReturnType<typeof forecastRating>>(null);
  const [calculating, setCalculating] = useState(false);
  useEffect(() => {
    setForecast(null);
    if (results.length < FORECAST_UNLOCK_GAMES) return;
    setCalculating(true);
    const worker = new Worker(new URL("../lib/rating.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event) => { setForecast(event.data); setCalculating(false); };
    worker.onerror = () => setCalculating(false);
    worker.postMessage({ results, now: Date.now() });
    return () => worker.terminate();
  }, [results]);
  const current = history.at(-1);
  const data = [...history.map((p) => ({ time: Date.parse(p.date), rating: p.rating })), ...(forecast?.points ?? []).map((p) => ({ time: Date.parse(p.date), forecast: p.median, band: [p.lower, p.upper] }))];
  const end = forecast?.points.at(-1);
  return <section className="space-y-3 border-y py-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">Rating forecast</h2><span className="font-mono text-xl">{current ? `${Math.round(current.rating)} ± ${Math.round(current.rd)}` : "1500 ± 350"}</span></div>
    <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}>
      <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(n) => new Date(n).toLocaleDateString(undefined, { month: "short", day: "numeric" })} stroke="var(--muted-foreground)" />
      <YAxis domain={["auto", "auto"]} stroke="var(--muted-foreground)" />
      <Tooltip labelFormatter={(n) => new Date(Number(n)).toLocaleDateString()} />
      <Area dataKey="band" name="80% credible band" stroke="none" fill="var(--forecast-band)" isAnimationActive={false} />
      <Line dataKey="rating" name="Rating history" stroke="var(--primary)" dot={false} isAnimationActive={false} />
      <Line dataKey="forecast" name="Forecast" stroke="var(--primary)" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
    </ComposedChart></ResponsiveContainer></div>
    {results.length < FORECAST_UNLOCK_GAMES ? <p className="text-sm text-muted-foreground">Play {FORECAST_UNLOCK_GAMES - results.length} more rated games to unlock your forecast.</p> : calculating ? <p className="text-sm text-muted-foreground">Calculating forecast…</p> : end ? <>
      <p className="text-sm">At your current pace, you'll likely be between {Math.round(end.lower)} and {Math.round(end.upper)} by {new Date(end.date).toLocaleDateString()}.</p>
      <p className="text-sm text-muted-foreground">Probability you're improving: {Math.round((forecast?.improving ?? 0) * 100)}%</p>
      <p className="text-xs text-primary">Forecast · 80% credible band</p>
    </> : <p className="text-sm text-muted-foreground">Forecast unavailable right now.</p>}
  </section>;
}