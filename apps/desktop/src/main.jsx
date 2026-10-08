import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Activity, ArrowDown, ArrowUp, Check, ChevronRight, Command, Copy,
  Download, ExternalLink, Flag, GripVertical, Layers, Lock, Moon,
  MousePointer2, Play, Plus, RefreshCw, Save, ScanLine, Search,
  ShieldCheck, Square, Star, Store, Sun, ThumbsDown, ThumbsUp,
  Trash2, Upload, X,
} from "lucide-react";
import { starters, defaults, clone, validateMacro, parseMacro, downloadJSON } from "../../../packages/shared/macros.js";
import { Runner } from "../../../packages/shared/runner.js";
import { Vision } from "./vision.js";
import config from "../../../config.json";
import "./style.css";

const labels = {
  wait: "Wait / random delay", move: "Move mouse", click: "Mouse click",
  key: "Press / hold key", text: "Type text", drag: "Drag mouse",
  findText: "Find text", findColor: "Find color", loop: "Repeat / infinite loop",
  ifFound: "If match / else",
};
const colors = {
  wait: "mint", move: "peach", click: "peach", key: "peach", text: "peach",
  drag: "peach", findText: "blue", findColor: "blue", loop: "lavender", ifFound: "lavender",
};
const get = (object, path) => path.reduce((value, key) => value[key], object);
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
  const [custom, setCustom] = useState(() => readLocal("ff-macros", []).filter((entry) => {
    try { validateMacro(entry.macro); return typeof entry.id === "string"; } catch { return false; }
  }));
  const all = [...starters, ...custom];
  const [id, setId] = useState(starters[0].id);
  const selected = all.find((entry) => entry.id === id) ?? starters[0];
  const [macro, setMacro] = useState(() => clone(starters[0].macro));
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
  const [catalog, setCatalog] = useState(catalogFallback);
  const [marketStatus, setMarketStatus] = useState("");
  const [marketStats, setMarketStats] = useState(() => readLocal("ff-market-stats", {}));
  const [marketSearch, setMarketSearch] = useState("");
  const [installCandidate, setInstallCandidate] = useState(null);
  const [reportItem, setReportItem] = useState(null);
  const [scanStep, setScanStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const runner = useRef(null);
  const session = useRef(null);
  const runBusy = useRef(false);
  const fileRef = useRef(null);
  const vision = useRef(new Vision());
  const native = isTauri();
  const locked = Boolean(selected.locked);
  const focused = path ? get(macro, path) : null;
  const installed = (item) => custom.some((entry) => entry.sourceId === item.id);
  const record = (kind, message) => {
    setStatus(message);
    setLogs((current) => [...current.slice(-199), { time: formatTime(), kind, message }]);
  };

  useEffect(() => { setMacro(clone(selected.macro)); setPath(null); setBuilderPane("blocks"); }, [id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1c1c1e" : "#f5f5f7");
    localStorage.setItem("ff-theme", JSON.stringify(theme));
  }, [theme]);
  useEffect(() => { localStorage.setItem("ff-macros", JSON.stringify(custom)); }, [custom]);
  useEffect(() => { localStorage.setItem("ff-market-stats", JSON.stringify(marketStats)); }, [marketStats]);
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
      if (native) invoke("stop").catch(() => {});
      vision.current.dispose();
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
    if (locked || running) return;
    const copy = clone(macro); fn(copy); setMacro(copy);
  }
  function save() {
    try {
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
    const macro = { version: 1, name: "Untitled flow", blocks: [] };
    const entry = { id: crypto.randomUUID(), name: macro.name, macro };
    setCustom((entries) => [...entries, entry]); setId(entry.id); setView("builder");
    record("success", "New flow created");
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
  function add(listPath, type) { mutate((copy) => get(copy, listPath).push(clone(defaults[type]))); }
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
      if (data.type === "palette" && Object.hasOwn(defaults, data.block)) list.splice(index, 0, clone(defaults[data.block]));
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
    const entry = { id: crypto.randomUUID(), name: checked.name, sourceId: item.id, macro: checked };
    setCustom((entries) => [...entries, entry]); setId(entry.id);
    updateStat(item.id, { downloads: (marketStats[item.id]?.downloads ?? 0) + 1 });
    setInstallCandidate(null); setView("builder");
    record("warning", `${checked.name} installed. Review the blocks before running.`);
  }
  async function stop() {
    runner.current?.stop(); record("warning", "Stopping input…");
    if (native) await invoke("stop").catch(() => {});
  }
  async function run() {
    if (runBusy.current) return;
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
      }, { humanize });
      record("info", `Starting ${macro.name} in 3 seconds · F8 to stop`);
      let focusWarning = false;
      const heartbeat = setInterval(() => bridge.check().catch((error) => {
        if (focusWarning) return;
        focusWarning = true;
        runner.current?.stop(); record("warning", String(error));
      }), 250);
      try { await runner.current.run(clone(macro)); record("success", "Flow finished"); }
      finally { clearInterval(heartbeat); }
    } catch (error) { record("error", String(error.message ?? error)); }
    finally {
      if (native) await invoke("stop").catch(() => {});
      runner.current = null; runBusy.current = false; setRunning(false); setStep("");
    }
  }
  function selectMacro(nextId) { if (!running) { setId(nextId); setView("builder"); } }
  const actions = { macro, locked, running, path, focused, setPath, mutate, save, duplicate, remove, reorder, add, dropBlock,
    builderPane, setBuilderPane, run, create, fileRef, imported, id, selected };
  return (
    <div className="studio">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("builder")} aria-label="Flowforge Studio home">
          <span className="brandmark"><Command size={19} /></span><span>flowforge</span><small>STUDIO</small>
        </button>
        <div className="side-label">WORKSPACE <button title="New macro" disabled={running} onClick={create}><Plus size={16} /></button></div>
        <nav className="side-nav" aria-label="Studio views">
          <button className={`navitem ${view === "builder" ? "active" : ""}`} onClick={() => setView("builder")}><Layers size={18} /> My Macros <span>{all.length}</span></button>
          <button className={`navitem ${view === "marketplace" ? "active" : ""}`} onClick={() => { setView("marketplace"); loadMarketplace(); }}><Store size={18} /> Marketplace</button>
          <button className={`navitem ${view === "run" ? "active" : ""}`} onClick={() => setView("run")}><Activity size={18} /> Run & Logs {running && <i className="status-dot live" />}</button>
        </nav>
        <div className="side-label library-title">YOUR LIBRARY</div>
        <div className="macrolist" aria-label="Saved macros">
          {all.map((entry) => <button key={entry.id} className={id === entry.id ? "selected" : ""} disabled={running}
            onClick={() => selectMacro(entry.id)}><span className={`miniicon ${colors[entry.macro.blocks[0]?.type] ?? "blue"}`}>
              {entry.id === "ad-skipper" ? <ScanLine size={15} /> : <Layers size={15} />}</span><span>{entry.name}</span>{entry.locked && <Lock size={12} />}</button>)}
        </div>
        <button className="importnav" disabled={running} onClick={() => fileRef.current?.click()}><Upload size={16} /> Import JSON macro</button>
        <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={(event) => imported(event.target.files?.[0])} />
        <div className="sidebarfoot"><ShieldCheck size={19} /><div><strong>Always in control.</strong><p>Local macros · F8 emergency stop</p></div>
          <button aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="crumb">FLOWFORGE <ChevronRight size={13} /> {view === "builder" ? "MY MACROS" : view === "marketplace" ? "MARKETPLACE" : "RUN & LOGS"}</div>
          <div className="headerstatus"><i className={`status-dot ${running ? "live" : ""}`} /> {running ? "Running" : "Ready"} <span>v{config.version}</span></div></header>
        {!native && <div className="notice">Browser preview · Window capture and input require the Windows app.</div>}
        {updated && <div className="notice">Version {updated} is available. <a href={`https://github.com/${config.repository}/releases/latest`} target="_blank" rel="noreferrer">View release ↗</a></div>}
        <div className="view-frame" key={view}>
          {view === "builder" && <BuilderView {...actions} />}
          {view === "marketplace" && <MarketplaceView catalog={catalog} marketStatus={marketStatus} marketSearch={marketSearch} setMarketSearch={setMarketSearch}
            stats={marketStats} updateStat={updateStat} prepareInstall={prepareInstall} installed={installed} busy={busy} loadMarketplace={loadMarketplace} setReportItem={setReportItem} />}
          {view === "run" && <RunView macro={macro} windows={windows} target={target} setTarget={setTarget} refreshWindows={refreshWindows}
            humanize={humanize} setHumanize={setHumanize} running={running} run={run} stop={stop} status={status} step={step} logs={logs} native={native} />}
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

function BuilderView({ macro, locked, running, path, focused, setPath, mutate, save, duplicate, remove, reorder, add, dropBlock, builderPane, setBuilderPane, run, id, selected }) {
  const clicker = id === "auto-clicker" || selected.sourceId === "auto-clicker";
  return <section className="builder-view" aria-label="Visual macro builder">
    <div className="view-heading"><div><small>VISUAL AUTOMATION</small><input className="flowname" aria-label="Macro name" disabled={locked || running} value={macro.name}
      onChange={(event) => mutate((copy) => { copy.name = event.target.value; })} /><p>{locked ? "Locked starter · duplicate to make changes" : "Create your workflow, block by block."}</p></div>
      <div className="heading-actions"><button className="ghost" title="Duplicate macro" disabled={running} onClick={() => duplicate()}><Copy size={16} /> Duplicate</button>
        <button className="ghost" title="Export JSON" onClick={() => downloadJSON(macro)}><Download size={16} /> Export</button>
        <button className="ghost" title="Save macro" disabled={locked || running} onClick={save}><Save size={16} /> Save</button>
        <button className="primary" onClick={run} disabled={running}><Play size={15} fill="currentColor" /> Run flow</button></div></div>
    <div className="builder-tabs"><button className={builderPane === "blocks" ? "selected" : ""} onClick={() => setBuilderPane("blocks")}>Block builder</button>
      {clicker && <button className={builderPane === "clicker" ? "selected" : ""} onClick={() => setBuilderPane("clicker")}>Clicker settings</button>}</div>
    {builderPane === "clicker" && clicker ? <div className="clickersettings surface"><span className="featureicon peach"><MousePointer2 size={25} /></span><h2>Auto-Clicker</h2>
      <p>Choose the mouse button and delay between clicks. Save creates an editable copy.</p>
      <label>Click interval (milliseconds)<input type="number" min="10" max="3600000" disabled={running || locked} value={macro.blocks[0]?.body?.[1]?.ms ?? 100}
        onChange={(event) => mutate((copy) => { copy.blocks[0].body[1].ms = Number(event.target.value); })} /></label>
      <label>Mouse button<select disabled={running || locked} value={macro.blocks[0]?.body?.[0]?.button ?? "left"}
        onChange={(event) => mutate((copy) => { copy.blocks[0].body[0].button = event.target.value; })}><option value="left">Left button</option><option value="right">Right button</option></select></label>
      <button className="secondary" onClick={save}>{id === "auto-clicker" ? "Save configured copy" : "Save changes"}</button></div> :
      <div className="builder-grid surface"><div className="palette"><small>BLOCK LIBRARY</small>
        <div className="palette-group"><strong>CONTROL</strong>{["loop", "ifFound", "wait"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        <div className="palette-group"><strong>INPUT & ACTIONS</strong>{["move", "click", "key", "text", "drag"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        <div className="palette-group"><strong>VISION</strong>{["findText", "findColor"].map((type) => <PaletteBlock key={type} type={type} disabled={locked || running} add={add} />)}</div>
        <p>Drag into any list to nest blocks, or click to append.</p></div>
        <div className="canvas"><div className="canvaslabel"><i className="status-dot live" /> WHEN FLOW STARTS <span>{locked ? <><Lock size={12} /> LOCKED</> : "EDITABLE FLOW"}</span></div>
          <BlockList list={macro.blocks} listPath={["blocks"]} chosen={path} select={setPath} add={add} remove={remove} reorder={reorder} dropBlock={dropBlock} disabled={locked || running} />
          <div className="canvasfoot"><ShieldCheck size={15} /> F8 stops input instantly · target focus is checked continuously</div></div>
        <div className="inspector"><small>BLOCK SETTINGS</small><h3>{focused ? labels[focused.type] : "Select a block"}</h3>
          {focused ? <><div className="inspector-fields">{Object.entries(focused).filter(([key, value]) => key !== "type" && !Array.isArray(value)).map(([key, value]) =>
            <label key={key}>{key.replace(/([A-Z])/g, " $1")}{typeof value === "boolean" ? <input type="checkbox" disabled={locked || running} checked={value}
              onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.checked; })} /> : key === "button" ?
              <select disabled={locked || running} value={value} onChange={(event) => mutate((copy) => { get(copy, path)[key] = event.target.value; })}><option value="left">Left</option><option value="right">Right</option></select> :
              <input disabled={locked || running} type={typeof value === "number" ? "number" : key === "color" ? "color" : "text"} value={value}
                onChange={(event) => mutate((copy) => { get(copy, path)[key] = typeof value === "number" ? Number(event.target.value) : event.target.value; })} />}</label>)}</div>
            {focused.type === "loop" && <p>0 repeats indefinitely. Set a positive count for a finite loop.</p>}
            {focused.type.startsWith("find") && <p>Scans visible pixels. The interval defaults to 500 ms; OCR may take longer.</p>}</> : <p>Choose a block to edit its values. Drag blocks into the canvas and nested branches.</p>}
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
function RunView({ macro, windows, target, setTarget, refreshWindows, humanize, setHumanize, running, run, stop, status, step, logs, native }) {
  const logEnd = useRef(null);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: "end" }); }, [logs]);
  return <section className="run-view" aria-label="Run and execution dashboard"><div className="view-heading"><div><small>LIVE CONTROL CENTER</small><h1>Run with confidence.</h1><p>Choose a target, monitor each step, and stop at any time.</p></div>
    <span className={`run-badge ${running ? "running" : ""}`}><i className={`status-dot ${running ? "live" : ""}`} /> {running ? "Running" : "Idle"}</span></div>
    <div className="run-grid"><div className="run-controls surface"><h2>Execution settings</h2><p>Selected flow: <strong>{macro.name}</strong></p>
      <label htmlFor="target-window">TARGET WINDOW</label><div className="target-select"><select id="target-window" disabled={running} value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="global">Global Desktop Input</option>{windows.map((window) => <option key={window.id} value={window.id}>{window.title} · PID {window.pid}</option>)}</select>
        <button aria-label="Refresh windows" title="Refresh windows" disabled={running} onClick={refreshWindows}><RefreshCw size={16} /></button></div>
      <div className="safety-note"><ShieldCheck size={19} /><div><strong>{target === "global" ? "Global mode" : "Focus protection active"}</strong><p>{target === "global" ? "Input can reach your entire desktop. Choose a window for focus protection." : "Input stops as soon as this window loses focus."}</p></div></div>
      <label className="toggle-row"><input type="checkbox" disabled={running} checked={humanize} onChange={(event) => setHumanize(event.target.checked)} /><span>Vary timing and mouse path slightly</span></label>
      <div className="run-buttons">{running ? <button className="stop" onClick={stop}><Square size={16} fill="currentColor" /> Stop · F8</button> : <button className="primary" onClick={run} disabled={!native}><Play size={16} fill="currentColor" /> Start flow</button>}</div>
      <p className="shortcut">F8 · Emergency stop from anywhere</p></div>
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
                      : b.type === "findText"
                        ? `“${b.text}”`
                        : b.type === "click"
                          ? b.button
                          : b.type === "key"
                            ? b.key
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
            {b.type === "loop" && (
              <BlockList
                list={b.body}
                listPath={[...path, "body"]}
                {...props}
              />
            )}
            {b.type === "ifFound" && (
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
