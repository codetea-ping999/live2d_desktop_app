# Live2D runtimes (not included)

The Live2D runtime scripts cannot be redistributed in this repository, so place them here yourself.
Each one enables one model format; you only need the one(s) for the models you use.

| File | Enables | Where to get it |
| --- | --- | --- |
| `live2dcubismcore.min.js` | Cubism 4 / 5 models (`*.model3.json`) | [Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/) → `Core/live2dcubismcore.min.js` |
| `live2d.min.js` | Cubism 2 models (`model.json`, e.g. the classic Miku sample) | Cubism 2.1 SDK for WebGL → `lib/live2d.min.js` |

Both files are git-ignored. After placing a file, restart `npm run dev` or reload the window.

If a model needs a runtime that is missing, the app shows which file to add instead of a blank window.
