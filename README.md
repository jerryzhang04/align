# idontknowthenameyet

Working title. Feed **this entire file** to GPT-6 Astra / Codex as the product spec. Infer a shippable mobile/web app. Do not wait for another doc.

Build a **live 3D posture scan**: phone camera, **floor marker**, user **rotates in place**. Match the **named findings and numeric specificity** of commercial Chinese 3D posture-scan mirrors (gym / rehab / wellness kiosks that do a 360° body scan). Push landmark angles, left/right deltas, and confidence as far as a single phone will go.

---

## Pitch

Face unlock → agent talks the phone onto a stand and the user onto a **floor mark** → **live 3D posture scan** (front, right, back, left) → **0–100 alignment profile** with every issue those scanners typically report, in **degrees** → **them vs 100/100** on a rigged 3D/skeletal body → three movement tests → birthday / height / weight → overall score saved to that face.

---

## Capture setup (get this right)

- **Floor marker** (tape/X) = where the **feet** stay. All four views happen **on that mark**. They rotate themselves; they do not walk around.
- **Phone** on a table or stand, **landscape**, **pelvis / hip height**, lens **level**, full body in frame (hair to shoes). Face-ID is the only selfie; the scan is not.
- **Audio + on-screen silhouette** until they fill the guide and both feet are on the mark.
- Camera **does not move**. Person turns **~90°** each time, small steps on the mark, both feet, like a lazy Susan. Habitual stance (don’t “stand at attention” unless you add a second “best posture” pass).
- Order: **front → right → back → left**. Live vision the whole time, not four photos graded later.
- **Reject and re-coach** (do not score) if: feet/head cropped, they stepped off the mark, they walked closer (body scale jumped), turn isn’t square vs edge-on, hands blocking hips, low light, landmark confidence weak, hoodie hiding the waist/shoulders. Fitted clothing; say so if you can’t see joints.

---

## The 3D scan — what to identify

Treat this as a **3D posture reconstruction from four calibrated-enough views**: 2D landmarks per view, lift to a **3D skeleton** (and a simple body mesh if you can). Report **angles and millimetre-or-degree deltas when the geometry supports it**; otherwise a high-confidence yes/no plus which views. Store the **time series**, not one frame.

Use the **same assessment list** as Chinese 3D body-scan mirrors. Be as specific as the landmarks allow. Every finding: **name, numeric value, left vs right, view(s), confidence**. No cause stories (no “because of a backpack”). No disease names (no scoliosis diagnosis). Screening language only.

### Head & neck

- Forward head (sagittal): ear vs shoulder / C7 line, **degrees**
- Head tilt (coronal): ear height L vs R, midline
- Head rotation if yaw is visible

### Shoulders & scapulae

- High/low (uneven) shoulders — height delta
- Rounded / protracted shoulders (side)
- Sloping shoulders
- Scapular prominence / winging (back)
- Shoulder-width vs hip-width if useful

### Trunk & spine (surface alignment, not an X-ray)

- Thoracic rounding / “hunch” (side)
- Coronal deviation: C7 vs pelvis midline (front + back)
- Rib / thorax vs pelvis stack (side)

### Pelvis & hips

- Anterior / posterior pelvic tilt (side)
- Pelvic obliquity / lateral shift (front + back)
- Hip height L vs R

### Knees & legs

- Knee hyperextension or flexed standing (side)
- Knock-knees / bow-legs (X / O), valgus–varus
- Knee midline tracking vs hip/foot
- Weight shift (more load on one leg)

### Ankles & contour (if visible)

- Heel position, obvious pronation
- Abdominal prominence on the side view (contour only)

**100/100 reference:** plumb line ear–shoulder–hip–knee–ankle (side); level ears, shoulders, hips (front/back); head stacked. Overall **0–100** plus **region scores** (head/neck, shoulders, thorax, lumbar/pelvis, hips, knees). Ranked problem list, each tied to a number.

**100/100 visual:** a **3D skeleton / simple rigged body** of *this* person (proportions from the scan), posed to those target angles, **side-by-side or wipe** with their live/captured pose. Overlay bones and angle callouts. Posture only — not a new face or body type.

Live callouts while they hold: “left shoulder is high,” “chin is forward,” with the degree on screen.

---

## After the static scan — three tests

On the **same mark**, then **one step back** if you need more height in frame. Demo clip + audio, then them. Live scoring, time series.

1. **Slow bodyweight squat** (2–3 reps) — ankles, knee tracking, hip shift, trunk, heels.
2. **Single-leg balance + forward reach** (both sides) — hip drop, knee cave, trunk lean, time.
3. **Overhead reach, then soft-knee hip hinge** — shoulder flexion L/R, thorax, whether the spine rounds instead of hinging.

Each drill **0–100** + mobility/balance notes from **that** movement only. Invalid rep → ask again, don’t silently score.

---

## Account, recap, history

- **Face enroll** (first time) / **recognize** (return) → load **all prior scans**. Confirm if uncertain. Consent screen for face stored as login.
- After movement: **birthday, height, weight** (age from birthday). Optional desk/labor/sport only to phrase the recap.
- **Overall 0–100** = posture weighted above any single drill; show the recipe. Save everything to that user.
- Return visit: compare the **same angles** to last time.

---

## Use cases

- Same face, second session: “left shoulder was +8° last time, it’s +3° now.”
- Uneven shoulders and/or hips flagged with degrees, both front and back agreeing.
- Desk-style forward head + rounded shoulders on both side views.
- Squat: heels rise or knee dives in; hinge can still score high.
- Single-leg: 80 vs 50 with hip drop on the weak side.
- Off the floor mark or cropped feet: no score until fixed.
- Two people, two histories.

---

## Rules

- Phone camera only; one device for the scan.
- Live vision + **spoken** coach whenever the camera is running.
- If you didn’t measure it, don’t say it. Findings are **alignment and movement quality**, with confidence.
- Prefer a complete flow over extra charts.

## Demo

Face in → phone on stand, **stand on the mark** → silhouette → rotate four ways with live numbers → 3D them vs 100/100 → three demos + scores → basics → overall → reopen, face brings the old scan back.

Repo name: **idontknowthenameyet**. Secrets in `.env`.
