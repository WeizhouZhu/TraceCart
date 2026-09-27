import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import type { LabelTask, Order, PaymentMethod, PaymentSession, SessionInfo, TelemetryEvent } from "../src/types";
import { createParquetExport } from "./export";
import {
  DATA_DIR,
  EXPORT_DIR,
  appendNdjson,
  ensureDataDirectories,
  readJson,
  writeJson,
} from "./storage";

interface StoredSession extends SessionInfo {
  startedAt: string;
  endedAt: string;
  sourceIp: string;
  userAgent: string;
  requestCount: number;
  trajectoryCount: number;
}

interface StoredOrder extends Order {
  sessionId: string;
  idempotencyKey: string;
}

interface StoredPayment extends PaymentSession {
  sessionId: string;
}

interface RequestBodyOrder {
  items: Order["items"];
  quote: Order["quote"];
  checkout: Order["checkout"];
  idempotencyKey: string;
}

interface TraceRequest extends FastifyRequest {
  traceStart?: bigint;
  traceSessionId?: string;
}

await ensureDataDirectories();

let sessions = await readJson<StoredSession[]>("sessions.json", []);
let tasks = await readJson<LabelTask[]>("tasks.json", []);
let orders = await readJson<StoredOrder[]>("orders.json", []);
let payments = await readJson<StoredPayment[]>("payments.json", []);

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
  trustProxy: true,
  bodyLimit: 1024 * 1024,
  genReqId: () => randomUUID(),
});

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET ?? "tracecart-development-cookie-secret-change-me",
  hook: "onRequest",
});

function now() {
  return new Date().toISOString();
}

function cookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 60 * 60 * 24 * 30,
    signed: false,
  };
}

function activeTask(task: LabelTask) {
  const current = Date.now();
  if (new Date(task.expiresAt).getTime() <= current) {
    task.status = "expired";
    return false;
  }
  if (task.boundSessions >= task.maxSessions) {
    task.status = "completed";
    return false;
  }
  return task.status === "waiting" || task.status === "collecting";
}

async function persistSessions() {
  await writeJson("sessions.json", sessions);
}

async function persistTasks() {
  await writeJson("tasks.json", tasks);
}

async function persistOrders() {
  await writeJson("orders.json", orders);
}

async function persistPayments() {
  await writeJson("payments.json", payments);
}

function matchTaskByFeatures(request: FastifyRequest) {
  const userAgent = String(request.headers["user-agent"] ?? "");
  const candidates = tasks.filter((task) => {
    if (!activeTask(task)) return false;
    if (!task.expectedIp && !task.expectedUserAgent) return false;
    if (task.expectedIp && task.expectedIp !== request.ip) return false;
    if (task.expectedUserAgent && !userAgent.includes(task.expectedUserAgent)) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

function matchTaskByToken(request: FastifyRequest) {
  const token = String(request.headers["x-tracecart-task"] ?? "").trim();
  if (!token) return undefined;
  return tasks.find((task) => task.token === token && activeTask(task));
}

async function bindTask(session: StoredSession, task: LabelTask) {
  if (session.collectionTaskId) return;
  session.label = task.label;
  session.collectionTaskId = task.id;
  task.boundSessions += 1;
  task.status = task.boundSessions >= task.maxSessions ? "completed" : "collecting";
  await Promise.all([persistSessions(), persistTasks()]);
}

async function ensureSession(request: TraceRequest, reply: FastifyReply) {
  const cookieId = request.cookies.tc_session;
  let session = cookieId ? sessions.find((item) => item.sessionId === cookieId) : undefined;
  if (!session) {
    session = {
      sessionId: randomUUID(),
      label: null,
      collectionTaskId: null,
      startedAt: now(),
      endedAt: now(),
      sourceIp: request.ip,
      userAgent: String(request.headers["user-agent"] ?? ""),
      requestCount: 0,
      trajectoryCount: 0,
    };
    const matchedTask = matchTaskByToken(request) ?? matchTaskByFeatures(request);
    if (matchedTask) {
      session.label = matchedTask.label;
      session.collectionTaskId = matchedTask.id;
      matchedTask.boundSessions += 1;
      matchedTask.status = matchedTask.boundSessions >= matchedTask.maxSessions ? "completed" : "collecting";
      await persistTasks();
    }
    sessions.push(session);
    reply.setCookie("tc_session", session.sessionId, cookieOptions());
    await persistSessions();
  }
  session.endedAt = now();
  request.traceSessionId = session.sessionId;
  return session;
}

app.addHook("onRequest", async (request: TraceRequest, reply) => {
  request.traceStart = process.hrtime.bigint();
  if (request.url.startsWith("/collect/start/")) return;
  const accept = String(request.headers.accept ?? "");
  if (accept.includes("text/html") || request.url.startsWith("/api/")) {
    await ensureSession(request, reply);
  } else {
    request.traceSessionId = request.cookies.tc_session;
  }
});

app.addHook("onResponse", async (request: TraceRequest, reply) => {
  const end = process.hrtime.bigint();
  const durationMs = request.traceStart ? Number(end - request.traceStart) / 1_000_000 : 0;
  const session = sessions.find((item) => item.sessionId === request.traceSessionId);
  if (session) {
    session.requestCount += 1;
    session.endedAt = now();
    if (session.requestCount % 10 === 0) await persistSessions();
  }

  await appendNdjson("requests.ndjson", {
    requestId: request.id,
    sessionId: request.traceSessionId ?? "",
    label: session?.label ?? null,
    serverReceivedAt: now(),
    method: request.method,
    path: request.url.split("?")[0],
    statusCode: reply.statusCode,
    durationMs: Number(durationMs.toFixed(3)),
    responseBytes: Number(reply.getHeader("content-length") ?? 0),
    sourceIp: request.ip,
    userAgent: String(request.headers["user-agent"] ?? ""),
    secChUa: String(request.headers["sec-ch-ua"] ?? ""),
    secChUaPlatform: String(request.headers["sec-ch-ua-platform"] ?? ""),
    acceptLanguage: String(request.headers["accept-language"] ?? ""),
    referer: String(request.headers.referer ?? ""),
    origin: String(request.headers.origin ?? ""),
  });
});

app.get("/api/health", async () => ({
  status: "ok",
  service: "tracecart",
  time: now(),
  sessions: sessions.length,
}));

app.get("/api/session", async (request: TraceRequest, reply) => {
  const session = await ensureSession(request, reply);
  return {
    sessionId: session.sessionId,
    label: session.label,
    collectionTaskId: session.collectionTaskId,
  } satisfies SessionInfo;
});

app.post("/api/telemetry/batches", async (request: TraceRequest, reply) => {
  const session = await ensureSession(request, reply);
  const body = request.body as { pageViewId?: string; events?: TelemetryEvent[] };
  const events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
  const receivedAt = now();

  for (const event of events) {
    const payload = event.payload ?? {};
    const target = typeof payload.target === "object" && payload.target ? payload.target as Record<string, unknown> : {};
    await appendNdjson("trajectories.ndjson", {
      eventId: String(event.id ?? randomUUID()),
      sessionId: session.sessionId,
      label: session.label,
      pageViewId: String(event.pageViewId ?? body.pageViewId ?? ""),
      sequence: Number(event.sequence ?? 0),
      eventType: String(event.eventType ?? "unknown"),
      clientTimestamp: String(event.clientTimestamp ?? receivedAt),
      serverReceivedAt: receivedAt,
      route: String(event.route ?? ""),
      clientX: numberOrNull(payload.clientX),
      clientY: numberOrNull(payload.clientY),
      pageX: numberOrNull(payload.pageX),
      pageY: numberOrNull(payload.pageY),
      xRatio: numberOrNull(payload.xRatio),
      yRatio: numberOrNull(payload.yRatio),
      scrollX: numberOrNull(payload.scrollX),
      scrollY: numberOrNull(payload.scrollY),
      viewportWidth: numberOrNull(payload.viewportWidth),
      viewportHeight: numberOrNull(payload.viewportHeight),
      targetTrackId: String(target.trackId ?? ""),
      actionName: String(payload.actionName ?? ""),
      payloadJson: JSON.stringify(payload),
    });
  }

  session.trajectoryCount += events.length;
  session.endedAt = receivedAt;
  await persistSessions();
  return { accepted: events.length };
});

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

app.get("/collect/start/:token", async (request: TraceRequest, reply) => {
  const { token } = request.params as { token: string };
  const task = tasks.find((item) => item.token === token);
  if (!task || !activeTask(task)) {
    return reply.code(410).type("text/html; charset=utf-8").send(
      "<!doctype html><meta charset=utf-8><title>任务不可用</title><style>body{font-family:system-ui;padding:10vh 10vw;color:#102a43}a{color:#ff6b35}</style><h1>采集任务不存在或已经过期</h1><p>请返回控制台创建新的采集任务。</p><a href='/collector'>打开采集控制台</a>",
    );
  }

  let session = request.cookies.tc_session
    ? sessions.find((item) => item.sessionId === request.cookies.tc_session)
    : undefined;
  if (!session) {
    session = {
      sessionId: randomUUID(),
      label: null,
      collectionTaskId: null,
      startedAt: now(),
      endedAt: now(),
      sourceIp: request.ip,
      userAgent: String(request.headers["user-agent"] ?? ""),
      requestCount: 0,
      trajectoryCount: 0,
    };
    sessions.push(session);
  }
  await bindTask(session, task);
  reply.setCookie("tc_session", session.sessionId, cookieOptions());
  return reply.redirect("/");
});

app.get("/api/collector/tasks", async () => {
  let changed = false;
  for (const task of tasks) {
    const previous = task.status;
    activeTask(task);
    if (task.status !== previous) changed = true;
  }
  if (changed) await persistTasks();
  return [...tasks].sort((a, b) => b.activeFrom.localeCompare(a.activeFrom));
});

app.post("/api/collector/tasks", async (request, reply) => {
  const body = request.body as {
    label?: string;
    expectedIp?: string;
    expectedUserAgent?: string;
    expiresInMinutes?: number;
    maxSessions?: number;
    note?: string;
  };
  if (!["human", "script", "ai"].includes(String(body.label))) {
    return reply.code(400).send({ message: "label 必须是 human、script 或 ai" });
  }
  const activeFrom = new Date();
  const expiresInMinutes = Math.max(1, Math.min(1440, Number(body.expiresInMinutes ?? 15)));
  const task: LabelTask = {
    id: randomUUID(),
    token: randomBytes(24).toString("base64url"),
    label: body.label as LabelTask["label"],
    expectedIp: body.expectedIp?.trim() || undefined,
    expectedUserAgent: body.expectedUserAgent?.trim() || undefined,
    activeFrom: activeFrom.toISOString(),
    expiresAt: new Date(activeFrom.getTime() + expiresInMinutes * 60_000).toISOString(),
    maxSessions: Math.max(1, Math.min(100, Number(body.maxSessions ?? 1))),
    boundSessions: 0,
    status: "waiting",
    note: body.note?.slice(0, 500),
  };
  tasks.push(task);
  await persistTasks();
  return reply.code(201).send(task);
});

app.post("/api/orders", async (request: TraceRequest, reply) => {
  const session = await ensureSession(request, reply);
  const body = request.body as RequestBodyOrder;
  if (!Array.isArray(body.items) || body.items.length === 0 || !body.checkout || !body.quote) {
    return reply.code(400).send({ message: "订单信息不完整" });
  }
  const prior = body.idempotencyKey
    ? orders.find((order) => order.sessionId === session.sessionId && order.idempotencyKey === body.idempotencyKey)
    : undefined;
  if (prior) return prior;

  const id = "TC" + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10);
  const order: StoredOrder = {
    id,
    token: randomBytes(18).toString("base64url"),
    items: body.items,
    quote: body.quote,
    checkout: body.checkout,
    status: "awaiting_payment",
    createdAt: now(),
    sessionId: session.sessionId,
    idempotencyKey: body.idempotencyKey || randomUUID(),
  };
  orders.push(order);
  await persistOrders();
  return reply.code(201).send(publicOrder(order));
});

app.get("/api/orders/:key", async (request: TraceRequest, reply) => {
  const session = await ensureSession(request, reply);
  const { key } = request.params as { key: string };
  const order = orders.find((item) => (item.id === key || item.token === key) && item.sessionId === session.sessionId);
  if (!order) return reply.code(404).send({ message: "订单不存在或不属于当前匿名会话" });
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
  const session = await ensureSession(request, reply);
  const body = request.body as { orderId?: string; method?: PaymentMethod };
  const order = orders.find((item) => item.id === body.orderId && item.sessionId === session.sessionId);
  if (!order) return reply.code(404).send({ message: "找不到需要支付的订单" });
  const method = body.method ?? "qr";
  const outcome = chooseOutcome(String(request.headers["x-tracecart-payment-outcome"] ?? "random"), method);
  const createdAt = new Date();
  const payment: StoredPayment = {
    id: randomUUID(),
    orderId: order.id,
    method,
    status: method === "cod" ? "succeeded" : "pending",
    outcome,
    amount: order.quote.total,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 2 * 60_000).toISOString(),
    sessionId: session.sessionId,
  };
  if (method === "cod") {
    order.status = "paid";
    order.paymentId = payment.id;
    await persistOrders();
  }
  payments.push(payment);
  order.paymentId = payment.id;
  await Promise.all([persistPayments(), persistOrders()]);
  return reply.code(201).send(publicPayment(payment));
});

app.get("/api/payments/:paymentId", async (request: TraceRequest, reply) => {
  const session = await ensureSession(request, reply);
  const { paymentId } = request.params as { paymentId: string };
  const payment = payments.find((item) => item.id === paymentId && item.sessionId === session.sessionId);
  if (!payment) return reply.code(404).send({ message: "支付会话不存在" });
  if (payment.status === "pending" && Date.now() >= new Date(payment.expiresAt).getTime()) {
    payment.status = "expired";
    payment.errorCode = "expired";
    await persistPayments();
  }
  return publicPayment(payment);
});

app.post("/api/payments/:paymentId/confirm", async (request: TraceRequest, reply) => {
  const session = await ensureSession(request, reply);
  const { paymentId } = request.params as { paymentId: string };
  const payment = payments.find((item) => item.id === paymentId && item.sessionId === session.sessionId);
  if (!payment) return reply.code(404).send({ message: "支付会话不存在" });
  if (payment.status !== "pending" && payment.status !== "processing") return publicPayment(payment);

  payment.status = "processing";
  if (payment.outcome === "succeeded") {
    payment.status = "succeeded";
    const order = orders.find((item) => item.id === payment.orderId);
    if (order) {
      order.status = "paid";
      order.paymentId = payment.id;
      await persistOrders();
    }
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
  const session = await ensureSession(request, reply);
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

app.post("/api/collector/export", async () => {
  const result = await createParquetExport(sessions);
  return {
    files: result.files.map((file) => ({
      ...file,
      url: "/api/collector/files/" + encodeURIComponent(result.batch) + "/" + encodeURIComponent(file.name),
    })),
  };
});

app.get("/api/collector/files/:batch/:file", async (request, reply) => {
  const { batch, file } = request.params as { batch: string; file: string };
  if (!/^[0-9TZ-]+$/.test(batch) || !["sessions.parquet", "requests.parquet", "trajectories.parquet"].includes(file)) {
    return reply.code(400).send({ message: "文件路径无效" });
  }
  const target = path.join(EXPORT_DIR, batch, file);
  try {
    await stat(target);
  } catch {
    return reply.code(404).send({ message: "导出文件不存在" });
  }
  reply.header("Content-Type", "application/octet-stream");
  reply.header("Content-Disposition", 'attachment; filename="' + file + '"');
  return reply.send(createReadStream(target));
});

const clientRoot = path.resolve(process.env.TRACECART_CLIENT_DIR ?? path.join(process.cwd(), "dist", "client"));
await app.register(fastifyStatic, {
  root: clientRoot,
  prefix: "/",
  wildcard: false,
});

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
