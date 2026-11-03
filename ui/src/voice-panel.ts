import { voicePanel, type VoiceSnapshot } from "../../src/domain/voice.js";

export interface VoicePanelProps {
  snapshot: VoiceSnapshot;
  onEnable: () => void;
  onDisable: () => void;
  onInterrupt: () => void;
}

export function voicePanelModel(props: VoicePanelProps): {
  status: string;
  detail: string;
  controls: Array<{ id: "habilitar" | "desligar" | "parar"; label: string; run: () => void }>;
} {
  const view = voicePanel(props.snapshot);
  const controls: Array<{ id: "habilitar" | "desligar" | "parar"; label: string; run: () => void }> = [];
  if (view.canEnable) {
    controls.push({ id: "habilitar", label: "Habilitar microfone", run: props.onEnable });
  }
  if (view.canDisable) {
    controls.push({ id: "desligar", label: "Desligar escuta", run: props.onDisable });
  }
  if (view.canInterrupt) {
    controls.push({ id: "parar", label: "Parar resposta", run: props.onInterrupt });
  }
  return { status: view.status, detail: view.detail, controls };
}
