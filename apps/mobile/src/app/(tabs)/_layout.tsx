import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { useCircles } from "../../hooks/useCircles";
import { useLatestLocations } from "../../hooks/useLatestLocations";
import { useActiveShareSessions } from "../../hooks/useShareSessions";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { reconcileTracking } from "../../lib/sharing";
import { connectRealtime, disconnectRealtime } from "../../lib/socket";
import { TabBar } from "../../components/TabBar";
import { IncomingRequestPrompt } from "../../components/IncomingRequestPrompt";
import { colors } from "../../theme";

export default function TabsLayout() {
  const { data: circles } = useCircles();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const setCircleId = useActiveCircleStore((s) => s.setCircleId);
  const { data: mySessions } = useActiveShareSessions();
  useLatestLocations(circleId);

  useEffect(() => {
    const stillMember = circles?.some((c) => c.id === circleId);
    if (circles && circles.length > 0 && !stillMember) setCircleId(circles[0].id);
  }, [circles, circleId, setCircleId]);

  // Sessions end server-side (arrival, expiry): stop the GPS when the last one
  // ends, or at launch if none is left (and on web, restart it after a reload
  // while one is active). Not on every empty list: a refetch can
  // land between "GPS started" and "session created" while starting a share.
  const previousCount = useRef<number | null>(null);
  useEffect(() => {
    if (!mySessions) return;
    const previous = previousCount.current;
    previousCount.current = mySessions.length;
    if (mySessions.length > 0 || previous !== 0) void reconcileTracking(mySessions.length);
  }, [mySessions]);

  useEffect(() => {
    connectRealtime();
    return () => disconnectRealtime();
  }, []);

  return (
    <>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          animation: "shift",
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Carte" }} />
        <Tabs.Screen name="circle" options={{ title: "Cercle" }} />
        <Tabs.Screen name="activity" options={{ title: "Activité" }} />
        <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      </Tabs>
      {/* "Tu es où ?" received: answerable from any tab. */}
      <IncomingRequestPrompt />
    </>
  );
}
