# Align product direction

Align is a native-feeling iPhone posture and movement capture companion. An adult places the phone on a stand, follows a calm hands-free four-view capture, and can ask a spoken question without leaving the camera flow. OMNI understands the current frame, the user's recorded question, and any locally measured facts together. OMNI speaks its own answer when it returns audio; captions always remain available.

## Product register

- Platform: Expo / React Native for iOS first, with the existing web app retained as a development and fallback surface.
- Primary user: an adult completing a self-guided posture scan with one phone and a floor mark.
- Core jobs: level the phone, achieve full-body framing, capture front/right/back/left, understand what was actually observed, and revisit prior sessions.
- Core promise: the phone helps the user capture consistently and explains supported observations without pretending to diagnose them.
- Signature line: **A posture coach that levels its own camera before assessing you.**

## Experience principles

1. Hands-free after setup. Large controls, countdowns, spoken/captioned direction, and no tiny camera-screen interactions.
2. Honest measurement. Never fabricate a score, angle, diagnosis, or confidence. Capture completeness is not posture quality.
3. Quiet precision. Warm neutral surfaces, ink text, one teal accent, generous space, restrained motion, and clear geometry.
4. Native behavior. Safe areas, system back behavior, Dynamic Type, VoiceOver labels, Reduce Motion, and 44-point minimum targets.
5. Explicit cloud consent. The app distinguishes on-device capture from sending a selected frame and recorded question to OMNI.

## Visual system

- Palette: parchment background, deep ink, desaturated teal accent, moss success, amber guidance, coral error.
- Typography: iOS system type with display-scale hero type and readable body text. Numeric readouts use tabular figures.
- Shape: softly rounded cards and controls; the live camera is the dominant rectangle, not a dashboard tile.
- Iconography: SF Symbols through Expo Symbols; icons reinforce labels rather than replacing them.
- Motion: short system-feeling transitions, countdown pulse, and level-gauge spring. No ambient animation that competes with capture.

## Anti-patterns

- Generic AI chat as the home screen.
- Crowded clinical dashboards, fake medical authority, or a default “perfect posture” score.
- Neon gradients, glassmorphism, gamified streaks, or floating decorative blobs.
- Hidden captions, color-only status, inaccessible fixed text, or gestures without button alternatives.
- Provider keys, raw provider errors, or cloud URLs exposed in the mobile bundle.

## First prototype boundary

The first native prototype proves the iPhone setup/capture and multimodal coaching loop: camera permission, device-level feedback, a continuous live scan that samples four guided stills, push-to-talk audio, OMNI image+audio reasoning, OMNI speech playback, captions, and local session history. Cloud-coach scans run computer vision (MoveNet) on those stills and feed `packages/metrics`; OMNI may quote those projected angles only. Live joint overlay on the viewfinder is the next measurement gate, not the current one. Local-only capture does not upload and therefore does not measure.
