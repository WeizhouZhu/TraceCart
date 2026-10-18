export interface QualitySession {
  label: string | null;
  endedAt: string;
}

export interface SessionActivityCounts {
  requests: number;
  trajectories: number;
}

export function isLowInformationUnlabeledSession(
  session: QualitySession,
  activity: SessionActivityCounts,
  cutoffTime: number,
) {
  if (session.label !== null) return false;
  if (activity.requests > 1 || activity.trajectories > 0) return false;
  const endedAt = Date.parse(session.endedAt);
  return Number.isFinite(endedAt) && endedAt <= cutoffTime;
}