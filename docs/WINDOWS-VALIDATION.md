# Native acceptance checks

This starter's JavaScript tests and Vite builds were verified in a Linux
workspace. Rust compilation, an actual NSIS installer, input delivery, DPI behavior,
and live OCR were not verified there. The Windows Actions job compiles the native
code and builds the installer; these interactive checks still require Windows.

1. Install from the generated NSIS artifact on Windows 10/11 with WebView2.
2. Use a test window (Notepad) first. Start a finite loop, switch to that window
   within the three-second countdown, then verify click/key/hold behavior.
3. Press F8 during a delay, drag, key hold and OCR request. All held input must
   release. No input may occur after stop.
4. Lose focus, close or minimize the target. Verify the session stops, rather
   than sending input into another foreground window.
5. Verify absolute coordinates are client-relative, relative movement stays
   inside the selected client area, and out-of-bounds movement is rejected.
6. Test Find Text against a visible “Skip” label at 100% display scaling;
   verify its bounding box center and confidence threshold. Use dry review
   (`click: false`) before enabling clicks. Test a multi-word label as well.
7. Verify Find Color, timeout, found/not-found branches and nested loops.
8. Test global input, target window input and monitor boundaries separately.
   Vision currently supports a target fully on one monitor at 100% scaling;
   global vision scans the monitor containing screen coordinate (0,0).
9. Import malformed JSON, unsupported fields and deeply nested blocks. Reject
   them. Import valid JSON, save, restart, export and compare the macro contents.
10. Run release/update checking against your own published release. Offline or
    rate-limited GitHub must not prevent normal local use.

Protected/elevated apps, exclusive fullscreen games, and some Roblox input paths
may reject synthetic input or screenshot capture. No guarantee of anti-AFK
behavior, ad recognition, game acceptance, or detection avoidance is made.
A text match is a visible label, not proof that the label is an ad-skip button.
Restrict the window and choose a precise phrase to reduce unwanted clicks.

## Performance boundaries

OCR worker/WASM is lazy-loaded and reused. English language data downloads on
first use (network required); subsequent loading uses Tesseract's cache. For a
fully offline release, ship a licensed traineddata asset and change langPath to
a local directory. Polling waits at least the configured interval after each
recognition; a 500 ms setting does not guarantee two OCR passes per second.
4K screenshot encoding and OCR are expensive. The two-second input watchdog may
stop a run during slow native screenshot work. Benchmark CPU, memory and latency
on representative Windows hardware before publishing performance claims.

Native checks use foreground identity rather than injecting into background
processes. A very small focus-change race remains between checking foreground
state and delivering a Windows input event; this is standard foreground input,
not exclusive window delivery. F8 is polled through GetAsyncKeyState; no installed
keyboard hook or kernel driver is used.
