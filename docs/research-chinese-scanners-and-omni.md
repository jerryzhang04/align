# Chinese posture scanners and Huawei OMNI integration

Research date: 2026-09-19. Shared implementation guidance for Tommy and Jerry.

## Recommendation

Build the guided scanner experience around repeatable camera measurements. Use local pose estimation for geometry and an OMNI model for contextual visual/audio coaching. A rendered 3D body is an estimated visualization, not proof of measured surface depth or clinical accuracy.

This document records research and the proposed API integration plan. No application or sponsor API integration has been implemented or tested yet. No credentials belong in this document.

## What the commercial systems actually do

| Product | Publicly described approach | Relevance to our phone app |
| --- | --- | --- |
| Visbody / 维塑 | Its technical page describes a depth camera and mechanical turntable, approximately 32-second capture, 3D reconstruction, landmark detection, and circumference measurements. | Borrow guided capture, annotated models, shoulder movement assessment, and historical comparison. One RGB phone does not inherit its depth measurements. |
| Xianku / 仙库 | Infrared structured-light scanning. A company article describes 16 depth sensors in its larger body-scanning booth. Hardware differs by product. | Borrow the reporting experience. Do not describe every Xianku product as using the same sensor arrangement. |
| Sennotech / 创感科技 | Its Posture Expert product uses standard RGB cameras and nine proprietary assessment algorithms. It separately offers Sennopose R2 with structured-light camera, turntable, and body-composition electrodes. | The RGB product is the closest commercial reference for our camera-only approach. Do not conflate it with the hardware-based products. |

Sources:

- [Visbody technical description](https://visbody.com/knowledge-base/)
- [Xianku's account of its scanning booth hardware](https://www.xianku.com/newsinfo/8001781.html)
- [Xianku scanning booth product](https://www.xianku.com/3dznltj)
- [Sennotech posture products, Chinese](https://www.sennotech.com/productPostureAssessment)
- [Sennotech posture products, English](https://www.sennotech.com/en/productPostureAssessment)

These are manufacturer descriptions, not independent validation. The reviewed pages do not disclose complete network architectures, downloadable proprietary weights, or reproducible classification thresholds. Claims about precision and health risks need separate evidence.

## Reusable architecture

The engineering interpretation of these systems is:

1. Guide capture and reject unsuitable frames.
2. Estimate landmarks and/or reconstruct a body surface.
3. Establish coordinates and measurement definitions.
4. Calculate angles, symmetry, and movement features.
5. Apply assessment rules or classifiers.
6. Display findings and compare equivalent measurements over time.

For our single fixed phone, collect stable holds at front, right, back, and left. Preserve a short time series per hold and aggregate stable measurements. Reject cropping, occlusion, weak landmarks, motion, and incorrect view orientation.

Four sequential views are not simultaneous multi-camera triangulation: a person changes stance while turning. A floor mark helps repeat positioning, but an arbitrary tape X does not provide full camera calibration or justify millimetre accuracy. A known-size marker could support calibration work, subject to testing.

Keep measurement coordinates distinct from the avatar. Fit consistent proportions for visualization, track disagreements between views, and label reconstructed geometry as estimated.

## Model options

**MediaPipe Pose:** recommended first baseline for live browser capture. It estimates 33 landmarks and supports segmentation and 3D world-coordinate output. That output is inferred, not depth-sensor measurement. Its landmark set lacks C7, scapular borders, and the pelvic landmarks needed for several clinical definitions. Use correctly scaled image coordinates for projected angles; do not calculate angles directly from differently scaled normalized x/y axes.

- [Official Pose Landmarker documentation and landmark list](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)

**RTMPose / MMPose:** credible Chinese open-source pose stack to benchmark against MediaPipe. MMPose is Apache-2.0; verify the terms of the particular weights and datasets before shipping. Official deployment documentation includes ONNX Runtime and other backends. General keypoint benchmark performance does not validate posture assessment accuracy.

- [MMPose repository](https://github.com/open-mmlab/mmpose)
- [Deployment documentation](https://github.com/open-mmlab/mmpose/blob/main/docs/en/user_guides/how_to_deploy.md)

**OpenCap:** useful processing reference; the previous `stanfordnmbl/opencap-core` URL now redirects to `opencap-org/opencap-core`. Do not assume a multi-camera processing method becomes equivalent with sequential single-phone views.

- [OpenCap processing repository](https://github.com/opencap-org/opencap-core)

The commercial sources reviewed do not establish that these vendors use MediaPipe or RTMPose internally. These are implementation alternatives, not identified vendor internals.

## Measurement scope and corrections to the product spec

These are proposed scope decisions, not validated performance claims.

| Initial candidate | Definition / limitation |
| --- | --- |
| Shoulder asymmetry | Shoulder-line inclination in a square front/back view; preserve anatomical left/right through camera mirroring. |
| Head tilt | Ear-line inclination when both ears are reliably visible. |
| Forward-head proxy | Ear-to-shoulder alignment in a side view; not a C7-based craniovertebral angle. |
| Trunk lean | Shoulder midpoint relative to hip midpoint; not spinal curvature. |
| Knee flexion | Projected hip–knee–ankle angle in a suitable side view. |
| Frontal leg alignment | Projected alignment only; rotation and perspective can change the result. |
| Shoulder elevation | Arm angle during reaching; define reference and compensations explicitly. |

Do not infer actual pelvic tilt from ordinary hip keypoints, scapular winging from a generic skeleton, spinal/Cobb angles from surface appearance, plantar force distribution from stance, or muscle weakness/body fat from posture. A lateral shift is not a measured load difference.

Confidence should reflect landmark visibility, temporal stability, view quality, and cross-view agreement. It is not a statistical confidence interval unless calibrated against reference measurements. Validate repeated captures and manual/reference measurements before assigning thresholds. Keep any 0–100 score transparent and product-specific; 100 is not medically perfect posture.

## Clinical reality check

A 70-person PAViR/MotiPhysio study compared an RGB-D system with EOS radiography. Capture included manually placed markers and specialist involvement. It found varying agreement/correlation across measurements; these results cannot validate an unassisted RGB-phone implementation. The paper distinguishes external estimates from actual spinal curvature.

- [Original PAViR study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9517778/)

## Huawei OMNI Live track

The sponsor repository requires a functional edge-device scenario, meaningful vision/video, speech/audio, and language use, an end-to-end demonstration, and setup instructions. It names Qwen3.5-Omni as an example, not a verified API model identifier. Sponsored credits are supplied through **YibuAPI**, according to the repository; this is not evidence of a direct Huawei Cloud endpoint.

Judging weights: scenario value 30%, OMNI use 25%, demo completeness 20%, interaction 15%, technical implementation 10%.

- [Challenge and sponsor-credit instructions](https://github.com/cari-waterloo-rc/OMNI-Live-Build-the-Next-Generation-of-Real-Time-Multimodal-AI)
- [Linked YibuAPI model/pricing page](https://yibuapi.com/pricing)

### Integration plan — not yet implemented

1. Confirm the provided credential's intended provider and base URL through sponsor instructions. Verify available model identifiers, image/audio formats, streaming, and native audio output. Do not infer the destination from the key prefix or send the credential to guessed providers.
2. Add a server-side adapter. Store credentials in an ignored environment file, with placeholders only in `.env.example`. Never include keys in browser bundles, URLs, logs, or commits.
3. Keep continuous pose processing local. Send selected frames, a bounded audio utterance, scan stage, and a compact measurement summary to the backend with explicit capture consent.
4. Combine those modalities in the same coaching interaction. Example: the user asks “Am I standing correctly?” while OMNI receives the current frame and capture-quality context, then gives a specific positioning instruction.
5. Let geometry own measurement numbers. OMNI interprets context and explains supplied measurements; it must not manufacture angles, diagnoses, or confidence values.
6. Support cancellation, bounded payloads, timeouts, rate limiting, and clear provider failures. Begin with push-to-talk; add automatic prompts at scan transitions after the loop works. Use native audio output if supported; document any separate speech-synthesis fallback accurately.
7. Validate a real frame + spoken question → contextual response loop first. Then connect positioning → four views → measured summary → spoken explanation and follow-up. Movement tests follow after this loop is stable.

### Suggested work boundary

Agree on the backend contract before splitting frontend and model work. A request should contain scan stage, selected image, audio with its format, measured findings with their definitions and quality, and bounded conversation context. The response should distinguish coaching text/audio from measurement data and expose actionable errors. Choose the exact schema after verifying the provider API.

### Verification before demo claims

- Real provider authentication and a successful multimodal request.
- Actual audio understanding, not only browser transcription passed as text.
- Responsive cancellation and measured latency on the demo device/network.
- Camera/microphone denial, provider errors, and invalid capture recovery.
- No key in Git or client-delivered files.
- Measured posture findings remain usable when cloud coaching fails.
- Setup instructions name the actual provider/model and supported modalities.

## Research status

This brief uses public web sources. Browserbase was not used and its supplied credential was not saved to the repository. The sponsor credential has not been tested. Neither proprietary vendor models nor a clinically validated phone reconstruction have been obtained. Next work is provider verification and a small functional multimodal loop, not a claim that the full scanner already exists.
