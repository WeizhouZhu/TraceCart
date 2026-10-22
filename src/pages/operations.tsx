import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import "../operations.css";
import {
  Activity,
  Bot,
  Check,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

type Label = "human" | "script" | "ai" | null;
interface Summary {
  generatedAt: string;
  totals: { sessions: number; requests: number; trajectories: number; labeledSessions: number; unlabeledSessions: number };
  labels: { unlabeled: number; human: number; script: number; ai: number };
  subtypes: Record<string, number>;
  taskTypes: Record<string, number>;
  timeRange: { first: string | null; last: string | null };
  recentSessions: Array<{
    sessionId: string;
    label: Label;
    sourceSubtype: string | null;
    taskType: string | null;
    scenarioId: string | null;
    experimentId: string | null;
    nickname: string | null;
    startedAt: string;
    endedAt: string;
    requestCount: number;
    trajectoryCount: number;
  }>;
}
interface SourceSubtype {
  id: string;
  label: "human" | "script" | "ai";
  displayName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
interface AccessData {
  keys: Array<{ id: string; label: "script" | "ai"; createdAt: string; revokedAt?: string; status: string }>;
  links: Array<{
    id: string;
    label: "human" | "script" | "ai";
    sourceSubtype?: string;
    taskType?: string;
    scenarioId?: string;
    nickname?: string;
    createdAt: string;
    expiresAt: string;
    usedAt?: string;
    status: string;
  }>;
  sourceSubtypes: SourceSubtype[];
  guide: Record<string, unknown>;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "请求失败");
  return body as T;
}
function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}
function labelName(label: Label | "unlabeled") {
  return label === null || label === "unlabeled" ? "无标签" : label === "human" ? "Human" : label === "script" ? "Script" : "AI Agent";
}
function OpsFrame({ children }: { children: ReactNode }) {
  return (
    <main className="ops-root">
      <div className="ops-brand"><span>TC</span><strong>TraceCart</strong><small>COLLECTION OPERATIONS</small></div>
      {children}
    </main>
  );
}
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await jsonRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      setPassword("");
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <OpsFrame>
      <section className="ops-auth-card">
        <div className="ops-auth-icon"><LockKeyhole /></div>
        <p className="ops-kicker">RESTRICTED AREA</p>
        <h1>数据采集管理</h1>
        <p>查看采集统计、导出训练数据并管理 Script 与 Agent 接入密钥。</p>
        <form onSubmit={submit}>
          <label><span>管理员密码</span><input autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {message && <div className="ops-error">{message}</div>}
          <button className="ops-primary" disabled={busy || !password}>
            {busy ? <LoaderCircle className="spin" /> : <ShieldCheck />}验证并进入
          </button>
        </form>
      </section>
    </OpsFrame>
  );
}

export function AdminPage() {
  const [auth, setAuth] = useState<"checking" | "guest" | "ready">("checking");
  const [tab, setTab] = useState<"data" | "access">("data");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [access, setAccess] = useState<AccessData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [oneTimeKey, setOneTimeKey] = useState("");

  async function load() {
    setBusy(true);
    try {
      const [nextSummary, nextAccess] = await Promise.all([
        jsonRequest<Summary>("/api/admin/summary"),
        jsonRequest<AccessData>("/api/admin/access"),
      ]);
      setSummary(nextSummary);
      setAccess(nextAccess);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    document.title = "采集管理 - TraceCart";
    void jsonRequest<{ authenticated: boolean }>("/api/admin/session")
      .then(() => { setAuth("ready"); void load() })
      .catch(() => setAuth("guest"));
  }, []);
  async function createExport() {
    setBusy(true);
    try {
      const result = await jsonRequest<{
        archive: { name: string; url: string; bytes: number };
        files: Array<{ name: string; rows: number }>;
      }>("/api/admin/export", { method: "POST", body: "{}" });
      const link = document.createElement("a");
      link.href = result.archive.url;
      link.download = result.archive.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage(`已生成并下载 ${result.archive.name}，包含3个Parquet文件。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }
  async function rotate(label: "script" | "ai") {
    if (!window.confirm(`轮换后，当前 ${label} Key 会立即失效。确认继续？`)) return;
    setBusy(true);
    try {
      const result = await jsonRequest<{ apiKey: string }>(`/api/admin/keys/${label}/rotate`, { method: "POST", body: "{}" });
      setOneTimeKey(result.apiKey);
      setMessage("新 API Key 只显示这一次，请立即安全保存。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "轮换失败");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await jsonRequest("/api/admin/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setAuth("guest");
  }
  if (auth === "checking") return <OpsFrame><div className="ops-loading"><LoaderCircle className="spin" />正在验证管理会话</div></OpsFrame>;
  if (auth === "guest") return <AdminLogin onSuccess={() => { setAuth("ready"); void load() }} />;

  return (
    <OpsFrame>
      <header className="ops-topbar">
        <div><p className="ops-kicker">DATA GOVERNANCE</p><h1>采集数据中心</h1><p>管理页面与验证流量不会进入训练数据。</p></div>
        <div className="ops-actions">
          <button onClick={() => void load()} disabled={busy}><RefreshCw className={busy ? "spin" : ""} />刷新</button>
          <button onClick={() => void logout()}><LogOut />退出</button>
        </div>
      </header>
      <nav className="ops-tabs">
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}><Database />数据总览与导出</button>
        <button className={tab === "access" ? "active" : ""} onClick={() => setTab("access")}><KeyRound />接入与密钥</button>
      </nav>
      {message && <div className="ops-notice"><Check />{message}</div>}
      {oneTimeKey && (
        <div className="ops-secret">
          <div><strong>一次性显示的新 API Key</strong><code>{oneTimeKey}</code><small>关闭后无法找回，只能再次轮换。</small></div>
          <button onClick={() => { void navigator.clipboard.writeText(oneTimeKey); setMessage("API Key 已复制。") }}><Copy />复制</button>
          <button onClick={() => setOneTimeKey("")}>已保存，关闭</button>
        </div>
      )}
      {tab === "data" ? (
        <DataPanel summary={summary} busy={busy} onExport={createExport} />
      ) : (
        <AccessPanel data={access} busy={busy} onRotate={rotate} onReload={load} />
      )}
    </OpsFrame>
  );
}

function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint: string }) {
  return <article className="ops-metric"><span>{icon}</span><div><small>{label}</small><strong>{value.toLocaleString()}</strong><em>{hint}</em></div></article>;
}
function DataPanel({ summary, busy, onExport }: { summary: Summary | null; busy: boolean; onExport: () => void }) {
  if (!summary) return <div className="ops-loading"><LoaderCircle className="spin" />正在读取统计数据</div>;
  return (
    <section className="ops-panel">
      <div className="ops-metrics">
        <Metric icon={<Database />} label="会话数量" value={summary.totals.sessions} hint={`${summary.totals.labeledSessions} 个有标签`} />
        <Metric icon={<Activity />} label="请求记录" value={summary.totals.requests} hint="仅商城白名单请求" />
        <Metric icon={<Users />} label="轨迹事件" value={summary.totals.trajectories} hint="点击、移动、滚动等" />
        <Metric icon={<ShieldCheck />} label="无标签会话" value={summary.totals.unlabeledSessions} hint="来自普通商城入口" />
      </div>
      <div className="ops-grid">
        <article className="ops-card">
          <div className="ops-card-head"><div><p className="ops-kicker">LABEL DISTRIBUTION</p><h2>标签分布</h2></div><button className="ops-primary compact" onClick={onExport} disabled={busy}><Download />导出 ZIP</button></div>
          <div className="ops-label-bars">
            {(Object.entries(summary.labels) as Array<[keyof Summary["labels"], number]>).map(([label, count]) => (
              <div key={label}><span>{labelName(label)}</span><strong>{count.toLocaleString()}</strong><i><b style={{ width: `${summary.totals.sessions ? Math.max(2, count / summary.totals.sessions * 100) : 0}%` }} /></i></div>
            ))}
          </div>
          <p className="ops-range">采集范围：{formatTime(summary.timeRange.first)} - {formatTime(summary.timeRange.last)}</p>
        </article>
        <article className="ops-card ops-export-info">
          <p className="ops-kicker">PYTHON READY</p><h2>训练数据导出</h2>
          <p>一次生成包含 sessions、requests 和 trajectories 的ZIP；主体子类型与任务元数据位于 sessions.parquet。</p>
          <div><code>sessions.parquet</code><code>requests.parquet</code><code>trajectories.parquet</code></div>
        </article>
      </div>
      <div className="ops-grid">
        <article className="ops-card">
          <p className="ops-kicker">SOURCE SUBTYPES</p><h2>主体子类型分布</h2>
          <div className="ops-compact-list">{Object.entries(summary.subtypes).sort().map(([name, count]) => <div key={name}><code>{name}</code><strong>{count}</strong></div>)}</div>
        </article>
        <article className="ops-card">
          <p className="ops-kicker">TASK TYPES</p><h2>任务类型分布</h2>
          <div className="ops-compact-list">{Object.entries(summary.taskTypes).sort().map(([name, count]) => <div key={name}><code>{name}</code><strong>{count}</strong></div>)}</div>
        </article>
      </div>
      <article className="ops-card">
        <div className="ops-card-head"><div><p className="ops-kicker">RECENT SESSIONS</p><h2>最近会话</h2></div><small>统计时间 {formatTime(summary.generatedAt)}</small></div>
        <div className="ops-table">
          <div className="ops-tr ops-th sessions"><span>会话</span><span>大类型</span><span>子类型</span><span>任务</span><span>开始时间</span><span>请求</span><span>轨迹</span></div>
          {summary.recentSessions.map((session) => (
            <div className="ops-tr sessions" key={session.sessionId}>
              <code>{session.sessionId.slice(0, 12)}</code>
              <span className={`ops-badge ${session.label ?? "unlabeled"}`}>{labelName(session.label)}</span>
              <code title={session.sourceSubtype ?? ""}>{session.sourceSubtype ?? "-"}</code>
              <span title={session.scenarioId ?? ""}>{session.taskType ?? "-"}</span>
              <time>{formatTime(session.startedAt)}</time>
              <strong>{session.requestCount}</strong><strong>{session.trajectoryCount}</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function AccessPanel({ data, busy, onRotate, onReload }: {
  data: AccessData | null;
  busy: boolean;
  onRotate: (label: "script" | "ai") => void;
  onReload: () => Promise<void>;
}) {
  const [subtypeLabel, setSubtypeLabel] = useState<"human" | "script" | "ai">("ai");
  const [subtypeId, setSubtypeId] = useState("");
  const [subtypeName, setSubtypeName] = useState("");
  const [subtypeMessage, setSubtypeMessage] = useState("");
  const [subtypeBusy, setSubtypeBusy] = useState(false);
  if (!data) return <div className="ops-loading"><LoaderCircle className="spin" />正在读取接入配置</div>;
  const activeKeys = data.keys.filter((key) => key.status === "active");

  async function createSubtype(event: FormEvent) {
    event.preventDefault();
    setSubtypeBusy(true);
    setSubtypeMessage("");
    try {
      await jsonRequest("/api/admin/source-subtypes", {
        method: "POST",
        body: JSON.stringify({ label: subtypeLabel, id: subtypeId, displayName: subtypeName }),
      });
      setSubtypeId("");
      setSubtypeName("");
      setSubtypeMessage("子类型已新增。");
      await onReload();
    } catch (error) {
      setSubtypeMessage(error instanceof Error ? error.message : "新增失败");
    } finally {
      setSubtypeBusy(false);
    }
  }

  async function toggleSubtype(item: SourceSubtype) {
    setSubtypeBusy(true);
    setSubtypeMessage("");
    try {
      await jsonRequest(`/api/admin/source-subtypes/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      setSubtypeMessage(item.enabled ? "子类型已停用；历史数据保持不变。" : "子类型已启用。");
      await onReload();
    } catch (error) {
      setSubtypeMessage(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSubtypeBusy(false);
    }
  }

  async function renameSubtype(item: SourceSubtype) {
    const displayName = window.prompt("新的显示名称", item.displayName)?.trim();
    if (!displayName || displayName === item.displayName) return;
    setSubtypeBusy(true);
    setSubtypeMessage("");
    try {
      await jsonRequest(`/api/admin/source-subtypes/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      setSubtypeMessage("显示名称已更新；稳定 ID 未改变。");
      await onReload();
    } catch (error) {
      setSubtypeMessage(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSubtypeBusy(false);
    }
  }
  return (
    <section className="ops-panel">
      <div className="ops-grid">
        {(["script", "ai"] as const).map((label) => {
          const key = activeKeys.find((item) => item.label === label);
          return (
            <article className="ops-card ops-key-card" key={label}>
              <div className="ops-key-icon">{label === "script" ? <FileCode2 /> : <Bot />}</div>
              <p className="ops-kicker">{label === "script" ? "STANDARD AUTOMATION" : "LLM AGENT"}</p>
              <h2>{label === "script" ? "Script API Key" : "Agent API Key"}</h2>
              <p>只能签发 <strong>{label}</strong> 标签链接；请求体无法覆盖标签。</p>
              <dl><div><dt>状态</dt><dd>{key ? "正常" : "未配置"}</dd></div><div><dt>Key ID</dt><dd>{key?.id ?? "-"}</dd></div><div><dt>创建</dt><dd>{formatTime(key?.createdAt)}</dd></div></dl>
              <button className="ops-secondary" onClick={() => onRotate(label)} disabled={busy}><RefreshCw />轮换密钥</button>
            </article>
          );
        })}
      </div>
      <article className="ops-card">
        <div className="ops-card-head"><div><p className="ops-kicker">SOURCE SUBTYPE REGISTRY</p><h2>子类型注册表</h2></div><small>大类型固定；子类型可新增、改名和启停</small></div>
        <form className="ops-subtype-form" onSubmit={createSubtype}>
          <label><span>大类型</span><select value={subtypeLabel} onChange={(event) => setSubtypeLabel(event.target.value as "human" | "script" | "ai")}><option value="human">human</option><option value="script">script</option><option value="ai">ai</option></select></label>
          <label><span>稳定 ID</span><input value={subtypeId} onChange={(event) => setSubtypeId(event.target.value)} placeholder={`${subtypeLabel}.custom_runner`} required /></label>
          <label><span>显示名称</span><input value={subtypeName} onChange={(event) => setSubtypeName(event.target.value)} placeholder="Custom Runner" required /></label>
          <button className="ops-primary" disabled={subtypeBusy}>新增子类型</button>
        </form>
        {subtypeMessage && <p className="ops-muted">{subtypeMessage}</p>}
        <div className="ops-table">
          <div className="ops-tr ops-th subtypes"><span>稳定 ID</span><span>大类型</span><span>显示名称</span><span>状态</span><span>操作</span></div>
          {data.sourceSubtypes.map((item) => (
            <div className="ops-tr subtypes" key={item.id}>
              <code>{item.id}</code><span className={`ops-badge ${item.label}`}>{labelName(item.label)}</span>
              <span>{item.displayName}</span><strong>{item.enabled ? "启用" : "停用"}</strong>
              <span className="ops-inline-actions"><button type="button" onClick={() => void renameSubtype(item)} disabled={subtypeBusy}>改名</button><button type="button" onClick={() => void toggleSubtype(item)} disabled={subtypeBusy || item.id.endsWith(".legacy_unspecified")}>{item.enabled ? "停用" : "启用"}</button></span>
            </div>
          ))}
        </div>
      </article>
      <article className="ops-card">
        <div className="ops-card-head"><div><p className="ops-kicker">MACHINE-READABLE API</p><h2>Script / Agent 接入</h2></div><code>GET - POST /api/collect</code></div>
        <div className="ops-docs">
          <div><h3>读取说明</h3><pre>{`curl https://42.193.237.190/api/collect \\\n  -H "Authorization: Bearer <API_KEY>"`}</pre></div>
          <div><h3>创建一次性链接</h3><pre>{`curl -X POST https://42.193.237.190/api/collect \\\n  -H "Authorization: Bearer <API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"sourceSubtype":"ai.browser_use","taskType":"purchase_exact_product","scenarioId":"purchase_exact_product_v1","experimentId":"pilot-2026q4"}'`}</pre></div>
        </div>
        <p className="ops-muted">链接单次使用、30 分钟有效。大类型由 Key 决定，sourceSubtype 必须来自启用的注册表；Token 仅在返回 URL 的 Fragment 中出现。</p>
      </article>
      <article className="ops-card">
        <div className="ops-card-head"><div><p className="ops-kicker">ISSUANCE AUDIT</p><h2>最近签发记录</h2></div><small>不保存明文 Token</small></div>
        <div className="ops-table links">
          <div className="ops-tr ops-th links"><span>Link ID</span><span>大类型</span><span>子类型</span><span>任务</span><span>签发时间</span><span>状态</span></div>
          {data.links.length ? data.links.map((link) => (
            <div className="ops-tr links" key={link.id}><code>{link.id.slice(0, 12)}</code><span className={`ops-badge ${link.label}`}>{labelName(link.label)}</span><code>{link.sourceSubtype ?? "-"}</code><span title={link.scenarioId}>{link.taskType ?? "-"}</span><time>{formatTime(link.createdAt)}</time><strong>{link.status}</strong></div>
          )) : <div className="ops-empty">尚未签发专属链接。</div>}
        </div>
      </article>
    </section>
  );
}

export function HumanPage() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = "人工数据采集 - TraceCart" }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await jsonRequest<{ url: string; expiresAt: string }>("/api/human/link", {
        method: "POST", body: JSON.stringify({ nickname, password }),
      });
      setLink(result.url);
      setExpiresAt(result.expiresAt);
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "领取失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <OpsFrame>
      <section className="ops-auth-card human">
        <div className="ops-auth-icon"><Users /></div><p className="ops-kicker">HUMAN COLLECTION</p><h1>人工采集入口</h1>
        <p>验证后会生成只属于本次参与者的一次性商城链接。建议填写代号，不要填写真实姓名。</p>
        {!link ? (
          <form onSubmit={submit}>
            <label><span>Nickname</span><input autoFocus maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="例如 participant-023" required /></label>
            <label><span>人工采集密码</span><input type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {message && <div className="ops-error">{message}</div>}
            <button className="ops-primary" disabled={busy || !nickname || !password}>{busy ? <LoaderCircle className="spin" /> : <KeyRound />}领取专属链接</button>
          </form>
        ) : (
          <div className="ops-link-result"><ShieldCheck /><h2>专属链接已生成</h2><p>有效至 {formatTime(expiresAt)}，打开后立即失效。</p><code>{link}</code>
            <div><button onClick={() => void navigator.clipboard.writeText(link)}><Copy />复制</button><a href={link}><ExternalLink />进入商城</a></div>
          </div>
        )}
      </section>
    </OpsFrame>
  );
}

export function ClaimPage() {
  const [state, setState] = useState<"claiming" | "error">("claiming");
  const [message, setMessage] = useState("正在验证一次性链接");
  useEffect(() => {
    document.title = "正在进入商城 - TraceCart";
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", "/c");
    if (!token) {
      setState("error");
      setMessage("链接中缺少访问令牌。");
      return;
    }
    void jsonRequest<{ redirectTo: string }>("/api/claim", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((result) => {
      setMessage("验证成功，正在创建独立采集会话");
      localStorage.removeItem("tracecart.store");
      localStorage.removeItem("tracecart.telemetry.pending");
      sessionStorage.removeItem("tracecart.scenario");
      window.setTimeout(() => window.location.replace(result.redirectTo), 450);
    }).catch((error) => {
      setState("error");
      setMessage(error instanceof Error ? error.message : "链接验证失败");
    });
  }, []);
  return (
    <OpsFrame>
      <section className="ops-claim">
        <div className={`ops-claim-icon ${state}`}>{state === "claiming" ? <LoaderCircle className="spin" /> : <LockKeyhole />}</div>
        <p className="ops-kicker">SECURE SESSION HANDOFF</p><h1>{state === "claiming" ? "正在准备商城" : "无法使用此链接"}</h1><p>{message}</p>
        {state === "error" && <a href="/">返回普通商城</a>}
      </section>
    </OpsFrame>
  );
}
