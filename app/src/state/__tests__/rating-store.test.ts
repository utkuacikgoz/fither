import AsyncStorage from "@react-native-async-storage/async-storage";

import { ratingMomentReached, useRatingStore } from "../rating-store";

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useRatingStore.setState({
    completedCloses: 0,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("rating store", () => {
  it("counts completed closes and persists across launches", async () => {
    useRatingStore.getState().recordCompletedClose();
    useRatingStore.getState().recordCompletedClose();
    expect(useRatingStore.getState().completedCloses).toBe(2);
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/rating-v1")).toContain(
      '"completedCloses":2',
    );
  });

  it("the rating moment starts at the SECOND completed session, never the first", () => {
    expect(ratingMomentReached()).toBe(false);
    useRatingStore.getState().recordCompletedClose();
    expect(ratingMomentReached()).toBe(false);
    useRatingStore.getState().recordCompletedClose();
    expect(ratingMomentReached()).toBe(true);
    useRatingStore.getState().recordCompletedClose();
    expect(ratingMomentReached()).toBe(true);
  });

  it("fails safe while unhydrated: no prompt over unknown state", () => {
    useRatingStore.setState({ completedCloses: 5, hydrated: false });
    expect(ratingMomentReached()).toBe(false);
  });

  it("exposes only the recording action — the count is never editable", () => {
    const state = useRatingStore.getState() as unknown as Record<string, unknown>;
    const actions = Object.keys(state).filter(
      (k) => typeof state[k] === "function",
    );
    expect(actions).toEqual(["recordCompletedClose"]);
  });
});
