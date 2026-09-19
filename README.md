# Worsevolt

Hack the North 2026. A **worse Evolt**: 60-second freeze, phone still, honest numbers, funny printout.

It is **not** bioelectrical impedance. Dummy handles are misdirection. The camera (phone) is the instrument. We do not invent visceral fat, body water, or medical diagnoses.

## What we measure (schema)

Only these keys may appear as facts on the sheet:

- `height_cm` — typed or ultrasonic
- `weight_kg` — typed or borrowed scale (FSR is not a scale)
- `waist_cm` / `neck_cm` — tape and/or calibrated pixels
- `pose_ok` — arms off torso, in slot, held still
- `hr_bpm` / `hr_quality` — phone fingertip PPG or face rPPG at rest; skip if `bad`
- `quality` — lighting, clothing, calibration

Anything else (visceral fat, TBW, sleep, “biological age”) is either **redacted** (`WE DON'T HAVE THE MACHINE`) or a **named toy index** with the formula on the sheet.

## Stack

| Piece | Job |
|---|---|
| Phone camera | Still of the whole body; optional fingertip pulse |
| Laptop | Vision + report UI / HDMI |
| QNX Pi 5 (optional) | Freeze / abort if they leave the marks; local TFLite later |
| Arduino (optional) | Buttons, dummy-handle reeds, lights — **not** the camera |

Runtime coach: **one** of Backboard or OpenAI, JSON in → short copy out, hallucination gate. Do not run two coaches.

## Repo hygiene

- Never commit `.env`, API keys, or photos of people (`scans/` is gitignored).
- `git pull` before you start, `git push` when a chunk works.
- Add teammates: GitHub → **Settings → Collaborators**.

## Name

**Worsevolt** — we are the honest knockoff.
