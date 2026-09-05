import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getBilling } from "../monetization/billing";
import { useEntitlementStore } from "./entitlement-store";

// The lifetime offer (ADR-0014): shown ONCE, on day 3 of the store's
// free trial, only to someone who has switched off auto-renew. The
// store knows the cancel; this store knows only whether we have asked.
// "Once" is the promise the copy makes ("We'll only ask once"), so the
// asked date is written BEFORE the screen is pushed — a crash between
// the two loses an ask, never repeats one.

interface LifetimeOfferState {
  hydrated: boolean;
  hydrationFailed: boolean;
  /** Local date the offer was shown, or null if never. */
  offeredDate: string | null;
  /**
   * Whether to show the offer now: never asked, not purchased, and the
   * billing port says the store condition holds. Marks asked when true.
   */
  claimOffer: (today: string) => Promise<boolean>;
  resetForDev: () => void;
}

export const useLifetimeOfferStore = create<LifetimeOfferState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hydrationFailed: false,
      offeredDate: null,

      claimOffer: async (today) => {
        const { hydrated, offeredDate } = get();
        // Unhydrated fails SAFE toward not asking: a skipped ask costs
        // nothing, a second ask breaks the promise.
        if (!hydrated || offeredDate !== null) return false;
        if (useEntitlementStore.getState().purchase?.plan === "lifetime") return false;
        const eligible = await getBilling().lifetimeOfferEligible();
        if (!eligible || get().offeredDate !== null) return false;
        set({ offeredDate: today });
        return true;
      },

      resetForDev: () => set({ offeredDate: null }),
    }),
    {
      name: "fither/lifetime-offer-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ offeredDate: state.offeredDate }),
      onRehydrateStorage: () => (_state, error) => {
        Promise.resolve().then(() =>
          useLifetimeOfferStore.setState({
            hydrated: !error,
            hydrationFailed: Boolean(error),
          }),
        );
      },
    },
  ),
);
