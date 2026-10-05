import type { TelemetryEvent } from "../types";
import { createId } from "./id";

const pageViewId = createId();
let sequence = 0;
let queue: TelemetryEvent[] = [];
let initialized = false;
let lastPointerAt = 0;
let lastScrollAt = 0;
let timer: number | undefined;

function safeTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return {};
  const masked = target.closest("[data-track-mask], input, textarea");
  return {
    trackId: target.closest<HTMLElement>("[data-track-id]")?.dataset.trackId ?? null,
    tag: target.tagName,
    role: target.getAttribute("role"),
    masked: Boolean(masked),
  };
}

function add(eventType: string, payload: Record<string, unknown> = {}) {
  queue.push({
    id: createId(),
    pageViewId,
    sequence: ++sequence,
    eventType,
    clientTimestamp: new Date().toISOString(),
    route: window.location.pathname + window.location.search,
    payload,
  });
  if (queue.length >= 50) void flush();
}

async function flush(useBeacon = false) {
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const body = JSON.stringify({ pageViewId, events });
  if (useBeacon && navigator.sendBeacon) {
    const sent = navigator.sendBeacon("/api/telemetry/batches", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }
  try {
    const response = await fetch("/api/telemetry/batches", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) throw new Error("telemetry rejected");
  } catch {
    queue = [...events, ...queue].slice(-500);
    try {
      localStorage.setItem("tracecart.telemetry.pending", JSON.stringify(queue.slice(-200)));
    } catch {
      // Storage may be unavailable; telemetry must never break the store.
    }
  }
}

export function trackBusiness(actionName: string, payload: Record<string, unknown> = {}) {
  add("business_action", { actionName, ...payload });
}

export function trackPageView(route: string) {
  add("page_view", {
    route,
    title: document.title,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    devicePixelRatio: window.devicePixelRatio,
  });
}

export function initTelemetry() {
  if (initialized) return;
  initialized = true;

  try {
    const pending = JSON.parse(localStorage.getItem("tracecart.telemetry.pending") ?? "[]") as TelemetryEvent[];
    queue.push(...pending);
    localStorage.removeItem("tracecart.telemetry.pending");
  } catch {
    // Ignore malformed prior telemetry.
  }

  document.addEventListener(
    "pointermove",
    (event) => {
      const now = performance.now();
      if (now - lastPointerAt < 55) return;
      lastPointerAt = now;
      add("pointer_move", {
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
        xRatio: event.clientX / Math.max(window.innerWidth, 1),
        yRatio: event.clientY / Math.max(window.innerHeight, 1),
        pointerType: event.pointerType,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        target: safeTarget(event.target),
      });
    },
    { passive: true, capture: true },
  );

  document.addEventListener(
    "click",
    (event) => {
      const pointer = event as PointerEvent;
      add("click", {
        clientX: pointer.clientX,
        clientY: pointer.clientY,
        pageX: pointer.pageX,
        pageY: pointer.pageY,
        button: pointer.button,
        target: safeTarget(event.target),
      });
    },
    { capture: true },
  );

  window.addEventListener(
    "scroll",
    () => {
      const now = performance.now();
      if (now - lastScrollAt < 100) return;
      lastScrollAt = now;
      add("scroll", {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      });
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    add("visibility_change", { state: document.visibilityState });
    if (document.visibilityState === "hidden") void flush(true);
  });

  window.addEventListener("beforeunload", () => {
    add("page_leave", { scrollY: window.scrollY });
    void flush(true);
  });

  timer = window.setInterval(() => void flush(), 2000);
  add("telemetry_ready", { pageViewId });
}

export function stopTelemetry() {
  if (timer) window.clearInterval(timer);
  void flush(true);
}
