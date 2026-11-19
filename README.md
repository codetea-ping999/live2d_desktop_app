# Live2D Desktop App

[![CI](https://github.com/codetea-ping999/live2d_desktop_app/actions/workflows/ci.yml/badge.svg)](https://github.com/codetea-ping999/live2d_desktop_app/actions/workflows/ci.yml)

A desktop mascot for **macOS** (also runs on Windows / Linux) that shows a Live2D
character in a transparent, always-on-top window. Models are stored locally, so
the app works offline.

---

## 🚀 Setup (first time only)

### 1. Node.js

Install **Node.js 22** (see `.nvmrc`). Check with `node -v`.

### 2. Live2D runtime (required, not included)

The Live2D runtime scripts cannot be redistributed, so add the one(s) for your
models to `src/renderer/public/lib/`:

| File                      | Needed for                                                   | Get it from                                                                 |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `live2dcubismcore.min.js` | Cubism 4 / 5 models (`*.model3.json`)                        | [Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/) → `Core/` |
| `live2d.min.js`           | Cubism 2 models (`model.json`, e.g. the classic Miku sample) | Cubism 2.1 SDK for WebGL → `lib/`                                           |

Details: [`src/renderer/public/lib/README.md`](src/renderer/public/lib/README.md).

### 3. Dependencies

```bash
npm install
```

---

## ▶️ Run (development)

```bash
npm run dev
```

The first time, the library is empty: click **＋ Import model** and choose a
model folder (or its `*.model3.json` / `model.json`).

---

## ✨ Controls

| Action                | How                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------- |
| Move the window       | Drag the character. A short click is a tap (plays a motion).                          |
| Settings              | Hover the ⚙️ button (top-right).                                                      |
| Size / transparency   | **Scale** and **Opacity** sliders.                                                    |
| Switch model / import | **Model** selector and **＋ Import** in the settings panel.                           |
| Always on top         | **📌 Pinned** button, or the tray menu.                                               |
| Click-through         | **👻** button or tray menu. Clicks then go to the apps behind the character.          |
| Leave click-through   | Hover the 👻 button and click it, press **⌘⇧L** (Ctrl+Shift+L), or use the tray menu. |
| Quit                  | **✕ Close** button or tray menu → Quit.                                               |

Everything above (window position and size, scale, opacity, always-on-top,
click-through, selected model) is restored on the next launch. If a monitor is
disconnected, the window moves back onto a visible screen.

### Where models live

- **Imported models:** the app's data folder — `~/Library/Application Support/Live2D Desktop/models/` on macOS.
  Import copies only the files the model references and checks that nothing is missing.
- **Bundled models (optional):** folders in [`src/renderer/models/`](src/renderer/models/README.md) are shipped inside the app.

---

## 📦 Build the app

```bash
npm run build:mac     # typecheck + bundle + dist/*.dmg (unsigned)
```

The app is written to `dist/` (e.g. `dist/mac-arm64/Live2D Desktop.app` and
`dist/live2d-desktop-app-1.0.0-arm64.dmg`). Unsigned builds open with
right-click → Open the first time. Signing and notarization:
[`docs/macos-release.md`](docs/macos-release.md).

Other platforms: `npm run build:win`, `npm run build:linux`.

---

## 🧪 Checks

The same commands run in CI on every push and pull request:

```bash
npm run lint
npm run typecheck
npm test          # Vitest: no network, no Electron window, no real Live2D assets
npm run build
```

---

## 🧱 Architecture

```text
Electron main  ── DesktopController (window, tray, settings) · ModelLibrary · live2d-model:// protocol
   │  typed IPC (validated payloads, trusted sender only)
Preload (sandboxed) ── window.api
   │
React UI ── ControlOverlay · Live2DViewer
   │
CharacterRuntime ── Pixi + pixi-live2d-display + Cubism runtime
```

Security: the renderer runs with `sandbox: true`, sees only `window.api`, has
a strict production CSP (no `unsafe-eval`, no remote origins), and can open
only `https:` links externally.

---

## ❓ Troubleshooting

- **"Live2D runtime not found" / "…live2d.min.js is not installed"** — add the
  runtime file for your model's Cubism version (Setup step 2) and reload.
- **Import says files are missing** — the model's JSON references files that
  are not in the folder; the message lists them.
- **Window disappeared** — use the tray menu → Show/Hide. If it is in
  click-through mode, press ⌘⇧L.
