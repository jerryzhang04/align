import { StyleSheet, Text, View } from "react-native";
import type { Measurement } from "@align/contracts";
import { formatMeasurement, measurementLabel } from "../lib/measurementCopy";
import { colors, radius, spacing } from "../theme";

export function MeasurementList({ measurements, localOnly = false }: { measurements: Measurement[]; localOnly?: boolean }) {
  if (measurements.length === 0) {
    return (
      <View style={styles.truthCard}>
        <Text style={styles.truthTitle}>Measurement status</Text>
        <Text style={styles.truthBody}>
          {localOnly
            ? "Pose measurement runs on the coaching server from your photos. Local-only mode kept those photos on this iPhone, so no projected angles are available."
            : "No usable posture measurements were returned. Retake with your whole body in frame, brighter lighting, and the correct view at each step."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Measured from your photos</Text>
      <Text style={styles.lead}>Projected angles from visible body landmarks. Camera position and clothing affect these estimates.</Text>
      {measurements.map((item) => (
        <View key={`${item.view}-${item.id}`} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>{measurementLabel(item.id)}</Text>
            <Text style={styles.value}>{formatMeasurement(item)}</Text>
          </View>
          <Text style={item.quality === "usable" ? styles.ok : styles.warn}>{item.view} view · {item.quality === "usable" ? "Measured" : "Limited confidence"}</Text>
          <Text style={styles.limit}>{item.limitations.join(" ")}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  heading: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { paddingVertical: spacing.md, gap: 6, borderBottomWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.md },
  title: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "600" },
  value: { color: colors.ink, fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  ok: { color: colors.tealDark, fontSize: 12, fontWeight: "700" },
  warn: { color: colors.amber, fontSize: 12, fontWeight: "700" },
  limit: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  truthCard: { backgroundColor: colors.tealSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  truthTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  truthBody: { color: "#3D5F57", fontSize: 14, lineHeight: 21 },
});
