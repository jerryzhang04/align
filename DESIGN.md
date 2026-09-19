# Align iOS design specification

This design is approved for the first Expo iOS prototype.

## Navigation

```text
Home -> Consent -> Setup -> Four-view scan -> Recap
  |                                      |
  +------------ Recent sessions <-------+
```

Use a native stack. Keep capture immersive with a dark camera surface; all other screens use the warm light canvas. Preserve the system back gesture before capture begins. During an active scan, stopping requires a confirmation sheet so accidental swipes do not discard progress.

## Screen contract

### Home

Lead with one outcome and one primary action: “Set the phone down. Step into frame. Align will guide the rest.” Show provider readiness as compact text, not a technical dashboard. Recent sessions show dates and completion only unless verified measurements exist.

### Consent

Use two plainly written layers: camera/audio stay on the device until the user asks the coach; a selected frame and short recording are then sent to the configured coaching service. A local-capture-only path remains available.

### Setup

The live camera fills most of the screen. A device-motion level gauge communicates roll with shape, text, and color. Show three steps: phone at hip height, full body visible, floor marker stays fixed. “Ready to scan” is enabled when permission exists and the phone is level, with a deliberate override for stands that report noisy motion values.

### Scan

Front, right, back, and left are shown as a four-step rail. A full-body framing guide sits over the camera. The main action starts a three-second countdown and captures the current view. After capture, the next view instruction replaces it. A clearly separated hold-to-talk control records a short question; releasing it captures the current frame, submits both media to OMNI, and plays OMNI's audio when it returns any, always showing matching captions.

### Recap

Show the four real captures and capture completeness. Do not show an alignment score until measurements exist. A coach summary may explain setup or capture observations, but must not invent angles. Offer “Ask about this scan,” “Retake a view,” and “Save session.”

## Accessibility and edge states

- Use semantic text styles and allow wrapping at large Dynamic Type sizes.
- Every image/control has a VoiceOver label and hint; captions are always visible when speech plays.
- State never relies only on teal/amber/coral.
- Reduce Motion removes scale pulses and uses opacity transitions.
- Permission denial shows the exact Settings recovery path.
- Provider or network failure never blocks capture or saving. Preserve the recording locally only until the request finishes, then delete it.
- Camera interruption/backgrounding pauses the countdown and active recording.

## Expo-specific value

- `expo-camera` provides the native capture surface and bounded stills.
- `expo-sensors` turns device motion into a live camera-level setup tool and stand-bump warning.
- `expo-audio` supplies microphone capture and response playback with iOS silent-mode support.
- `expo-haptics` confirms accepted captures and completion after the camera is no longer active.
- `expo-sqlite` keeps session summaries and capture references local-first.
- Expo Router provides deep-linkable native navigation and a clean EAS path to a signed demo build.
