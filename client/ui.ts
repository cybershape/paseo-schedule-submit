import type { PluginTheme } from "@getpaseo/plugin";
import type { TextStyle } from "react-native";

export type ThemeColors = PluginTheme["colors"];
export const radius = 8;

export function inputStyle(colors: ThemeColors): TextStyle {
  return {
    color: colors.foreground,
    backgroundColor: colors.surface1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  };
}
