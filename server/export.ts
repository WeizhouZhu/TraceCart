import path from "node:path";
import { mkdir } from "node:fs/promises";
import parquet from "parquetjs-lite";
import { EXPORT_DIR, readNdjson } from "./storage";

interface SessionRow {
  sessionId: string;
  label: string | null;
  collectionTaskId: string | null;
  startedAt: string;
  endedAt: string;
  sourceIp: string;
  userAgent: string;
  requestCount: number;
  trajectoryCount: number;
}

interface RequestRow {
  requestId: string;
  sessionId: string;
  label: string | null;
  serverReceivedAt: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  responseBytes: number;
  sourceIp: string;
  userAgent: string;
  secChUa: string;
  secChUaPlatform: string;
  acceptLanguage: string;
  referer: string;
  origin: string;
}

interface EventRow {
  eventId: string;
  sessionId: string;
  label: string | null;
  pageViewId: string;
  sequence: number;
  eventType: string;
  clientTimestamp: string;
  serverReceivedAt: string;
  route: string;
  clientX: number | null;
  clientY: number | null;
  pageX: number | null;
  pageY: number | null;
  xRatio: number | null;
  yRatio: number | null;
  scrollX: number | null;
  scrollY: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  targetTrackId: string;
  actionName: string;
  payloadJson: string;
}

const optionalString = { type: "UTF8", optional: true } as const;
const optionalDouble = { type: "DOUBLE", optional: true } as const;

async function writeParquet(filePath: string, schemaDefinition: Record<string, unknown>, rows: Record<string, unknown>[]) {
  const schema = new parquet.ParquetSchema(schemaDefinition);
  const writer = await parquet.ParquetWriter.openFile(schema, filePath);
  try {
    for (const row of rows) await writer.appendRow(row);
  } finally {
    await writer.close();
  }
}

export async function createParquetExport(sessions: SessionRow[]) {
  const batch = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(EXPORT_DIR, batch);
  await mkdir(directory, { recursive: true });

  const requests = await readNdjson<RequestRow>("requests.ndjson");
  const trajectories = await readNdjson<EventRow>("trajectories.ndjson");

  const sessionRows = sessions.map((session) => ({
    session_id: session.sessionId,
    label: session.label ?? undefined,
    collection_task_id: session.collectionTaskId ?? undefined,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    source_ip: session.sourceIp,
    user_agent: session.userAgent,
    request_count: session.requestCount,
    trajectory_count: session.trajectoryCount,
  }));

  const requestRows = requests.map((row) => ({
    request_id: row.requestId,
    session_id: row.sessionId,
    label: row.label ?? undefined,
    server_received_at: row.serverReceivedAt,
    method: row.method,
    path: row.path,
    status_code: row.statusCode,
    duration_ms: row.durationMs,
    response_bytes: row.responseBytes,
    source_ip: row.sourceIp,
    user_agent: row.userAgent,
    sec_ch_ua: row.secChUa,
    sec_ch_ua_platform: row.secChUaPlatform,
    accept_language: row.acceptLanguage,
    referer: row.referer,
    origin: row.origin,
  }));

  const trajectoryRows = trajectories.map((row) => ({
    event_id: row.eventId,
    session_id: row.sessionId,
    label: row.label ?? undefined,
    page_view_id: row.pageViewId,
    sequence: row.sequence,
    event_type: row.eventType,
    client_timestamp: row.clientTimestamp,
    server_received_at: row.serverReceivedAt,
    route: row.route,
    client_x: row.clientX ?? undefined,
    client_y: row.clientY ?? undefined,
    page_x: row.pageX ?? undefined,
    page_y: row.pageY ?? undefined,
    x_ratio: row.xRatio ?? undefined,
    y_ratio: row.yRatio ?? undefined,
    scroll_x: row.scrollX ?? undefined,
    scroll_y: row.scrollY ?? undefined,
    viewport_width: row.viewportWidth ?? undefined,
    viewport_height: row.viewportHeight ?? undefined,
    target_track_id: row.targetTrackId || undefined,
    action_name: row.actionName || undefined,
    payload_json: row.payloadJson,
  }));

  await writeParquet(path.join(directory, "sessions.parquet"), {
    session_id: { type: "UTF8" },
    label: optionalString,
    collection_task_id: optionalString,
    started_at: { type: "UTF8" },
    ended_at: { type: "UTF8" },
    source_ip: { type: "UTF8" },
    user_agent: { type: "UTF8" },
    request_count: { type: "INT64" },
    trajectory_count: { type: "INT64" },
  }, sessionRows);

  await writeParquet(path.join(directory, "requests.parquet"), {
    request_id: { type: "UTF8" },
    session_id: { type: "UTF8" },
    label: optionalString,
    server_received_at: { type: "UTF8" },
    method: { type: "UTF8" },
    path: { type: "UTF8" },
    status_code: { type: "INT32" },
    duration_ms: { type: "DOUBLE" },
    response_bytes: { type: "INT64" },
    source_ip: { type: "UTF8" },
    user_agent: { type: "UTF8" },
    sec_ch_ua: { type: "UTF8" },
    sec_ch_ua_platform: { type: "UTF8" },
    accept_language: { type: "UTF8" },
    referer: { type: "UTF8" },
    origin: { type: "UTF8" },
  }, requestRows);

  await writeParquet(path.join(directory, "trajectories.parquet"), {
    event_id: { type: "UTF8" },
    session_id: { type: "UTF8" },
    label: optionalString,
    page_view_id: { type: "UTF8" },
    sequence: { type: "INT64" },
    event_type: { type: "UTF8" },
    client_timestamp: { type: "UTF8" },
    server_received_at: { type: "UTF8" },
    route: { type: "UTF8" },
    client_x: optionalDouble,
    client_y: optionalDouble,
    page_x: optionalDouble,
    page_y: optionalDouble,
    x_ratio: optionalDouble,
    y_ratio: optionalDouble,
    scroll_x: optionalDouble,
    scroll_y: optionalDouble,
    viewport_width: optionalDouble,
    viewport_height: optionalDouble,
    target_track_id: optionalString,
    action_name: optionalString,
    payload_json: { type: "UTF8" },
  }, trajectoryRows);

  return {
    batch,
    files: [
      { name: "sessions.parquet", rows: sessionRows.length },
      { name: "requests.parquet", rows: requestRows.length },
      { name: "trajectories.parquet", rows: trajectoryRows.length },
    ],
  };
}
