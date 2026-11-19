# macOS release (signing & notarization)

`npm run build:mac` always works without any Apple credentials: it runs
typecheck, bundles the app and produces an **unsigned** `dist/*.dmg`.
That is enough for your own Mac (first launch: right-click → Open).

To distribute the app to other people, sign and notarize it. Credentials are
read from environment variables only — never commit them.

## 1. Signing

1. Join the Apple Developer Program and create a **Developer ID Application** certificate.
2. Install it in your login keychain, or export it as `.p12`.
3. electron-builder picks it up automatically from the keychain, or set:

   ```bash
   export CSC_LINK=/path/to/DeveloperID.p12   # or base64 content
   export CSC_KEY_PASSWORD='…'
   ```

To force an unsigned build on a Mac that has a certificate installed:
`CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`.

## 2. Notarization

`electron-builder.yml` sets `hardenedRuntime: true` (required) and keeps
`notarize: false` so normal builds never need network access to Apple.
For a release build, either:

- change `notarize` to `true` locally (do not commit if you build in CI without secrets), and
- provide one of the supported credential sets:

  ```bash
  # App-specific password
  export APPLE_ID='you@example.com'
  export APPLE_APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'
  export APPLE_TEAM_ID='ABCDE12345'
  # …or an App Store Connect API key
  export APPLE_API_KEY=/path/to/AuthKey_XXXX.p8
  export APPLE_API_KEY_ID='XXXX'
  export APPLE_API_ISSUER='uuid'
  ```

Then run `npm run build:mac`. Verify with:

```bash
spctl -a -vvv -t install "dist/mac-arm64/Live2D Desktop.app"
xcrun stapler validate dist/live2d-desktop-app-*-arm64.dmg
```

## Permissions

The app requests **no** privacy permissions (camera, microphone, Documents,
Downloads, …). Model import uses the system file picker, which grants access
to the chosen folder by itself. If a future feature needs a permission, add
its `NS…UsageDescription` under `mac.extendInfo` in `electron-builder.yml` in
the same PR.

## Bundled models

Folders in `src/renderer/models/` are copied to
`Live2D Desktop.app/Contents/Resources/models/` and appear in the model
selector as "(bundled)". Only ship models whose license allows redistribution.
