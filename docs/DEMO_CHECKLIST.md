# Installed iPhone demo

Keep the Mac and iPhone on the same Wi-Fi. Use `npm run iphone:dev` for the installed development build. If it is already running, reload Align from its development menu; do not start a second server on the same port. If the launcher was restarted, reopen the current development QR code so the API address and temporary token match.

1. Open Align, start a scan, and choose voice coaching.
2. Place the rear camera at hip height with the whole body visible. Continue from setup.
3. Start the scan. Follow front, right, back, left instructions. The counter and small thumbnail reflect actual retained camera images. A missed image holds the current phase. The four labels are instructed views, not automatic body-orientation detection.
4. Tap the microphone, ask a short question, then tap again to send (automatic send after 15 seconds). Scanning pauses during the question. Allow about 10–30 seconds for the provider. OMNI speech plays when returned; the answer remains readable in captions.
5. After the four views finish, record a goal such as “I feel stiff after working at my desk; what can I try?” The final request includes all four retained photos, even if an earlier live upload failed.
6. Review observations, practical actions, limitations, and cited sources. Save the session on the phone.

The native app captures real photos and OMNI reviews them. It does not currently perform native pose landmark detection, measure posture angles, diagnose conditions, or infer the cause of pain from appearance.

## Verification

- `npm test`
- `npm run build`
- `npm run omni:smoke` sends the repository preview image and generated test speech to the configured YibuAPI provider. On macOS it checks M4A voice input, verifies the returned WAV container with the native decoder, and checks four-view guidance. It does not validate real body-analysis accuracy.

The provider streams 24 kHz mono PCM; the API wraps it in a WAV container before iPhone playback. See [Qwen-Omni audio documentation](https://www.alibabacloud.com/help/en/model-studio/qwen-omni).
