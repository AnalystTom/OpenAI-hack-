import { useCallback, useEffect, useRef, useState } from "react";
import type { OfficeAgent } from "../../types";
import { parseOfficeSnapshot } from "../../snapshot";

export function useRobotsSessions(onAgents: (agents: OfficeAgent[]) => void) {
  const [connected, setConnected] = useState(
    () => sessionStorage.getItem("dots-robots-connected") === "yes",
  );
  const [state, setState] = useState<
    "disconnected" | "loading" | "connected" | "error"
  >("disconnected");
  const [error, setError] = useState("");
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const receive = useRef(onAgents);
  receive.current = onAgents;
  const disconnect = useCallback(() => {
    sessionStorage.removeItem("dots-robots-connected");
    setConnected(false);
    setState("disconnected");
    setError("");
    setObservedAt(null);
  }, []);
  const connect = useCallback(() => {
    sessionStorage.setItem("dots-robots-connected", "yes");
    setConnected(true);
  }, []);
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      setState((previous) =>
        previous === "connected" || previous === "error" ? previous : "loading",
      );
      try {
        const response = await fetch("/api/local-codex/robots", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5000),
          ]),
          cache: "no-store",
        });
        if (!response.headers.get("content-type")?.includes("application/json"))
          throw new Error(
            "Live local import is available when running Dots on your computer. Use a snapshot on the hosted site.",
          );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Cannot read local sessions.");
        const snapshot = parseOfficeSnapshot(JSON.stringify(data));
        if (cancelled) return;
        receive.current(snapshot.agents);
        setTotal(data.total);
        setObservedAt(data.observedAt);
        setState("connected");
        setError("");
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setError(e instanceof Error ? e.message : "Connection lost.");
      }
      if (!cancelled) timer = setTimeout(refresh, 5000);
    }
    refresh();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [connected]);
  return {
    connect,
    disconnect,
    state,
    error,
    observedAt,
    total,
    enabled: connected,
  };
}
