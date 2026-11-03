export interface MountEntry {
  source: string;
  mount: string;
  fstype: string;
}

export interface VolumeExpectation {
  mount: string;
  uuid: string | null;
  label: string | null;
}

export interface VolumeCheck {
  ok: boolean;
  diagnosis: string;
  source: string | null;
  fstype: string | null;
  uuid: string | null;
}

export function parseMountTable(text: string): MountEntry[] {
  const entries: MountEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [source, mount, fstype] = trimmed.split(/\s+/);
    if (!source || !mount || !fstype) {
      continue;
    }
    entries.push({
      source: decodeMount(source),
      mount: decodeMount(mount),
      fstype,
    });
  }
  return entries;
}

export function checkVolume(
  expected: VolumeExpectation,
  entries: MountEntry[],
  uuidOf: (source: string) => string | null,
): VolumeCheck {
  const found = entries.find((entry) => entry.mount === expected.mount);
  if (!found) {
    return {
      ok: false,
      diagnosis: `O volume esperado em ${expected.mount} não está montado. A existência de uma pasta não identifica o SSD.`,
      source: null,
      fstype: null,
      uuid: null,
    };
  }
  const uuid = uuidOf(found.source);
  if (expected.uuid && uuid !== expected.uuid) {
    return {
      ok: false,
      diagnosis: `O ponto ${expected.mount} está montado de ${found.source}, com UUID ${uuid ?? "desconhecido"}. O configurado é ${expected.uuid}.`,
      source: found.source,
      fstype: found.fstype,
      uuid,
    };
  }
  return {
    ok: true,
    diagnosis: `Volume confirmado em ${expected.mount} (${found.fstype}, UUID ${uuid ?? "não informado"}).`,
    source: found.source,
    fstype: found.fstype,
    uuid,
  };
}

function decodeMount(value: string): string {
  return value.replace(/\\040/g, " ").replace(/\\011/g, "\t").replace(/\\012/g, "\n").replace(/\\134/g, "\\");
}
