import { strings } from "../../../copy/strings";
import { OptionRow } from "../../../design/primitives/option-row";
import { useReducedMotion } from "../../../lib/use-reduced-motion";
import { loadLibrary } from "../../../session/load-library";
import { speakCue } from "../../../session/voice";
import { sampleCue } from "../../../session/voice-sample";
import { useSettingsStore } from "../../../state/settings-store";
import { SettingsGroup } from "../settings-group";
import { SettingsSubpage } from "./settings-subpage";

// Voice (mockup settings-voice): the recorded cue read aloud during a
// session, or silence. Two rows of equal dignity; off is not a loss. The
// list only offers this page when spoken cues are bundled, and the
// player silences the voice on any day she keeps quiet regardless.

export function VoicePage() {
  const reduceMotion = useReducedMotion();
  const voice = useSettingsStore((s) => s.voice);
  const setVoice = useSettingsStore((s) => s.setVoice);
  return (
    <SettingsSubpage
      title={strings.settings.voice.title}
      lead={strings.settings.voice.body}
      testID="settings-voice"
    >
      <SettingsGroup reduceMotion={reduceMotion}>
        <OptionRow
          testID="voice-on"
          label={strings.settings.voice.on}
          selected={voice}
          onPress={() => {
            setVoice(true);
            // Switching it on answers in the voice itself: one real cue,
            // so she hears what she chose (ADR-0030).
            const cue = sampleCue(loadLibrary());
            if (cue !== null) void speakCue(cue);
          }}
        />
        <OptionRow
          testID="voice-off"
          label={strings.settings.voice.off}
          selected={!voice}
          divider={false}
          onPress={() => setVoice(false)}
        />
      </SettingsGroup>
    </SettingsSubpage>
  );
}
