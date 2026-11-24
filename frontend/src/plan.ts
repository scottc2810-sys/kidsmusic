// The family's plan (free or family), read once per page load: locks on topics and songs follow it.
import { useEffect, useState } from "react";
import { api, type PlanStatus } from "./api";

let cached: Promise<PlanStatus | null> | null = null;
export const loadPlan = (fresh = false) => {
  if (!cached || fresh) cached = api.licence().catch(() => null);
  return cached;
};
export function usePlan(): PlanStatus | null {
  const [p, setP] = useState<PlanStatus | null>(null);
  useEffect(() => { void loadPlan().then(setP); }, []);
  return p;
}
/** In a strand's list of topics, is the i-th one past the free plan? */
export const topicLocked = (plan: PlanStatus | null, i: number) => {
  const n = plan?.limits.topics_per_strand;
  return n != null && i >= n;
};
