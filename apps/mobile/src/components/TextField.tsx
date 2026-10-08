import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

/**
 * TextInput with explicit text/placeholder colors: the app's surfaces are
 * light, so relying on the system defaults makes placeholders invisible when
 * the phone is in dark mode.
 */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(
  { style, placeholderTextColor = "#8a8f98", ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      style={[{ color: "#111827" }, style]}
      placeholderTextColor={placeholderTextColor}
      {...props}
    />
  );
});
