import type { ActorLabel } from "../src/types";

export interface SourceSubtypeDefinition {
  id: string;
  label: ActorLabel;
  displayName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const STABLE_ACTOR_LABELS = ["human", "script", "ai"] as const;

export const DEFAULT_SOURCE_SUBTYPES: ReadonlyArray<Pick<SourceSubtypeDefinition, "id" | "label" | "displayName">> = [
  { id: "human.manual", label: "human", displayName: "人工操作" },
  { id: "human.legacy_unspecified", label: "human", displayName: "历史人工（未细分）" },
  { id: "script.playwright", label: "script", displayName: "Playwright Script" },
  { id: "script.selenium", label: "script", displayName: "Selenium Script" },
  { id: "script.http_client", label: "script", displayName: "HTTP Client Script" },
  { id: "script.legacy_unspecified", label: "script", displayName: "历史 Script（未细分）" },
  { id: "ai.browser_semantic", label: "ai", displayName: "Browser Semantic" },
  { id: "ai.visual_gui", label: "ai", displayName: "Visual GUI" },
  { id: "ai.workflow_hybrid", label: "ai", displayName: "Workflow Hybrid" },
  { id: "ai.multi_agent", label: "ai", displayName: "Multi-Agent" },
  { id: "ai.browser_use", label: "ai", displayName: "Browser Use" },
  { id: "ai.claude_computer_use", label: "ai", displayName: "Claude Computer Use" },
  { id: "ai.openai_computer_use", label: "ai", displayName: "OpenAI Computer Use" },
  { id: "ai.legacy_unspecified", label: "ai", displayName: "历史 AI（未细分）" },
];

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export function isActorLabel(value: unknown): value is ActorLabel {
  return STABLE_ACTOR_LABELS.includes(value as ActorLabel);
}

export function normalizeIdentifier(value: unknown, maximum = 80) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length <= maximum && identifierPattern.test(normalized) ? normalized : undefined;
}

export function normalizeDisplayName(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length >= 1 && normalized.length <= 80 ? normalized : undefined;
}

export function validateSubtypeIdentity(id: unknown, label: unknown) {
  if (!isActorLabel(label)) return { ok: false as const, message: "大类型必须是 human、script 或 ai" };
  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId || !normalizedId.startsWith(`${label}.`)) {
    return { ok: false as const, message: `子类型必须使用 ${label}. 前缀及小写标识符` };
  }
  return { ok: true as const, id: normalizedId, label };
}

export function seedSourceSubtypes(current: SourceSubtypeDefinition[], timestamp: string) {
  const seen = new Set(current.map((item) => item.id));
  const additions = DEFAULT_SOURCE_SUBTYPES.filter((item) => !seen.has(item.id)).map((item) => ({
    ...item,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  return { sourceSubtypes: [...current, ...additions], changed: additions.length > 0 };
}

export function resolveSourceSubtype(
  definitions: SourceSubtypeDefinition[],
  label: ActorLabel,
  requested: unknown,
) {
  const id = requested === undefined || requested === null || requested === ""
    ? `${label}.legacy_unspecified`
    : normalizeIdentifier(requested);
  if (!id) return { ok: false as const, message: "sourceSubtype 格式无效" };
  const definition = definitions.find((item) => item.id === id && item.label === label);
  if (!definition) return { ok: false as const, message: `sourceSubtype 不属于 ${label} 或尚未注册` };
  if (!definition.enabled) return { ok: false as const, message: "sourceSubtype 已停用" };
  return { ok: true as const, definition };
}
