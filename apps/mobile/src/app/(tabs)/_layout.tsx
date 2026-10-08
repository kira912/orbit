import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCircles } from "../../hooks/useCircles";
import { useLatestLocations } from "../../hooks/useLatestLocations";
import { useActiveCircleStore } from "../../lib/active-circle-store";
import { connectRealtime, disconnectRealtime } from "../../lib/socket";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} color={color as string} size={size} />;
}

export default function TabsLayout() {
  const { data: circles } = useCircles();
  const circleId = useActiveCircleStore((s) => s.circleId);
  const setCircleId = useActiveCircleStore((s) => s.setCircleId);
  useLatestLocations(circleId);

  useEffect(() => {
    if (!circleId && circles && circles.length > 0) {
      setCircleId(circles[0].id);
    }
  }, [circles, circleId, setCircleId]);

  useEffect(() => {
    connectRealtime();
    return () => disconnectRealtime();
  }, []);

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563eb" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Carte",
          tabBarIcon: ({ color, size }) => <TabIcon name="map" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Membres",
          tabBarIcon: ({ color, size }) => <TabIcon name="list" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: "Cercles",
          tabBarIcon: ({ color, size }) => <TabIcon name="people" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: "Lieux",
          tabBarIcon: ({ color, size }) => <TabIcon name="location" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <TabIcon name="person-circle" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
