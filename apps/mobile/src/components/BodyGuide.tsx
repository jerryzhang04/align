import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ViewId } from "@align/contracts";
import { bodyGuideVariant } from "../lib/bodyGuide";
import { colors } from "../theme";

type Shape = {
  top: `${number}%`;
  left: `${number}%`;
  width: `${number}%`;
  height: `${number}%`;
  radius: number;
};

const FRONT: Shape[] = [
  { top: "1%", left: "38%", width: "24%", height: "13%", radius: 48 },
  { top: "13%", left: "45%", width: "10%", height: "4%", radius: 8 },
  { top: "15%", left: "12%", width: "76%", height: "9%", radius: 18 },
  { top: "22%", left: "28%", width: "44%", height: "28%", radius: 22 },
  { top: "48%", left: "30%", width: "40%", height: "7%", radius: 14 },
  { top: "22%", left: "8%", width: "11%", height: "30%", radius: 12 },
  { top: "22%", left: "81%", width: "11%", height: "30%", radius: 12 },
  { top: "54%", left: "31%", width: "16%", height: "42%", radius: 14 },
  { top: "54%", left: "53%", width: "16%", height: "42%", radius: 14 },
];

const SIDE: Shape[] = [
  { top: "1%", left: "44%", width: "22%", height: "13%", radius: 48 },
  { top: "13%", left: "50%", width: "9%", height: "4%", radius: 8 },
  { top: "16%", left: "36%", width: "34%", height: "7%", radius: 14 },
  { top: "22%", left: "38%", width: "28%", height: "28%", radius: 18 },
  { top: "48%", left: "37%", width: "30%", height: "7%", radius: 12 },
  { top: "20%", left: "26%", width: "12%", height: "32%", radius: 12 },
  { top: "54%", left: "40%", width: "18%", height: "42%", radius: 14 },
  { top: "56%", left: "52%", width: "14%", height: "40%", radius: 14 },
];

function Figure({
  shapes,
  mode,
  locked,
}: {
  shapes: Shape[];
  mode: "fill" | "outline";
  locked: boolean;
}) {
  const fill = mode === "fill";
  return (
    <>
      {shapes.map((shape, index) => (
        <View
          key={`${shape.top}-${shape.left}-${index}`}
          style={{
            position: "absolute",
            top: shape.top,
            left: shape.left,
            width: shape.width,
            height: shape.height,
            borderRadius: shape.radius,
            backgroundColor: fill ? "rgba(45, 196, 164, 0.58)" : "transparent",
            borderWidth: fill ? 0 : 2.5,
            borderColor: fill ? "transparent" : locked ? "rgba(45, 196, 164, 1)" : "rgba(255,255,255,0.9)",
          }}
        />
      ))}
    </>
  );
}

export function BodyGuide({
  view,
  fill,
  locked,
}: {
  view: ViewId;
  fill: number;
  locked: boolean;
}) {
  const variant = bodyGuideVariant(view);
  const shapes = variant === "side" ? SIDE : FRONT;
  const amount = locked ? 1 : Math.max(0, Math.min(1, fill));
  const flip = view === "left" ? -1 : 1;
  const [height, setHeight] = useState(0);
  const label = locked
    ? `${view} view saved.`
    : `Match your head and shoulders to the ${variant === "side" ? "side" : "front"} outline. ${Math.round(amount * 100)} percent filled.`;

  return (
    <View
      accessible
      accessibilityLabel={label}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={styles.frame}
    >
      <View style={[styles.figure, { transform: [{ scaleX: flip }] }]}>
        {height > 0 ? (
          <View style={[styles.clip, { height: height * amount }]}>
            <View style={[styles.full, { height }]}>
              <Figure shapes={shapes} mode="fill" locked={locked} />
            </View>
          </View>
        ) : null}
        <Figure shapes={shapes} mode="outline" locked={locked} />
      </View>
      <Text style={[styles.tag, styles.headTag]}>Head</Text>
      <Text style={[styles.tag, styles.shoulderTag]}>Shoulders</Text>
      <View style={styles.feet} />
      <Text style={styles.fillReadout}>{locked ? "Saved" : `${Math.round(amount * 100)}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  figure: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  clip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  full: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  tag: {
    position: "absolute",
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textShadowColor: "rgba(8,14,12,0.85)",
    textShadowRadius: 6,
  },
  headTag: { top: "4%", right: 0 },
  shoulderTag: { top: "16%", left: 0 },
  feet: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    width: 54,
    height: 10,
    borderBottomWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    borderLeftWidth: 2,
    borderRightWidth: 2,
    left: "50%",
    marginLeft: -27,
  },
  fillReadout: {
    position: "absolute",
    bottom: -2,
    alignSelf: "center",
    width: "100%",
    textAlign: "center",
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textShadowColor: "rgba(8,14,12,0.85)",
    textShadowRadius: 6,
  },
});
