import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScanProvider } from "../src/state/ScanContext";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <ScanProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: colors.canvas },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="consent" options={{ title: "Before you begin" }} />
        <Stack.Screen name="setup" options={{ title: "Set the scene" }} />
        <Stack.Screen name="scan" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="recap" options={{ title: "Capture recap", gestureEnabled: false }} />
      </Stack>
    </ScanProvider>
  );
}
