import { forecastRating, type RatedResult } from "./rating-forecast";
self.onmessage = (event: MessageEvent<{ results: RatedResult[]; now: number }>) => {
  self.postMessage(forecastRating(event.data.results, event.data.now));
};