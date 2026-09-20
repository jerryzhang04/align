import { Image, StyleSheet, View } from "react-native";
import type { ViewId } from "@align/contracts";
import { bodyGuideVariant } from "../lib/bodyGuide";

const figures = { front: require("../../assets/guide/front.png"), side: require("../../assets/guide/side.png") };

export function BodyGuide({ view, fill, locked }: { view: ViewId; fill: number; locked: boolean }) {
  const amount = locked ? 1 : Math.max(0, Math.min(1, fill));
  return (
    <View accessible accessibilityLabel={`${view} view. ${locked ? "Photo saved" : `${Math.round(amount * 3)} of 3 steady checks`}.`} style={styles.frame}>
      <Image source={figures[bodyGuideVariant(view)]} resizeMode="contain" style={[styles.figure, { transform: [{ scaleX: view === "left" ? -1 : 1 }], tintColor: locked ? "#54E4BA" : "#FFFFFF" }]} />

    </View>
  );
}
const styles = StyleSheet.create({
  frame: { flex: 1 },
  figure: { width: "100%", height: "100%", opacity: 0.65 },
});
