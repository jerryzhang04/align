import { StyleSheet, Text, View } from "react-native";
import type { ViewId } from "@align/contracts";
import { CAPTURE_VIEWS, type Captures } from "../lib/captureFlow";
import { colors, radius, spacing } from "../theme";

export function ProgressRail({ active, captures }: { active: ViewId; captures: Captures }) {
  return (
    <View accessibilityLabel="Scan progress" style={styles.rail}>
      {CAPTURE_VIEWS.map((view) => {
        const done = Boolean(captures[view.id]);
        const current = view.id === active;
        return (
          <View key={view.id} style={styles.item}>
            <View style={[styles.dot, done && styles.done, current && styles.current]}>
              <Text style={[styles.index, (done || current) && styles.indexActive]}>{done ? "✓" : view.label[0]}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.label, current && styles.labelActive]}>{view.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  item: { flex: 1, alignItems: "center", gap: spacing.xs },
  dot: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: "#61706A", alignItems: "center", justifyContent: "center", backgroundColor: "#17201D" },
  current: { borderColor: colors.white, borderWidth: 2 },
  done: { backgroundColor: colors.teal, borderColor: colors.teal },
  index: { color: "#AAB4B0", fontSize: 12, fontWeight: "800" },
  indexActive: { color: colors.white },
  label: { color: "#AAB4B0", fontSize: 11, fontWeight: "600" },
  labelActive: { color: colors.white },
});
