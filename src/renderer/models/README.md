# Bundled models (optional)

Put Live2D model folders here to ship them inside the app (read-only):

```
src/renderer/models/
  Hatsune Miku/
    model.json          (Cubism 2)  or  *.model3.json (Cubism 4)
    textures/ motions/ …
```

- In development they are listed as "(bundled)" in the model selector.
- `npm run build:mac` copies them to `Live2D Desktop.app/Contents/Resources/models/`.
- Everything in this folder except this README is git-ignored, because most
  models may not be redistributed. Check the model's license before shipping it.

Models the user imports from the UI are stored separately in the app's data folder
(`~/Library/Application Support/Live2D Desktop/models/` on macOS).
