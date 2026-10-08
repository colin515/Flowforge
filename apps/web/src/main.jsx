import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  Plus,
  MousePointer2,
  ScanLine,
  Orbit,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  X,
  Check,
  Lock,
  Sun,
  Moon,
  Play,
  Layers,
  Flag,
  Star,
} from "lucide-react";
import {
  starters,
  parseMacro,
  downloadJSON,
} from "../../../packages/shared/macros.js";
import config from "../../../config.json";
import logoUrl from "./assets/flowforge-mark.svg";
import "./style.css";
const icons = { orbit: Orbit, pointer: MousePointer2, scan: ScanLine };
function saved(k, fallback) {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
}
function preferredTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
function App() {
  const release = `https://github.com/${config.repository}/releases/latest`;
  const [installerUrl, setInstallerUrl] = useState(release);
  const [theme, setTheme] = useState(saved("ff-theme", preferredTheme()));
  const [items, setItems] = useState(saved("ff-community", []));
  const [stats, setStats] = useState(saved("ff-stats", {}));
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [scan, setScan] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#1c1c1e" : "#f5f5f7");
    localStorage.setItem("ff-theme", JSON.stringify(theme));
  }, [theme]);
  useEffect(() => {
    if (config.repository.startsWith("YOUR_")) return;
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${config.repository}/releases/latest`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Release unavailable")))
      .then((data) => {
        const installer = data.assets?.find((asset) =>
          /^Flowforge_.*_x64-setup\.exe$/i.test(asset.name) &&
          asset.browser_download_url?.startsWith(`https://github.com/${config.repository}/releases/download/`));
        if (installer) setInstallerUrl(installer.browser_download_url);
      }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    localStorage.setItem("ff-community", JSON.stringify(items));
    localStorage.setItem("ff-stats", JSON.stringify(stats));
  }, [items, stats]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (modal !== "scan" || !pending) return;
    let n = 0;
    const t = setInterval(() => {
      setScan(++n);
      if (n === 3) clearInterval(t);
    }, 650);
    return () => clearInterval(t);
  }, [modal, pending]);
  useEffect(() => {
    if (!modal) return;
    const old = document.activeElement;
    const t = setTimeout(
      () => document.querySelector("dialog button")?.focus(),
      0,
    );
    const key = (e) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const els = [
          ...document.querySelectorAll(
            "dialog button,dialog input,dialog textarea",
          ),
        ].filter((x) => !x.disabled);
        if (!els.length) return;
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, [modal]);
  const configured = !config.repository.startsWith("YOUR_");
  const all = [...starters, ...items];
  const mutate = (id, v) =>
    setStats((s) => ({ ...s, [id]: { ...s[id], ...v } }));
  const vote = (id, n) => {
    mutate(id, { vote: stats[id]?.vote === n ? 0 : n });
    setToast("Your local vote was saved.");
  };
  const upload = async (file) => {
    setError("");
    setPending(null);
    setScan(0);
    try {
      if (!file || file.size > 262144)
        throw new Error("Choose a JSON macro under 256 KB.");
      const macro = parseMacro(await file.text());
      setPending(macro);
      setModal("scan");
    } catch (e) {
      setError(e.message);
    }
  };
  const marketplacePage = window.location.pathname.includes("/marketplace/");
  const homeUrl = marketplacePage ? "../" : "./";
  const marketplaceUrl = marketplacePage ? "./" : "./marketplace/";
  const marketplaceSection = (
    <section id="marketplace" className="marketplace marketplace-page visible">
      <div className="markethead">
        <div>
          <div className="sectionlabel">THE COMMUNITY TOOLBOX</div>
          <h2>Find your next flow.</h2>
          <p>A head start for every little task.</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setError("");
            setModal("upload");
          }}
        >
          <Plus size={17} /> Share a macro
        </button>
      </div>
      <div className="markettoolbar">
        <div className="tabs">
          {["All", "Utility", "Productivity", "Vision", "Gaming", "AI"].map((v) => (
            <button
              key={v}
              className={v === filter ? "selected" : ""}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          aria-label="Search macros"
          placeholder="Search the toolbox…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="demobar">
        <ShieldCheck size={15} />
        <span>
          Marketplace preview · Uploads, votes, ratings, and counts stay in this
          browser. No shared service connected.
        </span>
      </div>
      <div className="marketgrid">
        {all
          .filter(
            (x) =>
              (filter === "All" || x.category === filter) &&
              x.name.toLowerCase().includes(search.toLowerCase()),
          )
          .map((x, i) => {
            const Icon = icons[x.icon] ?? Layers;
            const s = stats[x.id] ?? {};
            const official = starters.some((item) => item.id === x.id);
            return (
              <article className="macrocard" key={x.id}>
                <div className="cardtop">
                  <div
                    className={
                      "macroicon " + ["lavender", "peach", "mint"][i % 3]
                    }
                  >
                    <Icon size={26} />
                  </div>
                  <span className="tag">
                    {x.locked ? (
                      <>
                        <Lock size={11} /> BUILT IN
                      </>
                    ) : (
                      x.category
                    )}
                  </span>
                </div>
                <h3>{x.name}</h3>
                <p>{x.description}</p>
                <div className="author">
                  <span className="avatar">{official ? "F" : "Y"}</span>
                  {official ? "Flowforge" : "You · local upload"}
                  <span className="verified">
                    <Check size={12} />
                  </span>
                </div>
                <div className="cardstats">
                  <span>
                    <Download size={13} /> {s.downloads ?? 0} local
                  </span>
                  <span>
                    <Star size={13} />
                    {s.rating ? `${s.rating}.0 · your rating` : "Unrated"}
                  </span>
                </div>
                <div className="cardactions">
                  <button
                    className="getmacro"
                    onClick={() => {
                      downloadJSON(x.macro);
                      mutate(x.id, { downloads: (s.downloads ?? 0) + 1 });
                    }}
                  >
                    Get macro <ArrowDownIcon />
                  </button>
                  <button
                    title="Thumbs up"
                    aria-label={"Thumbs up " + x.name}
                    aria-pressed={s.vote === 1}
                    onClick={() => vote(x.id, 1)}
                  >
                    <ThumbsUp size={15} />
                    {s.vote === 1 ? 1 : 0}
                  </button>
                  <button
                    title="Thumbs down"
                    aria-label={"Thumbs down " + x.name}
                    aria-pressed={s.vote === -1}
                    onClick={() => vote(x.id, -1)}
                  >
                    <ThumbsDown size={15} />
                    {s.vote === -1 ? 1 : 0}
                  </button>
                  <button
                    title="Report suspicious macro"
                    aria-label={"Report " + x.name}
                    onClick={() => setModal({ type: "report", item: x })}
                  >
                    <Flag size={14} />
                  </button>
                </div>
                <div className="rating">
                  Your rating{" "}
                  {Array.from({ length: 5 }, (_, j) => (
                    <button
                      key={j}
                      aria-label={`Rate ${x.name} ${j + 1} stars`}
                      onClick={() => mutate(x.id, { rating: j + 1 })}
                    >
                      <Star
                        size={12}
                        fill={j < (s.rating ?? 0) ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                  {!official && (
                    <button
                      className="delete"
                      onClick={() =>
                        setItems(items.filter((a) => a.id !== x.id))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
      {!all.some(
        (x) =>
          (filter === "All" || x.category === filter) &&
          x.name.toLowerCase().includes(search.toLowerCase()),
      ) && <p className="empty">No flows found. Try another search.</p>}
    </section>
  );
  return (
    <>
      <nav>
        <a className="brand" href={homeUrl}>
          <span className="brandmark">
            <img src={logoUrl} alt="" />
          </span>
          flowforge<span className="beta">BETA</span>
        </a>
        <div className="navlinks">
          <a href={marketplacePage ? "../#features" : "#features"}>Overview</a>
          <a href={marketplaceUrl}>Marketplace</a>
          <button
            aria-label="Toggle theme"
            className="iconbutton"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <a className="navdownload" href={configured ? installerUrl : "#download"}>
            Get Flowforge <ArrowUpRight size={14} />
          </a>
        </div>
      </nav>
      <main>
        {marketplacePage ? (
          marketplaceSection
        ) : (
          <>
            <section className="hero">
              <div className="eyebrow">
                <span className="dot" /> YOUR DESKTOP. ON AUTOPILOT.
              </div>
              <h1>
                Less repetition.
                <br />
                <span>More possibility.</span>
              </h1>
              <p>
                Turn everyday actions into effortless flows.
                <br />
                Beautifully simple automation, built for Windows.
              </p>
              <div className="heroactions">
                <a
                  className="primary"
                  href={configured ? installerUrl : "#download"}
                >
                  <Download size={17} />
                  Download for Windows
                  <ArrowUpRight size={17} />
                </a>
                <a className="textbutton" href="./marketplace/">
                  Explore the marketplace <ArrowRight size={17} />
                </a>
              </div>
              <div className="fine">
                Windows 10 / 11 <span>·</span> Open source <span>·</span> Your
                flows, your control
              </div>
              <div className="product">
                <div className="producttitle">
                  <div className="traffic">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>Flowforge Studio</span>
                  <div className="status">
                    <span className="dot" />
                    Ready when you are
                  </div>
                </div>
                <div className="productbody">
                  <aside>
                    <div className="mockbrand">
                      <img src={logoUrl} alt="" /> Studio
                    </div>
                    <small>WORKSPACE</small>
                    <div className="active">
                      <Layers size={15} />
                      My macros <span>0</span>
                    </div>
                    <div>
                      <ScanLine size={15} />
                      Vision tools
                    </div>
                    <div>
                      <Orbit size={15} />
                      Marketplace
                    </div>
                    <div className="bottomaside">
                      Everything in flow.
                      <br />
                      <small>Designed for your desktop.</small>
                    </div>
                  </aside>
                  <div className="mockcanvas">
                    <div className="mockhead">
                      <div>
                        <small>EXAMPLE FLOW / PRODUCTIVITY</small>
                        <h3>A little less clicking.</h3>
                      </div>
                      <span className="play">
                        <Play size={14} fill="currentColor" /> Run flow
                      </span>
                    </div>
                    <div className="mocktarget">
                      <span className="targeticon">
                        <MousePointer2 size={18} />
                      </span>
                      <div>
                        <small>TARGET WINDOW</small>
                        <strong>Browser · active window</strong>
                      </div>
                      <span className="pill">Connected</span>
                    </div>
                    <div className="mockblocks">
                      <div className="block lavender">
                        <Layers size={16} />
                        <b>Repeat</b>
                        <span>until stopped</span>
                        <div className="innerblock peach">
                          <MousePointer2 size={16} />
                          <b>Click</b>
                          <span>left mouse button</span>
                        </div>
                        <div className="innerblock mint">
                          <Orbit size={16} />
                          <b>Wait</b>
                          <span>100 milliseconds</span>
                        </div>
                      </div>
                    </div>
                    <div className="mockfooter">
                      <span className="dot" /> A simple flow. Endless time
                      saved.
                      <span>F7 to stop</span>
                    </div>
                  </div>
                  <div className="mockinspector">
                    <small>FLOW SETTINGS</small>
                    <h4>Make it yours.</h4>
                    <label>Click interval</label>
                    <div>
                      100 <small>ms</small>
                    </div>
                    <label>Mouse button</label>
                    <div>
                      Left button <span>⌄</span>
                    </div>
                    <hr />
                    <ShieldCheck size={22} />
                    <h5>Always in control.</h5>
                    <p>
                      Choose your window.
                      <br />
                      Stop at any moment.
                    </p>
                  </div>
                </div>
              </div>
              <div className="underproduct">
                <span>VISUAL BY DESIGN</span>
                <span>LOCAL BY DEFAULT</span>
                <span>BUILT TO FLOW</span>
              </div>
            </section>
            <section id="features" className="features reveal">
              <div className="sectionlabel">MEET YOUR NEW SHORTCUT</div>
              <h2>
                Powerful possibilities.
                <br />
                <span>Refreshingly simple.</span>
              </h2>
              <div className="featuregrid">
                <article>
                  <div className="featureicon lavender">
                    <Layers />
                  </div>
                  <h3>Build it. Block by block.</h3>
                  <p>
                    Drag actions into place. Add loops, waits, and conditions.
                    No scripting required.
                  </p>
                  <div className="miniflow">
                    <span>Find “Skip”</span>
                    <ArrowRight size={14} />
                    <span>Click match</span>
                  </div>
                </article>
                <article>
                  <div className="featureicon mint">
                    <ScanLine />
                  </div>
                  <h3>A flow that can see.</h3>
                  <p>
                    Find visible text, colors, and image templates. Turn a
                    match into an action with OCR and visual matching.
                  </p>
                  <div className="scanpreview">
                    <span>Video playing</span>
                    <b>
                      Skip ad <ArrowRight size={13} />
                    </b>
                  </div>
                </article>
                <article>
                  <div className="featureicon peach">
                    <ShieldCheck />
                  </div>
                  <h3>Your window. Your rules.</h3>
                  <p>
                    Target a foreground app or work across your desktop. Export
                    your flows. Stop instantly with F7.
                  </p>
                  <div className="keycaps">
                    <kbd>F7</kbd>
                    <span>One key. Full control.</span>
                  </div>
                </article>
              </div>
            </section>
            <section className="market-teaser reveal">
              <div>
                <div className="sectionlabel">THE COMMUNITY TOOLBOX</div>
                <h2>Discover flows made to save time.</h2>
                <p>
                  Browse curated starter macros, ratings, and community uploads
                  on the dedicated marketplace.
                </p>
              </div>
              <a className="primary" href="./marketplace/">
                Open marketplace <ArrowUpRight size={17} />
              </a>
            </section>
            <section className="closing reveal" id="download">
              <div className="eyebrow">MAKE ROOM FOR WHAT MATTERS</div>
              <h2>
                Let your desktop
                <br />
                do the busywork.
              </h2>
              {configured ? (
                <a className="primary" href={installerUrl}>
                  <Download size={17} /> Get Flowforge for Windows
                </a>
              ) : (
                <div className="setupnote">
                  Source preview · Add your GitHub repository in{" "}
                  <code>config.json</code>
                  <br />
                  and publish a release to activate downloads.
                </div>
              )}
              <p>A calmer workflow is one flow away.</p>
            </section>
          </>
        )}
      </main>
      <footer>
        <a className="brand" href="#">
          <img className="footer-mark" src={logoUrl} alt="" />
          flowforge
        </a>
        <span>Thoughtfully made. Open by design.</span>
        {configured ? (
          <a href={`https://github.com/${config.repository}`}>
            Source on GitHub <ArrowUpRight size={14} />
          </a>
        ) : (
          <span>v{config.version} · source preview</span>
        )}
      </footer>
      {toast && (
        <div role="status" className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <dialog open aria-modal="true" aria-labelledby="modal-title">
            <button
              className="close iconbutton"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "upload" ? (
              <>
                <div className="featureicon lavender">
                  <Plus />
                </div>
                <h2 id="modal-title">Share a little possibility.</h2>
                <p>
                  Choose an exported Flowforge JSON macro. This demo adds it to
                  your browser’s local toolbox.
                </p>
                <label className="filedrop">
                  Choose a .json macro
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => upload(e.target.files[0])}
                  />
                </label>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <small>256 KB maximum · Declarative blocks only</small>
              </>
            ) : modal === "scan" ? (
              <>
                <div className="featureicon mint">
                  <ShieldCheck />
                </div>
                <h2 id="modal-title">A closer look.</h2>
                <p>
                  Schema validation is real. The animated security review is a
                  simulation and cannot certify a macro as safe.
                </p>
                {[
                  "Valid JSON and supported schema",
                  "Allowlisted actions only; no executable scripts",
                  "Preview ready — review actions before running",
                ].map((v, i) => (
                  <div className="checkrow" key={v}>
                    {scan > i ? (
                      <Check size={18} />
                    ) : (
                      <span className="spinner" />
                    )}
                    {v}
                  </div>
                ))}
                <button
                  className="primary"
                  disabled={scan < 3}
                  onClick={() => {
                    setItems([
                      ...items,
                      {
                        id: crypto.randomUUID(),
                        name: pending.name,
                        description:
                          "Custom macro. Review all actions and targets before running.",
                        category: "Utility",
                        icon: "orbit",
                        macro: pending,
                      },
                    ]);
                    setModal(null);
                    setToast("Macro added to your local toolbox.");
                  }}
                >
                  Add to local toolbox <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="featureicon peach">
                  <Flag />
                </div>
                <h2 id="modal-title">Report a suspicious macro.</h2>
                <p>
                  {modal.item.name} · Saved locally in this demo. No moderator
                  receives this report.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutate(modal.item.id, {
                      report: new FormData(e.target).get("reason"),
                    });
                    setModal(null);
                    setToast("Report saved locally.");
                  }}
                >
                  <textarea
                    required
                    name="reason"
                    minLength={10}
                    maxLength={1000}
                    placeholder="What looks suspicious?"
                  />
                  <button className="primary">Save local report</button>
                </form>
              </>
            )}
          </dialog>
        </div>
      )}
    </>
  );
}
function ArrowDownIcon() {
  return <Download size={14} />;
}
createRoot(document.getElementById("root")).render(<App />);
