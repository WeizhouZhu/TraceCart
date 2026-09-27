import { useEffect, useState, type FormEvent } from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FlaskConical,
  Gauge,
  FileCode2,
  LoaderCircle,
  Network,
  RefreshCw,
  Save,
  Server,
  Settings2,
} from "lucide-react";
import { Breadcrumbs } from "../components";
import { api } from "../lib/api";
import { trackBusiness } from "../lib/telemetry";
import { useStore } from "../store/AppStore";
import type { ActorLabel, LabelTask, SessionInfo } from "../types";

function useTitle(title: string) {
  useEffect(() => { document.title = title + " · TraceCart"; }, [title]);
}

export function CollectorPage() {
  useTitle("采集控制台");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tasks, setTasks] = useState<LabelTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exports, setExports] = useState<Array<{ name: string; url: string; rows: number }>>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    label: "human" as ActorLabel,
    expectedIp: "",
    expectedUserAgent: "",
    expiresInMinutes: 15,
    maxSessions: 1,
    note: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [sessionData, taskData] = await Promise.all([api.session(), api.listTasks()]);
      setSession(sessionData);
      setTasks(taskData);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      const task = await api.createTask({
        ...form,
        expectedIp: form.expectedIp || undefined,
        expectedUserAgent: form.expectedUserAgent || undefined,
      });
      setTasks((current) => [task, ...current]);
      setMessage("标签任务已创建。复制任务链接，在目标客户端中首先打开它。");
      trackBusiness("label_task_created", { label: task.label, taskId: task.id });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "创建任务失败");
    } finally {
      setCreating(false);
    }
  }

  async function createExport() {
    setExporting(true);
    setMessage("");
    try {
      const result = await api.exportData();
      setExports(result.files);
      setMessage("Parquet 导出已生成。");
      trackBusiness("parquet_export_created", { files: result.files.map((file) => file.name) });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  function taskUrl(task: LabelTask) {
    return window.location.origin + "/collect/start/" + task.token;
  }

  return (
    <div className="container admin-page">
      <Breadcrumbs items={[{ label: "采集控制台" }]} />
      <div className="admin-hero">
        <div><span className="eyebrow">DATA COLLECTION CONTROL</span><h1>轨迹与请求采集控制台</h1><p>创建会话级标签任务、检查当前绑定状态并导出 Python 可读的 Parquet 数据。</p></div>
        <div className="status-pill"><span className="pulse-dot" /><strong>采集服务运行中</strong></div>
      </div>

      <section className="admin-metrics">
        <div><Server /><span><small>当前会话</small><strong>{session?.sessionId.slice(0, 8) ?? "加载中"}</strong></span></div>
        <div><Gauge /><span><small>当前标签</small><strong>{session?.label ?? "unlabeled"}</strong></span></div>
        <div><Database /><span><small>标签任务</small><strong>{tasks.length}</strong></span></div>
        <div><Network /><span><small>写入模式</small><strong>NDJSON + Parquet</strong></span></div>
      </section>

      {message && <div className="notice notice--info"><CheckCircle2 size={18} /><span>{message}</span></div>}

      <div className="admin-layout">
        <section className="admin-card">
          <div className="admin-card__head"><div><span className="eyebrow">NEW LABELED SESSION</span><h2>创建有标签采集任务</h2></div><FlaskConical /></div>
          <form className="admin-form" onSubmit={submit}>
            <fieldset>
              <legend>访问类型</legend>
              <div className="label-selector">
                <button type="button" className={form.label === "human" ? "selected" : ""} onClick={() => setForm({ ...form, label: "human" })}><HumanIcon /><strong>Human</strong><small>人工操作</small></button>
                <button type="button" className={form.label === "script" ? "selected" : ""} onClick={() => setForm({ ...form, label: "script" })}><FileCode2 size={22} /><strong>Script</strong><small>普通脚本</small></button>
                <button type="button" className={form.label === "ai" ? "selected" : ""} onClick={() => setForm({ ...form, label: "ai" })}><Bot size={22} /><strong>AI</strong><small>Agent 操作</small></button>
              </div>
            </fieldset>
            <div className="form-grid">
              <label><span>预计来源 IP</span><input value={form.expectedIp} onChange={(event) => setForm({ ...form, expectedIp: event.target.value })} placeholder="可选，例如 203.0.113.10" /></label>
              <label><span>预计 User-Agent 包含</span><input value={form.expectedUserAgent} onChange={(event) => setForm({ ...form, expectedUserAgent: event.target.value })} placeholder="可选，例如 Chrome" /></label>
              <label><span>有效时间（分钟）</span><input type="number" min="1" max="1440" value={form.expiresInMinutes} onChange={(event) => setForm({ ...form, expiresInMinutes: Number(event.target.value) })} /></label>
              <label><span>可绑定会话数</span><input type="number" min="1" max="100" value={form.maxSessions} onChange={(event) => setForm({ ...form, maxSessions: Number(event.target.value) })} /></label>
              <label className="full"><span>实验备注</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="例如：GPT Agent 商品检索任务第 3 轮" /></label>
            </div>
            <button className="button button--primary" disabled={creating}>{creating ? <><LoaderCircle className="spin" />创建中</> : <><Save size={17} />创建任务</>}</button>
          </form>
        </section>

        <section className="admin-card export-card">
          <div className="admin-card__head"><div><span className="eyebrow">PYTHON DATASET</span><h2>导出采集数据</h2></div><Download /></div>
          <p>生成三个可直接由 pandas.read_parquet 读取的文件。</p>
          <div className="export-files-preview"><span>sessions.parquet</span><span>requests.parquet</span><span>trajectories.parquet</span></div>
          <button className="button button--dark button--full" onClick={createExport} disabled={exporting}>{exporting ? <><LoaderCircle className="spin" />正在生成</> : <><Download size={17} />生成 Parquet 导出</>}</button>
          {exports.length > 0 && <div className="export-results">{exports.map((file) => <a key={file.name} href={file.url} download><span><strong>{file.name}</strong><small>{file.rows} 行</small></span><Download size={16} /></a>)}</div>}
        </section>
      </div>

      <section className="admin-card task-list-card">
        <div className="admin-card__head"><div><span className="eyebrow">COLLECTION TASKS</span><h2>最近标签任务</h2></div><button className="icon-button" onClick={load} aria-label="刷新"><RefreshCw size={17} className={loading ? "spin" : ""} /></button></div>
        <div className="task-table">
          <div className="task-row task-row--head"><span>标签</span><span>状态</span><span>匹配条件</span><span>绑定</span><span>过期时间</span><span>任务链接</span></div>
          {tasks.length ? tasks.map((task) => (
            <div className="task-row" key={task.id}>
              <span className={"label-badge label-badge--" + task.label}>{task.label}</span>
              <span><i className={"status-dot status-dot--" + task.status} />{task.status}</span>
              <span>{task.expectedIp || task.expectedUserAgent || "仅使用任务令牌"}</span>
              <span>{task.boundSessions}/{task.maxSessions}</span>
              <time>{new Date(task.expiresAt).toLocaleString("zh-CN")}</time>
              <button className="copy-button" onClick={() => { navigator.clipboard.writeText(taskUrl(task)); setMessage("任务链接已复制。"); }}><Copy size={14} />复制链接</button>
            </div>
          )) : <div className="table-empty">还没有标签任务。普通访问会继续以无标签会话采集。</div>}
        </div>
      </section>
    </div>
  );
}

function HumanIcon() {
  return <span className="human-icon">人</span>;
}

export function ScenarioPage() {
  useTitle("场景设置");
  const { scenario, setScenario } = useStore();
  const [draft, setDraft] = useState(scenario);
  const [saved, setSaved] = useState(false);

  function save() {
    setScenario(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="container admin-page scenario-page">
      <Breadcrumbs items={[{ label: "场景设置" }]} />
      <div className="admin-hero"><div><span className="eyebrow">EXPERIMENT SCENARIOS</span><h1>可复现异常场景</h1><p>固定网络、库存与支付结果，为重复采集和自动化测试提供一致条件。</p></div><Settings2 size={42} /></div>
      <div className="scenario-grid">
        <section className="admin-card"><h2>网络状态</h2><label><span>模拟延迟</span><select value={draft.latency} onChange={(event) => setDraft({ ...draft, latency: Number(event.target.value) })}><option value="0">无额外延迟</option><option value="200">200 ms</option><option value="800">800 ms</option><option value="2000">2 秒慢速</option></select></label><label><span>失败概率</span><input type="range" min="0" max="100" value={draft.failRate * 100} onChange={(event) => setDraft({ ...draft, failRate: Number(event.target.value) / 100 })} /><strong>{Math.round(draft.failRate * 100)}%</strong></label></section>
        <section className="admin-card"><h2>商品状态</h2><label className="toggle-row"><span><strong>低库存模式</strong><small>展示库存紧张和数量边界</small></span><input type="checkbox" checked={draft.lowStock} onChange={(event) => setDraft({ ...draft, lowStock: event.target.checked })} /></label><label className="toggle-row"><span><strong>价格变化</strong><small>结算前返回报价变化</small></span><input type="checkbox" checked={draft.priceChanged} onChange={(event) => setDraft({ ...draft, priceChanged: event.target.checked })} /></label></section>
        <section className="admin-card payment-scenario"><h2>支付结果</h2><div>{[["random", "随机（75% 成功）"], ["succeeded", "固定成功"], ["insufficient_funds", "余额不足"], ["risk_rejected", "风控拒绝"], ["network_error", "网络错误"], ["expired", "二维码过期"]].map(([value, label]) => <button className={draft.paymentOutcome === value ? "selected" : ""} key={value} onClick={() => setDraft({ ...draft, paymentOutcome: value as typeof draft.paymentOutcome })}>{draft.paymentOutcome === value && <CheckCircle2 size={15} />}{label}</button>)}</div></section>
      </div>
      <div className="scenario-save"><span>{saved ? "设置已保存到当前浏览器会话" : "这些设置不会影响其他访问者"}</span><button className="button button--primary" onClick={save}>{saved ? <CheckCircle2 size={17} /> : <Save size={17} />}{saved ? "已保存" : "应用场景"}</button></div>
    </div>
  );
}
