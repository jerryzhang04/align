# Align

Align is an iPhone-first guided posture capture prototype for Hack the North 2026. The native Expo app levels the camera, guides a front/right/back/left capture, records a spoken question, and sends the current frame plus audio to OMNI. OMNI owns understanding, response text, and speech. Captions and local capture continue when cloud coaching is unavailable.

The app is honest by design: it does not display posture angles or scores until a verified native pose pipeline supplies those measurements.

## Current prototype status

The Expo app and local API are implemented and build successfully for a physical iPhone. The first native development build has been compiled and installed on a test device. The current prototype includes the complete guided capture flow and OMNI integration, but it deliberately withholds posture scores and angles until a validated native pose pipeline is connected.

## Fastest iPhone workflow

Requirements: Node 22.13+, npm, and an iPhone on the same Wi-Fi network as this Mac.

For everyday UI and TypeScript work, use Expo Go:

```text
npm install
cp .env.example .env
npm run iphone
```

Install Expo Go on the iPhone, then scan the QR code printed by Expo. This one command starts both the API and Metro, discovers the Mac's LAN address, and creates a temporary API access token for that run. It never sends OMNI credentials to the app.

JavaScript and TypeScript changes appear through Fast Refresh and do not need a native rebuild.

### Native development build

Use the development client when testing native behavior or after adding an Expo module. Connect the iPhone by USB, trust the Mac, enable Developer Mode, and run the one-time build:

```text
npm run iphone:build
```

Select the connected phone when Expo asks. If iOS installs Align but blocks the first launch, open **Settings → General → VPN & Device Management**, select the Apple Development profile, and tap **Trust**.

After the app is installed and trusted, use this faster daily loop:

```text
npm run iphone:dev
```

Both iPhone launchers start the API and Metro together. They discover the Mac's private LAN address, expose the development API on the Mac's network interfaces for that process, and share a fresh temporary API token with the app. Provider credentials remain server-side. Use this launcher only on a trusted development network.

The generated `apps/mobile/ios` directory is intentionally ignored. Expo prebuild regenerates it from `app.json` and the committed config plugin, avoiding machine-specific signing-team metadata in Git.

To use the simulator instead, run `npm run api` and `npm run mobile:ios` in separate terminals.

## Provider configuration

Set credentials only in the ignored root `.env`. Never put provider credentials in `EXPO_PUBLIC_*` variables.

- `OMNI_API_KEY` must be a sponsor-issued YibuAPI credential. Non-Yibu providers and non-OMNI models are rejected by the server.
- `OMNI_AUDIO_OUTPUT=true` requests native OMNI speech. Set it to `false` only when the Yibu configuration returns text without audio.
- The current architecture uses OMNI for multimodal understanding and speech. When OMNI returns no audio, the app keeps the response visible as captions.
- The app remains usable for local capture when cloud coaching is unavailable.

## What is implemented

- Expo Router native navigation for home, consent, setup, live scan, and recap.
- Rear-camera four-view capture with a three-second hands-free countdown.
- Device-motion horizon guide for a level phone on a stand.
- Push-to-talk recording with the current camera frame attached.
- OMNI multimodal backend turn with abort, payload bounds, rate limits, and safe error mapping.
- OMNI-native speech for OMNI's response, with a caption fallback when the model returns text only.
- Four-view plus spoken-goal analysis with structured observations, conservative actions, safety escalation, and server-resolved evidence citations.
- A versioned evidence catalog backed by WHO, CCOHS, NICE, NHS, and peer-reviewed systematic-review sources.
- One-command LAN launchers with an ephemeral bearer token for physical-device testing.
- Disposable image staging until Save, followed by persistent local images and SQLite session summaries.
- VoiceOver labels, captions, minimum touch targets, and explicit local/cloud consent.
- Browser capture and MediaPipe metric work retained in `apps/web` as a development baseline.

## Verify

```text
npm test
npm run build
npx expo-doctor apps/mobile
```

The latest local verification completed the repository test suite, TypeScript/web builds, an iOS Metro export, Expo Doctor checks, and a signed physical-device Xcode build.

See [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), the [implementation specification](docs/BUILD_SPEC.md), and the [research dossier](docs/research-chinese-scanners-and-omni.md).

## Repository map

```text
apps/mobile/        Expo / React Native iOS app
apps/api/           Hono backend, OMNI adapter
apps/web/           Browser pose and capture baseline
packages/contracts/ Shared Zod request/response schemas
packages/metrics/   Pure tested geometry and aggregation logic
docs/               Build, research, validation, and demo notes
```

Align is a wellness capture tool, not a medical device. It does not diagnose conditions or claim clinical accuracy.
