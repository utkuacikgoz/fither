import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { strings } from "../../../copy/strings";
import { OptionRow } from "../../../design/primitives/option-row";
import { SectionCaption } from "../../../design/primitives/section-caption";
import { SettingsRow } from "../../../design/primitives/settings-row";
import { spacing } from "../../../design/tokens";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { hasVoiceAudio } from "../../../session/voice-manifest";
import {
  PLACES,
  placeEquipment,
  usePlaceStore,
  type QuietMode,
} from "../../../state/place-store";
import { useSettingsStore } from "../../../state/settings-store";
import { SettingsGroup } from "../settings-group";
import { SETTINGS_ROUTES } from "../settings-screen";
import { equipmentValue, voiceValue } from "../settings-values";
import { SettingsSubpage } from "./settings-subpage";

// Where I train (owner brief 2026-09-07, wave 4; mockup settings-place,
// approved 2026-09-07). Three grouped lists under one title and lead:
// the place (Home or Hotel, the current one checked; a tap is the
// switch), the ACTIVE place's two presets (its equipment, edited on the
// existing Equipment page; its quiet default, toggled in place), and the
// one voice setting both places share. The caption at the foot says the
// one fact the page and the Voice page agree on.
//
// Every value is a read of the place store and the settings store
// (place-store.ts owns the switch and what each place remembers; this
// page decides nothing). The voice group exists only when spoken cues
// are bundled, the same constraint the Settings list applies: a switch
// for silence would be a lie. Switching place never touches
// `alwaysAvoid` — the store has no way to, and the test pins it.

/** The quiet default's two states, in toggle order. */
const NEXT_QUIET: Record<QuietMode, QuietMode> = { ask: "always", always: "ask" };

export function quietValue(mode: QuietMode): string {
  return mode === "always" ? strings.place.quietAlways : strings.place.quietAsk;
}

export function PlacePage() {
  const reduceMotion = useReducedMotion();
  const place = usePlaceStore((s) => s.place);
  const presets = usePlaceStore((s) => s.presets);
  const setPlace = usePlaceStore((s) => s.setPlace);
  const setQuiet = usePlaceStore((s) => s.setQuiet);
  const settingsEquipment = useSettingsStore((s) => s.equipment);
  const voice = useSettingsStore((s) => s.voice);
  const voiceRow = hasVoiceAudio();

  const equipment = placeEquipment({ place, presets }, settingsEquipment, place);
  const quiet = presets[place].quiet;

  return (
    <SettingsSubpage
      title={strings.place.title}
      testID="settings-place"
    >
      <View style={styles.section}>
        <SectionCaption label={strings.place.sectionPlace} />
        <SettingsGroup order={0} reduceMotion={reduceMotion} testID="place-options">
          {PLACES.map((candidate, index) => (
            <OptionRow
              key={candidate}
              testID={`place-${candidate}`}
              label={strings.place.value(candidate)}
              selected={place === candidate}
              divider={index < PLACES.length - 1}
              onPress={() => setPlace(candidate)}
            />
          ))}
        </SettingsGroup>
      </View>

      <View style={styles.section}>
        <SectionCaption
          label={place === "home" ? strings.place.sectionAtHome : strings.place.sectionAtHotel}
          testID="place-presets-caption"
        />
        <SettingsGroup order={1} reduceMotion={reduceMotion} testID="place-presets">
          <SettingsRow
            testID="place-equipment"
            label={strings.place.equipmentRow}
            value={equipmentValue(equipment)}
            chevron
            onPress={() => router.push(SETTINGS_ROUTES.equipment)}
          />
          {/* A toggle, not a door: the value flips in place (feedback). */}
          <SettingsRow
            testID="place-quiet"
            label={strings.place.quietRow}
            value={quietValue(quiet)}
            divider={false}
            onPress={() => setQuiet(place, NEXT_QUIET[quiet])}
          />
        </SettingsGroup>
      </View>

      {voiceRow && (
        <View style={styles.section}>
          <SectionCaption label={strings.place.sectionVoice} />
          <SettingsGroup order={2} reduceMotion={reduceMotion} testID="place-voice">
            <SettingsRow
              testID="place-voice-row"
              label={strings.place.voiceRow}
              value={voiceValue(voice)}
              chevron
              divider={false}
              onPress={() => router.push(SETTINGS_ROUTES.voice)}
            />
          </SettingsGroup>
        </View>
      )}
    </SettingsSubpage>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
});
