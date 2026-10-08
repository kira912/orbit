import { Text, type TextProps } from "react-native";
import { colors, type as typeScale, type TypeVariant } from "../../theme";

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: "left" | "center" | "right";
}

/** Every piece of text in the app, so the type scale and font stay consistent. */
export function AppText({ variant = "body", color = colors.ink, align, style, ...props }: AppTextProps) {
  return <Text {...props} style={[typeScale[variant], { color }, align && { textAlign: align }, style]} />;
}
