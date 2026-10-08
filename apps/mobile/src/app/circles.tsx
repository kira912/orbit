import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCircles, useCreateCircle, useJoinCircle } from "../hooks/useCircles";
import { useActiveCircleStore } from "../lib/active-circle-store";
import { ApiError } from "../lib/api-client";
import { shareInvite } from "../components/InviteCard";
import { ModalScreen, ModalSection } from "../components/ModalScreen";
import { AppText, AvatarStack, Button, IconButton, PressableScale, Segmented, TextField } from "../components/ui";
import { colors, radius, shadows, enter, layoutTransition } from "../theme";

type Mode = "create" | "join";

/** Switch between circles, create one, or join one with a code. */
export default function CirclesScreen() {
  const router = useRouter();
  const { data: circles } = useCircles();
  const createCircle = useCreateCircle();
  const joinCircle = useJoinCircle();
  const activeId = useActiveCircleStore((s) => s.circleId);
  const setActiveId = useActiveCircleStore((s) => s.setCircleId);

  const [mode, setMode] = useState<Mode>(circles?.length ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const select = (id: string) => {
    setActiveId(id);
    router.back();
  };

  const onSubmit = async () => {
    setError(null);
    try {
      const circle =
        mode === "create"
          ? await createCircle.mutateAsync({ name: name.trim() })
          : await joinCircle.mutateAsync({ inviteCode: code.trim().toUpperCase() });
      setName("");
      setCode("");
      select(circle.id);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Ce code ne correspond à aucun cercle"
          : err instanceof ApiError
            ? err.message
            : "Une erreur est survenue",
      );
    }
  };

  const busy = createCircle.isPending || joinCircle.isPending;

  return (
    <ModalScreen eyebrow="Orbit" title="Mes cercles">
      {circles && circles.length > 0 && (
        <ModalSection title="Choisir le cercle affiché" index={0}>
          {circles.map((circle, index) => {
            const active = circle.id === activeId;
            return (
              <Animated.View key={circle.id} entering={FadeInDown.delay(60 * index)} layout={layoutTransition}>
                <PressableScale
                  style={[styles.circle, active && styles.circleActive]}
                  onPress={() => select(circle.id)}
                  haptic="selection"
                  scaleTo={0.98}
                >
                  <View style={styles.flex}>
                    <AppText variant="headline">{circle.name}</AppText>
                    <View style={styles.meta}>
                      <AvatarStack members={circle.members} size={22} max={5} />
                      <AppText variant="caption" color={colors.muted}>
                        {circle.members.length} membre{circle.members.length > 1 ? "s" : ""}
                      </AppText>
                    </View>
                  </View>
                  <IconButton
                    icon="share-social-outline"
                    size={38}
                    background={colors.surfaceAlt}
                    accessibilityLabel={`Inviter dans ${circle.name}`}
                    onPress={() => shareInvite(circle)}
                  />
                  {active && (
                    <Animated.View entering={enter.fade()} style={styles.check}>
                      <Ionicons name="checkmark" size={16} color={colors.onNight} />
                    </Animated.View>
                  )}
                </PressableScale>
              </Animated.View>
            );
          })}
        </ModalSection>
      )}

      <ModalSection title="Nouveau cercle" index={1}>
        <Segmented<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: "join", label: "Rejoindre" },
            { value: "create", label: "Créer" },
          ]}
        />
        {mode === "create" ? (
          <TextField
            key="create"
            icon="people"
            placeholder="Nom du cercle (ex : Famille)"
            value={name}
            onChangeText={setName}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        ) : (
          <TextField
            key="join"
            icon="key"
            placeholder="Code d'invitation"
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            style={styles.code}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        )}
        {mode === "join" && (
          <Button variant="secondary" icon="qr-code" label="Scanner un QR code" onPress={() => router.push("/scan")} />
        )}
        {error && (
          <AppText variant="bodyStrong" color={colors.danger}>
            {error}
          </AppText>
        )}
        <Button
          icon={mode === "create" ? "add" : "enter-outline"}
          label={mode === "create" ? "Créer le cercle" : "Rejoindre le cercle"}
          loading={busy}
          disabled={mode === "create" ? !name.trim() : !code.trim()}
          onPress={onSubmit}
        />
      </ModalSection>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  circle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: "transparent",
    ...shadows.sm,
  },
  circleActive: { borderColor: colors.primary },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  check: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  code: { letterSpacing: 3 },
});
