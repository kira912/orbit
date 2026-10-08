import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors } from "../../theme";
import { AppText } from "./AppText";

/** Large title header for the list screens. */
export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
      <View style={styles.text}>
        {eyebrow && (
          <AppText variant="label" color={colors.primary}>
            {eyebrow}
          </AppText>
        )}
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
      </View>
      {right}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingTop: 8, paddingBottom: 16 },
  text: { flex: 1, gap: 2 },
});
