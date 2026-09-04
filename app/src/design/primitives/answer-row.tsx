import type { ReactNode } from "react";

import { motion } from "../tokens";
import { FadeIn } from "./fade-in";

interface AnswerRowProps {
  /** Position in its list; the delay is index × motion.staggerMs. */
  index: number;
  reduceMotion: boolean;
  children: ReactNode;
}

/**
 * An answer row entering with its siblings (ADR-0013) — the daily
 * prompt's and onboarding's option questions. Short lists only: across
 * eight rows a stagger becomes a wave travelling down the screen, which
 * is the opposite of "motion is breath"; long lists fade as one block.
 *
 * The row is hittable from the first frame, offset and all: a user who
 * knows the flow and taps ahead of the fade still lands on what she
 * sees, so nothing here spends Gate 3's budget.
 */
export function AnswerRow({ index, reduceMotion, children }: AnswerRowProps) {
  return (
    <FadeIn
      reduceMotion={reduceMotion}
      delayMs={index * motion.staggerMs}
      rise={motion.riseDistance}
    >
      {children}
    </FadeIn>
  );
}
