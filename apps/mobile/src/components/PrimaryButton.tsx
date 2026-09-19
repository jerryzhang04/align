import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, View } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = PressableProps & {
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function PrimaryButton({ label, icon, variant = "primary", disabled, style, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={(state) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        state.pressed && !disabled && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {icon}
        <Text style={[styles.label, variant !== "primary" && styles.secondaryLabel]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.tealDark },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ghost: { backgroundColor: "transparent" },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { color: colors.white, fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  secondaryLabel: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
