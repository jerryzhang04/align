import Constants from "expo-constants";
import { resolveCoachApiUrl, type CoachApiConfig } from "./apiConfig";

export function runtimeCoachApi(): CoachApiConfig {
  return resolveCoachApiUrl({
    envUrl: process.env.EXPO_PUBLIC_ALIGN_API_URL,
    envToken: process.env.EXPO_PUBLIC_ALIGN_API_TOKEN,
    hostHints: [Constants.expoConfig?.hostUri, Constants.linkingUri],
  });
}
