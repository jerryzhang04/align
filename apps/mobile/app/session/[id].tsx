import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { MeasurementList } from "../../src/components/MeasurementList";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { CAPTURE_VIEWS } from "../../src/lib/captureFlow";
import { deleteSession, getSession, type SavedSession } from "../../src/services/history";
import { colors, radius, spacing } from "../../src/theme";

export default function SavedSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SavedSession | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    getSession(id).then(setSession).catch(() => setSession(null));
  }, [id]);

  const remove = () => {
    if (!session) return;
    Alert.alert("Delete this session?", "Photos and measurements stored on this iPhone will be removed.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteSession(session.id).then(() => router.replace("/"));
        },
      },
    ]);
  };

  if (session === undefined) {
    return (
      <View style={styles.missingPage}>
        <Text style={styles.lead}>Opening saved session…</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.missingPage}>
        <Text style={styles.title}>Session not found</Text>
        <PrimaryButton label="Home" onPress={() => router.replace("/")} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={styles.title}>{new Date(session.createdAt).toLocaleString()}</Text>
      <Text style={styles.lead}>Saved on this iPhone. Projected measurements are computer vision, not a diagnosis.</Text>
      <View style={styles.gallery}>
        {CAPTURE_VIEWS.map((view) => (
          <View key={view.id} style={styles.captureCard}>
            {session.captures[view.id] ? (
              <Image accessibilityLabel={`${view.label} posture capture`} source={{ uri: session.captures[view.id] }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.missing}><Text style={styles.missingText}>Missing</Text></View>
            )}
            <View style={styles.captureFooter}>
              <Text style={styles.captureLabel}>{view.label}</Text>
              <SymbolView name={session.captures[view.id] ? "checkmark.circle.fill" : "exclamationmark.circle"} size={16} tintColor={session.captures[view.id] ? colors.teal : colors.amber} />
            </View>
          </View>
        ))}
      </View>
      <MeasurementList measurements={session.measurements} />
      {session.guidanceReport ? (
        <View style={styles.coachCard}>
          <Text style={styles.coachLabel}>SAVED GUIDANCE</Text>
          <Text style={styles.coachText}>{session.guidanceReport.summary}</Text>
        </View>
      ) : null}
      <PrimaryButton label="Delete session" variant="secondary" onPress={remove} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  missingPage: { flex: 1, padding: spacing.lg, gap: spacing.lg, justifyContent: "center" },
  title: { color: colors.ink, fontSize: 28, lineHeight: 32, fontWeight: "700", letterSpacing: -0.8 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  captureCard: { width: "48.5%", backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  image: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.camera },
  missing: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
  missingText: { color: colors.muted, fontWeight: "700" },
  captureFooter: { minHeight: 44, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captureLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  coachCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.line },
  coachLabel: { color: colors.tealDark, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  coachText: { color: colors.ink, fontSize: 16, lineHeight: 23 },
});
