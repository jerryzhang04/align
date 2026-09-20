# Developing Align

## Local setup

Requirements: Node.js 22.13+, npm, and a physical iPhone on the same Wi-Fi network. Building the native iOS development client also requires macOS, Xcode, and device signing.

```sh
npm install
cp .env.example .env
```

Set the sponsor-issued `OMNI_API_KEY` in the root `.env`. The demo uses:

```dotenv
OMNI_BASE_URL=https://yibuapi.com/v1
OMNI_MODEL=qwen3.5-omni-flash
OMNI_AUDIO_OUTPUT=true
```

Provider credentials belong only in the ignored `.env`, never in `EXPO_PUBLIC_*` variables. The usage ledger in `artifacts/` is also ignored.

## Expo Go

```sh
npm run iphone
```

This starts the API and Metro, discovers the computer's LAN address, and shares a temporary API access token with the app. Scan the QR code with Expo Go. Use a trusted development network.

## Native iPhone development build

Connect the iPhone by USB, trust the Mac, and enable Developer Mode. Build and install:

```sh
npm run iphone:build
```

Select the connected device when prompted. If iOS requires it, trust the Apple Development profile under **Settings → General → VPN & Device Management**. Then start the API and Metro for the development client:

```sh
npm run iphone:dev
```

JavaScript and TypeScript changes use Fast Refresh. Reload the app fully after changes to persistent hook or ref state. Native dependency or configuration changes require rebuilding the development client.

The generated `apps/mobile/ios` directory is ignored. Expo prebuild regenerates it from `app.json` and the committed config plugin.

For simulator UI work, run `npm run api` and `npm run mobile:ios` in separate terminals. Use the physical iPhone to validate camera capture, microphone input, and spoken playback.

## Verification

```sh
npm test
npm run build
```

Provider checks:

```sh
npm run omni:use
npm run omni:models
npm run omni:smoke
```

The smoke test starts its own API on port 8799. It does not replace the server used by `npm run iphone`. For a person-photo test and photo-only report, see [Posture grounding](POSTURE_GROUNDING.md).

## Further reading

- [Demo checklist](DEMO_CHECKLIST.md)
- [Posture grounding and claim boundaries](POSTURE_GROUNDING.md)
- [OMNI usage reporting](OMNI_USAGE_REPORTING.md)
- [Build specification](BUILD_SPEC.md)
- [Design system](../DESIGN.md)
