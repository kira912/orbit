import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Alert, Linking, Platform, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCircles } from "../../hooks/useCircles";
import { useActiveShareSessions, useEnablePublicLink, useStopShareSession } from "../../hooks/useShareSessions";
import { useAuthStore } from "../../lib/auth-store";
import { getNotificationPermission, pushSupported, registerForPushNotifications } from "../../lib/notifications";
import { sharePublicLink } from "../../lib/sharing";
import { useTabBarClearance } from "../../components/TabBar";
import { AppText, Avatar, Button, Card, IconButton, OrbitLogo } from "../../components/ui";
import { colors, gradients, radius, layoutTransition } from "../../theme";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: circles } = useCircles();
  const { data: sessions } = useActiveShareSessions();
  const stopSession = useStopShareSession();
  const enableLink = useEnablePublicLink();
  const notificationsGranted = useNotificationPermission();

  // Light status bar over the dark header, only while this tab is shown.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content");
      return () => StatusBar.setBarStyle("dark-content");
    }, []),
  );

  const circleName = (id: string) => circles?.find((c) => c.id === id)?.name ?? "Cercle";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: clearance + 8 }}>
      <LinearGradient
        colors={gradients.night}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.heroLogo} pointerEvents="none">
          <OrbitLogo size={220} />
        </View>
        {user && (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.heroContent}>
            <Avatar userId={user.id} name={user.displayName} size={72} ring />
            <AppText variant="title" color={colors.onNight}>
              {user.displayName}
            </AppText>
            <AppText variant="caption" color={colors.onNightMuted}>
              {user.email}
            </AppText>
          </Animated.View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        <Section title="Mes partages en cours" delay={80}>
          {sessions && sessions.length > 0 ? (
            sessions.map((session) => (
              <Animated.View key={session.id} layout={layoutTransition} style={styles.session}>
                <View style={styles.sessionIcon}>
                  <Ionicons name="navigate" size={18} color={colors.onNight} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {session.destinationName ? `Vers ${session.destinationName}` : "Position en direct"}
                  </AppText>
                  <AppText variant="caption" color={colors.muted}>
                    {circleName(session.circleId)}
                    {session.publicToken ? " · lien public actif" : ""}
                  </AppText>
                </View>
                <IconButton
                  icon="link"
                  size={36}
                  background={colors.primarySoft}
                  color={colors.primary}
                  accessibilityLabel="Partager le lien"
                  onPress={async () => {
                    const token = session.publicToken ?? (await enableLink.mutateAsync(session.id)).publicToken;
                    if (token) await sharePublicLink(token, session.destinationName);
                  }}
                />
                <IconButton
                  icon="stop"
                  size={36}
                  background={colors.dangerSoft}
                  color={colors.danger}
                  accessibilityLabel="Arrêter le partage"
                  onPress={() => stopSession.mutate(session.id)}
                />
              </Animated.View>
            ))
          ) : (
            <AppText variant="body" color={colors.muted}>
              Tu ne partages pas ta position en ce moment.
            </AppText>
          )}
        </Section>

        <Section title="Notifications" delay={140}>
          <Row
            icon={notificationsGranted ? "notifications" : "notifications-off"}
            title={
              notificationsGranted
                ? "Activées"
                : pushSupported
                  ? "Désactivées"
                  : Platform.OS === "web"
                    ? "Bientôt sur la version web"
                    : "Indisponibles dans Expo Go"
            }
            subtitle={
              notificationsGranted
                ? "Arrivées, départs et rendez-vous de tes cercles, même app fermée."
                : pushSupported
                  ? "Active-les pour savoir quand tes proches arrivent."
                  : Platform.OS === "web"
                    ? "En attendant, les alertes s'affichent quand l'app est ouverte."
                    : "Lance le build de développement (npx expo run:android) pour les recevoir."
            }
            action={
              !notificationsGranted &&
              pushSupported && (
                <Button
                  label="Activer"
                  variant="secondary"
                  onPress={async () => {
                    const permission = await getNotificationPermission();
                    if (permission?.canAskAgain) await registerForPushNotifications();
                    else void Linking.openSettings();
                  }}
                />
              )
            }
          />
        </Section>

        <Section title="Confidentialité" delay={200}>
          <Row icon="time" title="Partage temporaire" subtitle="Ta position n'est visible que pendant un partage, qui s'arrête tout seul à l'arrivée ou à l'heure prévue." />
          <Row icon="trash-bin" title="Historique court" subtitle="Tes positions sont effacées automatiquement au bout de 7 jours." />
          <Row icon="link" title="Liens publics" subtitle="Un lien de suivi cesse de fonctionner dès que le partage s'arrête." />
        </Section>

        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.buttons}>
          <Button variant="light" icon="planet" label="Gérer mes cercles" onPress={() => router.push("/circles")} />
          <Button
            variant="danger"
            icon="log-out-outline"
            label="Se déconnecter"
            onPress={() =>
              Alert.alert("Se déconnecter ?", undefined, [
                { text: "Annuler", style: "cancel" },
                { text: "Se déconnecter", style: "destructive", onPress: () => void logout() },
              ])
            }
          />
        </Animated.View>
      </View>
    </ScrollView>
  );
}

function Section({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.section}>
      <AppText variant="label" color={colors.muted}>
        {title}
      </AppText>
      <Card style={styles.card}>{children}</Card>
    </Animated.View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={colors.muted}>
          {subtitle}
        </AppText>
      </View>
      {action}
    </View>
  );
}

function useNotificationPermission(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    const check = () => getNotificationPermission().then((p) => setGranted(p?.granted ?? false), () => undefined);
    void check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);
  return granted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  hero: {
    paddingBottom: 36,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: "hidden",
  },
  heroLogo: { position: "absolute", right: -50, top: 10, opacity: 0.35 },
  heroContent: { alignItems: "center", gap: 6 },
  body: { padding: 16, gap: 20 },
  section: { gap: 10 },
  card: { gap: 16 },
  session: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: { gap: 10 },
});
