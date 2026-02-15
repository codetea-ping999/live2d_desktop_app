# Live2D Desktop App

A desktop mascot application for **Mac** that displays a Live2D character (e.g., Hatsune Miku) floating on your desktop with a transparent background.

---

## 🔰 Beginner's Guide & Overview

This application uses **Electron** (which runs web technologies as a desktop app) and **PixiJS** (for rendering graphics).

**How it works:**
1. You run a command in the terminal to start the app.
2. A window appears with the character.
3. You can interact with the character (drag, resize, etc.).
4. The background is transparent so it looks like the character is on your desktop wallpaper.

---

## 🚀 Setup (First Time Only)

### 1. Prerequisites
Ensure you have **Node.js** installed on your Mac.
- Check by running in Terminal: `node -v`
- If not installed, download from [nodejs.org](https://nodejs.org/).

### 2. Download Live2D Cubism SDK (Required)
The application needs a specific file from Live2D to work. This file cannot be distributed with the source code due to licensing, so you must add it manually.

1. Go to the [Live2D Cubism SDK Download Page](https://www.live2d.com/en/sdk/download/web/).
2. Accept the license agreement and download **Cubism SDK for Web**.
3. Extract the downloaded zip file.
4. Find the file: `Core/live2dcubismcore.min.js`.
5. Copy this file into the project folder at:
   `src/renderer/public/lib/live2dcubismcore.min.js`
   *(If the folder `src/renderer/public/lib/` does not exist, create it first.)*

### 3. Install Project Dependencies
Open your **Terminal**, navigate to this project folder, and run:
```bash
npm install
```
This downloads all the necessary libraries to run the app.

---

## ▶️ How to Start (Development Mode)

To run the application while you are working on it or just want to test it:

1. Open **Terminal** in the project folder.
2. Run the command:
   ```bash
   npm run dev
   ```
3. Wait a moment. The application window should appear on your desktop.

**Note:** In development mode, you might see a "DevTools" window (code inspector) open alongside the character. You can close it if you don't need it.

---

## 📦 How to Build (Create App File)

To create a standalone application file (`.app`) that you can run without the Terminal:

1. Run the build command:
   ```bash
   npm run build:mac
   ```
2. Once finished, look in the `dist/` or `dist/mac/` folder inside the project directory.
3. You will find the application file (e.g., `Live2D Desktop App.app` or similar). You can double-click this to run it!

---

## ✨ Controls & Features

- **Move Character**: Click and drag anywhere on the character to move it around your screen.
- **Resize / Opacity**:
  - Hover your mouse over the **top-right** area of the character.
  - A control panel will appear. Use the sliders to change the size (Scale) or transparency (Opacity).
- **System Tray**:
  - Look for the app icon in your Mac's top menu bar (Tray).
  - Click it to see options like **"Toggle Always on Top"** (keep character above everything) or **"Quit"** to close the app.
- **Interaction**: The character's eyes will follow your mouse cursor.

---

## ❓ Troubleshooting

- **"Module not found" error**:
  Did you run `npm install`? Make sure all dependencies are installed.
- **Blank white window**:
  Did you copy the `live2dcubismcore.min.js` file correctly? See step 2 in Setup.
- **Character not appearing**:
  Check the Terminal for errors. If it says network error, check your internet connection (the model is loaded from the internet by default).
