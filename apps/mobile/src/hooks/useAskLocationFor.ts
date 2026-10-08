import { useAskLocation } from "./useLocationRequests";
import { ApiError } from "../lib/api-client";
import { useToastStore } from "../components/ui";
import { colors } from "../theme";

/** "Tu es où ?" with feedback as a toast, shared by the map and the circle tab. */
export function useAskLocationFor(circleId: string | null) {
  const ask = useAskLocation();
  const toast = useToastStore((s) => s.show);
  return {
    asking: ask.isPending,
    ask: (userId: string, name: string, onSent?: () => void) => {
      if (!circleId) return;
      ask.mutate(
        { circleId, toUserId: userId },
        {
          onSuccess: () => {
            toast({ title: `Demande envoyée à ${name}`, body: "Tu seras prévenu·e de sa réponse", icon: "paper-plane" });
            onSent?.();
          },
          onError: (err) =>
            toast({
              title: "Demande impossible",
              body: err instanceof ApiError ? err.message : "Réessaie dans un instant",
              icon: "alert-circle",
              color: colors.danger,
            }),
        },
      );
    },
  };
}
