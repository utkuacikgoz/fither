import AsyncStorage from "@react-native-async-storage/async-storage";

import { intentionAskDue, useIntentionStore } from "../intention-store";

// Two facts, persisted: the target she holds and whether we asked. A
// target change is prospective — the store holds no history at all, so
// there is nothing it could rewrite.

async function flushPersistence() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useIntentionStore.setState({
    target: null,
    asked: false,
    hydrated: true,
    hydrationFailed: false,
  });
});

describe("intention store", () => {
  it("starts with no target and the ask still owed", () => {
    expect(useIntentionStore.getState().target).toBeNull();
    expect(useIntentionStore.getState().asked).toBe(false);
    expect(intentionAskDue()).toBe(true);
  });

  it("setTarget holds 2 or 3 and counts as the answer to the ask", async () => {
    useIntentionStore.getState().setTarget(2);
    expect(useIntentionStore.getState().target).toBe(2);
    expect(useIntentionStore.getState().asked).toBe(true);
    expect(intentionAskDue()).toBe(false);

    useIntentionStore.getState().setTarget(3);
    expect(useIntentionStore.getState().target).toBe(3);

    await flushPersistence();
    const stored = await AsyncStorage.getItem("fither/intention-v1");
    expect(stored).toContain('"target":3');
    expect(stored).toContain('"asked":true');
  });

  it("a target can be cleared again; the ask stays answered", () => {
    useIntentionStore.getState().setTarget(3);
    useIntentionStore.getState().setTarget(null);
    expect(useIntentionStore.getState().target).toBeNull();
    expect(useIntentionStore.getState().asked).toBe(true);
  });

  it("markAsked ends the ask without choosing a target", async () => {
    useIntentionStore.getState().markAsked();
    expect(useIntentionStore.getState().asked).toBe(true);
    expect(useIntentionStore.getState().target).toBeNull();
    expect(intentionAskDue()).toBe(false);
    await flushPersistence();
    expect(await AsyncStorage.getItem("fither/intention-v1")).toContain(
      '"asked":true',
    );
  });

  it("holds nothing but the two facts: no history to rewrite", () => {
    const persisted = (useIntentionStore.persist.getOptions().partialize as (
      s: ReturnType<typeof useIntentionStore.getState>,
    ) => object)(useIntentionStore.getState());
    expect(Object.keys(persisted).sort()).toEqual(["asked", "target"]);
  });

  it("before hydration the ask is not due — fails safe toward not asking", () => {
    useIntentionStore.setState({ hydrated: false });
    expect(intentionAskDue()).toBe(false);
  });
});
