import { createPlayer, finishEarly, reduce } from "../../session/player-machine";
import { fixturePlayerBlocks, fixtureSession } from "../../test-utils/fixtures";
import { todaySessionState } from "../today-session";

// The hub's one reading of the in-memory session, on the same boundary
// the crash snapshot is written: begun means the machine moved.

const today = fixtureSession.date;

it("nothing in memory is nothing", () => {
  expect(todaySessionState(null, null, today)).toBe("none");
  expect(todaySessionState(fixtureSession, null, today)).toBe("none");
});

it("a fresh player is a built session, not a begun one", () => {
  expect(todaySessionState(fixtureSession, createPlayer(fixturePlayerBlocks), today)).toBe("built");
});

it("begun once the machine moves — Begin, or any captured outcome", () => {
  const begun = reduce(createPlayer(fixturePlayerBlocks), { type: "begin" });
  expect(todaySessionState(fixtureSession, begun, today)).toBe("inFlight");
  const skipped = reduce(createPlayer(fixturePlayerBlocks), { type: "skipBlock" });
  expect(todaySessionState(fixtureSession, skipped, today)).toBe("inFlight");
});

it("finished is over, and another day's session never claims today", () => {
  const done = finishEarly(createPlayer(fixturePlayerBlocks));
  expect(todaySessionState(fixtureSession, done, today)).toBe("none");
  const begun = reduce(createPlayer(fixturePlayerBlocks), { type: "begin" });
  expect(todaySessionState({ ...fixtureSession, date: "2026-01-01" }, begun, today)).toBe("none");
});
