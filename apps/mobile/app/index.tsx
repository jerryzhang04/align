import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { checkCoachHealth } from "../src/services/coach";
import { coachErrorMessage } from "../src/services/request";
import { listSessions, type SavedSession } from "../src/services/history";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";

type Readiness = "checking" | "omni" | "unconfigured" | "offline";

export default function HomeScreen() {
  const { reset } = useScan();
  const [readiness, setReadiness] = useState<Readiness>("checking");
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [offlineDetail, setOfflineDetail] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    checkCoachHealth(controller.signal)
      .then((health) => setReadiness(health.providerMode === "omni" ? "omni" : "unconfigured"))
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setReadiness("offline");
        setOfflineDetail(coachErrorMessage(error));
      });
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
    omni: "Voice coach connected",
    unconfigured: "Capture ready · guidance needs setup",
    offline: "Offline capture available",
  }[readiness];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image source={require("../assets/align-mark.png")} style={styles.mark} accessibilityIgnoresInvertColors />
          <Text style={styles.brand}>ALIGN</Text>
        </View>

        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.title}>See your posture from four views.</Text>
          <Text style={styles.subtitle}>Take four photos, review measured alignment, and ask the coach a question.</Text>
        </View>

        <PrimaryButton label="Start a scan" onPress={start} />
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, readiness === "omni" && styles.statusReady]} />
          <Text style={styles.statusText}>{statusCopy}</Text>
        </View>
        {readiness === "offline" && offlineDetail ? <Text style={styles.offlineDetail}>{offlineDetail}</Text> : null}

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
            <Text style={styles.emptyTitle}>No saved scans yet.</Text>
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
  mark: { width: 28, height: 28, borderRadius: 8 },
  brand: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 2.6 },
  hero: { gap: spacing.sm, paddingTop: spacing.md },
  title: { color: colors.ink, fontSize: 34, lineHeight: 39, letterSpacing: -0.8, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 18, lineHeight: 27, maxWidth: 350 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: -10 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
  statusReady: { backgroundColor: colors.teal },
  statusText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  offlineDetail: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.md },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  privateText: { color: colors.muted, fontSize: 12 },
  sessionCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  sessionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  sessionCopy: { flex: 1, gap: 3 },
  sessionDate: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  sessionMeta: { color: colors.muted, fontSize: 13 },
  emptyCard: { borderTopWidth: 1, borderColor: colors.line, paddingVertical: spacing.lg, gap: spacing.xs },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
