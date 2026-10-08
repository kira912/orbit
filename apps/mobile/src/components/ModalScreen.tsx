import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { AppText, IconButton } from "./ui";

interface ModalScreenProps {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  /** Pinned under the content (the screen's main action). */
  footer?: ReactNode;
}

/** Layout shared by the modal routes: title, close button, scrolling body, sticky footer. */
export function ModalScreen({ eyebrow, title, children, footer }: ModalScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Animated.View entering={FadeInDown.duration(350)} style={styles.titles}>
          {eyebrow && (
            <AppText variant="label" color={colors.primary}>
              {eyebrow}
            </AppText>
          )}
          <AppText variant="title">{title}</AppText>
        </Animated.View>
        <IconButton icon="close" background={colors.surfaceAlt} accessibilityLabel="Fermer" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

/** A titled block inside a modal, sliding in after the previous one. */
export function ModalSection({ title, index = 0, children }: { title: string; index?: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).duration(400)} style={styles.section}>
      <AppText variant="label" color={colors.muted}>
        {title}
      </AppText>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  titles: { flex: 1, gap: 2 },
  body: { padding: 20, gap: 24 },
  section: { gap: 12 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
