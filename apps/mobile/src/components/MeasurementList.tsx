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
            : "No pose landmarks were confident enough to report a projected angle. Capture completeness is not posture quality."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Projected pose measurements</Text>
      <Text style={styles.lead}>These come from MoveNet landmarks on your photos, then Align’s geometry — not from OMNI guessing degrees.</Text>
      {measurements.map((item) => (
        <View key={`${item.view}-${item.id}`} style={styles.card}>
          <Text style={styles.title}>{measurementLabel(item.id)} · {item.view}</Text>
          <Text style={styles.value}>{formatMeasurement(item)}</Text>
          <Text style={item.quality === "usable" ? styles.ok : styles.warn}>{item.quality} · {item.sampleCount} sample{item.sampleCount === 1 ? "" : "s"}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  value: { color: colors.ink, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  ok: { color: colors.tealDark, fontSize: 12, fontWeight: "700" },
  warn: { color: colors.amber, fontSize: 12, fontWeight: "700" },
  limit: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  truthCard: { backgroundColor: colors.tealSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  truthTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  truthBody: { color: "#3D5F57", fontSize: 14, lineHeight: 21 },
});
