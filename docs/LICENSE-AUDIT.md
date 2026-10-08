# Distribution license review

Flowforge's own source is MIT. The local AI adapter uses Ollama's loopback API;
the installer does not redistribute Ollama, model weights, drivers, or a Python
environment. At first use, `ai_prepare` pulls the fixed `qwen2.5vl:3b` tag and
checks `/api/show` for an Apache 2.0 license before generating. Model tags can
change upstream, so the runtime check is an important guard rather than a
substitute for reviewing a release's model digest.

| Direct component | License published upstream | Role |
| --- | --- | --- |
| React / React DOM | MIT | UI runtime |
| Tauri API / CLI | Apache 2.0 OR MIT | Windows shell and build |
| Tesseract.js / core | Apache 2.0 | OCR runtime |
| Enigo | MIT | Input runtime |
| Ollama (separate installation) | MIT | Local model server |
| qwen2.5vl:3b (separate pull) | Apache 2.0 per current model listing | Local vision model |
| Lucide React | ISC, some Feather-derived icons MIT | SVG icons |

The committed npm lockfile declares 116 MIT, 13 Apache 2.0 OR MIT, five
Apache 2.0, six ISC, two BSD, and one CC-BY-4.0 package among external entries.
The CC-BY-4.0 entry is `caniuse-lite` compatibility data used by the frontend
toolchain. These are permissive licenses, but **not every dependency is
literally MIT or Apache 2.0**. The Rust and generated OCR assets also need a
complete transitive notice review for a strict two-license-only distribution
policy. The CI build verifies compilation and tests; it does not issue a legal
certification. Do not advertise a 100% MIT/Apache-only dependency set without
replacing and re-auditing the other entries.

Sources: [Ollama MIT](https://github.com/ollama/ollama/blob/main/LICENSE),
[model listing](https://ollama.com/library/qwen2.5vl:3b),
[Tesseract.js](https://github.com/naptha/tesseract.js),
[Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE),
and `package-lock.json` for exact npm versions and declared licenses.
