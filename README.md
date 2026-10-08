# Flowforge

[**Website**](https://colin515.github.io/Flowforge/) · [**Marketplace**](https://colin515.github.io/Flowforge/marketplace.html) · [**Windows downloads**](https://github.com/colin515/Flowforge/releases/latest)

A repository-ready Windows automation starter and an Apple-inspired community
landing page. Tauri 2 + Rust + React power the desktop; React/Vite and CSS power
the GitHub Pages site. Tesseract.js supplies open-source OCR. Plain CSS keeps the
styling dependency footprint small; Lucide provides consistent SVG icons.

**Status:** both frontend production builds and shared interpreter tests pass.
The native Windows source has not been compiled or run in this Linux workspace.
The included Windows workflow builds an NSIS `.exe` installer. Treat the project
as a starter until that build and the Windows acceptance checks pass. The
marketplace is a working browser-local demo, not a connected community service.

## Included

- Light/dark themes, responsive landing page, animated reveals, reduced-motion
  support, product preview, marketplace filters/search and release download CTA.
- Three starter macros: locked Default Roblox Anti-AFK, Auto-Clicker with a
  dedicated configuration panel, and Smart Ad Skipper with visible-text OCR.
- JSON uploads with strict real schema validation, clearly labelled simulated
  review animation, local downloads/counts, ratings, thumbs up/down and reports.
- Visual block builder: drag palette blocks into nested lists, append through
  keyboard-friendly controls, reorder, inspect fields, duplicate, save,
  import/export JSON. Built-in Anti-AFK is immutable in the UI; editable copies
  are supported. Starter items remain present after reload.
- Relative/absolute movement, left/right clicks, timed key holds, drags, waits,
  randomized delays, finite/infinite nested loops and found/not-found branches.
- Text/phrase and RGB color matching; pixel-coordinate click results. OCR worker
  and WASM load on demand. English traineddata downloads on first use.
- Foreground Windows target selection or global input; cursor bounds checks,
  three-second countdown, F8 stop, focus-loss stop and two-second watchdog.
- Optional humanization: ±10% wait variation and up to 2 px mouse-path curvature,
  preserving endpoints. Random variation does not guarantee detection avoidance.
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
- Marketplace: https://colin515.github.io/Flowforge/marketplace.html
- Latest Windows release: https://github.com/colin515/Flowforge/releases/latest

The Pages workflow builds both web entries and publishes the landing page,
marketplace, catalog and downloadable JSON macros. The Windows workflow validates
Rust and creates the NSIS installer. Release tags use the matching app version,
for example `v0.1.0`.

## Source layout

```text
flowforge/
  .github/workflows/
    pages.yml                   # Static Pages deployment
    windows.yml                 # Rust check, NSIS build, draft Release
  apps/
    desktop/
      src/
        main.jsx                # Studio, nested block builder, clicker panel
        vision.js               # Tesseract OCR and pixel color matching
        style.css               # Adaptive light/dark desktop interface
      public/ocr/               # Generated worker/WASM, not committed
      src-tauri/
        src/main.rs             # Native session/input/capture/watchdog commands
        src/windows.rs          # Win32 enumeration and foreground/client bounds
        capabilities/default.json
        icons/icon.ico
        Cargo.toml
        build.rs
        tauri.conf.json
      index.html
      marketplace.html
      public/catalog.json
      public/macros/*.json
      package.json
      vite.config.js
    web/
      src/main.jsx              # Landing page and separate marketplace
      src/style.css             # Glass navigation, animation, responsive themes
      index.html
      package.json
      vite.config.js
  packages/shared/
    macros.js                   # Starter definitions + strict JSON validation
    runner.js                   # Cancellable interpreter and humanization
  examples/
    roblox-afk.json
    auto-clicker.json
    ad-skipper.json
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
loops. Press F8 at any time to release held inputs and stop the session.

OCR matches a whole word or phrase within a recognized line; it clicks the
center of the bounding box only if each word meets the confidence threshold.
Find Color selects the first matching pixel within the per-channel tolerance.
Both set a found/not-found state consumed by `ifFound`. Repeated scanning waits
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

## Verified here / still needed

Verified: Vite production builds for web and desktop renderer; starter schema,
unknown-action/field rejection, nested loop/branch order, OCR click coordinate
translation, humanized movement endpoints and cancellation cleanup (7 tests).
Browser interaction/screenshot testing was unavailable because the workspace had
no Chromium executable and its browser download failed.
Native Rust compilation and runtime behavior require Windows CI and interactive
acceptance. No performance benchmarks or production security certification have
been performed. Cargo.lock should be committed after your first successful
native build to make subsequent Rust dependency resolution reproducible.

## Open-source references

- [Tauri 2 Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/)
- [Tesseract.js source and API](https://github.com/naptha/tesseract.js)
- [Enigo Rust input library](https://github.com/enigo-rs/enigo)
- [screenshots capture library](https://github.com/nashaofu/screenshots-rs)

Check dependency and traineddata licenses when preparing a distribution.
This project's original source uses the MIT license; third-party libraries retain
their own licenses.
