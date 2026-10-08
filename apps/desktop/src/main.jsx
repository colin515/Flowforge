import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Activity, ArrowDown, ArrowUp, Check, ChevronRight, Copy,
  Download, ExternalLink, Flag, GripVertical, Layers, Lock, Moon,
  MousePointer2, Play, Plus, RefreshCw, Save, ScanLine, Search,
  ShieldCheck, Square, Star, Store, Sun, ThumbsDown, ThumbsUp, Image as ImageIcon,
  Trash2, Upload, X, Minus, Maximize2, Volume2,
} from "lucide-react";
import { starters, defaults, clone, validateMacro, parseMacro, downloadJSON } from "../../../packages/shared/macros.js";
import { Runner } from "../../../packages/shared/runner.js";
import { Vision } from "./vision.js";
import { AudioFeedback } from "./audio.js";
import { LocalAI } from "./local-ai.js";
import logoUrl from "./assets/flowforge-mark.svg";
import config from "../../../config.json";
import "./style.css";

const labels = {
  wait: "Wait / random delay", move: "Move mouse", click: "Mouse click",
  key: "Press / hold key", keyChord: "Key chord", text: "Type text", drag: "Drag mouse",
  findText: "Find text", findColor: "Find color", findImage: "Find image",
  checkPixel: "Check pixel color", loop: "Repeat / infinite loop", while: "While / until",
  ifFound: "If match / else", ifCompare: "If variable / else",
  setVar: "Set variable", math: "Variable arithmetic", break: "Break loop", continue: "Continue loop",
  aiNavigate: "AI Navigate & Do", aiIf: "AI If / Else",
};
const colors = {
  wait: "mint", move: "peach", click: "peach", key: "peach", keyChord: "peach", text: "peach",
  drag: "peach", findText: "blue", findColor: "blue", findImage: "blue", checkPixel: "blue",
  loop: "lavender", while: "lavender", ifFound: "lavender", ifCompare: "lavender",
  setVar: "mint", math: "mint", break: "lavender", continue: "lavender",
  aiNavigate: "blue", aiIf: "blue",
};
const get = (object, path) => path.reduce((value, key) => value?.[key], object);
const readLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const preferredTheme = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const catalogUrl = "https://colin515.github.io/Flowforge/marketplace/catalog.json";
const marketplaceUrl = "https://colin515.github.io/Flowforge/marketplace/";
const catalogFallback = starters.map(({ id, name, category, description }) => ({
  id, name, category, description,
  url: new URL(`macros/${id}.json`, marketplaceUrl).href,
}));
const formatTime = () => new Date().toLocaleTimeString([], { hour12: false });

function App() {
  const [custom, setCustom] = useState(() => {
    const stored = readLocal("ff-macros", []);
    return (Array.isArray(stored) ? stored : []).filter((entry) => {
      try { validateMacro(entry.macro); return typeof entry.id === "string"; } catch { return false; }
    });
  });
  const all = custom;
  const [id, setId] = useState(() => custom[0]?.id ?? null);
  const selected = all.find((entry) => entry.id === id) ?? null;
  const [macro, setMacro] = useState(() => custom[0] ? clone(custom[0].macro) : null);
  const [path, setPath] = useState(null);
  const [view, setView] = useState("builder");
  const [builderPane, setBuilderPane] = useState("blocks");
  const [theme, setTheme] = useState(() => readLocal("ff-theme", preferredTheme()));
  const [windows, setWindows] = useState([]);
  const [target, setTarget] = useState("global");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready when you are");
  const [step, setStep] = useState("");
  const [logs, setLogs] = useState(() => [{ time: formatTime(), kind: "info", message: "Studio ready" }]);
  const [updated, setUpdated] = useState(null);
  const [humanize, setHumanize] = useState(false);
  const [sounds, setSounds] = useState(() => readLocal("ff-sounds", true));
  const [catalog, setCatalog] = useState(catalogFallback);
  const [marketStatus, setMarketStatus] = useState("");
  const [marketStats, setMarketStats] = useState(() => readLocal("ff-market-stats", {}));
  const [marketSearch, setMarketSearch] = useState("");
  const [installCandidate, setInstallCandidate] = useState(null);
  const [reportItem, setReportItem] = useState(null);
  const [scanStep, setScanStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const runner = useRef(null);
  const session = useRef(null);
  const runBusy = useRef(false);
  const fileRef = useRef(null);
  const vision = useRef(new Vision());
  const audio = useRef(new AudioFeedback());
  const native = isTauri();
  const locked = Boolean(selected?.locked);
  const focused = path && macro ? get(macro, path) : null;
  const installed = (item) => custom.some((entry) => entry.sourceId === item.id);
  const aiInstalled = custom.some((entry) => entry.sourceId === "local-ai-suite");
  const record = (kind, message) => {
    setStatus(message);
    setLogs((current) => [...current.slice(-199), { time: formatTime(), kind, message }]);
  };

  useEffect(() => { setMacro(selected ? clone(selected.macro) : null); setPath(null); setBuilderPane("blocks"); }, [id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1c1c1e" : "#f5f5f7");
    localStorage.setItem("ff-theme", JSON.stringify(theme));
  }, [theme]);
  useEffect(() => { localStorage.setItem("ff-macros", JSON.stringify(custom)); }, [custom]);
  useEffect(() => { localStorage.setItem("ff-market-stats", JSON.stringify(marketStats)); }, [marketStats]);
  useEffect(() => { audio.current.enabled = sounds; localStorage.setItem("ff-sounds", JSON.stringify(sounds)); }, [sounds]);
  useEffect(() => {
    refreshWindows();
    const abort = new AbortController();
    fetch(`https://api.github.com/repos/${config.repository}/releases/latest`, { signal: abort.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((release) => {
        const latest = release.tag_name?.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
        if (!latest) return;
        const a = latest.slice(1).map(Number), b = config.version.split(".").map(Number);
        for (let i = 0; i < 3; i++) { if (a[i] > b[i]) { setUpdated(release.tag_name); break; } if (a[i] < b[i]) break; }
      }).catch(() => {});
    return () => {
      abort.abort(); runner.current?.stop();
      if (native) { invoke("stop").catch(() => {}); invoke("ai_unload").catch(() => {}); }
      vision.current.dispose();
      audio.current.dispose();
    };
  }, []);

  async function refreshWindows() {
    if (!native) return;
    try {
      const found = await invoke("list_windows");
      setWindows(found);
      setTarget((current) => current === "global" || found.some((w) => w.id === current) ? current : "global");
    } catch (error) { record("error", String(error)); }
  }
  function mutate(fn) {
    if (!macro || locked || running) return;
    const copy = clone(macro); fn(copy); setMacro(copy);
  }
  function save() {
    try {
      if (!macro) throw new Error("Create or install a macro first");
      validateMacro(macro);
      if (locked) return record("warning", "Duplicate the locked starter to edit it.");
      if (starters.some((entry) => entry.id === id)) return duplicate(macro, `${macro.name} custom`);
      setCustom((entries) => entries.map((entry) => entry.id === id ? { ...entry, name: macro.name, macro: clone(macro) } : entry));
      record("success", "Saved in your local library");
    } catch (error) { record("error", error.message); }
  }
  function duplicate(source = macro, name = `${source.name} copy`) {
    const copy = { ...clone(source), name };
    const entry = { id: crypto.randomUUID(), name, macro: copy };
    setCustom((entries) => [...entries, entry]); setId(entry.id); setView("builder");
    record("success", "Created an editable macro");
  }
  function create() {
    const macro = { version: 1, name: "Untitled flow", vars: {}, blocks: [] };
    const entry = { id: crypto.randomUUID(), name: macro.name, macro };
    setCustom((entries) => [...entries, entry]); setId(entry.id); setView("builder");
    record("success", "New flow created");
  }
  function deleteSelected() {
    if (!selected || selected.locked || running) return;
    const next = custom.filter((entry) => entry.id !== id);
    setCustom(next); setId(next[0]?.id ?? null);
    record("info", "Macro removed from your library");
  }
  async function imported(file) {
    try {
      if (!file || file.size > 262144) throw new Error("Choose a JSON macro under 256 KB");
      const importedMacro = parseMacro(await file.text());
      const entry = { id: crypto.randomUUID(), name: importedMacro.name, macro: importedMacro };
      setCustom((entries) => [...entries, entry]); setId(entry.id); setView("builder");
      record("warning", "Imported. Review each block before running.");
    } catch (error) { record("error", error.message); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }
  function makeBlock(copy, type) {
    const block = clone(defaults[type]);
    if (["setVar", "math", "while", "ifCompare"].includes(type)) {
      copy.vars ??= {};
      if (!Object.keys(copy.vars).length) copy.vars.counter = 0;
      block.name = Object.keys(copy.vars)[0];
    }
    return block;
  }
  function add(listPath, type) { mutate((copy) => get(copy, listPath).push(makeBlock(copy, type))); }
  function remove(blockPath) {
    mutate((copy) => get(copy, blockPath.slice(0, -1)).splice(blockPath.at(-1), 1)); setPath(null);
  }
  function reorder(blockPath, offset) {
    mutate((copy) => {
      const list = get(copy, blockPath.slice(0, -1)), from = blockPath.at(-1), to = from + offset;
      if (to >= 0 && to < list.length) [list[from], list[to]] = [list[to], list[from]];
    }); setPath(null);
  }
  function dropBlock(listPath, index, data) {
    mutate((copy) => {
      const list = get(copy, listPath);
      if (data.type === "palette" && Object.hasOwn(defaults, data.block)) list.splice(index, 0, makeBlock(copy, data.block));
      if (data.type === "existing" && Array.isArray(data.path)) {
        const sourcePath = data.path;
        if (listPath.length >= sourcePath.length && sourcePath.every((key, i) => listPath[i] === key)) return;
        const source = get(copy, sourcePath.slice(0, -1));
        const sourceIndex = sourcePath.at(-1);
        const [block] = source.splice(sourceIndex, 1);
        if (block) list.splice(source === list && sourceIndex < index ? index - 1 : index, 0, block);
      }
    }); setPath(null);
  }
  function updateStat(itemId, patch) { setMarketStats((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } })); }
  async function loadMarketplace() {
    setMarketStatus("Refreshing catalog…");
    try {
      const response = await fetch(catalogUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not refresh the catalog");
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.items)) throw new Error("Unsupported catalog format");
      const vetted = data.items.filter((item) => typeof item.id === "string" && typeof item.name === "string" &&
        typeof item.category === "string" && typeof item.description === "string" &&
        typeof item.url === "string" && new URL(item.url).origin === new URL(marketplaceUrl).origin &&
        new URL(item.url).pathname.startsWith(new URL("macros/", marketplaceUrl).pathname));
      if (!vetted.length) throw new Error("No valid macro listings");
      setCatalog(vetted); setMarketStatus("");
    } catch (error) { setMarketStatus(`${error.message}. Showing built-in listings.`); setCatalog(catalogFallback); }
  }
  async function prepareInstall(item) {
    setBusy(true); setMarketStatus(`Checking ${item.name}…`);
    try {
      const url = new URL(item.url);
      if (url.origin !== new URL(marketplaceUrl).origin || !url.pathname.startsWith(new URL("macros/", marketplaceUrl).pathname))
        throw new Error("Macro URL is outside the trusted catalog path");
      const response = await fetch(url.href, { cache: "no-store" });
      if (!response.ok) throw new Error("Macro download failed");
      const raw = await response.text();
      const checked = parseMacro(raw);
      setInstallCandidate({ item, macro: checked }); setScanStep(0); setMarketStatus("");
    } catch (error) { record("error", error.message); setMarketStatus(error.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!installCandidate) return;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setScanStep(step);
      if (step === 3) clearInterval(timer);
    }, 350);
    return () => clearInterval(timer);
  }, [installCandidate]);
  useEffect(() => {
    if (!installCandidate && !reportItem) return;
    const onEscape = (event) => {
      if (event.key === "Escape") { setInstallCandidate(null); setReportItem(null); }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [installCandidate, reportItem]);
  function finishInstall() {
    if (!installCandidate || scanStep < 3) return;
    const { item, macro: checked } = installCandidate;
    const entry = { id: crypto.randomUUID(), name: checked.name, sourceId: item.id, locked: item.id === "roblox-afk", macro: checked };
    setCustom((entries) => [...entries, entry]); setId(entry.id);
    updateStat(item.id, { downloads: (marketStats[item.id]?.downloads ?? 0) + 1 });
    setInstallCandidate(null); setView("builder");
    record("warning", `${checked.name} installed. Review the blocks before running.`);
  }
  async function stop() {
    runner.current?.stop(); record("warning", "Stopping input…");
    if (native) await invoke("stop").catch(() => {});
    if (runner.current?.options.ai?.ready) invoke("ai_unload").catch(() => {});
  }
  const localAI = () => new LocalAI({
    prepare: () => invoke("ai_prepare"),
    generate: (request) => invoke("ai_generate", { request }),
    unload: () => invoke("ai_unload"),
  }, (message) => record("info", message));
  async function generateFlow(goal) {
    if (!native || !aiInstalled || running || aiBusy) return;
    setAiBusy(true);
    const ai = localAI();
    try {
      if (!goal.trim() || goal.length > 500) throw new Error("Describe your goal in 1–500 characters");
      const created = await ai.generateMacro(goal);
      const entry = { id: crypto.randomUUID(), name: created.name, macro: created };
      setCustom((entries) => [...entries, entry]); setId(entry.id); setBuilderPane("blocks");
      record("warning", "Generated flow added. Review every block before running.");
    } catch (error) { record("error", String(error.message ?? error)); }
    finally { await ai.unload().catch(() => {}); setAiBusy(false); }
  }
  async function run() {
    if (runBusy.current) return;
    audio.current.activate();
    runBusy.current = true; setView("run");
    try {
      validateMacro(macro);
      if (!native) throw new Error("Input is available in the Windows desktop app.");
      setRunning(true);
      session.current = await invoke("begin", { target: target === "global" ? null : target });
      const bridge = {
        position: (screen) => invoke("position", { session: session.current, screen }),
        check: () => invoke("check", { session: session.current }),
        input: (event) => invoke("input", { session: session.current, event }),
        capture: () => invoke("capture", { session: session.current }),
        release: () => invoke("stop"),
      };
      runner.current = new Runner(bridge, vision.current, (type) => {
        setStep(labels[type]); setLogs((entries) => [...entries.slice(-199), { time: formatTime(), kind: "step", message: labels[type] }]);
        if (["click", "key", "keyChord"].includes(type)) audio.current.play("tick");
      }, { humanize, ai: localAI(), onAIStatus: (message) => record("info", message),
        onMatch: (type, hit) => record("success", `${labels[type]} matched at ${hit.x}, ${hit.y}${hit.confidence == null ? "" : ` · ${hit.confidence}% confidence`}`),
        onVariable: (name, value) => setLogs((entries) => [...entries.slice(-199), { time: formatTime(), kind: "step", message: `${name} = ${value}` }]) });
      record("info", `Starting ${macro.name} in 3 seconds · F7 to stop`);
      let focusWarning = false;
      const heartbeat = setInterval(() => bridge.check().catch((error) => {
        if (focusWarning) return;
        focusWarning = true;
        runner.current?.stop(); record("warning", String(error));
      }), 250);
      try { await runner.current.run(clone(macro)); record("success", "Flow finished"); audio.current.play("success"); }
      finally { clearInterval(heartbeat); }
    } catch (error) { record("error", String(error.message ?? error)); audio.current.play("error"); }
    finally {
      if (native) await invoke("stop").catch(() => {});
      runner.current = null; runBusy.current = false; setRunning(false); setStep("");
    }
  }
  function selectMacro(nextId) { if (!running) { setId(nextId); setView("builder"); } }
  async function windowControl(action) {
    if (!native) return;
    try { await getCurrentWindow()[action](); }
    catch (error) { record("error", `Window control failed: ${error}`); }
  }
  const actions = { macro, locked, running, path, focused, setPath, mutate, save, duplicate, remove, reorder, add, dropBlock, deleteSelected, record,
    builderPane, setBuilderPane, run, create, fileRef, imported, id, selected, aiInstalled, aiBusy, generateFlow, native };
  return (
    <div className="studio">
      <div className="windowbar"><div className="window-drag" data-tauri-drag-region onDoubleClick={() => windowControl("toggleMaximize")}
        aria-label="Drag Flowforge Studio window"><img src={logoUrl} alt="" /><span>Flowforge Studio</span><i className={`status-dot ${running ? "live" : ""}`} /></div>
        <div className="window-controls" aria-label="Window controls">
          <button title="Minimize" aria-label="Minimize window" disabled={!native} onClick={() => windowControl("minimize")}><Minus size={15} /></button>
          <button title="Maximize or restore" aria-label="Maximize or restore window" disabled={!native} onClick={() => windowControl("toggleMaximize")}><Maximize2 size={13} /></button>
          <button className="window-close" title="Close" aria-label="Close window" disabled={!native} onClick={() => windowControl("close")}><X size={15} /></button>
        </div></div>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("builder")} aria-label="Flowforge Studio home">
          <span className="brandmark"><img src={logoUrl} alt="" /></span><span>flowforge</span><small>STUDIO</small>
        </button>
        <div className="side-label">WORKSPACE <button title="New macro" disabled={running} onClick={create}><Plus size={16} /></button></div>
        <nav className="side-nav" aria-label="Studio views">
          <button className={`navitem ${view === "builder" ? "active" : ""}`} onClick={() => setView("builder")}><Layers size={18} /> My Macros <span>{all.length}</span></button>
          <button className={`navitem ${view === "marketplace" ? "active" : ""}`} onClick={() => { setView("marketplace"); loadMarketplace(); }}><Store size={18} /> Marketplace</button>
          <button className={`navitem ${view === "run" ? "active" : ""}`} onClick={() => setView("run")}><Activity size={18} /> Run & Logs {running && <i className="status-dot live" />}</button>
        </nav>
        <div className="side-label library-title">YOUR LIBRARY</div>
        <div className="macrolist" aria-label="Saved macros">
          {!all.length && <p className="library-empty">No macros yet. Create one or explore the marketplace.</p>}
          {all.map((entry) => <button key={entry.id} className={id === entry.id ? "selected" : ""} disabled={running}
            onClick={() => selectMacro(entry.id)}><span className={`miniicon ${colors[entry.macro.blocks[0]?.type] ?? "blue"}`}>
              {entry.id === "ad-skipper" ? <ScanLine size={15} /> : <Layers size={15} />}</span><span>{entry.name}</span>{entry.locked && <Lock size={12} />}</button>)}
        </div>
        <button className="importnav" disabled={running} onClick={() => fileRef.current?.click()}><Upload size={16} /> Import JSON macro</button>
        <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={(event) => imported(event.target.files?.[0])} />
        <div className="sidebarfoot"><ShieldCheck size={19} /><div><strong>Always in control.</strong><p>Local macros · F7 emergency stop</p></div>
          <button aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="crumb">FLOWFORGE <ChevronRight size={13} /> {view === "builder" ? "MY MACROS" : view === "marketplace" ? "MARKETPLACE" : "RUN & LOGS"}</div>
          <div className="headerstatus"><i className={`status-dot ${running ? "live" : ""}`} /> {running ? "Running" : "Ready"} <span>v{config.version}</span></div></header>
        {!native && <div className="notice">Browser preview · Window capture and input require the Windows app.</div>}
        {updated && <div className="notice">Version {updated} is available. <a href={`https://github.com/${config.repository}/releases/latest`} target="_blank" rel="noreferrer">View release ↗</a></div>}
        <div className="view-frame" key={view}>
          {view === "builder" && (macro ? <BuilderView {...actions} /> : <EmptyBuilder create={create} openMarket={() => { setView("marketplace"); loadMarketplace(); }} importFile={() => fileRef.current?.click()} />)}
          {view === "marketplace" && <MarketplaceView catalog={catalog} marketStatus={marketStatus} marketSearch={marketSearch} setMarketSearch={setMarketSearch}
            stats={marketStats} updateStat={updateStat} prepareInstall={prepareInstall} installed={installed} busy={busy} loadMarketplace={loadMarketplace} setReportItem={setReportItem} />}
          {view === "run" && <RunView macro={macro} windows={windows} target={target} setTarget={setTarget} refreshWindows={refreshWindows}
            humanize={humanize} setHumanize={setHumanize} sounds={sounds} setSounds={setSounds} activateSound={() => { audio.current.enabled = true; audio.current.activate(); }}
            running={running} run={run} stop={stop} status={status} step={step} logs={logs} native={native} />}
        </div>
        <div role="status" className="statusbar"><i className={`status-dot ${running ? "live" : ""}`} /> {status}<span>{step}</span></div>
      </main>
      {installCandidate && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInstallCandidate(null)}>
        <dialog open aria-modal="true" aria-labelledby="scan-title" className="modal-card"><button className="modal-close" aria-label="Close" onClick={() => setInstallCandidate(null)}><X size={18} /></button>
          <div className="featureicon blue"><ShieldCheck size={23} /></div><small>MACRO REVIEW</small><h2 id="scan-title">Check before installing.</h2><p><strong>{installCandidate.item.name}</strong> contains {installCandidate.macro.blocks.length} top-level block(s).</p>
          {["JSON and schema validated", "Only supported declarative actions", "Animated review complete"].map((label, index) =>
            <div className="checkrow" key={label}><span>{scanStep > index ? <Check size={15} /> : "···"}</span>{label}</div>)}
          <p className="modal-note">The animation simulates a security review. It cannot certify a macro as safe. Inspect its blocks before running.</p>
          <button className="primary" disabled={scanStep < 3} onClick={finishInstall}>Install to my library</button>
        </dialog></div>}
      {reportItem && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setReportItem(null)}>
        <dialog open aria-modal="true" aria-labelledby="report-title" className="modal-card"><button className="modal-close" aria-label="Close" onClick={() => setReportItem(null)}><X size={18} /></button>
          <div className="featureicon peach"><Flag size={22} /></div><h2 id="report-title">Report {reportItem.name}</h2><p>Describe the issue. Reports are stored on this device; no shared moderation service is connected.</p>
          <form onSubmit={(event) => { event.preventDefault(); updateStat(reportItem.id, { report: new FormData(event.currentTarget).get("reason") }); setReportItem(null); record("info", "Local report saved"); }}>
            <textarea required name="reason" minLength={10} maxLength={1000} placeholder="What looks suspicious?" /><button className="primary">Save local report</button></form>
        </dialog></div>}
    </div>
  );
}

function EmptyBuilder({ create, openMarket, importFile }) {
  return <section className="empty-builder" aria-label="Empty macro workspace"><div className="empty-orbit"><img src={logoUrl} alt="" /></div>
    <small>YOUR WORKSPACE</small><h1>A blank canvas. All yours.</h1><p>Create a flow from blocks, import your JSON, or bring one in from the community. Nothing is preinstalled.</p>
    <div className="empty-actions"><button className="primary" onClick={create}><Plus size={16} /> Create a macro</button>
      <button className="secondary" onClick={openMarket}><Store size={16} /> Browse marketplace</button>
      <button className="ghost" onClick={importFile}><Upload size={16} /> Import JSON</button></div></section>;
}
function BuilderView({ macro, locked, running, path, focused, setPath, mutate, save, duplicate, remove, reorder, add, dropBlock, deleteSelected, record, builderPane, setBuilderPane, run, id, selected, aiInstalled, aiBusy, generateFlow, native }) {
  const clicker = id === "auto-clicker" || selected.sourceId === "auto-clicker";
  const [variableName, setVariableName] = useState("");
  const [variableInitial, setVariableInitial] = useState("0");
  const [aiGoal, setAiGoal] = useState("");
  const variables = macro.vars ?? {};
  function addVariable(event) {
    event.preventDefault();
    const name = variableName.trim(), initial = Number(variableInitial);
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name) || Object.hasOwn(variables, name) || Object.keys(variables).length >= 32 ||
      !Number.isFinite(initial) || Math.abs(initial) > 1000000000) return record("error", "Use a unique variable name and a finite initial value");
    mutate((copy) => { copy.vars ??= {}; copy.vars[name] = initial; });
    setVariableName(""); setVariableInitial("0");
    record("success", `Variable ${name} created`);
  }
  function deleteVariable(name) {
    const uses = (blocks) => blocks.some((block) => block.name === name || block.operand === name || block.value === name ||
      ["body", "then", "else"].some((branch) => Array.isArray(block[branch]) && uses(block[branch])));
    if (uses(macro.blocks)) return record("error", `Remove blocks using ${name} before deleting it`);
    mutate((copy) => { delete copy.vars[name]; });
  }
  async function uploadTemplate(file) {
    if (!file || !path) return;
    try {
      if (!file.type.startsWith("image/") || file.size > 262144) throw new Error("Choose an image under 256 KB");
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 128 || bitmap.height > 128 || !bitmap.width || !bitmap.height) { bitmap.close(); throw new Error("Crop the template to 128 × 128 pixels or smaller"); }
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!pixels.some((channel, i) => i % 4 === 3 && channel >= 128)) throw new Error("The template has no visible pixels");
      const data = canvas.toDataURL("image/png");
      if (data.length > 200000) throw new Error("Compressed template exceeds 150 KB");
      const selectedPath = [...path];
      mutate((copy) => { const block = get(copy, selectedPath); if (block.type === "findImage") block.template = data; });
      record("success", `Template ready · ${canvas.width} × ${canvas.height} pixels`);
    } catch (error) { record("error", error.message); }
  }
  return <section className="builder-view" aria-label="Visual macro builder">
    <div className="view-heading"><div><small>VISUAL AUTOMATION</small><input className="flowname" aria-label="Macro name" disabled={locked || running} value={macro.name}
      onChange={(event) => mutate((copy) => { copy.name = event.target.value; })} /><p>{locked ? "Locked starter · duplicate to make changes" : "Create your workflow, block by block."}</p></div>
      <div className="heading-actions"><button className="ghost" title="Duplicate macro" disabled={running} onClick={() => duplicate()}><Copy size={16} /> Duplicate</button>
        <button className="ghost" title="Export JSON" onClick={() => downloadJSON(macro)}><Download size={16} /> Export</button>
        <button className="ghost" title="Save macro" disabled={locked || running} onClick={save}><Save size={16} /> Save</button>
        {!locked && <button className="ghost danger" title="Delete macro" disabled={running} onClick={deleteSelected}><Trash2 size={16} /> Delete</button>}
        <button className="primary" onClick={run} disabled={running}><Play size={15} fill="currentColor" /> Run flow</button></div></div>
    <div className="builder-tabs"><button className={builderPane === "blocks" ? "selected" : ""} onClick={() => setBuilderPane("blocks")}>Block builder</button>
      <button className={builderPane === "variables" ? "selected" : ""} onClick={() => setBuilderPane("variables")}>Variables <span>{Object.keys(variables).length}</span></button>
      {aiInstalled && <button className={builderPane === "ai" ? "selected" : ""} onClick={() => setBuilderPane("ai")}>AI Generator</button>}
      {clicker && <button className={builderPane === "clicker" ? "selected" : ""} onClick={() => setBuilderPane("clicker")}>Clicker settings</button>}</div>
    {builderPane === "variables" ? <div className="variable-panel surface"><small>INITIAL VALUES</small><h2>Variables & counters</h2><p>Set starting values here. Set and Math blocks update them as a flow runs.</p>
      <div className="variable-list">{Object.entries(variables).map(([name, value]) => <label key={name}><code>{name}</code><input type="number" aria-label={`Initial value for ${name}`} disabled={locked || running}
        value={value} onChange={(event) => mutate((copy) => { copy.vars[name] = Number(event.target.value); })} /><button aria-label={`Delete ${name}`} disabled={locked || running} onClick={() => deleteVariable(name)}><Trash2 size={15} /></button></label>)}</div>
      {!Object.keys(variables).length && <p className="variable-empty">No variables. Create a counter to use it in math and condition blocks.</p>}
      <form onSubmit={addVariable}><input aria-label="Variable name" placeholder="Variable name" value={variableName} disabled={locked || running} onChange={(event) => setVariableName(event.target.value)} />
        <input aria-label="Initial value" type="number" value={variableInitial} disabled={locked || running} onChange={(event) => setVariableInitial(event.target.value)} />
        <button className="secondary" disabled={locked || running}><Plus size={15} /> Add variable</button></form></div> :
    builderPane === "ai" && aiInstalled ? <div className="ai-panel surface"><span className="featureicon blue"><ScanLine size={24} /></span>
      <small>LOCAL AI · QWEN2.5-VL 3B</small><h2>Describe a flow.</h2><p>Turn a plain-language goal into a validated block tree. The model loads only when you generate or run an AI block, then unloads. Ollama must be installed and running; the model downloads on first use.</p>
      <form onSubmit={(event) => { event.preventDefault(); generateFlow(aiGoal); }}><label htmlFor="ai-goal">WHAT SHOULD THIS FLOW DO?</label>
        <textarea id="ai-goal" minLength={3} maxLength={500} required value={aiGoal} onChange={(event) => setAiGoal(event.target.value)} placeholder="Find the sound settings, then turn the volume off" />
        <button className="primary" disabled={!native || aiBusy || running || !aiGoal.trim()}>{aiBusy ? "Preparing local model…" : "Generate blocks"}</button></form>
      <p className="ai-disclosure">AI can misread screens or propose the wrong action. Review each generated block before running. Screenshots are sent only to Ollama at 127.0.0.1.</p></div> :
    builderPane === "clicker" && clicker ? <div className="clickersettings surface"><span className="featureicon peach"><MousePointer2 size={25} /></span><h2>Auto-Clicker</h2>
      <p>Choose the mouse button and delay between clicks. Save creates an editable copy.</p>
      <label>Click interval (milliseconds)<input type="number" min="10" max="3600000" disabled={running || locked} value={macro.blocks[0]?.body?.[1]?.ms ?? 100}
        onChange={(event) => mutate((copy) => { copy.blocks[0].body[1].ms = Number(event.target.value); })} /></label>
      <label>Mouse button<select disabled={running || locked} value={macro.blocks[0]?.body?.[0]?.button ?? "left"}
        onChange={(event) => mutate((copy) => { copy.blocks[0].body[0].button = event.target.value; })}><option value="left">Left button</option><option value="right">Right button</option></select></label>
      <button className="secondary" onClick={save}>{id === "auto-clicker" ? "Save configured copy" : "Save changes"}</button></div> :
      <div className="builder-grid surface"><div className="palette"><small>BLOCK LIBRARY</small>
        <div className="palette-group"><strong>CONTROL</strong>{["loop", "while", "ifFound", "ifCompare", "break", "continue", "wait"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        <div className="palette-group"><strong>VARIABLES</strong>{["setVar", "math"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        <div className="palette-group"><strong>INPUT & ACTIONS</strong>{["move", "click", "key", "keyChord", "text", "drag"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        <div className="palette-group"><strong>VISION</strong>{["findText", "findColor", "findImage", "checkPixel"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        {aiInstalled && <div className="palette-group"><strong>LOCAL AI</strong>{["aiNavigate", "aiIf"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>}
        <p>Drag into any list to nest blocks, or click to append.</p></div>
        <div className="canvas"><div className="canvaslabel"><i className="status-dot live" /> WHEN FLOW STARTS <span>{locked ? <><Lock size={12} /> LOCKED</> : "EDITABLE FLOW"}</span></div>
          <BlockList list={macro.blocks} listPath={["blocks"]} chosen={path} select={setPath} add={add} remove={remove} reorder={reorder} dropBlock={dropBlock} disabled={locked || running} />
          <div className="canvasfoot"><ShieldCheck size={15} /> F7 stops input instantly · target focus is checked continuously</div></div>
        <div className="inspector"><small>BLOCK SETTINGS</small><h3>{focused ? labels[focused.type] : "Select a block"}</h3>
          {focused ? <><div className="inspector-fields">{Object.entries(focused).filter(([key, value]) => key !== "type" && key !== "template" && !Array.isArray(value)).map(([key, value]) =>
            <label key={key}>{key.replace(/([A-Z])/g, " $1")}{typeof value === "boolean" ? <input type="checkbox" disabled={locked || running} checked={value}
              onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.checked; })} /> : key === "name" ?
              <select disabled={locked || running} value={value} onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.value; })}>{Object.keys(variables).map((name) => <option key={name} value={name}>{name}</option>)}</select> : key === "operator" ?
              <select disabled={locked || running} value={value} onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.value; })}>{(focused.type === "math" ? ["+", "-", "*", "/"] : ["==", "!=", "<", "<=", ">", ">="]).map((op) => <option key={op} value={op}>{op}</option>)}</select> : key === "mode" ?
              <select disabled={locked || running} value={value} onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.value; })}><option value="while">While true</option><option value="until">Until true</option></select> : key === "button" ?
              <select disabled={locked || running} value={value} onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.value; })}><option value="left">Left</option><option value="right">Right</option></select> :
              <input disabled={locked || running} type={typeof value === "number" ? "number" : key === "color" ? "color" : "text"} value={value}
                onChange={(event) => mutate((copy) => { get(copy, path)[key] = typeof value === "number" ? Number(event.target.value) : event.target.value; })} />}</label>)}</div>
            {focused.type === "findImage" && <div className="template-field"><label className="secondary" htmlFor="template-upload"><ImageIcon size={15} /> {focused.template ? "Replace image" : "Upload image template"}</label>
              <input id="template-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked || running} onChange={(event) => { uploadTemplate(event.target.files?.[0]); event.target.value = ""; }} />
              {focused.template && <img src={focused.template} alt="Template preview" />}
              <p>Crop tightly around the object. Maximum 128 × 128 pixels. The match uses the template's original size.</p></div>}
            {focused.type === "loop" && <p>0 repeats indefinitely. Set a positive count for a finite loop.</p>}
            {["break", "continue"].includes(focused.type) && <p>Place this block inside a Repeat or While/Until body. It affects the nearest enclosing loop.</p>}
            {["math", "setVar", "while", "ifCompare"].includes(focused.type) && <p>Operands accept numbers or the name of another variable. Edit starting values in the Variables tab.</p>}
            {focused.type === "move" && <p>Smooth movement eases between endpoints. Duration is in milliseconds; humanization adds small path and timing variation.</p>}
            {focused.type === "keyChord" && <p>Separate simultaneous keys with +, for example w+Shift.</p>}
            {focused.type.startsWith("ai") && <p>Runs on your local Ollama model when this block executes. Choose a target window; the agent is limited to 20 steps and stops on focus loss or F7.</p>}
            {focused.type.startsWith("find") && <p>Scans visible pixels. The interval defaults to 500 ms; recognition may take longer.</p>}</> : <p>Choose a block to edit its values. Drag blocks into the canvas and nested branches.</p>}
          <div className="inspector-foot"><ShieldCheck size={20} /><strong>Your desktop stays yours.</strong><p>Input stops when the chosen window loses focus.</p></div></div></div>}
  </section>;
}
function PaletteBlock({ type, disabled, add }) {
  return <button className={`paletteblock ${colors[type]}`} disabled={disabled} draggable={!disabled}
    onDragStart={(event) => event.dataTransfer.setData("application/x-flowforge", JSON.stringify({ type: "palette", block: type }))}
    onClick={() => add(["blocks"], type)}><GripVertical size={13} /><span>{labels[type]}</span><Plus size={14} /></button>;
}
function MarketplaceView({ catalog, marketStatus, marketSearch, setMarketSearch, stats, updateStat, prepareInstall, installed, busy, loadMarketplace, setReportItem }) {
  const visible = catalog.filter((item) => item.name.toLowerCase().includes(marketSearch.toLowerCase()) || item.category.toLowerCase().includes(marketSearch.toLowerCase()));
  return <section className="marketplace-view" aria-label="Community marketplace"><div className="view-heading"><div><small>COMMUNITY TOOLBOX</small><h1>Find your next flow.</h1>
    <p>Explore macros and install them directly into your local library.</p></div><a className="ghost" href={marketplaceUrl} target="_blank" rel="noreferrer">Marketplace website <ExternalLink size={15} /></a></div>
    <div className="market-toolbar"><div className="search"><Search size={17} /><input aria-label="Search marketplace" placeholder="Search macros…" value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} /></div>
      <button className="ghost" onClick={loadMarketplace}><RefreshCw size={15} /> Refresh</button></div>
    {marketStatus && <div className="notice-inline" role="status">{marketStatus}</div>}
    <div className="market-grid">{visible.map((item, index) => { const value = stats[item.id] ?? {};
      return <article className="market-card surface" key={item.id}><div className="market-card-top"><span className={`featureicon ${["blue", "mint", "lavender"][index % 3]}`}>{item.id === "ad-skipper" ? <ScanLine size={23} /> : item.id === "auto-clicker" ? <MousePointer2 size={23} /> : <Layers size={23} />}</span>
        <span className="category">{item.id === "roblox-afk" && <Lock size={11} />} {item.category}</span></div><h2>{item.name}</h2><p>{item.description}</p>
        <div className="market-meta"><span><Download size={13} /> {value.downloads ?? 0} local installs</span><span><Star size={13} /> {value.rating ? `${value.rating}/5` : "Unrated"}</span></div>
        <div className="market-actions"><button className="primary" disabled={busy} onClick={() => prepareInstall(item)}><Download size={15} /> {installed(item) ? "Install another copy" : "Install macro"}</button>
          <button aria-label={`Thumbs up ${item.name}`} aria-pressed={value.vote === 1} onClick={() => updateStat(item.id, { vote: value.vote === 1 ? 0 : 1 })}><ThumbsUp size={16} /></button>
          <button aria-label={`Thumbs down ${item.name}`} aria-pressed={value.vote === -1} onClick={() => updateStat(item.id, { vote: value.vote === -1 ? 0 : -1 })}><ThumbsDown size={16} /></button>
          <button aria-label={`Report ${item.name}`} onClick={() => setReportItem(item)}><Flag size={16} /></button></div>
        <div className="rating"><span>Your rating</span>{[1, 2, 3, 4, 5].map((star) => <button key={star} aria-label={`Rate ${item.name} ${star} stars`} onClick={() => updateStat(item.id, { rating: star })}><Star size={14} fill={star <= (value.rating ?? 0) ? "currentColor" : "none"} /></button>)}</div></article>;
    })}</div>{!visible.length && <div className="empty-state">No matching macros. Try another search.</div>}
    <p className="market-disclosure"><ShieldCheck size={14} /> Counts, ratings, votes, and reports are local to this device. Shared community services are not connected.</p></section>;
}
function RunView({ macro, windows, target, setTarget, refreshWindows, humanize, setHumanize, sounds, setSounds, activateSound, running, run, stop, status, step, logs, native }) {
  const logEnd = useRef(null);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: "end" }); }, [logs]);
  return <section className="run-view" aria-label="Run and execution dashboard"><div className="view-heading"><div><small>LIVE CONTROL CENTER</small><h1>Run with confidence.</h1><p>Choose a target, monitor each step, and stop at any time.</p></div>
    <span className={`run-badge ${running ? "running" : ""}`}><i className={`status-dot ${running ? "live" : ""}`} /> {running ? "Running" : "Idle"}</span></div>
    <div className="run-grid"><div className="run-controls surface"><h2>Execution settings</h2><p>Selected flow: <strong>{macro?.name ?? "No macro selected"}</strong></p>
      <label htmlFor="target-window">TARGET WINDOW</label><div className="target-select"><select id="target-window" disabled={running} value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="global">Global Desktop Input</option>{windows.map((window) => <option key={window.id} value={window.id}>{window.title} · PID {window.pid}</option>)}</select>
        <button aria-label="Refresh windows" title="Refresh windows" disabled={running} onClick={refreshWindows}><RefreshCw size={16} /></button></div>
      <div className="safety-note"><ShieldCheck size={19} /><div><strong>{target === "global" ? "Global mode" : "Focus protection active"}</strong><p>{target === "global" ? "Input can reach your entire desktop. Choose a window for focus protection." : "Input stops as soon as this window loses focus."}</p></div></div>
      <label className="toggle-row"><input type="checkbox" disabled={running} checked={humanize} onChange={(event) => setHumanize(event.target.checked)} /><span>Vary timing and mouse path slightly</span></label>
      <label className="toggle-row"><Volume2 size={17} /><input type="checkbox" checked={sounds} onChange={(event) => { if (event.target.checked) activateSound(); setSounds(event.target.checked); }} /><span>Subtle action and event sounds</span></label>
      <div className="run-buttons">{running ? <button className="stop" onClick={stop}><Square size={16} fill="currentColor" /> Stop · F7</button> : <button className="primary" onClick={run} disabled={!native || !macro}><Play size={16} fill="currentColor" /> Start flow</button>}</div>
      <p className="shortcut">F7 · Emergency stop from anywhere</p></div>
      <div className="run-monitor surface"><div className="monitor-header"><div><small>LIVE ACTIVITY</small><h2>Execution log</h2></div><span>{step || status}</span></div>
        <div className="terminal" role="log" aria-live="polite">{logs.map((entry, index) => <div className={`log-line ${entry.kind}`} key={`${entry.time}-${index}`}><time>{entry.time}</time><span>{entry.kind.toUpperCase()}</span><p>{entry.message}</p></div>)}<div ref={logEnd} /></div></div></div></section>;
}
function BlockList({
  list,
  listPath,
  chosen,
  select,
  add,
  remove,
  reorder,
  dropBlock,
  disabled,
}) {
  const props = { chosen, select, add, remove, reorder, dropBlock, disabled };
  const [over, setOver] = useState(false);
  return (
    <div
      className={"blocklist " + (over ? "dragover" : "")}
      onDragOver={(e) => {
        if (!disabled) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData("application/x-flowforge"));
          if (!disabled) dropBlock(listPath, list.length, data);
        } catch { setOver(false); }
      }}
    >
      {list.map((b, i) => {
        const path = [...listPath, i],
          active = JSON.stringify(chosen) === JSON.stringify(path);
        return (
          <React.Fragment key={JSON.stringify(path)}>
          <div className="insert-slot" aria-label={`Drop block before ${labels[b.type]}`}
            onDragOver={(event) => { if (!disabled) { event.preventDefault(); event.stopPropagation(); } }}
            onDrop={(event) => { event.preventDefault(); event.stopPropagation();
              try { if (!disabled) dropBlock(listPath, i, JSON.parse(event.dataTransfer.getData("application/x-flowforge"))); } catch {} }} />
          <div
            className={
              "flowblock " + colors[b.type] + (active ? " chosen" : "")
            }
          >
            <div className="blockheading">
              <button className="blockselect" onClick={() => select(path)}>
                <span className="draghandle" draggable={!disabled} aria-label="Drag block"
                  onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData("application/x-flowforge", JSON.stringify({ type: "existing", path })); }}><GripVertical size={13} /></span>
                <b>{labels[b.type]}</b>
                <span>
                  {b.type === "wait"
                    ? `${b.ms} ms ± ${b.jitter}`
                    : b.type === "loop"
                      ? b.count === 0
                        ? "until stopped"
                        : `${b.count} times`
                      : b.type === "while"
                        ? `${b.mode} ${b.name} ${b.operator} ${b.operand}`
                      : b.type === "ifCompare"
                        ? `${b.name} ${b.operator} ${b.operand}`
                      : b.type === "setVar"
                        ? `${b.name} = ${b.value}`
                      : b.type === "aiNavigate"
                        ? `${b.maxSteps} steps · ${b.goal.slice(0, 35)}`
                      : b.type === "aiIf"
                        ? b.prompt.slice(0, 38)
                      : b.type === "math"
                        ? `${b.name} ${b.operator}= ${b.operand}`
                      : b.type === "findText"
                        ? `“${b.text}”`
                        : b.type === "findImage"
                          ? b.template ? `${b.confidence}% match` : "upload image"
                        : b.type === "checkPixel"
                          ? `${b.x}, ${b.y} · ${b.color}`
                        : b.type === "click"
                          ? b.button
                          : b.type === "key"
                            ? b.key
                          : b.type === "keyChord"
                            ? b.keys
                          : b.type === "text"
                            ? b.value.slice(0, 18)
                            : b.type === "move"
                              ? `${b.x}, ${b.y}`
                      : b.type === "findColor"
                                ? b.color
                                : ""}
                </span>
              </button>
              <div className="blocktools">
                <button
                  aria-label="Move block up"
                  disabled={disabled || i === 0}
                  onClick={() => reorder(path, -1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  aria-label="Move block down"
                  disabled={disabled || i === list.length - 1}
                  onClick={() => reorder(path, 1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  aria-label="Delete block"
                  disabled={disabled}
                  onClick={() => remove(path)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {(b.type === "loop" || b.type === "while") && (
              <BlockList
                list={b.body}
                listPath={[...path, "body"]}
                {...props}
              />
            )}
            {(b.type === "ifFound" || b.type === "ifCompare" || b.type === "aiIf") && (
              <>
                <small className="branchlabel">THEN</small>
                <BlockList
                  list={b.then}
                  listPath={[...path, "then"]}
                  {...props}
                />
                <small className="branchlabel">ELSE</small>
                <BlockList
                  list={b.else}
                  listPath={[...path, "else"]}
                  {...props}
                />
              </>
            )}
          </div>
          </React.Fragment>
        );
      })}
      <div className="dropzone">
        {list.length === 0
          ? "Drop your first block here"
          : "Drop to append a block"}
        {!disabled && (
          <select
            aria-label="Add a block to this list"
            value=""
            onChange={(e) => add(listPath, e.target.value)}
          >
            <option value="" disabled>
              + Add block
            </option>
            {Object.keys(defaults).map((t) => (
              <option key={t} value={t}>
                {labels[t]}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
