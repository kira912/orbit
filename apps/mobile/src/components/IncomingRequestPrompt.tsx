import { useEffect, useState, type ReactNode } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useAnswerLocationRequest, useIncomingLocationRequests } from "../hooks/useLocationRequests";
import { colors } from "../theme";
import { AppText, Avatar, Button, Chip, Sheet } from "./ui";

const DURATIONS = [15, 30, 60];

/**
 * "Tu es où ?" on the receiving end: a sheet that pops up over whatever tab
 * is open. Answering is one tap; nothing is shared until "Partager".
 */
export function IncomingRequestPrompt() {
  const { data: requests } = useIncomingLocationRequests();
  const answer = useAnswerLocationRequest();
  const [minutes, setMinutes] = useState(15);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const request = requests?.find((r) => !dismissed.includes(r.id)) ?? null;
  // Keep the last request on screen while the sheet animates out.
  const [shown, setShown] = useState(request);
  useEffect(() => {
    if (request) setShown(request);
  }, [request]);

  const respond = (accept: boolean) => {
    if (!request) return;
    answer.mutate(
      { id: request.id, accept, durationMinutes: minutes },
      {
        onSuccess: () => setDismissed((d) => [...d, request.id]),
        onError: (err) => Alert.alert("Impossible de répondre", (err as Error).message),
      },
    );
  };

  return (
    <Sheet visible={request != null} onClose={() => request && setDismissed((d) => [...d, request.id])}>
      {shown && (
        <View style={styles.content}>
          <Ripple>
            <Avatar userId={shown.fromUserId} name={shown.fromName} size={72} />
          </Ripple>
          <AppText variant="title" align="center">
            {shown.fromName} aimerait savoir où tu es
          </AppText>
          <AppText variant="body" color={colors.muted} align="center">
            Ta position sera visible par le cercle « {shown.circleName} » pendant la durée choisie, puis le partage
            s'arrêtera tout seul.
          </AppText>
          <View style={styles.chips}>
            {DURATIONS.map((m) => (
              <Chip key={m} label={m < 60 ? `${m} min` : "1 h"} selected={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </View>
          <Button
            size="lg"
            icon="navigate"
            label="Partager ma position"
            loading={answer.isPending && answer.variables?.accept === true}
            onPress={() => respond(true)}
            style={styles.button}
          />
          <Button
            variant="ghost"
            label="Pas maintenant"
            loading={answer.isPending && answer.variables?.accept === false}
            onPress={() => respond(false)}
            style={styles.button}
          />
        </View>
      )}
    </Sheet>
  );
}

/** Two rings rippling out of the requester's avatar: someone is calling. */
function Ripple({ children }: { children: ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
  }, [t]);
  const first = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.9 }] }));
  const second = useAnimatedStyle(() => {
    const p = (t.value + 0.5) % 1;
    return { opacity: 0.35 * (1 - p), transform: [{ scale: 1 + p * 0.9 }] };
  });
  return (
    <View style={styles.ripple}>
      <Animated.View style={[styles.ring, first]} />
      <Animated.View style={[styles.ring, second]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: 10, paddingTop: 8 },
  ripple: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  ring: { position: "absolute", width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary },
  chips: { flexDirection: "row", gap: 8, marginTop: 6 },
  button: { alignSelf: "stretch" },
});
