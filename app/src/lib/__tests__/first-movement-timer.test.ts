// Pure Gate 3 timing logic: every timestamp here is injected — no real
// clocks anywhere in this file.

import {
  appendRun,
  computeDeltaMs,
  createLaunchTracker,
  formatDeltaSeconds,
  latestFirstRun,
  MAX_RECORDED_RUNS,
  type FirstMovementRun,
} from "../first-movement-timer";

function run(overrides: Partial<FirstMovementRun> = {}): FirstMovementRun {
  return { t0: 1000, t1: 43_500, deltaMs: 42_500, firstRun: false, ...overrides };
}

describe("delta math", () => {
  it("is t1 - t0 from injected timestamps", () => {
    expect(computeDeltaMs(1_000, 43_500)).toBe(42_500);
    expect(computeDeltaMs(0, 60_000)).toBe(60_000);
  });

  it("clamps a clock that went backwards to zero", () => {
    expect(computeDeltaMs(5_000, 4_000)).toBe(0);
  });

  it("formats milliseconds as one-decimal seconds", () => {
    expect(formatDeltaSeconds(42_500)).toBe("42.5s");
    expect(formatDeltaSeconds(0)).toBe("0.0s");
    expect(formatDeltaSeconds(60_049)).toBe("60.0s");
  });
});

describe("launch tracker", () => {
  it("captures exactly once, at the first work phase after launch", () => {
    const tracker = createLaunchTracker();
    tracker.markLaunch(1_000);
    tracker.markFirstRun(true);

    expect(tracker.captureWorkEntry("blockIntro", () => 2_000)).toBeNull();
    const captured = tracker.captureWorkEntry("work", () => 43_500);
    expect(captured).toEqual({
      t0: 1_000,
      t1: 43_500,
      deltaMs: 42_500,
      firstRun: true,
    });

    // Every later phase — including more work entries — is a no-op.
    expect(tracker.captureWorkEntry("rest", () => 50_000)).toBeNull();
    expect(tracker.captureWorkEntry("work", () => 60_000)).toBeNull();
  });

  it("never reads the clock except on the one capture", () => {
    const tracker = createLaunchTracker();
    tracker.markLaunch(1_000);
    const clock = jest.fn(() => 5_000);

    tracker.captureWorkEntry("blockIntro", clock);
    tracker.captureWorkEntry("work", clock);
    tracker.captureWorkEntry("work", clock);
    tracker.captureWorkEntry("rest", clock);
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it("captures nothing before t0 is marked", () => {
    const tracker = createLaunchTracker();
    expect(tracker.captureWorkEntry("work", () => 9_000)).toBeNull();
    // Still armed: marking the launch afterwards allows the capture.
    tracker.markLaunch(1_000);
    expect(tracker.captureWorkEntry("work", () => 9_000)).not.toBeNull();
  });

  it("t0 is idempotent — the first mount of the launch surface wins", () => {
    const tracker = createLaunchTracker();
    tracker.markLaunch(1_000);
    tracker.markLaunch(2_000); // remount within the same launch
    expect(tracker.captureWorkEntry("work", () => 3_000)?.t0).toBe(1_000);
  });

  it("first-run flag: first stamp wins, defaults to false when never stamped", () => {
    const stamped = createLaunchTracker();
    stamped.markLaunch(0);
    stamped.markFirstRun(true);
    stamped.markFirstRun(false); // later re-render must not flip it
    expect(stamped.captureWorkEntry("work", () => 10)?.firstRun).toBe(true);

    const unstamped = createLaunchTracker();
    unstamped.markLaunch(0);
    expect(unstamped.captureWorkEntry("work", () => 10)?.firstRun).toBe(false);
  });

  it("reset re-arms the tracker (tests only)", () => {
    const tracker = createLaunchTracker();
    tracker.markLaunch(1_000);
    tracker.captureWorkEntry("work", () => 2_000);
    tracker.reset();
    expect(tracker.captureWorkEntry("work", () => 5_000)).toBeNull(); // no t0 yet
    tracker.markLaunch(4_000);
    expect(tracker.captureWorkEntry("work", () => 5_000)).toEqual({
      t0: 4_000,
      t1: 5_000,
      deltaMs: 1_000,
      firstRun: false,
    });
  });
});

describe("appendRun", () => {
  it("appends newest last", () => {
    const runs = appendRun([run({ t0: 1 })], run({ t0: 2 }));
    expect(runs.map((r) => r.t0)).toEqual([1, 2]);
  });

  it("trims the oldest later-launch records over the cap", () => {
    const first = run({ t0: 0, firstRun: true });
    let runs: FirstMovementRun[] = [first];
    for (let i = 1; i <= MAX_RECORDED_RUNS + 5; i += 1) {
      runs = appendRun(runs, run({ t0: i }));
    }
    expect(runs).toHaveLength(MAX_RECORDED_RUNS);
    // The Gate 3 record survives; the oldest later-launches went first.
    expect(runs[0]).toEqual(first);
    expect(runs[1]?.t0).toBe(7);
  });

  it("honours a custom cap", () => {
    let runs: FirstMovementRun[] = [];
    for (let i = 0; i < 5; i += 1) runs = appendRun(runs, run({ t0: i }), 3);
    expect(runs.map((r) => r.t0)).toEqual([2, 3, 4]);
  });
});

describe("latestFirstRun", () => {
  it("returns the most recent first-run record", () => {
    const runs = [
      run({ t0: 1, firstRun: true }),
      run({ t0: 2 }),
      run({ t0: 3, firstRun: true }),
      run({ t0: 4 }),
    ];
    expect(latestFirstRun(runs)?.t0).toBe(3);
  });

  it("returns null when no first run was ever captured", () => {
    expect(latestFirstRun([])).toBeNull();
    expect(latestFirstRun([run()])).toBeNull();
  });
});
