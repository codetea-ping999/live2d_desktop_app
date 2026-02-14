# Live2D Desktop App

A desktop mascot application built with Electron, React, TypeScript, and PixiJS.

## 🚀 Setup Required

Before running the application, you **MUST** add the proprietary Live2D Cubism SDK and a model.

### 1. Download Cubism SDK for Web
1. Go to the [Live2D Cubism SDK Download Page](https://www.live2d.com/en/sdk/download/web/).
2. Accept the license and download `Cubism SDK for Web`.
3. Extract the zip file.
4. Locate `Core/live2dcubismcore.min.js`.
5. Copy it to: `src/renderer/public/lib/live2dcubismcore.min.js`.
   * Note: If `public/lib` doesn't exist, create it. In this project structure, it should be `src/renderer/lib/` or `resources/` depending on how static assets are served. 
   * **CORRECTION**: In this `electron-vite` project, place it in `src/renderer/public/lib/` (create if missing) OR direct to `src/renderer/lib/`.
   * **Wait!** The correct path configured in `index.html` is `./lib/live2dcubismcore.min.js`.
   * **ACTION**: Put the file in `src/renderer/public/lib/live2dcubismcore.min.js`. I will create this directory for you.

### 2. Add a Live2D Model
1. Obtain a Live2D model (e.g., from [Live2D Cubism Samples](https://www.live2d.com/en/sdk/download/sample/)).
2. Place the model folder in `src/renderer/public/models/`.
   * Example: `src/renderer/public/models/hiyori/`
3. Update `src/renderer/src/App.tsx` if your model path is different from the default (`./models/hiyori/hiyori_pro_t10.model3.json`).

## 🛠 Usage

### Install Dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build:mac
```

## ✨ Features
- **Transparent Window**: The character floats on your desktop.
- **Drag to Move**: Click and drag anywhere on the character (or window body) to move.
- **Always on Top**: Kept visible above other windows (toggleable).
- **Interaction**: Eyes follow mouse, click to trigger motion.
- **Controls**: Hover over the top-right corner to access settings (Scale, Opacity, Quit).
