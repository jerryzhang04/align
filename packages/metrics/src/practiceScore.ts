import type { Measurement, ViewId } from "@align/contracts";

export type PracticeAreaScore = {
  id: string;
  label: string;
  score: number;
  view: ViewId;
  measurementId: string;
  measuredValue: number;
  unit: Measurement["unit"];
  improve: string;
  whyCommon: string;
};

export type PracticeProfile = {
  overall: number;
  areas: PracticeAreaScore[];
  limitations: string[];
};

const AREA_LIMITATION = "Camera-alignment practice scores come from projected landmarks on phone photos, not a clinical exam.";

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreAbs(value: number, fullPenaltyAt: number) {
  if (!Number.isFinite(fullPenaltyAt) || fullPenaltyAt <= 0) return 0;
  return clampScore(100 - (Math.abs(value) / fullPenaltyAt) * 100);
}

type AreaRule = {
  id: string;
  label: string;
  weight: number;
  score: (value: number) => number;
  improve: string;
  whyCommon: string;
};

const RULES: Record<string, AreaRule> = {
  shoulder_line_tilt: {
    id: "shoulders",
    label: "Shoulder level",
    weight: 1.2,
    score: (value) => scoreAbs(value, 12),
    improve: "Switch bags between sides and keep screens in front of you rather than off to one side.",
    whyCommon: "Carrying a bag on one shoulder and sitting with a mouse or laptop off-center are everyday habits that often show up as an uneven shoulder line on camera.",
  },
  head_line_tilt: {
    id: "head-level",
    label: "Head level",
    weight: 1.1,
    score: (value) => scoreAbs(value, 12),
    improve: "Bring the screen to eye height and glance with your eyes before tipping your head.",
    whyCommon: "Cradling a phone on one shoulder or working with a display off to one side often appears as a tipped head line in a standing photo.",
  },
  head_shoulder_offset: {
    id: "head-stack",
    label: "Head over shoulders",
    weight: 1.3,
    score: (value) => scoreAbs(value, 0.18),
    improve: "Raise the screen, slide the chair in, and take brief look-up breaks from the phone.",
    whyCommon: "Long stretches looking down at a laptop or phone are a common desk pattern that can look like the head sitting forward of the shoulders on a side view.",
  },
  trunk_lean: {
    id: "trunk",
    label: "Upright trunk",
    weight: 1.2,
    score: (value) => scoreAbs(value, 14),
    improve: "Stand with weight on both feet and rest your back against a chair when you sit.",
    whyCommon: "Standing on one leg or sitting on the edge of a chair are common stances that can look like a trunk lean in a still photo.",
  },
  knee_flexion: {
    id: "knees",
    label: "Easy standing knees",
    weight: 0.8,
    score: (value) => scoreAbs(Math.max(0, value - 6), 22),
    improve: "Stand with soft, easy knees rather than a crouch or a locked freeze.",
    whyCommon: "Waiting in a slight crouch or locking the knees for a posed photo are common standing habits.",
  },
  frontal_knee_alignment: {
    id: "knee-track",
    label: "Knee tracking",
    weight: 0.8,
    score: (value) => scoreAbs(value, 0.12),
    improve: "Keep knees pointing the same way as your toes and avoid standing with feet turned far out.",
    whyCommon: "Turned-out feet and a narrow or wide stance often change how the knees line up in a front photo.",
  },
};

export function practiceProfile(measurements: Measurement[]): PracticeProfile {
  const usable = measurements.filter((item) => Number.isFinite(item.value) && RULES[item.id]);
  const byId = new Map<string, PracticeAreaScore>();

  for (const item of usable) {
    const rule = RULES[item.id]!;
    const score = rule.score(item.value);
    const previous = byId.get(rule.id);
    if (!previous || score < previous.score) {
      byId.set(rule.id, {
        id: rule.id,
        label: rule.label,
        score,
        view: item.view,
        measurementId: item.id,
        measuredValue: item.value,
        unit: item.unit,
        improve: rule.improve,
        whyCommon: rule.whyCommon,
      });
    }
  }

  const areas = [...byId.values()].sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
  if (!areas.length) {
    return {
      overall: 0,
      areas: [],
      limitations: [AREA_LIMITATION, "No camera-alignment score is available until pose landmarks are confident."],
    };
  }

  let weighted = 0;
  let weight = 0;
  for (const area of areas) {
    const rule = RULES[area.measurementId];
    const areaWeight = rule?.weight ?? 1;
    weighted += area.score * areaWeight;
    weight += areaWeight;
  }

  return {
    overall: clampScore(weight > 0 ? weighted / weight : 0),
    areas,
    limitations: [AREA_LIMITATION],
  };
}

export function practiceScoreInts(profile: PracticeProfile): number[] {
  return [...new Set([profile.overall, ...profile.areas.map((area) => area.score)])];
}
