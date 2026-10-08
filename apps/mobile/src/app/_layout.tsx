import "../tasks/background-location-task";
import "../lib/web-polyfills";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/query-client";
import { useAuthStore } from "../lib/auth-store";
import { onNotificationTap, registerForPushNotifications } from "../lib/notifications";
import { takePendingInvite } from "../lib/pending-invite";
import { Toaster } from "../components/ui";
import { colors } from "../theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = status !== "idle" && (fontsLoaded || fontError != null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <View style={styles.splash} />;

  const authenticated = status === "authenticated";
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={authenticated ? "dark" : "light"} />
          {authenticated && <PushNotifications />}
          {authenticated && <PendingInvite />}
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade_from_bottom",
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Protected guard={authenticated}>
              <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
              {["share", "circles", "invite", "meetup/new", "meetup/[id]", "place/new", "report/new"].map((name) => (
                <Stack.Screen
                  key={name}
                  name={name}
                  options={{ presentation: "modal", animation: "slide_from_bottom", gestureEnabled: true }}
                />
              ))}
              <Stack.Screen name="scan" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
            </Stack.Protected>
            <Stack.Protected guard={!authenticated}>
              <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
            </Stack.Protected>
            {/* Invite links work signed in or out (the screen sends visitors to sign in first). */}
            <Stack.Screen name="join/[code]" options={{ animation: "fade" }} />
          </Stack>
          <Toaster />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Registers this device for push, and opens the screen a tapped notification points to. */
function PushNotifications() {
  const router = useRouter();
  useEffect(() => {
    void registerForPushNotifications();
    return onNotificationTap((url) => router.navigate(url as never));
  }, [router]);
  return null;
}

/** An invite link opened before signing in: use it now that we are. */
function PendingInvite() {
  const router = useRouter();
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.navigate(`/join/${code}`);
  }, [router]);
  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, backgroundColor: colors.night },
});
