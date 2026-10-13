import { create } from "zustand";
import type { TripReaction } from "@orbit/shared";

export interface ActiveFloatingReaction extends TripReaction {
  animKey: string;
}

interface ReactionState {
  reactions: ActiveFloatingReaction[];
  addReaction: (reaction: TripReaction) => void;
  removeReaction: (animKey: string) => void;
}

export const useReactionStore = create<ReactionState>((set) => ({
  reactions: [],
  addReaction: (reaction) => {
    const animKey = `${reaction.id}-${Date.now()}-${Math.random()}`;
    set((state) => ({
      reactions: [...state.reactions.slice(-10), { ...reaction, animKey }],
    }));
  },
  removeReaction: (animKey) => {
    set((state) => ({
      reactions: state.reactions.filter((r) => r.animKey !== animKey),
    }));
  },
}));
