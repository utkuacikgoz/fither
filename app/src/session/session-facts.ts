// The preview's "why it fits" list (owner brief 2026-09-07, wave 1):
// today's session explained as facts the engine emitted, one line each,
// never personalization theater. Every line maps something the session
// already carries — its length, its adaptations, what its movements ARE
// in the library — onto a string. No thresholds, no rules; the only
// reading of the prompt is her quiet answer, and even that line waits
// for the library to confirm every movement in the session is silent.

import type {
  DailyPrompt,
  Movement,
  MovementLibrary,
  Pattern,
  Session,
} from "@fither/engine";

import { strings } from "../copy/strings";
import { findMovement } from "./load-library";

function patternName(pattern: Pattern): string {
  return strings.profile.patterns.names[pattern].toLowerCase();
}

function blockMovements(
  session: Session,
  library: MovementLibrary,
): Array<Movement | null> {
  return session.blocks.map((block) => findMovement(library, block.movementId));
}

/**
 * The preview's paragraph (owner-approved mockup preview-b, 2026-09-09):
 * the same facts as `sessionFacts`, run together as prose rather than
 * listed as rows. The shape is the copy surface's own ORDER AND STOP
 * contract (strings.preview.facts), and this function only obeys it:
 * the opening always renders, at most TWO middle sentences survive in
 * the copy's order of keeping, and the equipment sentence closes when
 * the library can vouch for it. Four sentences is the ceiling, so the
 * plan never falls below the fold.
 */
export function sessionParagraph(
  session: Session,
  prompt: DailyPrompt | null,
  library: MovementLibrary | null,
): string {
  const facts = strings.preview.facts;
  const soreness = session.adaptations.find((a) => a.kind === "soreness");
  const areas =
    soreness && soreness.kind === "soreness"
      ? soreness.areas.map((area) => strings.prompt.soreness.areas[area].toLowerCase())
      : [];
  const sentences: string[] = [facts.opening(session.blocks.length, areas)];

  // The middles, in the copy's order of keeping, not the engine's order
  // of emission: her own answer about energy first, then why today is
  // lighter, then the room.
  const movements = library ? blockMovements(session, library) : [];
  const allKnown =
    library !== null &&
    movements.length > 0 &&
    movements.every((m): m is Movement => m !== null);
  const softLanding = session.adaptations.find((a) => a.kind === "softLanding");
  const staleFocus = session.adaptations.find((a) => a.kind === "staleFocus");
  const taste = session.adaptations.find((a) => a.kind === "tasteBlock");
  const tasteMovement =
    taste && taste.kind === "tasteBlock" && library
      ? findMovement(library, taste.movementId)
      : null;
  const middles: string[] = [];
  if (session.adaptations.some((a) => a.kind === "lowEnergy")) {
    middles.push(facts.lowEnergy);
  }
  if (softLanding && softLanding.kind === "softLanding") {
    middles.push(facts.softLanding(patternName(softLanding.pattern)));
  }
  if (prompt?.quiet && allKnown && movements.every((m) => m !== null && m.silent)) {
    middles.push(facts.quiet);
  }
  if (staleFocus && staleFocus.kind === "staleFocus") {
    middles.push(facts.staleFocus(patternName(staleFocus.pattern)));
  }
  // Never a raw id on screen: without the name, the sentence is dropped.
  if (tasteMovement) middles.push(facts.taste(tasteMovement.name));
  sentences.push(...middles.slice(0, 2));

  // The settling note, and the only sentence that may be absent: a claim
  // about the room is never made without the library to check it.
  if (allKnown) {
    sentences.push(
      movements.some((m) => m !== null && m.equipment === "chair")
        ? facts.withChair
        : facts.floorOnly,
    );
  }
  return sentences.join(" ");
}

/**
 * Plain-language facts about the session, in display order:
 * length, avoided areas, low energy, quiet, equipment, then the per-pattern
 * adaptations in the engine's own order (soft landing, stale focus, taste).
 * A missing library drops only the lines it would have verified (quiet,
 * equipment): a claim about the room is never made without the data.
 */
export function sessionFacts(
  session: Session,
  prompt: DailyPrompt | null,
  library: MovementLibrary | null,
): string[] {
  const facts = strings.preview.facts;
  const lines: string[] = [];

  lines.push(facts.minutes(session.minutes, session.blocks.length));

  for (const adaptation of session.adaptations) {
    if (adaptation.kind === "soreness" && adaptation.areas.length > 0) {
      lines.push(
        facts.avoid(
          adaptation.areas
            .map((area) => strings.prompt.soreness.areas[area].toLowerCase())
            .join(", "),
        ),
      );
    }
  }

  if (session.adaptations.some((a) => a.kind === "lowEnergy")) {
    lines.push(facts.lowEnergy);
  }

  if (library) {
    const movements = blockMovements(session, library);
    const allKnown =
      movements.length > 0 && movements.every((m): m is Movement => m !== null);

    if (prompt?.quiet && allKnown && movements.every((m) => m.silent)) {
      lines.push(facts.quiet);
    }

    if (allKnown) {
      lines.push(
        movements.some((m) => m.equipment === "chair")
          ? facts.withChair
          : facts.floorOnly,
      );
    }
  }

  for (const adaptation of session.adaptations) {
    switch (adaptation.kind) {
      case "softLanding":
        lines.push(facts.softLanding(patternName(adaptation.pattern)));
        break;
      case "staleFocus":
        lines.push(facts.staleFocus(patternName(adaptation.pattern)));
        break;
      case "tasteBlock": {
        const movement = library
          ? findMovement(library, adaptation.movementId)
          : null;
        // Never a raw id on screen: without the name, the line is dropped.
        if (movement) lines.push(facts.taste(movement.name));
        break;
      }
      default:
        break;
    }
  }

  return lines;
}
