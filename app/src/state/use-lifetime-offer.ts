import { useEffect } from "react";
import { router } from "expo-router";

import { useTodayIso } from "../lib/use-today";
import { useLifetimeOfferStore } from "./lifetime-offer-store";

/**
 * The hub asks the offer store, once per mount, whether the one lifetime
 * ask is due (ADR-0014) and pushes it if so. Off the training path: a
 * store read that resolves after the hub has rendered, never before.
 */
export function useLifetimeOffer(): void {
  const today = useTodayIso();
  const hydrated = useLifetimeOfferStore((s) => s.hydrated);
  const claimOffer = useLifetimeOfferStore((s) => s.claimOffer);
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    void claimOffer(today).then((due) => {
      if (live && due) router.push("/lifetime-offer");
    });
    return () => {
      live = false;
    };
  }, [hydrated, claimOffer, today]);
}
