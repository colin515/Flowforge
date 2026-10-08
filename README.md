# Flowforge

[**Website**](https://colin515.github.io/Flowforge/) · [**Marketplace**](https://colin515.github.io/Flowforge/marketplace/) · [**Windows downloads**](https://github.com/colin515/Flowforge/releases/latest)

A repository-ready Windows automation starter and an Apple-inspired community
landing page. Tauri 2 + Rust + React power the desktop; React/Vite and CSS power
the GitHub Pages site. Tesseract.js supplies open-source OCR. Plain CSS keeps the
styling dependency footprint small; Lucide provides consistent SVG icons.

**Status:** v0.4.1 opens to an empty local library. Users create, import or install
macros from the catalog. Builder, Marketplace, and Run & Logs remain isolated
views. The Windows installer is built by GitHub Actions. Marketplace
engagement remains local to each device; shared accounts, counts, and moderation
require a service beyond static GitHub Pages.

## Included

- Light/dark themes, responsive landing page, scroll-driven product and feature
  motion with reduced-motion support, marketplace filters/search, and a CTA that
  resolves the latest published NSIS `.exe` through GitHub's Releases API.
- No macros installed on first launch. The catalog offers five curated flows:
  locked Default Roblox Anti-AFK, Auto-Clicker with a dedicated settings panel,
  Smart Ad Skipper with visible-text OCR, and Da Hood Mobility Flow with
  configurable movement key chords, plus Local AI Agent Suite. Games may restrict automation.
- JSON uploads with strict real schema validation, clearly labelled simulated
  review animation, local downloads/counts, ratings, thumbs up/down and reports.
- Visual block builder: drag palette blocks into nested lists, append through
  keyboard-friendly controls, reorder, inspect fields, duplicate, save,
  import/export JSON. Built-in Anti-AFK is immutable in the UI; editable copies
  are supported. The local library is empty on a fresh install.
- Relative/absolute movement, left/right clicks, timed key holds, text typing, drags, waits,
  randomized delays, finite/infinite nested loops, while/until, nested if/else,
  break/continue, variables, arithmetic and numeric comparisons.
- Text/phrase, RGB color, and uploaded PNG/JPEG/WebP template matching with a
  confidence threshold, pixel-coordinate click results and log feedback. The
  stored template is embedded as PNG in exported JSON and limited to 128 × 128
  pixels. OCR worker
  and WASM load on demand. English traineddata downloads on first use.
- Exact-pixel RGB checks with per-channel tolerance and conditional found state.
- Local AI Agent Suite can be installed from the Marketplace. It adds two
  draggable blocks: bounded screenshot-based navigation and a strict boolean
  If/Else. A prompt-to-flow generator creates validated JSON blocks for review.
  Ollama's local `qwen2.5vl:3b` model is pulled only when AI is invoked and
  explicitly unloaded after the run; a one-minute keep-alive also limits memory
  residency if the app exits unexpectedly. It is not downloaded on launch.
- Foreground Windows target selection or global input; cursor bounds checks,
  three-second countdown, F7 stop, focus-loss stop and two-second watchdog.
- Optional smooth mouse interpolation with easing and configurable duration.
  Humanization adds modest timing and path variation while preserving endpoints;
  it cannot guarantee avoidance of bot or anti-cheat detection.
- Key chords (for example `w+Shift`) hold keys together and release them in
  reverse order, including during cancellation.
- New vector branding and a matching multi-resolution Windows icon.
- Frameless Windows window with draggable translucent titlebar and native
  minimize, maximize/restore and close controls. Optional synthesized click,
  completion and error sounds use Web Audio without external media assets.
- Public GitHub release version-check notification; Pages and NSIS workflows.
- In-app Marketplace catalog with direct, schema-validated macro installation.

## Quick start

Install Node.js 22 or newer. For native development on Windows, install stable
Rust (1.87+), Visual Studio C++ Build Tools and Microsoft Edge WebView2.
See the official [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm ci
npm run ocr:assets
npm test
npm run dev:web
```

Web preview: http://localhost:5173. Desktop UI browser preview:

```bash
npm run dev:desktop
```

Native Windows app (run separately; do not also run dev:desktop):

```bash
npm run desktop -- dev
```

The AI suite requires a separately installed and running [Ollama](https://ollama.com/download/windows)
service on `127.0.0.1:11434`. Installing the marketplace entry configures the
blocks and generator in Flowforge; the first AI request downloads the roughly
3B-parameter model through Ollama. This is a substantial download and needs
disk space. The application does not bundle or silently install Ollama. The
model is only loaded into memory when an AI request starts; GPU memory use
depends on the model/runtime and cannot be guaranteed on a particular card.

Windows installer:

```bash
npm run desktop -- build
```

Output: `apps/desktop/src-tauri/target/release/bundle/nsis/*-setup.exe`.
The root `npm run build` builds both frontends; it does not build an installer.
Prepare OCR assets before the desktop build; CI does this automatically.
If a restricted development environment cannot enumerate network interfaces,
use `npm run dev -w @flowforge/web -- --host 127.0.0.1`.

## GitHub repository and hosting

- Repository: https://github.com/colin515/Flowforge
- Landing page: https://colin515.github.io/Flowforge/
- Marketplace: https://colin515.github.io/Flowforge/marketplace/
- Latest Windows release: https://github.com/colin515/Flowforge/releases/latest

The Pages workflow builds the two web entries and commits the output to the
`split-websites` branch. GitHub Pages serves the branch root, with the marketplace
under `/marketplace/`, including its catalog and JSON macros. The Windows workflow
validates Rust and publishes the NSIS installer as release `v0.4.1`.

## Source layout

```text
flowforge/
  .github/workflows/
    pages.yml                   # Build and publish both sites to split-websites
    windows.yml                 # Rust check, NSIS build, GitHub Release
  apps/
    desktop/
      src/
        main.jsx                # Isolated Builder, Marketplace and Run views
        vision.js               # Tesseract OCR, color and image matching
        pixel-check.js          # Pure exact-pixel color match
        audio.js                # Native WebView audio cues
        local-ai.js             # Constrained model output and generator
        template-match.js       # Cancellable pixel template search and confidence
        assets/flowforge-mark.svg # Vector logo
        style.css               # Adaptive light/dark desktop interface
      public/ocr/               # Generated worker/WASM, not committed
      src-tauri/
        src/main.rs             # Native session/input/capture/watchdog commands
        src/ai.rs               # Fixed local Ollama bridge and license check
        src/windows.rs          # Win32 enumeration and foreground/client bounds
        capabilities/default.json
        icons/icon.ico
        Cargo.toml
        build.rs
        tauri.conf.json
      index.html
      package.json
      vite.config.js
    web/
      src/main.jsx              # Landing page and separate marketplace
      src/style.css             # Glass navigation, animation, responsive themes
      index.html
      marketplace/index.html
      public/marketplace/catalog.json
      public/marketplace/macros/*.json
      src/assets/flowforge-mark.svg
      package.json
      vite.config.js
  packages/shared/
    macros.js                   # Starter definitions + strict JSON validation
    runner.js                   # Cancellable interpreter and humanization
  examples/
    roblox-afk.json
    auto-clicker.json
    ad-skipper.json
    da-hood-mobility.json
    local-ai-suite.json
  scripts/
    ocr-assets.mjs              # Copies installed open-source OCR assets
    check-config.mjs            # Repository/version readiness check
  tests/macros.test.js
  docs/
    PRODUCTION-MARKETPLACE.md   # Backend contract/storage/moderation boundary
    WINDOWS-VALIDATION.md       # Native behavior + performance acceptance
  config.json
  package.json
  package-lock.json
  LICENSE
  README.md
```

## Coordinates, targeting and cancellation

For a selected window, absolute move/drag coordinates are relative to its client
area; relative movements use the current cursor position. Global mode uses
screen coordinates. Native input is ordinary foreground input, not background
window injection. The target must be in front after the countdown, and the
cursor must stay inside its client area. Begin with a test window and finite
loops. Press F7 at any time to release held inputs and stop the session; F8
remains an undocumented compatibility shortcut for existing users.

AI navigation accepts only a single validated click, key, text, scroll, done,
or fail action per screenshot. It refuses clicks outside the captured image,
limits each block to at most 20 steps, and checks the native focus interlock
before each input. Model decisions can still be inaccurate. Review generated
flows, use a selected window, and supervise runs.

OCR matches a whole word or phrase within a recognized line; it clicks the
center of the bounding box only if each word meets the confidence threshold.
Find Color selects the first matching pixel within the per-channel tolerance.
All vision blocks set a found/not-found state consumed by `ifFound`. Repeated scanning waits
for each result before scheduling the next pass: 500 ms is a requested interval,
not a throughput guarantee. Text recognition is not semantic ad detection.

Vision currently requires **100% Windows display scaling** and a target fully
inside one monitor; global vision uses the display containing screen (0,0).
These restrictions fail explicitly rather than silently clicking wrong pixels.
Hidden/minimized windows, elevated/protected apps and some game input paths are
unsupported. Anti-AFK micro-movements may not reset a particular game's idle
state. [Windows acceptance checks](docs/WINDOWS-VALIDATION.md) cover these limits.

## Trust boundary

Macros are declarative JSON, not executable code. Unknown fields and actions,
oversize files, invalid ranges and excessive nesting are rejected. The app
exposes a narrow native command bridge; it includes no shell plugin, arbitrary
filesystem access or process injection. JSON may still perform unwanted clicks.
The “security scan” is a UI simulation plus actual schema validation; it is not
antivirus and does not prove safe intent. Local stats are not real community
aggregates. See [production marketplace plan](docs/PRODUCTION-MARKETPLACE.md)
for the separately hosted service needed for shared uploads, votes and reports.

The local model listing currently declares Apache 2.0 and Ollama is MIT;
Flowforge checks the model-reported Apache 2.0 license before use. Lucide icons
use the permissive ISC license, with some Feather-derived icons under MIT.
Tesseract.js is Apache 2.0. A full transitive dependency notice/SBOM audit is
still required before claiming every packaged component has only MIT or Apache
2.0 terms. No model weights or Ollama executable are redistributed here.

## Verification and limits

The repository tests cover schema rejection, nested control flow, variable math,
pixel checks, vision coordinates,
template confidence/centering, key chords, smooth endpoints, and cancellation.
GitHub Actions runs the web and desktop frontend builds, Rust check, and NSIS
installer packaging. Native input, game-specific behavior and OCR/template
accuracy still need interactive Windows acceptance checks. No production
security certification has been performed. Cargo.lock should be committed
after a successful native build to make Rust resolution reproducible.

## Open-source references

- [Tauri 2 Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/)
- [Tesseract.js source and API](https://github.com/naptha/tesseract.js)
- [Enigo Rust input library](https://github.com/enigo-rs/enigo)
- [screenshots capture library](https://github.com/nashaofu/screenshots-rs)

Check dependency and traineddata licenses when preparing a distribution.
This project's original source uses the MIT license; third-party libraries retain
their own licenses.
