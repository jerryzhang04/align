import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { SymbolView } from "expo-symbols";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { MeasurementList } from "../src/components/MeasurementList";
import { CAPTURE_VIEWS, captureProgress } from "../src/lib/captureFlow";
import { discardLocalFiles, finalizeCaptures } from "../src/services/captures";
import { cacheCoachAudio } from "../src/services/audioFile";
import { playCachedCoachAudio } from "../src/lib/coachPlayback";
import { saveSession } from "../src/services/history";
import { localWellnessReport } from "../src/lib/localGuidance";
import { useScan } from "../src/state/ScanContext";
import { colors, radius, spacing } from "../src/theme";

export default function RecapScreen() {
  const { scanId, captures, cloudCoachEnabled, coachCaption, guidanceReport, measurements, reset } = useScan();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audioError, setAudioError] = useState("");
  const reportAudioFile = useRef<string | null>(null);
  const player = useAudioPlayer(null);
  const progress = captureProgress(captures);
  const displayReport = useMemo(
    () => guidanceReport ?? localWellnessReport({ requestId: scanId, measurements }),
    [guidanceReport, measurements, scanId],
  );

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!displayReport.audioBase64) return;
    let cancelled = false;
    void (async () => {
      try {
        const file = cacheCoachAudio(displayReport.audioBase64!, displayReport.audioMime);
        reportAudioFile.current = file;
        if (!cancelled) await playCachedCoachAudio(player, file);
      } catch {
        if (!cancelled) setAudioError("Audio could not play. Your coach’s answer is available below.");
      }
    })();
    return () => {
      cancelled = true;
      void discardLocalFiles(reportAudioFile.current);
    };
  }, [displayReport, player]);

  const save = async () => {
    setSaving(true);
    try {
      await finalizeCaptures(scanId, captures, async (persistent) => {
        await saveSession({ id: scanId, createdAt: new Date().toISOString(), captures: persistent, coachCaption, guidanceReport: displayReport, measurements: measurements.length ? measurements : displayReport.measurements });
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
      <Text accessibilityRole="header" style={styles.title}>Your posture recap</Text>
      <Text style={styles.lead}>{progress.accepted} of 4 views captured. Review the photos and measured findings, then save this session.</Text>

      <MeasurementList
        measurements={measurements.length ? measurements : displayReport.measurements}
        localOnly={!cloudCoachEnabled}
      />

      <View style={styles.gallery}>
        {CAPTURE_VIEWS.map((view) => (
          <View key={view.id} style={styles.captureCard}>
            {captures[view.id] ? <Image accessibilityLabel={`${view.label} posture capture`} source={{ uri: captures[view.id] }} style={styles.image} resizeMode="cover" /> : <View style={styles.missing}><Text style={styles.missingText}>Missing</Text></View>}
            <View style={styles.captureFooter}><Text style={styles.captureLabel}>{view.label}</Text><SymbolView name={captures[view.id] ? "checkmark.circle.fill" : "exclamationmark.circle"} size={16} tintColor={captures[view.id] ? colors.teal : colors.amber} /></View>
          </View>
        ))}
      </View>

      <View style={styles.coachCard}>
        <Text style={styles.coachLabel}>{displayReport.providerMode === "omni" ? "Coach’s answer" : "Scan notes"}</Text>
        {displayReport.safety.level !== "wellness" ? <Text style={styles.safetyText}>{displayReport.safety.message}</Text> : null}
        {displayReport.providerMode !== "omni" ? <Text style={styles.sourceText}>Rule-based scan notes. A personalized OMNI review is not available for this report.</Text> : null}
        <Text style={styles.coachText}>{displayReport.summary}</Text>
        {displayReport.audioBase64 ? <PrimaryButton label="Replay coach answer" variant="secondary" onPress={() => {
          setAudioError("");
          void (async () => {
            try {
              const file = reportAudioFile.current ?? cacheCoachAudio(displayReport.audioBase64!, displayReport.audioMime);
              reportAudioFile.current = file;
              await playCachedCoachAudio(player, file);
            } catch {
              setAudioError("Audio could not play. Read the answer above.");
            }
          })();
        }} /> : <Text style={styles.sourceText}>Caption-only reply · no OMNI audio was returned.</Text>}
        {audioError ? <Text accessibilityRole="alert" style={styles.safetyText}>{audioError}</Text> : null}
        {displayReport.observations.map((observation) => (
          <View key={observation.id} style={styles.guidanceItem}>
            <Text style={styles.guidanceBody}>{observation.text}</Text>
          </View>
        ))}
        {displayReport.actions.map((action) => (
          <View key={action.id} style={styles.guidanceItem}>
            <Text style={styles.guidanceTitle}>{action.title}</Text>
            <Text style={styles.guidanceBody}>{action.instruction}</Text>
            <Text style={styles.guidanceRationale}>{action.rationale}</Text>
          </View>
        ))}
        {displayReport.limitations.map((limitation) => <Text key={limitation} style={styles.sourceText}>{limitation}</Text>)}
        <Text style={styles.sourceHeading}>Sources used</Text>
        {displayReport.sources.map((source) => <Text key={source.id} style={styles.sourceText}>{source.publisher} · {source.title}{"\n"}{source.url}</Text>)}
        <Text style={styles.providerText}>{displayReport.speechProvider === "omni" ? `OMNI · ${displayReport.model}` : `Reviewed sources · ${displayReport.model}`}</Text>
      </View>

      {coachCaption && !guidanceReport ? (
        <View style={styles.coachCard}>
          <Text style={styles.coachLabel}>Last coach answer</Text>
          <Text style={styles.coachText}>{coachCaption}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {!saved ? <PrimaryButton label={saving ? "Saving…" : "Save session on this iPhone"} disabled={saving || progress.accepted < 4} onPress={save} /> : <PrimaryButton label="Done" onPress={done} />}
        <PrimaryButton label="Retake the scan" variant="secondary" onPress={() => { reset(); router.replace("/setup"); }} />
      </View>

      <Text style={styles.footnote}>Align is a daily-practice capture tool. It does not diagnose conditions.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  title: { color: colors.ink, fontSize: 35, lineHeight: 39, letterSpacing: -1.2, fontWeight: "700" },
  lead: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  captureCard: { width: "48.5%", backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  image: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.camera },
  missing: { width: "100%", aspectRatio: 0.82, backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
  missingText: { color: colors.muted, fontWeight: "700" },
  captureFooter: { minHeight: 44, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  captureLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  coachCard: { paddingVertical: spacing.md, gap: spacing.md, borderTopWidth: 1, borderColor: colors.line },
  coachLabel: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  coachText: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  safetyText: { color: colors.coral, fontSize: 15, lineHeight: 22, fontWeight: "800" },
  guidanceItem: { gap: 3, paddingTop: spacing.xs },
  guidanceTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  guidanceBody: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  guidanceRationale: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sourceHeading: { color: colors.tealDark, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, marginTop: spacing.sm },
  sourceText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  providerText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.md },
});
