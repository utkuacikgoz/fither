import { createInitialProfile, POINTS } from "@fither/engine";

import { applyResult } from "../apply-result";
import { createSession } from "../create-session";
import { resetLibraryCache } from "../load-library";
import { fixturePrompt } from "../../test-utils/fixtures";

// Integration through the real engine: generate → complete → apply.

describe("applyResult boundary (integration)", () => {
  beforeEach(() => resetLibraryCache());

  it("applies a completed session and issues ledger events", () => {
    const profile = createInitialProfile();
    const history = { entries: [] };
    const created = createSession(fixturePrompt, profile, history, 7);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const { session } = created.value;
    const outcome = applyResult(profile, history, {
      session,
      outcomes: session.blocks.map(() => "completed" as const),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const { value } = outcome;
    expect(value.history.entries).toHaveLength(1);
    const sessionEvent = value.ledgerEvents.find((e) => e.type === "session");
    expect(sessionEvent?.points).toBe(POINTS.perSessionByMinutes[session.minutes]);
  });
});
