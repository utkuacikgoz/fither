import { act, render, screen } from "@testing-library/react-native";

import { Toast } from "../toast";
import { motion } from "../../tokens";

// The toast is a confirmation, never a decision: it says what happened,
// it leaves by itself, and nothing waits on it.

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("Toast", () => {
  it("renders nothing at all with no message", () => {
    const onHidden = jest.fn();
    render(<Toast message={null} reduceMotion={false} onHidden={onHidden} testID="toast" />);
    expect(screen.queryByTestId("toast")).toBeNull();
    expect(onHidden).not.toHaveBeenCalled();
  });

  it("shows the line and reports itself hidden once it has left", () => {
    const onHidden = jest.fn();
    render(
      <Toast message="Onto the next one" reduceMotion={false} onHidden={onHidden} testID="toast" />,
    );
    expect(screen.getByTestId("toast")).toBeTruthy();
    expect(screen.getByText("Onto the next one")).toBeTruthy();
    expect(onHidden).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(motion.fadeMs + motion.toastMs + motion.fadeMs + 50);
    });
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("with Reduce Motion it still appears, and still leaves on its own", () => {
    const onHidden = jest.fn();
    render(
      <Toast message="Onto the next one" reduceMotion onHidden={onHidden} testID="toast" />,
    );
    expect(screen.getByTestId("toast")).toBeTruthy();
    act(() => jest.advanceTimersByTime(motion.toastMs - 1));
    expect(onHidden).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2));
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("never takes a press: it sits in a layer that passes touches through", () => {
    render(
      <Toast message="Onto the next one" reduceMotion onHidden={jest.fn()} testID="toast" />,
    );
    // The button underneath must stay reachable while the toast is up.
    expect(screen.getByTestId("toast-stage").props.pointerEvents).toBe("none");
  });
});
