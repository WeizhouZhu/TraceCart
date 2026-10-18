import { mkdir, rm } from "node:fs/promises";
import { isLowInformationUnlabeledSession } from "./data-quality";
import { EXPORT_DIR, readJson, readNdjson, replaceNdjson, writeJson } from "./storage";

interface SessionRow {
  sessionId: string;
  label: string | null;
  endedAt: string;
  requestCount: number;
  trajectoryCount: number;
  [key: string]: unknown;
}

interface ActivityRow {
  sessionId: string;
  [key: string]: unknown;
}

function increment(counts: Map<string, number>, sessionId: string) {
  counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
}

const apply = process.argv.includes("--apply");
const clearExports = process.argv.includes("--clear-exports");
const minutesArg = process.argv.find((argument) => argument.startsWith("--min-idle-minutes="));
const parsedMinutes = Number(minutesArg?.split("=")[1] ?? 30);
const minIdleMinutes = Number.isFinite(parsedMinutes) && parsedMinutes >= 1 ? parsedMinutes : 30;
const cutoffTime = Date.now() - minIdleMinutes * 60_000;

const [sessions, requests, trajectories] = await Promise.all([
  readJson<SessionRow[]>("sessions.json", []),
  readNdjson<ActivityRow>("requests.ndjson"),
  readNdjson<ActivityRow>("trajectories.ndjson"),
]);

const requestCounts = new Map<string, number>();
const trajectoryCounts = new Map<string, number>();
for (const row of requests) increment(requestCounts, row.sessionId);
for (const row of trajectories) increment(trajectoryCounts, row.sessionId);

const removedIds = new Set(
  sessions
    .filter((session) => isLowInformationUnlabeledSession(session, {
      requests: requestCounts.get(session.sessionId) ?? 0,
      trajectories: trajectoryCounts.get(session.sessionId) ?? 0,
    }, cutoffTime))
    .map((session) => session.sessionId),
);

const retainedSessions = sessions
  .filter((session) => !removedIds.has(session.sessionId))
  .map((session) => ({
    ...session,
    requestCount: requestCounts.get(session.sessionId) ?? 0,
    trajectoryCount: trajectoryCounts.get(session.sessionId) ?? 0,
  }));
const retainedRequests = requests.filter((row) => !removedIds.has(row.sessionId));
const retainedTrajectories = trajectories.filter((row) => !removedIds.has(row.sessionId));

const result = {
  mode: apply ? "apply" : "dry-run",
  minIdleMinutes,
  removed: {
    sessions: sessions.length - retainedSessions.length,
    requests: requests.length - retainedRequests.length,
    trajectories: trajectories.length - retainedTrajectories.length,
  },
  retained: {
    sessions: retainedSessions.length,
    requests: retainedRequests.length,
    trajectories: retainedTrajectories.length,
  },
  clearedExports: apply && clearExports,
};

if (apply) {
  await Promise.all([
    writeJson("sessions.json", retainedSessions),
    replaceNdjson("requests.ndjson", retainedRequests),
    replaceNdjson("trajectories.ndjson", retainedTrajectories),
  ]);
  if (clearExports) {
    await rm(EXPORT_DIR, { recursive: true, force: true });
    await mkdir(EXPORT_DIR, { recursive: true });
  }
}

console.log(JSON.stringify(result, null, 2));