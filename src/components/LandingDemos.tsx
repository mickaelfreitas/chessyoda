import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { initializeLandingDemos } from "@/lib/landing-demos";

export function LandingDemos() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    return initializeLandingDemos(root.current);
  }, []);
  return <div className="landing-demos" ref={root}>
  <section id="forecast">
    <div className="demo-wrap two-col">
      <div className="stack">
        <h2 className="demo-heading">Your progress, with honest odds</h2>
        <p className="demo-body">After every rated game, a small Bayesian model updates two things: how strong you are right now, and how fast you’re improving. The forecast starts wide and tightens as evidence comes in, so you get a range you can trust instead of a promise.</p>
        <div className="stats" aria-live="polite">
          <div className="stat"><span className="stat-val" id="fc-games">0</span><span className="stat-lbl">Rated games</span></div>
          <div className="stat"><span className="stat-val" id="fc-range">–</span><span className="stat-lbl">Likely rating in week 16</span></div>
          <div className="stat"><span className="stat-val" id="fc-prob">–</span><span className="stat-lbl">Chance you’re improving</span></div>
        </div>
      </div>
      <div className="panel chart-panel">
        <div className="chart-meta"><span>Sample player, simulated games</span><span>80% band</span></div>
        <svg id="fc-chart" viewBox="0 0 800 440" role="img" aria-label="Rating forecast: game results as dots, a median line and an uncertainty band that narrows as more games are played"></svg>
      </div>
    </div>
  </section>

  
  <section id="skills">
    <div className="demo-wrap two-col">
      <div className="panel chart-panel">
        <div className="chart-meta"><span>Sample player</span><span id="rd-week">Week 1</span></div>
        <svg id="rd-chart" viewBox="0 0 700 520" role="img" aria-label="Skill radar with six axes: opening play, tactics, positional play, endgames, defense and consistency"></svg>
      </div>
      <div className="stack">
        <h2 className="demo-heading">Your game in six numbers</h2>
        <p className="demo-body">Every axis is scored from your own games and puzzles. The faint outline shows how sure the model is, and it tightens as you play. Watch the weak spots close.</p>
        <div className="week-toggle" role="group" aria-label="Radar view">
          <Button variant="ghost" type="button" data-w="0" aria-pressed="false">Week 1</Button>
          <Button variant="ghost" type="button" data-w="1" aria-pressed="false">Week 8</Button>
          <Button variant="ghost" type="button" data-w="auto" aria-pressed="true">Play</Button>
        </div>
        <dl className="axes-list">
          <div><dt>Opening play</dt><dd>Sound, accurate moves in the first 12.</dd></div>
          <div><dt>Tactics</dt><dd>Forks, pins and winning moves found.</dd></div>
          <div><dt>Positional play</dt><dd>Good plans in quiet positions.</dd></div>
          <div><dt>Endgames</dt><dd>Advantages converted, draws held.</dd></div>
          <div><dt>Defense</dt><dd>Threats spotted before they land.</dd></div>
          <div><dt>Consistency</dt><dd>Games played without a blunder.</dd></div>
        </dl>
      </div>
    </div>
  </section>


</div>;
}
