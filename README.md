# idontknowthenameyet

Working title. Feed **this entire file** to GPT-6 Astra / Codex as the product spec. Do **not** wait for a second architecture document. Infer a sensible implementation. Ship a demoable mobile/web app.

You are building a **personal posture and movement coach**, not a gym body-composition scanner, not an Evolt clone, not a fake BIA / fat-% kiosk. No impedance, no visceral fat, no “macros.” The product is **live computer vision + a continuous spoken/visual feedback agent**.

---

## One-sentence pitch

A user unlocks the app with their **face**. The agent talks them through placing the phone, fitting their body to an on-screen silhouette, and completing a **live 4-side posture exam** plus **three full-body exercises**. They get **0–100 scores**, **where they are lopsided or restricted**, a **side-by-side of their posture vs a generated “100/100”**, and a **history** that comes back the next time the same face appears.

---

## Canonical user flow (this is the product)

### 1. Face login / enrollment

- First visit: camera on the **face** (hold the phone, ~eye level, selfie distance). Capture / enroll the face into a **database of known users**.
- Return visit: see the face → **recognize** → load **all previous scans** (scores, problem areas, dates, exercise results). The user should feel “it remembers me,” not “I typed an email.”
- If recognition is uncertain: ask them to confirm (“Is this you?”) rather than silently mixing two people.
- Always get consent that their face is stored for login and history (one clear screen). No surprise biometrics.

### 2. Place the camera (audio-first)

After login, this is **not** a selfie. The phone goes on a stable surface or cheap stand. **Audio tells them what to do** — continuous, like a trainer in the room, not a wall of text.

**Camera height: about chest / lower-chest (roughly nipple-to-sternum height), landscape, phone leaning so the lens sees the full person.**

- Eye-level is wrong for the exam: you lose the feet and cannot judge squat, balance, or standing posture.
- Eye-level **is** right for the face-ID step only.
- The agent should say, in plain speech, e.g. “Put the phone down at chest height, like it’s looking at your belt-to-head. Step back until you fill the silhouette. I need to see your feet.”

### 3. Fit the silhouette

- On-screen **silhouette / body-shaped guide** (full body, including feet).
- Live preview. Agent coaches: closer, farther, left, right, “I can’t see your ankles,” “your head is cut off.”
- Do not start scoring until they **fit**. This is a gate.

### 4. Four-direction live posture exam (not a photo booth)

The camera **stays put**. The **person rotates**. These are **not snapshots you grade later**. Run **live computer vision the whole time** — as precise as you can get on a phone camera.

Order:

1. **Front** — shoulders, head, hips, knees, ankles. Shoulder height L vs R. Head vs midline. Weight on one leg. Collapsed arch if visible. Arm hang.
2. **Right side** — ear vs shoulder vs hip vs ankle (forward head, rounded upper back, anterior pelvic tilt / swayback, knee hyperextension).
3. **Back** — shoulder blade winging if visible, hip height, spine deviation, head tilt, scapular asymmetry.
4. **Left side** — same as right; compare to right.

Audio for each: “Turn right. Stand easy — don’t ‘stand up straight’ for me. Breathe. Hold.” We want **habitual** posture, not a fake military pose, unless you later add an optional “now stand your best” comparison.

**Precision bar:** prefer quantitative joint/segment angles and left-right deltas in degrees or % over vibes. Example the product **must** be able to catch: someone who always wears a backpack on the **left strap only** → left shoulder hiked / depressed, trunk lean, maybe head tilt. Call that out in human language (“your left shoulder sits higher; classic one-strap backpack pattern”) **only if the geometry supports it**. Do not invent a story that the pixels don’t show.

### 5. Internal “what would 100 look like” + score

- Define **neutral / efficient standing posture** as the 100 (plumb line: ear–shoulder–hip–knee–ankle on the side; level shoulders and hips on the front; head stacked). 100 is a **reference**, not a moral judgment and not a medical diagnosis.
- Output:
  - **Overall posture score 0–100**
  - **Region scores** (at least: head/neck, shoulders, thoracic, lumbar/pelvis, hips, knees)
  - **Problem list** ranked, each tied to a visible finding (e.g. “left shoulder +12° vs right”)
- **Continuous feedback** during the holds: “chin’s drifting forward — that’s the one,” “left hip is high,” not silence then a dump.

### 6. Show them 100/100 vs them (generative)

If they are not already ~100:

- Use an **image or video generation model** to show **what their 100/100 standing posture would look like** (same person / same clothes / same body if the model allows; otherwise a clear matched silhouette or overlay — **their** proportions, not a random fitness influencer).
- Present **side-by-side or back-and-forth**: current live/captured posture vs the generated ideal (front and at least one side).
- This is a **coach visual**, not a deepfake prank. No body-fat morph, no gender swap, no “ideal body.” **Posture only.**

### 7. Step farther back — three exercises

Audio: “Take two steps back. I need space for your squat.” Re-fit silhouette if needed.

**Three exercises, in this order**, chosen because they **reveal the most** with no equipment:

1. **Bodyweight squat** (2–3 slow reps) — ankle dorsiflexion, knee tracking (valgus), hip depth/shift, torso collapse, heels, asymmetry.
2. **Single-leg reach / balance** (each side: stand on one leg, other leg or hand reach toward the floor or hover — a slow “woodpecker / airplane / toe-touch on one leg,” not a circus trick) — balance time, hip drop, knee cave, trunk rotation.
3. **Overhead reach + hinge** (arms up, then a hip hinge / toe-touch with knees soft) — shoulder flexion, thoracic extension, hamstring / posterior-chain limit vs lumbar rounding.

Before **each** exercise: **play a short demo** (pre-rendered clip or generated video) of the correct pattern, with audio cues (“sit between your hips, knees track over mid-foot”). Then “your turn” and live analysis.

Each exercise: **score 0–100** plus **mobility / movement / flexibility / balance** notes (only what that drill can actually show). Rank issues. Continuous feedback while they move (“pause at the bottom — left knee is diving in”).

If a rep is invalid (they laughed, walked out of frame, did a different movement): don’t score it; ask for one more. Don’t silently give a 40.

### 8. Basics, then overall score

**After** movement, not before (so the exam isn’t delayed by a form):

- Birthday (store age from this)
- Height
- Weight
- Optional: what they do all day (desk / labor / sport) as context for the **language** of the recap, not as fake detection from video

Then an **overall score 0–100** that combines posture + the three drills with a transparent recipe (posture should weigh more than any single exercise). Show the breakdown. Save the whole session to **that face’s history**.

End state: recap they can understand in 20 seconds, plus “next time I’ll compare.”

---

## Use cases (build so these are true)

1. **Returner:** Face in the door → “Welcome back. Last Tuesday your squat was 61 because of left knee cave. Let’s see if it changed.”
2. **One-strap backpack / bag:** Front + back views flag shoulder/hip height mismatch and name it as a **possible** habit, not a diagnosis.
3. **Desk neck:** Side views flag forward head + rounded shoulders; 100/100 visual is a stacked ear-over-shoulder, not a new jawline.
4. **Stiff ankles:** Squat score drops because heels lift / knees stop; the hinge drill is fine. The app must **not** say “bad knees” if the pixels say ankles.
5. **Balance asymmetry:** Left single-leg 82, right 54, hip drop on the weak side.
6. **Roommate demo:** Two faces, two histories, no crossed wires.
7. **Bad setup recovery:** Phone too high, feet cropped → agent refuses to score and tells them to lower the phone / step back. A wrong 100 is worse than a delay.
8. **They already stand well:** If they’re genuinely ~high 90s, skip the shame; still run exercises; the 100/100 compare can say “you’re already close.”
9. **Booth / hackathon:** Full flow under ~4–6 minutes for a stranger, audio on, silhouette obvious from two meters away.

---

## Product rules (non-negotiable)

- **Live vision** during posture and exercises. Stills are only for history thumbnails / the generative before-after, not the grading method.
- **Speak.** This is a **continuous feedback agent** (audio + on-screen highlights). If the camera is running and the agent is silent, it’s broken.
- **Ground every claim.** If you didn’t measure it, you don’t say it. No sleep lectures, no “you’re unhealthy,” no invented injuries. “Left shoulder is higher” is allowed. “You have scoliosis” is not.
- **100 is a reference posture/movement pattern**, not attractiveness, BMI, or morality.
- **Face data** is login + history only. Don’t sell it; don’t put raw face images in the recap they screenshot if you can use landmarks + scores instead.
- **Phone camera is the imager** (user’s phone). Design for one camera, landscape on a table/stand.
- Prefer **working demo of the full flow** over extra metrics.

---

## What “done” looks like for a teammate demo

A volunteer opens the app → face enrolls → follows **audio** to set the phone at **chest height** → fits silhouette → rotates through **front / right / back / left** with live callouts → sees a **0–100 + problem regions** → sees **them vs generated 100/100** → steps back → watches a **demo** → squat / single-leg / overhead-hinge each scored → enters birthday, height, weight → **overall score** saved → they kill the app, come back, **face unlocks the old scan**.

If time is short, cut polish, not this sequence.

---

## You (Astra / Codex) should

Implement the app end-to-end from this spec. Choose boring, shippable tech. Keep secrets in `.env`. Do not add a fake Evolt / body-fat / impedance story. Do not block waiting for a name; the repo is **idontknowthenameyet**.
