import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { verify } from "@node-rs/argon2";
import type { ActorLabel, Order, PaymentMethod, PaymentSession, SessionInfo, TelemetryEvent } from "../src/types";
import { createParquetExport } from "./export";
import { DATA_DIR, EXPORT_DIR, appendNdjson, ensureDataDirectories, readJson, readNdjson, writeJson } from "./storage";
import { advanceOrderLifecycle, confirmOrderReceipt, markOrderPaid } from "./order-lifecycle";
import { FailureLimiter, WindowLimiter, safeDigestEqual, sanitizeNickname, secretDigest } from "./security";
import {
  normalizeDisplayName,
  normalizeIdentifier,
  resolveSourceSubtype,
  seedSourceSubtypes,
  validateSubtypeIdentity,
  type SourceSubtypeDefinition,
} from "./collection-metadata";

interface StoredSession extends SessionInfo {
  startedAt: string;
  endedAt: string;
  sourceIp: string;
  userAgent: string;
  requestCount: number;
  trajectoryCount: number;
  collectionLinkId?: string | null;
  participantId?: string | null;
  nickname?: string | null;
  captureMode?: "unlabeled" | "labeled";
}
interface StoredOrder extends Order { sessionId: string; idempotencyKey: string }
interface StoredPayment extends PaymentSession { sessionId: string }
interface RequestBodyOrder { items: Order["items"]; quote: Order["quote"]; checkout: Order["checkout"]; idempotencyKey: string }
interface TraceRequest extends FastifyRequest { traceStart?: bigint; traceSessionId?: string }
interface AccessLink {
  id: string;
  tokenDigest: string;
  label: ActorLabel;
  nickname?: string;
  participantId?: string;
  issuedByKeyId?: string;
  note?: string;
  sourceSubtype?: string;
  taskType?: string;
  scenarioId?: string;
  experimentId?: string;
  runnerVersion?: string;
  metadataSchemaVersion?: number;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}
interface ApiKeyRecord {
  id: string;
  label: "script" | "ai";
  digest: string;
  createdAt: string;
  revokedAt?: string;
  allowedSourceSubtypes?: string[];
}
interface RequestRow { label: ActorLabel | null; serverReceivedAt: string }
interface TrajectoryRow { label: ActorLabel | null; serverReceivedAt: string }
interface PendingSession {
  session: StoredSession;
  requests: Array<Record<string, unknown>>;
  lastSeenAt: number;
}

await ensureDataDirectories();
let sessions = await readJson<StoredSession[]>("sessions.json", []);
let orders = await readJson<StoredOrder[]>("orders.json", []);
let payments = await readJson<StoredPayment[]>("payments.json", []);
let accessLinks = await readJson<AccessLink[]>("access-links.json", []);
let apiKeys = await readJson<ApiKeyRecord[]>("api-keys.json", []);
let sourceSubtypes = await readJson<SourceSubtypeDefinition[]>("source-subtypes.json", []);

const cookieSecret = process.env.COOKIE_SECRET ?? "tracecart-development-cookie-secret-change-me";
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
const humanPasswordHash = process.env.HUMAN_PASSWORD_HASH ?? "";
const configuredOrigin = process.env.PUBLIC_ORIGIN?.replace(/\/$/, "");
const failureLimiter = new FailureLimiter();
const quotaLimiter = new WindowLimiter();
const adminSessions = new Map<string, number>();
const pendingUnlabeledSessions = new Map<string, PendingSession>();
const PENDING_SESSION_TTL_MS = 5 * 60_000;
const MAX_PENDING_SESSIONS = 5_000;
const MAX_PENDING_REQUESTS = 100;

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "password", "token", "apiKey", "nickname"],
      censor: "[REDACTED]",
    },
  },
  trustProxy: true,
  bodyLimit: 1024 * 1024,
  genReqId: () => randomUUID(),
});
await app.register(cookie, { secret: cookieSecret, hook: "onRequest" });

function now() { return new Date().toISOString() }
function sessionCookieOptions(persistent = true) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    ...(persistent ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    signed: true,
  };
}
function adminCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 60 * 60 * 8,
    signed: true,
  };
}
async function persistSessions() { await writeJson("sessions.json", sessions) }
async function persistAccessLinks() { await writeJson("access-links.json", accessLinks) }
async function persistApiKeys() { await writeJson("api-keys.json", apiKeys) }
async function persistSourceSubtypes() { await writeJson("source-subtypes.json", sourceSubtypes) }
async function persistOrders() { await writeJson("orders.json", orders) }
async function persistPayments() { await writeJson("payments.json", payments) }

async function seedApiKeys() {
  if (apiKeys.length) return;
  const createdAt = now();
  const seeds: Array<{ label: "script" | "ai"; digest: string }> = [
    { label: "script", digest: process.env.SCRIPT_API_KEY_DIGEST ?? "" },
    { label: "ai", digest: process.env.AGENT_API_KEY_DIGEST ?? "" },
  ];
  for (const seed of seeds) {
    if (/^[a-f0-9]{64}$/i.test(seed.digest)) {
      apiKeys.push({ id: `${seed.label}-initial`, label: seed.label, digest: seed.digest, createdAt });
    }
  }
  if (apiKeys.length) await persistApiKeys();
}
await seedApiKeys();

async function seedCollectionMetadata() {
  const seeded = seedSourceSubtypes(sourceSubtypes, now());
  sourceSubtypes = seeded.sourceSubtypes;
  let linksChanged = false;
  let sessionsChanged = false;
  for (const link of accessLinks) {
    if (!link.sourceSubtype) { link.sourceSubtype = `${link.label}.legacy_unspecified`; linksChanged = true }
    if (!link.taskType) { link.taskType = "unspecified"; linksChanged = true }
    if (!link.scenarioId) { link.scenarioId = "unspecified"; linksChanged = true }
    if (!link.metadataSchemaVersion) { link.metadataSchemaVersion = 1; linksChanged = true }
  }
  for (const session of sessions) {
    if (session.label && !session.sourceSubtype) { session.sourceSubtype = `${session.label}.legacy_unspecified`; sessionsChanged = true }
    if (session.label && !session.taskType) { session.taskType = "unspecified"; sessionsChanged = true }
    if (session.label && !session.scenarioId) { session.scenarioId = "unspecified"; sessionsChanged = true }
    if (session.label && !session.metadataSchemaVersion) { session.metadataSchemaVersion = 1; sessionsChanged = true }
  }
  await Promise.all([
    seeded.changed ? persistSourceSubtypes() : Promise.resolve(),
    linksChanged ? persistAccessLinks() : Promise.resolve(),
    sessionsChanged ? persistSessions() : Promise.resolve(),
  ]);
}
await seedCollectionMetadata();

function readSignedCookie(request: FastifyRequest, name: string) {
  const value = request.cookies[name];
  if (!value) return undefined;
  const result = request.unsignCookie(value);
  return result.valid ? result.value : undefined;
}
function requestPath(request: FastifyRequest) { return request.url.split("?")[0] }
function commercePage(pathname: string) {
  return pathname === "/" ||
    /^\/(search|product\/[^/]+|cart|checkout|favorites|compare|orders|order\/[^/]+|service|payment\/.*)$/.test(pathname);
}
function commerceApi(pathname: string) {
  return pathname === "/api/session" || pathname === "/api/orders" ||
    pathname.startsWith("/api/orders/") || pathname === "/api/payments" || pathname.startsWith("/api/payments/");
}
function collectableRequest(pathname: string) {
  return commercePage(pathname) || commerceApi(pathname) || pathname === "/api/telemetry/batches";
}
function cleanupPendingUnlabeledSessions(current = Date.now()) {
  for (const [sessionId, pending] of pendingUnlabeledSessions) {
    if (current - pending.lastSeenAt >= PENDING_SESSION_TTL_MS) pendingUnlabeledSessions.delete(sessionId);
  }
  while (pendingUnlabeledSessions.size >= MAX_PENDING_SESSIONS) {
    const oldest = pendingUnlabeledSessions.keys().next().value as string | undefined;
    if (!oldest) break;
    pendingUnlabeledSessions.delete(oldest);
  }
}

function findCommerceSession(sessionId: string | undefined) {
  if (!sessionId) return undefined;
  return sessions.find((item) => item.sessionId === sessionId)
    ?? pendingUnlabeledSessions.get(sessionId)?.session;
}

async function promotePendingSession(session: StoredSession) {
  const pending = pendingUnlabeledSessions.get(session.sessionId);
  if (!pending) return false;
  sessions.push(session);
  for (const row of pending.requests) await appendNdjson("requests.ndjson", row);
  await persistSessions();
  pendingUnlabeledSessions.delete(session.sessionId);
  return true;
}

async function ensureCommerceSession(request: TraceRequest, reply: FastifyReply) {
  cleanupPendingUnlabeledSessions();
  const rawCookie = request.cookies.tc_session;
  const signedId = readSignedCookie(request, "tc_session");
  let session = findCommerceSession(signedId);
  if (!session && rawCookie && /^[0-9a-f-]{36}$/i.test(rawCookie)) {
    const legacy = sessions.find((item) => item.sessionId === rawCookie && item.label === null);
    if (legacy) {
      session = legacy;
      reply.setCookie("tc_session", legacy.sessionId, sessionCookieOptions());
    }
  }
  if (!session) {
    session = {
      sessionId: randomUUID(),
      label: null,
      collectionTaskId: null,
      collectionLinkId: null,
      participantId: null,
      nickname: null,
      captureMode: "unlabeled",
      startedAt: now(),
      endedAt: now(),
      sourceIp: request.ip,
      userAgent: String(request.headers["user-agent"] ?? ""),
      requestCount: 0,
      trajectoryCount: 0,
    };
    pendingUnlabeledSessions.set(session.sessionId, { session, requests: [], lastSeenAt: Date.now() });
    reply.setCookie("tc_session", session.sessionId, sessionCookieOptions());
  }
  session.endedAt = now();
  const pending = pendingUnlabeledSessions.get(session.sessionId);
  if (pending) pending.lastSeenAt = Date.now();
  request.traceSessionId = session.sessionId;
  return session;
}
app.addHook("onRequest", async (request: TraceRequest, reply) => {
  request.traceStart = process.hrtime.bigint();
  const pathname = requestPath(request);
  const accept = String(request.headers.accept ?? "");
  if ((request.method === "GET" && accept.includes("text/html") && commercePage(pathname)) || commerceApi(pathname)) {
    await ensureCommerceSession(request, reply);
  }
});
app.addHook("onResponse", async (request: TraceRequest, reply) => {
  const pathname = requestPath(request);
  if (!request.traceSessionId || !collectableRequest(pathname)) return;
  const session = findCommerceSession(request.traceSessionId);
  if (!session) return;
  const end = process.hrtime.bigint();
  const durationMs = request.traceStart ? Number(end - request.traceStart) / 1_000_000 : 0;
  session.requestCount += 1;
  session.endedAt = now();
  const row = {
    requestId: request.id, sessionId: session.sessionId, label: session.label, serverReceivedAt: now(),
    method: request.method, path: pathname, statusCode: reply.statusCode,
    durationMs: Number(durationMs.toFixed(3)), responseBytes: Number(reply.getHeader("content-length") ?? 0),
    sourceIp: request.ip, userAgent: String(request.headers["user-agent"] ?? ""),
    secChUa: String(request.headers["sec-ch-ua"] ?? ""), secChUaPlatform: String(request.headers["sec-ch-ua-platform"] ?? ""),
    acceptLanguage: String(request.headers["accept-language"] ?? ""), referer: String(request.headers.referer ?? ""),
    origin: String(request.headers.origin ?? ""),
  };
  const pending = pendingUnlabeledSessions.get(session.sessionId);
  if (pending) {
    pending.lastSeenAt = Date.now();
    if (pending.requests.length < MAX_PENDING_REQUESTS) pending.requests.push(row);
    else pendingUnlabeledSessions.delete(session.sessionId);
    return;
  }
  if (session.requestCount % 10 === 0) await persistSessions();
  await appendNdjson("requests.ndjson", row);
});

function numberOrNull(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null }
function publicOrigin(request: FastifyRequest) {
  if (configuredOrigin) return configuredOrigin;
  const protocol = String(request.headers["x-forwarded-proto"] ?? request.protocol).split(",")[0];
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? request.hostname).split(",")[0];
  return `${protocol}://${host}`;
}
function retry(reply: FastifyReply, seconds: number) {
  reply.header("Retry-After", String(seconds));
  return reply.code(429).send({ message: "请求过于频繁，请稍后重试" });
}
async function passwordMatches(hash: string, password: unknown) {
  if (!hash || typeof password !== "string" || password.length > 256) return false;
  try { return await verify(hash, password) } catch { return false }
}
function currentAdmin(request: FastifyRequest) {
  const sessionId = readSignedCookie(request, "tc_admin");
  if (!sessionId) return false;
  const expiresAt = adminSessions.get(sessionId);
  if (!expiresAt || expiresAt <= Date.now()) { adminSessions.delete(sessionId); return false }
  return true;
}
async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!currentAdmin(request)) return reply.code(401).send({ message: "需要管理员验证" });
}
function bearerToken(request: FastifyRequest) {
  return /^Bearer\s+([^\s]+)$/i.exec(String(request.headers.authorization ?? ""))?.[1];
}
function authenticateApiKey(request: FastifyRequest) {
  const token = bearerToken(request);
  if (!token || token.length > 160) return undefined;
  const digest = secretDigest(token, cookieSecret);
  return apiKeys.find((key) => !key.revokedAt && safeDigestEqual(key.digest, digest));
}
function linkStatus(link: AccessLink) {
  if (link.usedAt) return "used";
  return Date.parse(link.expiresAt) <= Date.now() ? "expired" : "active";
}
async function issueLink(
  request: FastifyRequest,
  data: Pick<AccessLink,
    "label" | "nickname" | "participantId" | "issuedByKeyId" | "note" |
    "sourceSubtype" | "taskType" | "scenarioId" | "experimentId" | "runnerVersion" | "metadataSchemaVersion"
  >,
) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const record: AccessLink = {
    id: randomUUID(), tokenDigest: secretDigest(token, cookieSecret), label: data.label,
    nickname: data.nickname, participantId: data.participantId, issuedByKeyId: data.issuedByKeyId, note: data.note,
    sourceSubtype: data.sourceSubtype, taskType: data.taskType, scenarioId: data.scenarioId,
    experimentId: data.experimentId, runnerVersion: data.runnerVersion,
    metadataSchemaVersion: data.metadataSchemaVersion,
    createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + 30 * 60_000).toISOString(),
  };
  accessLinks.push(record);
  await persistAccessLinks();
  return {
    id: record.id, label: record.label, sourceSubtype: record.sourceSubtype,
    taskType: record.taskType, scenarioId: record.scenarioId,
    expiresAt: record.expiresAt, url: `${publicOrigin(request)}/c#${token}`,
  };
}
function apiGuide(label: "script" | "ai", request: FastifyRequest) {
  return {
    service: "TraceCart labeled collection", version: "1.0", credentialScope: label, assignedLabel: label,
    endpoints: {
      describe: { method: "GET", url: `${publicOrigin(request)}/api/collect` },
      createLink: { method: "POST", url: `${publicOrigin(request)}/api/collect` },
      claim: { method: "POST", url: `${publicOrigin(request)}/api/claim` },
    },
    authorization: "Authorization: Bearer <API_KEY>",
    createLinkBody: {
      fields: {
        sourceSubtype: "registered subtype; omitted clients use *.legacy_unspecified",
        taskType: "lowercase task identifier",
        scenarioId: "lowercase scenario identifier",
        experimentId: "optional lowercase experiment identifier",
        runnerVersion: "optional runner release or git revision",
        metadataSchemaVersion: "optional positive integer; defaults to 1",
        note: "optional human-readable note",
      },
      forbiddenFields: ["label"],
    },
    availableSourceSubtypes: sourceSubtypes.filter((item) => item.label === label && item.enabled)
      .map(({ id, displayName }) => ({ id, displayName })),
    linkPolicy: { singleUse: true, expiresInMinutes: 30, labelDeterminedByApiKey: true },
    browserFlow: ["POST /api/collect with this API key.", "Open the returned url.", "The /c page claims and redirects to /."],
    httpClientFlow: [
      "Parse the token from the returned URL fragment locally.",
      "POST JSON { token } to /api/claim with a cookie jar.",
      "Preserve the returned tc_session cookie for storefront requests.",
    ],
  };
}
app.get("/api/health", async () => ({ status: "ok", service: "tracecart", time: now(), sessions: sessions.length }));
app.post("/api/admin/login", async (request, reply) => {
  const limitKey = `admin:${request.ip}`;
  const locked = failureLimiter.check(limitKey);
  if (locked) return retry(reply, locked);
  const body = request.body as { password?: string };
  if (!(await passwordMatches(adminPasswordHash, body?.password))) {
    const retryAfter = failureLimiter.fail(limitKey, 5, 15 * 60_000, 15 * 60_000);
    if (retryAfter) return retry(reply, retryAfter);
    return reply.code(401).send({ message: "凭据无效" });
  }
  failureLimiter.success(limitKey);
  const sessionId = randomBytes(32).toString("base64url");
  adminSessions.set(sessionId, Date.now() + 8 * 60 * 60_000);
  reply.setCookie("tc_admin", sessionId, adminCookieOptions());
  return { authenticated: true };
});
app.get("/api/admin/session", async (request, reply) => {
  if (!currentAdmin(request)) return reply.code(401).send({ authenticated: false });
  return { authenticated: true };
});
app.post("/api/admin/logout", { preHandler: requireAdmin }, async (request, reply) => {
  const sessionId = readSignedCookie(request, "tc_admin");
  if (sessionId) adminSessions.delete(sessionId);
  reply.clearCookie("tc_admin", adminCookieOptions());
  return { authenticated: false };
});

app.get("/api/admin/summary", { preHandler: requireAdmin }, async () => {
  const [requests, trajectories] = await Promise.all([
    readNdjson<RequestRow>("requests.ndjson"), readNdjson<TrajectoryRow>("trajectories.ndjson"),
  ]);
  const labels = { unlabeled: 0, human: 0, script: 0, ai: 0 };
  const subtypes: Record<string, number> = {};
  const taskTypes: Record<string, number> = {};
  for (const session of sessions) {
    labels[session.label ?? "unlabeled"] += 1;
    const subtype = session.sourceSubtype ?? (session.label ? `${session.label}.legacy_unspecified` : "unlabeled");
    subtypes[subtype] = (subtypes[subtype] ?? 0) + 1;
    const taskType = session.taskType ?? "unspecified";
    taskTypes[taskType] = (taskTypes[taskType] ?? 0) + 1;
  }
  const dates = sessions.flatMap((session) => [session.startedAt, session.endedAt]).filter(Boolean).sort();
  return {
    generatedAt: now(),
    totals: {
      sessions: sessions.length, requests: requests.length, trajectories: trajectories.length,
      labeledSessions: sessions.length - labels.unlabeled, unlabeledSessions: labels.unlabeled,
    },
    labels, subtypes, taskTypes, timeRange: { first: dates[0] ?? null, last: dates.at(-1) ?? null },
    recentSessions: sessions.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50).map((session) => ({
      sessionId: session.sessionId, label: session.label, sourceSubtype: session.sourceSubtype ?? null,
      taskType: session.taskType ?? null, scenarioId: session.scenarioId ?? null, experimentId: session.experimentId ?? null,
      nickname: session.nickname ?? null, startedAt: session.startedAt, endedAt: session.endedAt,
      requestCount: session.requestCount, trajectoryCount: session.trajectoryCount,
    })),
  };
});
app.get("/api/admin/access", { preHandler: requireAdmin }, async (request) => ({
  keys: apiKeys.map(({ digest: _digest, ...key }) => ({ ...key, status: key.revokedAt ? "revoked" : "active" })),
  links: accessLinks.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
    .map((link) => { const { tokenDigest: _tokenDigest, ...visible } = link; return { ...visible, status: linkStatus(link) } }),
  sourceSubtypes: sourceSubtypes.slice().sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id)),
  guide: { script: apiGuide("script", request), ai: apiGuide("ai", request) },
}));
app.post("/api/admin/source-subtypes", { preHandler: requireAdmin }, async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const identity = validateSubtypeIdentity(body.id, body.label);
  if (!identity.ok) return reply.code(400).send({ message: identity.message });
  const displayName = normalizeDisplayName(body.displayName);
  if (!displayName) return reply.code(400).send({ message: "显示名称不能为空且最多 80 个字符" });
  if (sourceSubtypes.some((item) => item.id === identity.id)) {
    return reply.code(409).send({ message: "sourceSubtype 已存在；可修改显示名或启停状态" });
  }
  const timestamp = now();
  const definition: SourceSubtypeDefinition = {
    id: identity.id, label: identity.label, displayName, enabled: true,
    createdAt: timestamp, updatedAt: timestamp,
  };
  sourceSubtypes.push(definition);
  await persistSourceSubtypes();
  return reply.code(201).send(definition);
});
app.patch("/api/admin/source-subtypes/:id", { preHandler: requireAdmin }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const definition = sourceSubtypes.find((item) => item.id === id);
  if (!definition) return reply.code(404).send({ message: "sourceSubtype 不存在" });
  const body = (request.body ?? {}) as Record<string, unknown>;
  if ("label" in body || "id" in body) {
    return reply.code(400).send({ message: "子类型 ID 和大类型不可修改；请新增子类型并停用旧项" });
  }
  if ("displayName" in body) {
    const displayName = normalizeDisplayName(body.displayName);
    if (!displayName) return reply.code(400).send({ message: "显示名称不能为空且最多 80 个字符" });
    definition.displayName = displayName;
  }
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") return reply.code(400).send({ message: "enabled 必须是布尔值" });
    if (definition.id.endsWith(".legacy_unspecified") && body.enabled === false) {
      return reply.code(400).send({ message: "兼容旧客户端的 legacy_unspecified 子类型不能停用" });
    }
    definition.enabled = body.enabled;
  }
  definition.updatedAt = now();
  await persistSourceSubtypes();
  return definition;
});
app.post("/api/admin/keys/:label/rotate", { preHandler: requireAdmin }, async (request, reply) => {
  const { label } = request.params as { label: string };
  if (label !== "script" && label !== "ai") return reply.code(400).send({ message: "密钥类型无效" });
  const createdAt = now();
  for (const key of apiKeys) if (key.label === label && !key.revokedAt) key.revokedAt = createdAt;
  const prefix = label === "ai" ? "tc_agent_" : "tc_script_";
  const rawKey = prefix + randomBytes(32).toString("base64url");
  const record: ApiKeyRecord = {
    id: `${label}-${randomUUID()}`, label, digest: secretDigest(rawKey, cookieSecret), createdAt,
  };
  apiKeys.push(record);
  await persistApiKeys();
  return { keyId: record.id, label, apiKey: rawKey, displayedOnce: true };
});
app.post("/api/admin/export", { preHandler: requireAdmin }, async () => {
  const result = await createParquetExport(sessions);
  return {
    archive: {
      ...result.archive,
      url: "/api/admin/files/" + encodeURIComponent(result.batch) + "/" + encodeURIComponent(result.archive.name),
    },
    files: result.files,
  };
});
app.get("/api/admin/files/:batch/:file", { preHandler: requireAdmin }, async (request, reply) => {
  const { batch, file } = request.params as { batch: string; file: string };
  const expectedFile = `tracecart-export-${batch}.zip`;
  if (!/^[0-9TZ-]+$/.test(batch) || file !== expectedFile) {
    return reply.code(400).send({ message: "文件路径无效" });
  }
  const directory = path.join(EXPORT_DIR, batch);
  const target = path.join(directory, file);
  try { await stat(target) } catch { return reply.code(404).send({ message: "导出文件不存在" }) }
  const stream = createReadStream(target);
  stream.on("close", () => { void rm(directory, { recursive: true, force: true }); });
  reply.header("Content-Type", "application/zip");
  reply.header("Content-Disposition", `attachment; filename="${file}"`);
  return reply.send(stream);
});
function rejectApiKey(request: FastifyRequest, reply: FastifyReply) {
  const limitKey = `api:${request.ip}`;
  const locked = failureLimiter.check(limitKey);
  if (locked) return retry(reply, locked);
  const retryAfter = failureLimiter.fail(limitKey, 10, 10 * 60_000, 10 * 60_000);
  if (retryAfter) return retry(reply, retryAfter);
  return reply.code(401).send({ message: "凭据无效" });
}
app.get("/api/collect", async (request, reply) => {
  const key = authenticateApiKey(request);
  if (!key) return rejectApiKey(request, reply);
  failureLimiter.success(`api:${request.ip}`);
  return apiGuide(key.label, request);
});
app.post("/api/collect", async (request, reply) => {
  const key = authenticateApiKey(request);
  if (!key) return rejectApiKey(request, reply);
  failureLimiter.success(`api:${request.ip}`);
  const body = (request.body ?? {}) as Record<string, unknown>;
  if ("label" in body) return reply.code(400).send({ message: "label 由 API Key 权限决定，不能在请求中指定" });
  const resolvedSubtype = resolveSourceSubtype(sourceSubtypes, key.label, body.sourceSubtype);
  if (!resolvedSubtype.ok) return reply.code(400).send({ message: resolvedSubtype.message });
  if (key.allowedSourceSubtypes?.length && !key.allowedSourceSubtypes.includes(resolvedSubtype.definition.id)) {
    return reply.code(403).send({ message: "当前 API Key 无权使用该 sourceSubtype" });
  }
  const taskType = body.taskType == null || body.taskType === "" ? "unspecified" : normalizeIdentifier(body.taskType);
  const scenarioId = body.scenarioId == null || body.scenarioId === "" ? "unspecified" : normalizeIdentifier(body.scenarioId);
  const experimentId = body.experimentId == null || body.experimentId === "" ? undefined : normalizeIdentifier(body.experimentId);
  const runnerVersion = String(body.runnerVersion ?? "").trim().slice(0, 120) || undefined;
  const metadataSchemaVersion = body.metadataSchemaVersion == null ? 1 : Number(body.metadataSchemaVersion);
  if (!taskType || !scenarioId || (body.experimentId && !experimentId)) {
    return reply.code(400).send({ message: "taskType、scenarioId 或 experimentId 格式无效" });
  }
  if (!Number.isInteger(metadataSchemaVersion) || metadataSchemaVersion < 1 || metadataSchemaVersion > 1000) {
    return reply.code(400).send({ message: "metadataSchemaVersion 必须是 1 到 1000 的整数" });
  }
  const minute = quotaLimiter.take(`mint-minute:${key.id}`, 12, 60_000);
  if (!minute.allowed) return retry(reply, minute.retryAfter);
  const day = quotaLimiter.take(`mint-day:${key.id}`, 500, 24 * 60 * 60_000);
  if (!day.allowed) return retry(reply, day.retryAfter);
  const activeCount = accessLinks.filter((link) => link.issuedByKeyId === key.id && linkStatus(link) === "active").length;
  if (activeCount >= 50) return reply.code(409).send({ message: "当前未使用链接过多，请使用或等待链接过期" });
  const issued = await issueLink(request, {
    label: key.label, issuedByKeyId: key.id, note: String(body.note ?? "").trim().slice(0, 500) || undefined,
    sourceSubtype: resolvedSubtype.definition.id, taskType, scenarioId, experimentId, runnerVersion,
    metadataSchemaVersion,
  });
  return reply.code(201).send(issued);
});

app.post("/api/human/link", async (request, reply) => {
  const limitKey = `human:${request.ip}`;
  const locked = failureLimiter.check(limitKey);
  if (locked) return retry(reply, locked);
  const body = request.body as { password?: string; nickname?: string };
  const nickname = sanitizeNickname(body?.nickname);
  const valid = nickname.length >= 1 && await passwordMatches(humanPasswordHash, body?.password);
  if (!valid) {
    const retryAfter = failureLimiter.fail(limitKey, 8, 10 * 60_000, 10 * 60_000);
    if (retryAfter) return retry(reply, retryAfter);
    return reply.code(401).send({ message: "凭据无效或 nickname 不符合要求" });
  }
  failureLimiter.success(limitKey);
  const hourly = quotaLimiter.take(`human-issue:${request.ip}`, 30, 60 * 60_000);
  if (!hourly.allowed) return retry(reply, hourly.retryAfter);
  const issued = await issueLink(request, {
    label: "human", nickname, participantId: randomUUID(), sourceSubtype: "human.manual",
    taskType: "unspecified", scenarioId: "unspecified", metadataSchemaVersion: 1,
  });
  return reply.code(201).send(issued);
});
app.post("/api/claim", async (request: TraceRequest, reply) => {
  const limitKey = `claim:${request.ip}`;
  const locked = failureLimiter.check(limitKey);
  if (locked) return retry(reply, locked);
  const token = String((request.body as { token?: string })?.token ?? "");
  const digest = token.length >= 40 && token.length <= 160 ? secretDigest(token, cookieSecret) : "";
  const link = digest
    ? accessLinks.find((item) => !item.usedAt && Date.parse(item.expiresAt) > Date.now() && safeDigestEqual(item.tokenDigest, digest))
    : undefined;
  if (!link) {
    const retryAfter = failureLimiter.fail(limitKey, 20, 10 * 60_000, 10 * 60_000);
    if (retryAfter) return retry(reply, retryAfter);
    return reply.code(410).send({ message: "链接无效、已使用或已过期" });
  }
  link.usedAt = now();
  const session: StoredSession = {
    sessionId: randomUUID(), label: link.label, collectionTaskId: link.id, collectionLinkId: link.id,
    participantId: link.participantId ?? null, nickname: link.nickname ?? null, captureMode: "labeled",
    sourceSubtype: link.sourceSubtype ?? `${link.label}.legacy_unspecified`,
    taskType: link.taskType ?? "unspecified", scenarioId: link.scenarioId ?? "unspecified",
    experimentId: link.experimentId ?? null, runnerVersion: link.runnerVersion ?? null,
    metadataSchemaVersion: link.metadataSchemaVersion ?? 1,
    startedAt: now(), endedAt: now(), sourceIp: request.ip,
    userAgent: String(request.headers["user-agent"] ?? ""), requestCount: 0, trajectoryCount: 0,
  };
  sessions.push(session);
  await Promise.all([persistAccessLinks(), persistSessions()]);
  failureLimiter.success(limitKey);
  reply.setCookie("tc_session", session.sessionId, sessionCookieOptions(false));
  return { claimed: true, redirectTo: "/" };
});
app.get("/collector", async (_request, reply) => reply.redirect("/admin"));
app.get("/lab/scenarios", async (_request, reply) => reply.redirect("/admin"));
app.get("/api/session", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  return {
    sessionId: session.sessionId, label: session.label, collectionTaskId: session.collectionTaskId,
    sourceSubtype: session.sourceSubtype ?? null, taskType: session.taskType ?? null,
    scenarioId: session.scenarioId ?? null, experimentId: session.experimentId ?? null,
    runnerVersion: session.runnerVersion ?? null, metadataSchemaVersion: session.metadataSchemaVersion ?? null,
  } satisfies SessionInfo;
});
app.post("/api/telemetry/batches", async (request: TraceRequest, reply) => {
  const body = request.body as { pageViewId?: string; events?: TelemetryEvent[] };
  const events = (Array.isArray(body.events) ? body.events : [])
    .filter((event) => commercePage(String(event.route ?? "").split("?")[0])).slice(0, 100);
  if (!events.length) return { accepted: 0 };
  const session = await ensureCommerceSession(request, reply);
  const receivedAt = now();
  for (const event of events) {
    const payload = event.payload ?? {};
    const target = typeof payload.target === "object" && payload.target ? payload.target as Record<string, unknown> : {};
    await appendNdjson("trajectories.ndjson", {
      eventId: String(event.id ?? randomUUID()), sessionId: session.sessionId, label: session.label,
      pageViewId: String(event.pageViewId ?? body.pageViewId ?? ""), sequence: Number(event.sequence ?? 0),
      eventType: String(event.eventType ?? "unknown"), clientTimestamp: String(event.clientTimestamp ?? receivedAt),
      serverReceivedAt: receivedAt, route: String(event.route ?? ""),
      clientX: numberOrNull(payload.clientX), clientY: numberOrNull(payload.clientY),
      pageX: numberOrNull(payload.pageX), pageY: numberOrNull(payload.pageY),
      xRatio: numberOrNull(payload.xRatio), yRatio: numberOrNull(payload.yRatio),
      scrollX: numberOrNull(payload.scrollX), scrollY: numberOrNull(payload.scrollY),
      viewportWidth: numberOrNull(payload.viewportWidth), viewportHeight: numberOrNull(payload.viewportHeight),
      targetTrackId: String(target.trackId ?? ""), actionName: String(payload.actionName ?? ""),
      payloadJson: JSON.stringify(payload),
    });
  }
  session.trajectoryCount += events.length;
  session.endedAt = receivedAt;
  await promotePendingSession(session);
  await persistSessions();
  return { accepted: events.length };
});

app.post("/api/orders", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const body = request.body as RequestBodyOrder;
  if (!Array.isArray(body.items) || body.items.length === 0 || !body.checkout || !body.quote) {
    return reply.code(400).send({ message: "订单信息不完整" });
  }
  const prior = body.idempotencyKey
    ? orders.find((order) => order.sessionId === session.sessionId && order.idempotencyKey === body.idempotencyKey)
    : undefined;
  if (prior) return publicOrder(prior);
  const id = "TC" + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10);
  const order: StoredOrder = {
    id, token: randomBytes(18).toString("base64url"), items: body.items, quote: body.quote, checkout: body.checkout,
    status: "awaiting_payment", createdAt: now(), statusUpdatedAt: now(), sessionId: session.sessionId,
    idempotencyKey: body.idempotencyKey || randomUUID(),
  };
  orders.push(order);
  await persistOrders();
  return reply.code(201).send(publicOrder(order));
});

app.get("/api/orders", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const sessionOrders = orders.filter((item) => item.sessionId === session.sessionId);
  const changed = sessionOrders.map((order) => advanceOrderLifecycle(order)).some(Boolean);
  if (changed) await persistOrders();
  return sessionOrders.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(publicOrder);
});
app.get("/api/orders/:key", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const { key } = request.params as { key: string };
  const order = orders.find((item) => (item.id === key || item.token === key) && item.sessionId === session.sessionId);
  if (!order) return reply.code(404).send({ message: "订单不存在或不属于当前匿名会话" });
  if (advanceOrderLifecycle(order)) await persistOrders();
  return publicOrder(order);
});
app.post("/api/orders/:key/confirm-receipt", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const { key } = request.params as { key: string };
  const order = orders.find((item) => (item.id === key || item.token === key) && item.sessionId === session.sessionId);
  if (!order) return reply.code(404).send({ message: "订单不存在或不属于当前匿名会话" });
  const advanced = advanceOrderLifecycle(order);
  if (order.status === "completed") {
    if (advanced) await persistOrders();
    return publicOrder(order);
  }
  if (!confirmOrderReceipt(order)) return reply.code(409).send({ message: "订单发货后才能确认收货" });
  await persistOrders();
  return publicOrder(order);
});
function publicOrder(order: StoredOrder): Order {
  const { sessionId: _sessionId, idempotencyKey: _idempotencyKey, ...result } = order;
  return result;
}
function chooseOutcome(forced: string, method: PaymentMethod): PaymentSession["outcome"] {
  if (method === "cod") return "succeeded";
  if (["succeeded", "insufficient_funds", "risk_rejected", "network_error", "expired"].includes(forced)) {
    return forced as PaymentSession["outcome"];
  }
  const value = Math.random();
  if (value < 0.75) return "succeeded";
  if (value < 0.85) return "insufficient_funds";
  if (value < 0.91) return "risk_rejected";
  if (value < 0.96) return "network_error";
  return "expired";
}
app.post("/api/payments", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const body = request.body as { orderId?: string; method?: PaymentMethod };
  const order = orders.find((item) => item.id === body.orderId && item.sessionId === session.sessionId);
  if (!order) return reply.code(404).send({ message: "找不到需要支付的订单" });
  const method = body.method ?? "qr";
  const outcome = chooseOutcome(String(request.headers["x-tracecart-payment-outcome"] ?? "random"), method);
  const createdAt = new Date();
  const payment: StoredPayment = {
    id: randomUUID(), orderId: order.id, method, status: method === "cod" ? "succeeded" : "pending",
    outcome, amount: order.quote.total, createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 2 * 60_000).toISOString(), sessionId: session.sessionId,
  };
  if (method === "cod") markOrderPaid(order);
  payments.push(payment);
  order.paymentId = payment.id;
  await Promise.all([persistPayments(), persistOrders()]);
  return reply.code(201).send(publicPayment(payment));
});

app.get("/api/payments/:paymentId", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const { paymentId } = request.params as { paymentId: string };
  const payment = payments.find((item) => item.id === paymentId && item.sessionId === session.sessionId);
  if (!payment) return reply.code(404).send({ message: "支付会话不存在" });
  if (payment.status === "pending" && Date.now() >= Date.parse(payment.expiresAt)) {
    payment.status = "expired";
    payment.errorCode = "expired";
    await persistPayments();
  }
  return publicPayment(payment);
});
app.post("/api/payments/:paymentId/confirm", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const { paymentId } = request.params as { paymentId: string };
  const payment = payments.find((item) => item.id === paymentId && item.sessionId === session.sessionId);
  if (!payment) return reply.code(404).send({ message: "支付会话不存在" });
  if (payment.status !== "pending" && payment.status !== "processing") return publicPayment(payment);
  payment.status = "processing";
  if (payment.outcome === "succeeded") {
    payment.status = "succeeded";
    const order = orders.find((item) => item.id === payment.orderId);
    if (order) { markOrderPaid(order); order.paymentId = payment.id; await persistOrders() }
  } else if (payment.outcome === "expired") {
    payment.status = "expired";
    payment.errorCode = "expired";
  } else {
    payment.status = "failed";
    payment.errorCode = payment.outcome;
  }
  await persistPayments();
  return publicPayment(payment);
});
app.post("/api/payments/:paymentId/cancel", async (request: TraceRequest, reply) => {
  const session = await ensureCommerceSession(request, reply);
  const { paymentId } = request.params as { paymentId: string };
  const payment = payments.find((item) => item.id === paymentId && item.sessionId === session.sessionId);
  if (!payment) return reply.code(404).send({ message: "支付会话不存在" });
  payment.status = "cancelled";
  payment.errorCode = "cancelled";
  await persistPayments();
  return publicPayment(payment);
});
function publicPayment(payment: StoredPayment): PaymentSession {
  const { sessionId: _sessionId, ...result } = payment;
  return result;
}
const clientRoot = path.resolve(process.env.TRACECART_CLIENT_DIR ?? path.join(process.cwd(), "dist", "client"));
await app.register(fastifyStatic, { root: clientRoot, prefix: "/", wildcard: false });
app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) return reply.code(404).send({ message: "API 路由不存在" });
  return reply.type("text/html").sendFile("index.html");
});
const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? "0.0.0.0";
try {
  await app.listen({ port, host });
  app.log.info({ dataDir: DATA_DIR, clientRoot }, "TraceCart started");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
