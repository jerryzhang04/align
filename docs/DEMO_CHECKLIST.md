# Hackathon demo rehearsal

## Run the current app

Use `npm run iphone` for Expo Go, or `npm run iphone:dev` for an installed development client. Keep the Mac and iPhone on the same Wi-Fi. Reload the app from Expo's menu after pulling changes. Do not stop an existing development server owned by someone else.

The local demo configuration uses the sponsored `qwen3.5-omni-flash` model. The live API's `/v1/health` response should show that model and `nativeAudioExpected: true`. The local `.env` and sponsored usage ledger must remain uncommitted.

## Two-minute presentation path

1. Choose the cloud coach option. Position the phone upright at hip height; include the person's head and feet with good lighting.
2. Start the scan. Follow Front → Right → Back → Left. The small figure is an angle reference, not a box to fit inside.
3. For a predictable operator-assisted demo, turn **Auto off**. Have the operator confirm each named angle, then tap **Capture … view**. Auto is optional and requires repeated recent pose checks; it will not capture from a stalled check.
4. Tap **Analyze posture** after the fourth photo. No microphone recording is needed to obtain measured findings. If analysis fails, the photos remain and this action can be retried.
5. Review the projected measurements and real photos. Save the session if desired.

To demonstrate multimodal voice, use **Ask coach** during capture, or **Add a question** after all four views. Tap once, speak a short question, then tap **Send question**. Recording sends automatically at 15 seconds. Captions appear with the response; **Replay coach** is available only when actual OMNI audio was returned. Final-report audio plays on the recap screen.

## Honest limits

- Auto checks framing, front-versus-profile geometry, and stillness. It does not reliably distinguish front from back, or left from right. Follow the named view and verify the photos.
- Local-only mode captures photos without uploading or measuring them; it uses manual capture.
- Measurements come from the existing metric engine applied to MoveNet landmarks. Sparse or uncertain landmarks can produce limited findings or no result; neither means perfect posture.
- In the September 20 live test, a short Flash voice turn took about 12 seconds and the four-photo report with speech about 32 seconds. Network/provider latency varies. The Plus model's report hit the 45-second timeout during the same investigation.
- The backend voice round trip and WAV decoding were verified, as was real-photo pose inference. Rehearse microphone permission, two consecutive recordings, audible playback, and the four physical turns on the actual demo iPhone.
