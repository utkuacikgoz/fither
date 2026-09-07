import { render } from "@testing-library/react-native";
import React from "react";
import { router } from "expo-router";

import AvoidRoute from "../../../../app/settings/avoid";
import EquipmentRoute from "../../../../app/settings/equipment";
import FeedbackRoute from "../../../../app/settings/feedback";
import IntentionRoute from "../../../../app/settings/intention";
import InvitationRoute from "../../../../app/settings/invitation";
import NotesRoute from "../../../../app/settings/notes";
import PlaceRoute from "../../../../app/settings/place";
import PlanRoute from "../../../../app/settings/plan";
import VoiceRoute from "../../../../app/settings/voice";
import { strings } from "../../../copy/strings";
import { resetSettingsStores } from "./settings-test-setup";

// Each Settings subpage route mounts its page behind the hydration guard
// and never redirects: they show records she owns. (The shared pushed
// header is inert chrome under jest; pushed-header has its own test.)

beforeEach(async () => {
  await resetSettingsStores();
});

it.each([
  ["/settings/place", PlaceRoute, strings.place.title],
  ["/settings/avoid", AvoidRoute, strings.settings.avoid.title],
  ["/settings/equipment", EquipmentRoute, strings.settings.rows.equipment],
  ["/settings/voice", VoiceRoute, strings.settings.voice.title],
  ["/settings/invitation", InvitationRoute, strings.settings.reminders.title],
  ["/settings/intention", IntentionRoute, strings.intention.question],
  ["/settings/notes", NotesRoute, strings.settings.careNotes.title],
  ["/settings/plan", PlanRoute, strings.settings.restore.title],
  ["/settings/feedback", FeedbackRoute, strings.feedback.title],
])("%s renders its page — always a valid destination", (_path, Route, title) => {
  const screen = render(<Route />);
  expect(screen.getByText(title)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});
