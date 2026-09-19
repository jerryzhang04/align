import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { CAPTURE_VIEWS, captureProgress } from "../src/lib/captureFlow";
import { finalizeCaptures } from "../src/services/captures";
import { saveSession } from "../src/services/history";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";

export default function RecapScreen() {
  const { scanId, captures, coachCaption, reset } = useScan();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const progress = captureProgress(captures);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await finalizeCaptures(scanId, captures, async (persistent) => {
        await saveSession({ id: scanId, createdAt: new Date().toISOString(), captures: persistent, coachCaption });
      });
      setSaved(true);
    } catch {
      Alert.alert("Session not saved", "Your captures are still available here. Check device storage and try again.");
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    reset();
    router.replace("/");
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.successIcon}><SymbolView name="checkmark" size={31} tintColor={colors.white} weight="bold" /></View>
      <Text accessibilityRole="header" style={styles.title}>Four views, one consistent baseline.</Text>
      <Text style={styles.lead}>{progress.accepted} of {progress.total} views captured. This confirms capture completeness—not posture quality.</Text>

      <View style={styles.gallery}>
        {CAPTURE_VIEWS.map((view) => (
          <View key={view.id} style={styles.captureCard}>
            {captures[view.id] ? <Image accessibilityLabel={`${view.label} posture capture`} source={{ uri: captures[view.id] }} style={styles.image} resizeMode="cover" /> : <View style={styles.missing}><Text style={styles.missingText}>Missing</Text></View>}
            <View style={styles.captureFooter}><Text style={styles.captureLabel}>{view.label}</Text><SymbolView name={captures[view.id] ? "checkmark.circle.fill" : "exclamationmark.circle"} size={16} tintColor={captures[view.id] ? colors.teal : colors.amber} /></View>
          </View>
        ))}
      </View>

      <View style={styles.truthCard}>
        <View style={styles.truthHeader}><SymbolView name="ruler" size={22} tintColor={colors.tealDark} /><Text style={styles.truthTitle}>Measurement status</Text></View>
        <Text style={styles.truthBody}>The iOS capture loop is active. Degree-level findings stay hidden until the native pose pipeline is connected to the shared, tested metric definitions.</Text>
      </View>

      {coachCaption ? (
        <View style={styles.coachCard}>
          <Text style={styles.coachLabel}>LAST COACH NOTE</Text>
          <Text style={styles.coachText}>{coachCaption}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {!saved ? <PrimaryButton label={saving ? "Saving…" : "Save session on this iPhone"} disabled={saving || progress.accepted < 4} onPress={save} /> : <PrimaryButton label="Done" onPress={done} />}
        <PrimaryButton label="Retake the scan" variant="secondary" onPress={() => { reset(); router.replace("/setup"); }} />
      </View>

      <Text style={styles.footnote}>Align is a wellness capture tool, not a medical device. It does not diagnose posture or spinal conditions.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  successIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: colors.tealDark, alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, fontSize: 35, lineHeight: 39, letterSpacing: -1.2, fontWeight: "700" },
  lead: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  captureCard: { width: "48.5%", backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  image: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.camera },
  missing: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
  missingText: { color: colors.muted, fontWeight: "700" },
  captureFooter: { minHeight: 44, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captureLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  truthCard: { backgroundColor: colors.tealSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  truthHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  truthTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  truthBody: { color: "#3D5F57", fontSize: 14, lineHeight: 21 },
  coachCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.line },
  coachLabel: { color: colors.tealDark, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  coachText: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  actions: { gap: spacing.sm },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.md },
});
