export interface AudioNode {
  id: string;
  kind: "sink" | "source";
  name: string;
  defaultNode: boolean;
}

export interface ProbeReport {
  escolha: "jbl" | "camera";
  captura: { id: string; nome: string; frames: number; pico: number; abertoDepois: boolean };
  reproducao: { id: string; nome: string; texto: string; capturaAbertaDuranteFala: boolean };
  microfoneLiberado: boolean;
  detectorConfirmado: false;
  nomeFaladoReconhecido: false;
  aviso: string;
}

export function parseWpctl(text: string): AudioNode[] {
  const nodes: AudioNode[] = [];
  let kind: "sink" | "source" | null = null;
  for (const line of text.split("\n")) {
    if (line.includes("Sinks:")) {
      kind = "sink";
      continue;
    }
    if (line.includes("Sources:")) {
      kind = "source";
      continue;
    }
    if (line.includes("Filters:") || line.includes("Streams:") || line.includes("Video")) {
      kind = null;
    }
    if (!kind) {
      continue;
    }
    const match = /(\*)?\s*(\d+)\.\s+(.+?)(?:\s+\[vol:.*)?$/.exec(line);
    if (!match?.[2] || !match[3]) {
      continue;
    }
    nodes.push({
      id: match[2],
      kind,
      name: match[3].trim(),
      defaultNode: match[1] === "*",
    });
  }
  return nodes;
}

export function selectDevice(nodes: AudioNode[], choice: "jbl" | "camera"): { source: AudioNode; sink: AudioNode } {
  const sourceName = choice === "jbl" ? /JBL Quantum 360/i : /REDRAGON Live Camera Analog/i;
  const sinkName = choice === "jbl" ? /JBL Quantum 360/i : /HDMI/i;
  const source = nodes.find((node) => node.kind === "source" && sourceName.test(node.name));
  const sink = nodes.find((node) => node.kind === "sink" && sinkName.test(node.name));
  if (!source || !sink) {
    throw new Error(`Dispositivo ${choice} não está disponível para captura e reprodução.`);
  }
  return { source, sink };
}

export async function runGreetingProbe(input: {
  enabled: boolean;
  nodes: AudioNode[];
  choice: "jbl" | "camera";
  capture: (id: string) => Promise<{ frames: number; peak: number; heldAfter: boolean }>;
  play: (id: string, text: string) => Promise<void>;
  captureOpen: () => boolean;
}): Promise<ProbeReport> {
  if (!input.enabled) {
    throw new Error("A captura exige habilitação explícita.");
  }
  const { source, sink } = selectDevice(input.nodes, input.choice);
  const captured = await input.capture(source.id);
  const captureOpen = input.captureOpen();
  if (captureOpen) {
    throw new Error("A captura continuou aberta antes da saudação.");
  }
  await input.play(sink.id, "Estou aqui.");
  return {
    escolha: input.choice,
    captura: { id: source.id, nome: source.name, frames: captured.frames, pico: captured.peak, abertoDepois: captured.heldAfter },
    reproducao: { id: sink.id, nome: sink.name, texto: "Estou aqui.", capturaAbertaDuranteFala: captureOpen },
    microfoneLiberado: !captured.heldAfter && !input.captureOpen(),
    detectorConfirmado: false,
    nomeFaladoReconhecido: false,
    aviso: "A reprodução confirma o áudio da saudação. Não houve detector de MOAH neste teste.",
  };
}
