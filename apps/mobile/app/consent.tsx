import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";

function PrivacyRow({ symbol, title, body }: { symbol: "iphone" | "waveform" | "lock.shield"; title: string; body: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}><SymbolView name={symbol} size={23} tintColor={colors.tealDark} /></View>
      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{body}</Text></View>
    </View>
  );
}

export default function ConsentScreen() {
  const { setCloudCoachEnabled } = useScan();
  const continueWith = (cloud: boolean) => {
    setCloudCoachEnabled(cloud);
    router.push("/setup");
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroIcon}><SymbolView name="hand.raised.fill" size={32} tintColor={colors.tealDark} /></View>
      <Text accessibilityRole="header" style={styles.title}>You decide what leaves the phone.</Text>
      <Text style={styles.lead}>Capture works locally. The coach only receives media when you deliberately hold the talk button.</Text>

      <View style={styles.card}>
        <PrivacyRow symbol="iphone" title="Camera capture" body="Four still views are saved on this iPhone when you choose Save session." />
        <View style={styles.rule} />
        <PrivacyRow symbol="waveform" title="Ask the coach" body="A selected frame and short recording go to OMNI. OMNI answers in text, and speaks it when it returns audio." />
        <View style={styles.rule} />
        <PrivacyRow symbol="lock.shield" title="No hidden scoring" body="The prototype does not invent posture angles while native pose measurement is still being connected." />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Wellness guidance, not medical advice</Text>
        <Text style={styles.noteBody}>Stop if you feel pain or dizziness. Align does not diagnose conditions or replace a clinician.</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Continue with voice coach" onPress={() => continueWith(true)} />
        <PrimaryButton label="Use local capture only" variant="secondary" onPress={() => continueWith(false)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  heroIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  title: { color: colors.ink, fontSize: 36, lineHeight: 40, letterSpacing: -1.2, fontWeight: "700" },
  lead: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  rowBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  note: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  noteTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  noteBody: { color: "#6F5134", fontSize: 14, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
