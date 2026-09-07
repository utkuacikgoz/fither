import { MAX_TIER, milestoneMovement } from "@fither/engine";

import { strings } from "../../copy/strings";
import { loadLibrary } from "../load-library";
import { skillFigureId, skillLabel } from "../skill-name";

const library = loadLibrary();
if (!library) throw new Error("bundled movement library missing in test env");

describe("skill names", () => {
  it("names the milestone movement from the library", () => {
    const expected = milestoneMovement(library, "push", 4);
    expect(skillLabel(library, "push", 4)).toBe(expected?.name);
    expect(skillFigureId(library, "push", 4)).toBe(expected?.id);
  });

  it("with no library, says the ladder and the rung in her words, never a raw id", () => {
    const label = skillLabel(null, "hinge", 3);
    expect(label).toBe(
      strings.profile.skills.unnamed(
        strings.profile.patterns.names.hinge,
        strings.profile.tier(3, MAX_TIER),
      ),
    );
    expect(label).not.toBe("hinge");
    expect(label).toContain("Hip hinge");
    expect(skillFigureId(null, "hinge", 3)).toBe("");
  });
});
