import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { DeviceMotion } from "expo-sensors";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { assessHorizon } from "../src/lib/level";
import { colors, radius, spacing } from "../src/theme";

export default function SetupScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [roll, setRoll] = useState<number | null>(null);
  const [sensorReady, setSensorReady] = useState(false);
  const [sensorUnavailable, setSensorUnavailable] = useState(false);

  useEffect(() => {
    if (!sensorReady) return;
    DeviceMotion.setUpdateInterval(120);
    const subscription = DeviceMotion.addListener((motion) => setRoll(motion.rotation.gamma));
    return () => subscription.remove();
  }, [sensorReady]);

  const level = useMemo(() => assessHorizon(roll), [roll]);
  const prepare = async () => {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!camera.granted) return;
    try {
      const available = await DeviceMotion.isAvailableAsync();
      if (!available) {
        setSensorUnavailable(true);
        return;
      }
      const motion = await DeviceMotion.requestPermissionsAsync();
      if (motion.granted) setSensorReady(true);
      else setSensorUnavailable(true);
    } catch {
      setSensorUnavailable(true);
    }
  };

  const canStart = Boolean(cameraPermission?.granted) && (level.isLevel || sensorUnavailable);

  if (!cameraPermission?.granted) {
    return (
      <View style={styles.permissionPage}>
        <View style={styles.permissionIcon}><SymbolView name="camera.fill" size={32} tintColor={colors.tealDark} /></View>
        <Text style={styles.permissionTitle}>Align needs the camera to frame your scan.</Text>
        <Text style={styles.permissionBody}>Nothing is uploaded until you hold Ask coach. You can change camera access in iOS Settings.</Text>
        <PrimaryButton label="Enable camera" onPress={prepare} />
        {cameraPermission && !cameraPermission.canAskAgain ? <PrimaryButton label="Open iOS Settings" variant="secondary" onPress={() => Linking.openSettings()} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.cameraShell}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" animateShutter={false} />
        <View pointerEvents="none" style={styles.horizon}>
          <View style={[styles.horizonBar, { transform: [{ rotate: `${Math.max(-18, Math.min(18, level.rollDegrees))}deg` }] }]} />
          <View style={styles.centerTick} />
        </View>
        <View style={styles.levelBadge}>
          <SymbolView name={level.isLevel ? "checkmark.circle.fill" : "rotate.left"} size={20} tintColor={level.isLevel ? colors.white : "#F8C889"} />
          <Text style={styles.levelBadgeText}>{sensorReady ? `${level.message} · ${Math.abs(level.rollDegrees)}°` : "Enable level guide"}</Text>
        </View>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.title}>Make the room part of the measurement.</Text>
        <View style={styles.step}><Text style={styles.stepNumber}>1</Text><Text style={styles.stepText}>Place the phone upright at about hip height.</Text></View>
        <View style={styles.step}><Text style={styles.stepNumber}>2</Text><Text style={styles.stepText}>Set a floor marker where your whole body fits.</Text></View>
        <View style={styles.step}><Text style={styles.stepNumber}>3</Text><Text style={styles.stepText}>Keep the phone still; you rotate on the marker.</Text></View>
      </View>

      <View style={styles.actions}>
        {!sensorReady && !sensorUnavailable ? <PrimaryButton label="Turn on level guide" variant="secondary" onPress={prepare} /> : null}
        <PrimaryButton label={level.isLevel ? "Ready to scan" : sensorUnavailable ? "Continue without level guide" : "Level the phone to continue"} disabled={!canStart} onPress={() => router.push("/scan")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas, padding: spacing.md, gap: spacing.lg },
  permissionPage: { flex: 1, padding: spacing.lg, justifyContent: "center", gap: spacing.lg, backgroundColor: colors.canvas },
  permissionIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  permissionTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, letterSpacing: -0.8, fontWeight: "700" },
  permissionBody: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  cameraShell: { height: "42%", minHeight: 280, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.camera },
  horizon: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  horizonBar: { width: "52%", height: 2, backgroundColor: colors.white },
  centerTick: { position: "absolute", width: 3, height: 28, borderRadius: 2, backgroundColor: colors.tealSoft },
  levelBadge: { position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md, minHeight: 42, borderRadius: radius.pill, backgroundColor: "rgba(10,18,15,0.76)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  levelBadgeText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  instructions: { gap: spacing.sm },
  title: { color: colors.ink, fontSize: 25, lineHeight: 29, letterSpacing: -0.6, fontWeight: "700", marginBottom: spacing.xs },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 34 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, textAlign: "center", textAlignVertical: "center", lineHeight: 28, overflow: "hidden", backgroundColor: colors.tealSoft, color: colors.tealDark, fontSize: 13, fontWeight: "800" },
  stepText: { flex: 1, color: colors.muted, fontSize: 15, lineHeight: 21 },
  actions: { gap: spacing.sm, marginTop: "auto", paddingBottom: spacing.sm },
});
