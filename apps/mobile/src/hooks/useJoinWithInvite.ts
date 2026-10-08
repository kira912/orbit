import { useRouter } from "expo-router";
import { useJoinCircle } from "./useCircles";
import { useActiveCircleStore } from "../lib/active-circle-store";
import { ApiError } from "../lib/api-client";
import { useToastStore } from "../components/ui";
import { colors } from "../theme";

/**
 * Joins the circle behind an invite code (scanned or opened from a link),
 * then shows it on the map. Joining a circle you're already in is harmless:
 * the API just returns it.
 */
export function useJoinWithInvite() {
  const router = useRouter();
  const join = useJoinCircle();
  const setActiveCircle = useActiveCircleStore((s) => s.setCircleId);
  const toast = useToastStore((s) => s.show);

  const joinWithInvite = async (inviteCode: string) => {
    const circle = await join.mutateAsync({ inviteCode });
    setActiveCircle(circle.id);
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
    toast({ title: `Bienvenue dans « ${circle.name} »`, icon: "people", color: colors.success });
  };

  return { joinWithInvite, joining: join.isPending };
}

/** People-facing reason an invite couldn't be used. */
export function describeJoinError(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) return "Ce code ne correspond à aucun cercle";
  if (err instanceof ApiError) return err.message;
  return "Impossible de rejoindre le cercle pour le moment";
}
