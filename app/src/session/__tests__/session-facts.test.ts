import type { MovementLibrary, Session } from "@fither/engine";

import { strings } from "../../copy/strings";
import {
  fixtureLibrary,
  fixturePrompt,
  fixtureSession,
} from "../../test-utils/fixtures";
import { sessionFacts } from "../session-facts";

const facts = strings.preview.facts;

function withAdaptations(adaptations: Session["adaptations"]): Session {
  return { ...fixtureSession, adaptations };
}

/** The fixture library with the plank moved onto a chair. */
const chairLibrary: MovementLibrary = {
  ...fixtureLibrary,
  movements: fixtureLibrary.movements.map((m) =>
    m.id === "plank" ? { ...m, equipment: "chair" } : m,
  ),
};

/** The fixture library with one of the session's movements not silent. */
const loudLibrary: MovementLibrary = {
  ...fixtureLibrary,
  movements: fixtureLibrary.movements.map((m) =>
    m.id === "plank" ? { ...m, silent: false } : m,
  ),
};

describe("sessionFacts", () => {
  it("always leads with the length and block count", () => {
    const lines = sessionFacts(fixtureSession, fixturePrompt, fixtureLibrary);
    expect(lines[0]).toBe(facts.minutes(10, 2));
  });

  it("with no adaptations and a quiet answer, states length, quiet and the floor, nothing more", () => {
    const lines = sessionFacts(fixtureSession, fixturePrompt, fixtureLibrary);
    expect(lines).toEqual([facts.minutes(10, 2), facts.quiet, facts.floorOnly]);
  });

  it("turning low energy on adds its line; off removes it", () => {
    const on = sessionFacts(
      withAdaptations([{ kind: "lowEnergy" }]),
      fixturePrompt,
      fixtureLibrary,
    );
    const off = sessionFacts(fixtureSession, fixturePrompt, fixtureLibrary);
    expect(on).toContain(facts.lowEnergy);
    expect(off).not.toContain(facts.lowEnergy);
    expect(on).not.toEqual(off);
  });

  it("an avoided area names the area in lower case; none avoided says nothing", () => {
    const on = sessionFacts(
      withAdaptations([{ kind: "soreness", areas: ["knees", "back"] }]),
      { ...fixturePrompt, avoid: ["knees", "back"] },
      fixtureLibrary,
    );
    const off = sessionFacts(fixtureSession, fixturePrompt, fixtureLibrary);
    expect(on).toContain(facts.avoid("knees, back"));
    expect(off.some((line) => line === facts.avoid("knees, back"))).toBe(false);
    expect(on).not.toEqual(off);
  });

  it("quiet needs both the answer and an all-silent session", () => {
    const quietAllSilent = sessionFacts(fixtureSession, fixturePrompt, fixtureLibrary);
    const notQuiet = sessionFacts(
      fixtureSession,
      { ...fixturePrompt, quiet: false },
      fixtureLibrary,
    );
    const quietButLoud = sessionFacts(fixtureSession, fixturePrompt, loudLibrary);
    expect(quietAllSilent).toContain(facts.quiet);
    expect(notQuiet).not.toContain(facts.quiet);
    expect(quietButLoud).not.toContain(facts.quiet);
  });

  it("names the chair when any block uses one, else just the floor", () => {
    const floor = sessionFacts(fixtureSession, fixturePrompt, fixtureLibrary);
    const chair = sessionFacts(fixtureSession, fixturePrompt, chairLibrary);
    expect(floor).toContain(facts.floorOnly);
    expect(floor).not.toContain(facts.withChair);
    expect(chair).toContain(facts.withChair);
    expect(chair).not.toContain(facts.floorOnly);
  });

  it("soft landing, stale focus and taste name the pattern or movement in her words", () => {
    const lines = sessionFacts(
      withAdaptations([
        { kind: "softLanding", pattern: "hinge" },
        { kind: "staleFocus", pattern: "push" },
        { kind: "tasteBlock", pattern: "core", movementId: "plank" },
      ]),
      fixturePrompt,
      fixtureLibrary,
    );
    expect(lines).toContain(facts.softLanding("hip hinge"));
    expect(lines).toContain(facts.staleFocus("push"));
    expect(lines).toContain(facts.taste("Plank"));
    expect(lines.join("\n")).not.toContain("hinge is");
  });

  it("keeps the brief's order: length, avoid, energy, quiet, room, then the pattern lines", () => {
    const lines = sessionFacts(
      withAdaptations([
        { kind: "soreness", areas: ["wrists"] },
        { kind: "quiet" },
        { kind: "lowEnergy" },
        { kind: "softLanding", pattern: "push" },
        { kind: "staleFocus", pattern: "core" },
        { kind: "tasteBlock", pattern: "push", movementId: "wall-push-up" },
      ]),
      fixturePrompt,
      chairLibrary,
    );
    expect(lines).toEqual([
      facts.minutes(10, 2),
      facts.avoid("wrists"),
      facts.lowEnergy,
      facts.quiet,
      facts.withChair,
      facts.softLanding("push"),
      facts.staleFocus("core"),
      facts.taste("Wall Push-Up"),
    ]);
  });

  it("never shows a raw movement id: an unknown taste movement is dropped", () => {
    const lines = sessionFacts(
      withAdaptations([{ kind: "tasteBlock", pattern: "push", movementId: "ghost" }]),
      fixturePrompt,
      fixtureLibrary,
    );
    expect(lines.join("\n")).not.toContain("ghost");
  });

  it("without a library, makes no claim about quiet or the room", () => {
    const lines = sessionFacts(fixtureSession, fixturePrompt, null);
    expect(lines).toEqual([facts.minutes(10, 2)]);
  });
});
