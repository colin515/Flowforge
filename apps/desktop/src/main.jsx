import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Command,
  Layers,
  Plus,
  Play,
  Square,
  Download,
  Upload,
  Copy,
  Trash2,
  Sun,
  Moon,
  MousePointer2,
  ScanLine,
  Orbit,
  ChevronRight,
  RefreshCw,
  GripVertical,
  ShieldCheck,
  Save,
  ArrowUp,
  ArrowDown,
  Lock,
  Store,
  ExternalLink,
} from "lucide-react";
import {
  starters,
  defaults,
  clone,
  validateMacro,
  parseMacro,
  downloadJSON,
} from "../../../packages/shared/macros.js";
import { Runner } from "../../../packages/shared/runner.js";
import { Vision } from "./vision";
import config from "../../../config.json";
import "./style.css";
const labels = {
  wait: "Wait",
  move: "Move mouse",
  click: "Click",
  key: "Press / hold key",
  drag: "Drag mouse",
  findText: "Find text",
  findColor: "Find color",
  loop: "Repeat",
  ifFound: "If match found",
};
const colors = {
  wait: "mint",
  move: "peach",
  click: "peach",
  key: "peach",
  drag: "peach",
  findText: "blue",
  findColor: "blue",
  loop: "lavender",
  ifFound: "lavender",
};
const get = (o, path) => path.reduce((a, k) => a[k], o);
function local(k, def) {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? def;
  } catch {
    return def;
  }
}
function preferredTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
function App() {
  const [custom, setCustom] = useState(() =>
    local("ff-macros", []).filter((m) => {
      try {
        validateMacro(m.macro);
        return true;
      } catch {
        return false;
      }
    }),
  );
  const all = [...starters, ...custom];
  const [id, setId] = useState(starters[0].id);
  const selected = all.find((x) => x.id === id) ?? starters[0];
  const [macro, setMacro] = useState(clone(selected.macro));
  const [path, setPath] = useState(null);
  const [theme, setTheme] = useState(local("ff-theme", preferredTheme()));
  const [windows, setWindows] = useState([]);
  const [target, setTarget] = useState("global");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready when you are");
  const [step, setStep] = useState("");
  const [updated, setUpdated] = useState(null);
  const [tab, setTab] = useState("builder");
  const [humanize, setHumanize] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [marketStatus, setMarketStatus] = useState("Loading marketplace…");
  const runner = useRef(null);
  const session = useRef(null);
  const runBusy = useRef(false);
  const native = isTauri();
  const fileRef = useRef();
  const vision = useRef(new Vision());
  const locked = selected.locked;
  useEffect(() => {
    setMacro(clone(selected.macro));
    setPath(null);
  }, [id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0b0c10" : "#f7f7f5");
    localStorage.setItem("ff-theme", JSON.stringify(theme));
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("ff-macros", JSON.stringify(custom));
  }, [custom]);
  useEffect(() => {
    refresh();
    const abort = new AbortController();
    if (!config.repository.startsWith("YOUR_"))
      fetch(
        `https://api.github.com/repos/${config.repository}/releases/latest`,
        {
          signal: abort.signal,
          headers: { Accept: "application/vnd.github+json" },
        },
      )
        .then((r) => {
          if (!r.ok) throw new Error("No release available");
          return r.json();
        })
        .then((r) => {
          const latest = r.tag_name?.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
          if (!latest) return;
          const a = latest.slice(1).map(Number),
            b = config.version.split(".").map(Number);
          for (let i = 0; i < 3; i++) {
            if (a[i] > b[i]) {
              setUpdated(r.tag_name);
              break;
            }
            if (a[i] < b[i]) break;
          }
        })
        .catch(() => {});
    return () => {
      abort.abort();
      runner.current?.stop();
      if (native) invoke("stop").catch(() => {});
      vision.current.dispose();
    };
  }, []);
  async function refresh() {
    if (native)
      try {
        setWindows(await invoke("list_windows"));
      } catch (e) {
        setStatus(String(e));
      }
  }
  function mutate(fn) {
    if (locked || running) return;
    const copy = clone(macro);
    fn(copy);
    setMacro(copy);
  }
  function save() {
    try {
      validateMacro(macro);
      if (locked) {
        setStatus("Built-in macro is locked. Duplicate it to customize.");
        return;
      }
      setCustom((list) =>
        list.map((x) =>
          x.id === id ? { ...x, name: macro.name, macro: clone(macro) } : x,
        ),
      );
      setStatus("Saved on this device");
    } catch (e) {
      setStatus(e.message);
    }
  }
  function duplicate(m = macro) {
    const entry = {
      id: crypto.randomUUID(),
      name: m.name + " copy",
      macro: { ...clone(m), name: m.name + " copy" },
    };
    setCustom((s) => [...s, entry]);
    setId(entry.id);
    setStatus("Created an editable copy");
  }
  function create() {
    const entry = {
      id: crypto.randomUUID(),
      name: "Untitled flow",
      macro: { version: 1, name: "Untitled flow", blocks: [] },
    };
    setCustom((s) => [...s, entry]);
    setId(entry.id);
  }
  async function imported(file) {
    try {
      if (!file || file.size > 262144)
        throw new Error("Choose a JSON file under 256 KB");
      const m = parseMacro(await file.text());
      const entry = { id: crypto.randomUUID(), name: m.name, macro: m };
      setCustom((s) => [...s, entry]);
      setId(entry.id);
      setStatus("Imported. Review the actions before running.");
    } catch (e) {
      setStatus(e.message);
    } finally {
      fileRef.current.value = "";
    }
  }
  function add(listPath, type) {
    mutate((m) => get(m, listPath).push(clone(defaults[type])));
  }
  function remove(p) {
    mutate((m) => get(m, p.slice(0, -1)).splice(p.at(-1), 1));
    setPath(null);
  }
  function reorder(p, d) {
    mutate((m) => {
      const list = get(m, p.slice(0, -1)),
        i = p.at(-1),
        j = i + d;
      if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    });
    setPath(null);
  }
  async function loadMarketplace() {
    setMarketStatus("Loading marketplace…");
    try {
      const response = await fetch(
        "https://colin515.github.io/Flowforge/marketplace/catalog.json",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Marketplace is not available yet");
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.items))
        throw new Error("Unsupported marketplace catalog");
      setCatalog(data.items);
      setMarketStatus("");
    } catch (error) {
      setCatalog([]);
      setMarketStatus(error.message);
    }
  }
  async function installMarketplaceMacro(item) {
    try {
      setMarketStatus(`Downloading ${item.name}…`);
      const response = await fetch(item.url, { cache: "no-store" });
      if (!response.ok) throw new Error("Download failed");
      const macro = parseMacro(await response.text());
      const entry = { id: crypto.randomUUID(), name: macro.name, macro };
      setCustom((list) => [...list, entry]);
      setId(entry.id);
      setTab("builder");
      setStatus(
        `${macro.name} installed from Marketplace. Review it before running.`,
      );
      setMarketStatus("");
    } catch (error) {
      setMarketStatus(error.message);
    }
  }
  async function stop() {
    runner.current?.stop();
    setStatus("Stopping…");
    if (native) await invoke("stop").catch(() => {});
  }
  async function run() {
    if (runBusy.current) return;
    runBusy.current = true;
    try {
      validateMacro(macro);
      if (!native)
        throw new Error(
          "Browser preview only. Run the Tauri app on Windows to send input.",
        );
      setRunning(true);
      session.current = await invoke("begin", {
        target: target === "global" ? null : target,
      });
      const bridge = {
        position: (screen) =>
          invoke("position", { session: session.current, screen }),
        check: () => invoke("check", { session: session.current }),
        input: (b) => invoke("input", { session: session.current, event: b }),
        capture: () => invoke("capture", { session: session.current }),
        release: () => invoke("stop"),
      };
      runner.current = new Runner(
        bridge,
        vision.current,
        (type) => {
          setStep(labels[type]);
          setStatus("Running · F8 stops immediately");
        },
        { humanize },
      );
      setStatus("Starting in 3 seconds. Focus your selected window now.");
      const heartbeat = setInterval(
        () => bridge.check().catch(() => runner.current?.stop()),
        250,
      );
      try {
        await runner.current.run(clone(macro));
        setStatus("Flow finished");
      } finally {
        clearInterval(heartbeat);
      }
    } catch (e) {
      setStatus(String(e.message ?? e));
    } finally {
      if (native) await invoke("stop").catch(() => {});
      runner.current = null;
      runBusy.current = false;
      setRunning(false);
      setStep("");
    }
  }
  const focused = path ? get(macro, path) : null;
  return (
    <div className="studio">
      <aside className="sidebar">
        <a className="brand">
          <span className="brandmark">
            <Command size={19} />
          </span>
          flowforge<span>STUDIO</span>
        </a>
        <div className="workspace">
          WORKSPACE{" "}
          <button title="New macro" disabled={running} onClick={create}>
            <Plus size={16} />
          </button>
        </div>
        <div className="navitem active">
          <Layers size={17} />
          My macros<span>{all.length}</span>
        </div>
        <button
          className={`navitem marketnav ${tab === "marketplace" ? "active" : ""}`}
          onClick={() => {
            setTab("marketplace");
            loadMarketplace();
          }}
        >
          <Store size={17} />
          Marketplace<span>Online</span>
        </button>
        <div className="macrolist">
          {all.map((x, i) => (
            <button
              key={x.id}
              disabled={running}
              className={x.id === id ? "selected" : ""}
              onClick={() => setId(x.id)}
            >
              <span
                className={"miniicon " + ["lavender", "peach", "mint"][i % 3]}
              >
                {i === 0 ? (
                  <Orbit size={14} />
                ) : i === 1 ? (
                  <MousePointer2 size={14} />
                ) : (
                  <Layers size={14} />
                )}
              </span>
              <span>{x.name}</span>
              {x.locked && <Lock size={11} />}
            </button>
          ))}
        </div>
        <button
          className="importnav"
          disabled={running}
          onClick={() => fileRef.current.click()}
        >
          <Upload size={16} />
          Import a macro
        </button>
        <input
          hidden
          type="file"
          accept=".json"
          ref={fileRef}
          onChange={(e) => imported(e.target.files[0])}
        />
        <div className="sidebarfoot">
          <ShieldCheck size={20} />
          <h4>Your flows stay yours.</h4>
          <p>
            Saved locally.
            <br />
            Export whenever you like.
          </p>
          <div>
            <small>v{config.version}</small>
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="crumb">
            WORKSPACE <ChevronRight size={12} /> MY MACROS
          </div>
          <div className="headerstatus">
            <span className={running ? "dot live" : "dot"} />
            {running ? "Flow in progress" : "Everything in flow"}
          </div>
        </header>
        {!native && (
          <div className="notice">
            Browser preview · Build and run the Windows app to enable window
            selection, screenshots, and input.
          </div>
        )}
        {updated && (
          <div className="notice">
            {updated} is available.
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/${config.repository}/releases/latest`}
            >
              View release →
            </a>
          </div>
        )}
        <div className="titlebar">
          <div>
            <div className="eyebrow">YOUR AUTOMATION WORKSPACE</div>
            <input
              className="flowname"
              aria-label="Macro name"
              disabled={locked || running}
              value={macro.name}
              onChange={(e) => mutate((m) => (m.name = e.target.value))}
            />
            <p>
              {locked
                ? "A built-in flow. Duplicate it to make it your own."
                : "Small actions. Beautifully connected."}
            </p>
          </div>
          <div className="runactions">
            {running ? (
              <button className="stop" onClick={stop}>
                <Square size={15} fill="currentColor" />
                Stop · F8
              </button>
            ) : (
              <button className="primary" onClick={run}>
                <Play size={15} fill="currentColor" />
                Run flow
              </button>
            )}
          </div>
        </div>
        <div className="target">
          <span className="targeticon">
            <MousePointer2 size={21} />
          </span>
          <div>
            <label htmlFor="target">TARGET WINDOW</label>
            <select
              id="target"
              disabled={running}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="global">Entire desktop · global input</option>
              {windows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </div>
          <button
            aria-label="Refresh windows"
            disabled={running}
            onClick={refresh}
          >
            <RefreshCw size={15} />
          </button>
          <span className="pill">
            {target === "global" ? "Global mode" : "Foreground only"}
          </span>
        </div>
        <div className="humanize">
          <label>
            <input
              type="checkbox"
              disabled={running}
              checked={humanize}
              onChange={(e) => setHumanize(e.target.checked)}
            />{" "}
            Humanization · ±10% wait timing and slight mouse path variation
          </label>
          <span>Optional · does not guarantee undetectable input</span>
        </div>
        <div className="editbar">
          <div className="tabs">
            <button
              className={tab === "builder" ? "selected" : ""}
              onClick={() => setTab("builder")}
            >
              <Layers size={14} />
              Block builder
            </button>
            {id === "auto-clicker" && (
              <button
                className={tab === "clicker" ? "selected" : ""}
                onClick={() => setTab("clicker")}
              >
                <MousePointer2 size={14} />
                Clicker settings
              </button>
            )}
          </div>
          <div>
            <button
              title="Save macro"
              disabled={locked || running}
              onClick={save}
            >
              <Save size={15} />
            </button>
            <button
              title="Duplicate macro"
              disabled={running}
              onClick={() => duplicate()}
            >
              <Copy size={15} />
            </button>
            <button
              title="Export JSON"
              onClick={() => {
                try {
                  downloadJSON(macro);
                  setStatus("Exported JSON");
                } catch (e) {
                  setStatus(e.message);
                }
              }}
            >
              <Download size={15} />
            </button>
            <button
              title="Delete macro"
              disabled={locked || running || starters.some((x) => x.id === id)}
              onClick={() => {
                setCustom((s) => s.filter((x) => x.id !== id));
                setId(starters[0].id);
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div
          className={`editor ${tab === "marketplace" ? "market-editor" : ""}`}
        >
          {tab === "marketplace" ? (
            <div className="app-marketplace">
              <div className="app-market-head">
                <div>
                  <small>FLOWFORGE MARKETPLACE</small>
                  <h2>Install a flow.</h2>
                  <p>
                    Download community macros directly into your library. Review
                    every block before running.
                  </p>
                </div>
                <a
                  href="https://colin515.github.io/Flowforge/marketplace/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open website <ExternalLink size={14} />
                </a>
              </div>
              {marketStatus && (
                <div className="market-message">
                  {marketStatus}{" "}
                  <button onClick={loadMarketplace}>Try again</button>
                </div>
              )}
              <div className="app-market-grid">
                {catalog.map((item) => (
                  <article key={item.id}>
                    <div className="featureicon lavender">
                      <Store size={20} />
                    </div>
                    <span>{item.category}</span>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <button
                      className="primary"
                      onClick={() => installMarketplaceMacro(item)}
                    >
                      <Download size={14} />
                      Install macro
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : tab === "clicker" ? (
            <div className="clickersettings">
              <div className="featureicon peach">
                <MousePointer2 />
              </div>
              <h2>Click less. Do more.</h2>
              <p>
                Configure the built-in Auto-Clicker and save an editable copy.
              </p>
              <label>
                Click interval (milliseconds)
                <input
                  type="number"
                  min="10"
                  max="3600000"
                  value={macro.blocks[0]?.body?.[1]?.ms ?? 100}
                  disabled={running}
                  onChange={(e) =>
                    mutate(
                      (m) => (m.blocks[0].body[1].ms = Number(e.target.value)),
                    )
                  }
                />
              </label>
              <label>
                Mouse button
                <select
                  disabled={running}
                  value={macro.blocks[0]?.body?.[0]?.button ?? "left"}
                  onChange={(e) =>
                    mutate((m) => (m.blocks[0].body[0].button = e.target.value))
                  }
                >
                  <option>left</option>
                  <option>right</option>
                </select>
              </label>
              <button
                className="secondary"
                disabled={running}
                onClick={() => duplicate()}
              >
                Save configured copy <Copy size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="palette">
                <small>BLOCK LIBRARY</small>
                {Object.keys(defaults).map((type) => (
                  <button
                    key={type}
                    className={"paletteblock " + colors[type]}
                    disabled={locked || running}
                    draggable={!locked && !running}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", type)
                    }
                    onClick={() => add(["blocks"], type)}
                  >
                    <GripVertical size={12} />
                    {labels[type]}
                    <Plus size={12} />
                  </button>
                ))}
                <p>
                  Drag to any block list.
                  <br />
                  Or click to append.
                </p>
                <small>KEYBOARD FRIENDLY</small>
                <p>Select a block, then use its arrows to reorder.</p>
              </div>
              <div className="canvas">
                <div className="canvaslabel">
                  <span className="dot" />
                  WHEN YOU PRESS PLAY{" "}
                  <span>
                    {locked ? (
                      <>
                        <Lock size={10} /> LOCKED
                      </>
                    ) : (
                      "VISUAL FLOW"
                    )}
                  </span>
                </div>
                <BlockList
                  list={macro.blocks}
                  listPath={["blocks"]}
                  chosen={path}
                  select={setPath}
                  add={add}
                  remove={remove}
                  reorder={reorder}
                  disabled={locked || running}
                />
                <div className="canvasfoot">
                  <ShieldCheck size={13} />
                  F8 stops input. Keep your target in front.
                </div>
              </div>
            </>
          )}
          <div className="inspector">
            <small>BLOCK SETTINGS</small>
            <h3>{focused ? labels[focused.type] : "A flow, your way."}</h3>
            {focused ? (
              <>
                {Object.entries(focused)
                  .filter(([k, v]) => k !== "type" && !Array.isArray(v))
                  .map(([k, v]) => (
                    <label key={k}>
                      {k.replace(/([A-Z])/g, " $1")}{" "}
                      {typeof v === "boolean" ? (
                        <input
                          disabled={locked || running}
                          type="checkbox"
                          checked={v}
                          onChange={(e) =>
                            mutate((m) => (get(m, path)[k] = e.target.checked))
                          }
                        />
                      ) : k === "button" ? (
                        <select
                          disabled={locked || running}
                          value={v}
                          onChange={(e) =>
                            mutate((m) => (get(m, path)[k] = e.target.value))
                          }
                        >
                          <option>left</option>
                          <option>right</option>
                        </select>
                      ) : (
                        <input
                          disabled={locked || running}
                          type={
                            typeof v === "number"
                              ? "number"
                              : k === "color"
                                ? "color"
                                : "text"
                          }
                          value={v}
                          onChange={(e) =>
                            mutate(
                              (m) =>
                                (get(m, path)[k] =
                                  typeof v === "number"
                                    ? Number(e.target.value)
                                    : e.target.value),
                            )
                          }
                        />
                      )}
                    </label>
                  ))}
                {focused.type === "loop" && (
                  <p>
                    Count 0 repeats until stopped. Nested loops are supported.
                  </p>
                )}
                {focused.type === "wait" && (
                  <p>
                    Jitter adds ± milliseconds to the wait. It does not
                    guarantee undetectable input.
                  </p>
                )}
                {focused.type === "move" && (
                  <p>
                    Absolute coordinates are relative to the target’s client
                    area. Global mode uses screen coordinates.
                  </p>
                )}
                {focused.type.startsWith("find") && (
                  <p>
                    Polls visible pixels. OCR may take longer than the interval.
                    Confidence filters text matches.
                  </p>
                )}
              </>
            ) : (
              <p>
                Select any block to edit its settings. Build with clicks or drag
                and drop.
              </p>
            )}
            <hr />
            <ShieldCheck size={23} />
            <h4>Always in control.</h4>
            <p>
              Inputs stop when your selected window loses focus. No background
              hooks.
            </p>
          </div>
        </div>
        <div role="status" className="statusbar">
          <span className={running ? "dot live" : "dot"} />
          {status}
          <span className="currentstep">{step}</span>
        </div>
      </div>
    </div>
  );
}
function BlockList({
  list,
  listPath,
  chosen,
  select,
  add,
  remove,
  reorder,
  disabled,
}) {
  const props = { chosen, select, add, remove, reorder, disabled };
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
        const type = e.dataTransfer.getData("text/plain");
        if (!disabled && Object.hasOwn(defaults, type)) add(listPath, type);
      }}
    >
      {list.map((b, i) => {
        const path = [...listPath, i],
          active = JSON.stringify(chosen) === JSON.stringify(path);
        return (
          <div
            key={JSON.stringify(path)}
            className={
              "flowblock " + colors[b.type] + (active ? " chosen" : "")
            }
          >
            <div className="blockheading">
              <button className="blockselect" onClick={() => select(path)}>
                <GripVertical size={12} />
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
