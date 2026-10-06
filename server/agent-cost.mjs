// Standard API USD per million tokens, verified 2026-10-06.
// https://developers.openai.com/api/docs/pricing
const rates = new Map([
  ["gpt-6-astra", [10, 1, 12.5, 50]],
  ["gpt-6.1-sol", [2, 0.1, 2.5, 10]],
  ["gpt-6-luna", [0.1, 0.01, 0.125, 0.5]],
]);
export function agentCostTracker() {
  let model = null, estimatedUSD = 0, observedRequests = 0, unpricedRequests = 0;
  const seen = new Set();
  return {
    observe(event) {
      const p = event.payload;
      if (event.type === "turn_context") model = p.model ?? null;
      if (event.type === "world_state") {
        const value = p.state?.model;
        model = typeof value === "string" ? value : value?.model ?? model;
      }
      if (event.type !== "event_msg" || p.type !== "token_count" || !p.info) return;
      const usage = p.info.last_token_usage, total = p.info.total_token_usage;
      if (!total) { observedRequests++; unpricedRequests++; return; }
      const key = JSON.stringify(total);
      if (seen.has(key)) return;
      seen.add(key); observedRequests++;
      const price = rates.get(model);
      const input = usage?.input_tokens, cached = usage?.cached_input_tokens, output = usage?.output_tokens;
      const writes = usage?.cache_write_input_tokens ?? 0;
      if (!price || ![input, cached, writes, output].every((n) => Number.isSafeInteger(n) && n >= 0) || cached + writes > input) {
        unpricedRequests++; return;
      }
      // Long-context requests surcharge the full request, not lifetime usage.
      const long = input > 272_000;
      estimatedUSD += ((input - cached - writes) * price[0] * (long ? 2 : 1) +
        cached * price[1] * (long ? 2 : 1) + writes * price[2] * (long ? 2 : 1) + output * price[3] * (long ? 1.5 : 1)) / 1_000_000;
    },
    snapshot() {
      return { estimatedUSD: observedRequests === unpricedRequests ? null : estimatedUSD, observedRequests, unpricedRequests };
    },
  };
}
