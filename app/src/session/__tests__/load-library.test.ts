import { findMovement, loadLibrary, resetLibraryCache } from "../load-library";
import { fixtureLibrary } from "../../test-utils/fixtures";

describe("loadLibrary", () => {
  beforeEach(() => resetLibraryCache());

  it("loads the bundled movement library", () => {
    const library = loadLibrary();
    expect(library).not.toBeNull();
    expect(typeof library!.version).toBe("number");
    expect(library!.movements.length).toBeGreaterThan(0);
  });

  it("returns null calmly if the library asset is absent or unreadable", () => {
    // Simulate a build without data/movements.json — the app must degrade,
    // never crash (the defensive-require path).
    jest.isolateModules(() => {
      jest.doMock("../../../../data/movements.json", () => {
        throw new Error("module not found");
      });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("../load-library") as typeof import("../load-library");
      expect(mod.loadLibrary()).toBeNull();
    });
    jest.dontMock("../../../../data/movements.json");
  });
});

describe("findMovement", () => {
  it("finds a movement by id", () => {
    expect(findMovement(fixtureLibrary, "plank")?.name).toBe("Plank");
  });

  it("returns null for an unknown id", () => {
    expect(findMovement(fixtureLibrary, "nope")).toBeNull();
  });
});
