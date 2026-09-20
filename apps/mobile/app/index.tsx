import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { checkCoachHealth } from "../src/services/coach";
import { listSessions, type SavedSession } from "../src/services/history";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";

type Readiness = "checking" | "omni" | "unconfigured" | "offline";

export default function HomeScreen() {
  const { reset } = useScan();
  const [readiness, setReadiness] = useState<Readiness>("checking");
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    checkCoachHealth(controller.signal)
      .then((health) => setReadiness(health.providerMode === "omni" ? "omni" : "unconfigured"))
      .catch(() => setReadiness("offline"));
    return () => controller.abort();
  }, []);

  useFocusEffect(useCallback(() => {
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, []));

  const start = () => {
    reset();
    router.push("/consent");
  };

  const statusCopy = {
    checking: "Checking coach…",
    omni: "OMNI multimodal guidance ready",
    unconfigured: "Capture ready · guidance needs setup",
    offline: "Offline capture available",
  }[readiness];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.mark}><View style={styles.markLine} /></View>
          <Text style={styles.brand}>ALIGN</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>GUIDED POSTURE CAPTURE</Text>
          <Text accessibilityRole="header" style={styles.title}>Set the phone down. Step into frame.</Text>
          <Text style={styles.subtitle}>Align guides one slow live scan, samples useful views automatically, and responds with one calm voice.</Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewTop}>
            <View style={styles.previewSymbol}>
              <SymbolView name="viewfinder" size={30} tintColor={colors.tealDark} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>A steadier scan starts level</Text>
              <Text style={styles.previewBody}>Your iPhone checks its horizon before it checks your framing.</Text>
            </View>
          </View>
          <View style={styles.levelLine}>
            <View style={styles.levelTrack}><View style={styles.levelDot} /></View>
            <Text style={styles.levelText}>±3° setup guide</Text>
          </View>
        </View>

        <PrimaryButton label="Start guided scan" onPress={start} />
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, readiness === "omni" && styles.statusReady]} />
          <Text style={styles.statusText}>{statusCopy}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent sessions</Text>
          <Text style={styles.privateText}>Stored on this iPhone</Text>
        </View>
        {sessions.length ? sessions.map((session) => (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={`Open session from ${new Date(session.createdAt).toLocaleDateString()}`}
            onPress={() => router.push({ pathname: "/session/[id]", params: { id: session.id } })}
            style={styles.sessionCard}
          >
            <View style={styles.sessionIcon}><SymbolView name="figure.stand" size={22} tintColor={colors.tealDark} /></View>
            <View style={styles.sessionCopy}>
              <Text style={styles.sessionDate}>{new Date(session.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</Text>
              <Text style={styles.sessionMeta}>
                {Object.keys(session.captures).length} of 4 views · {session.measurements.length} measurement{session.measurements.length === 1 ? "" : "s"}
              </Text>
            </View>
          </Pressable>
        )) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your first baseline starts here.</Text>
            <Text style={styles.emptyBody}>Sessions appear after you save a completed four-view capture.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mark: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.tealDark, alignItems: "center", justifyContent: "center" },
  markLine: { width: 3, height: 15, borderRadius: 2, backgroundColor: colors.white, transform: [{ rotate: "18deg" }] },
  brand: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 2.6 },
  hero: { gap: spacing.sm, paddingTop: spacing.md },
  eyebrow: { color: colors.tealDark, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 43, lineHeight: 46, letterSpacing: -1.8, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 18, lineHeight: 27, maxWidth: 350 },
  previewCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg, borderWidth: 1, borderColor: colors.line },
  previewTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  previewSymbol: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  previewCopy: { flex: 1, gap: spacing.xs },
  previewTitle: { color: colors.ink, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  previewBody: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  levelLine: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  levelTrack: { flex: 1, height: 2, backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
  levelDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.teal },
  levelText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: -10 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  statusReady: { backgroundColor: colors.teal },
  statusText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  privateText: { color: colors.muted, fontSize: 12 },
  sessionCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  sessionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  sessionCopy: { flex: 1, gap: 3 },
  sessionDate: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  sessionMeta: { color: colors.muted, fontSize: 13 },
  emptyCard: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
