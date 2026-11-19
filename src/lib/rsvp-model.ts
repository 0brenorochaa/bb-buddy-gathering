export const RELATIONS = [
  "Amigo(a)",
  "Marido",
  "Esposa",
  "Namorado(a)",
  "Namorada",
  "Mãe",
  "Pai",
  "Filho(a)",
  "Filha",
  "Irmão",
  "Irmã",
  "Outro familiar",
  "Outro",
] as const;

export type Relation = (typeof RELATIONS)[number];
export const OTHER_RELATION = "Outro";

export const SUCCESS_MESSAGE =
  "Sua resposta foi registrada com sucesso! Agradecemos sua participação na BB Confraternização 2026!";

export type RsvpInput = {
  fullName: string;
  attending: boolean;
  undecided: boolean;
  hasCompanion: boolean;
  companionName: string;
  companionRelation: string;
  companionRelationNote: string;
  correctionCode: string;
};

export type RsvpRecord = {
  id: string;
  fullName: string;
  attending: boolean;
  undecided: boolean;
  hasCompanion: boolean;
  companionName: string;
  companionRelation: string;
  companionRelationNote: string;
  createdAt: string;
  updatedAt: string;
};

export type Stats = {
  registered: number;
  attending: number;
  absent: number;
  undecided: number;
  companions: number;
  confirmedPeople: number;
};

export type SubmitResult =
  | { ok: true; created: boolean; code: string; message: string; rsvp: RsvpRecord }
  | { ok: false; error: string };

export type OwnResult =
  | { ok: true; rsvp: RsvpRecord | null; code: string }
  | { ok: false; error: string };

const COMPANION_PATTERN = /^[\p{L}\p{N}\s'.,’()-]+$/u;
const NAME_PATTERN = /^[\p{L}\s'.’-]+$/u;

export function tidyName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[-'`’]/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasFullName(name: string): boolean {
  const parts = tidyName(name).split(" ").filter(Boolean);
  return parts.length >= 2 && parts.every((part) => /\p{L}/u.test(part));
}

export function displayRelation(relation: string, note: string): string {
  if (!relation) return "";
  if (relation === OTHER_RELATION && note.trim()) return note.trim();
  return relation;
}

export function validateRsvp(
  raw: RsvpInput,
): { ok: true; value: RsvpInput } | { ok: false; error: string } {
  const fullName = tidyName(raw.fullName ?? "");
  if (!fullName) return { ok: false, error: "Informe o nome completo." };
  if (fullName.length > 120) return { ok: false, error: "O nome está longo demais." };
  if (!NAME_PATTERN.test(fullName) || !hasFullName(fullName)) {
    return { ok: false, error: "Informe nome e sobrenome, usando apenas letras." };
  }

  const attending = raw.attending === true;
  const undecided = !attending && raw.undecided === true;
  let hasCompanion = raw.hasCompanion === true;
  let companionName = tidyName(raw.companionName ?? "");
  let companionRelation = (raw.companionRelation ?? "").trim();
  let companionRelationNote = tidyName(raw.companionRelationNote ?? "");

  if (!attending) {
    hasCompanion = false;
    companionName = "";
    companionRelation = "";
    companionRelationNote = "";
  } else if (!hasCompanion) {
    companionName = "";
    companionRelation = "";
    companionRelationNote = "";
  } else {
    if (!companionName) {
      return { ok: false, error: "Informe o nome e a idade do acompanhante." };
    }
    if (companionName.length > 120) {
      return { ok: false, error: "O nome do acompanhante está longo demais." };
    }
    if (!COMPANION_PATTERN.test(companionName) || !/\p{L}/u.test(companionName)) {
      return {
        ok: false,
        error: "Informe o nome e a idade do acompanhante (ex.: Maria Silva, 35 anos).",
      };
    }
    if (!RELATIONS.includes(companionRelation as Relation)) {
      return { ok: false, error: "Selecione o parentesco do acompanhante." };
    }
    if (companionRelation === OTHER_RELATION) {
      if (companionRelationNote.length < 2) {
        return { ok: false, error: "Escreva qual é o parentesco." };
      }
      if (companionRelationNote.length > 80) {
        return { ok: false, error: "O parentesco está longo demais." };
      }
    } else {
      companionRelationNote = "";
    }
  }

  return {
    ok: true,
    value: {
      fullName,
      attending,
      undecided,
      hasCompanion,
      companionName,
      companionRelation,
      companionRelationNote,
      correctionCode: (raw.correctionCode ?? "").trim(),
    },
  };
}

export function formatWhen(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "—" };
  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date),
  };
}

export function coerceInput(data: unknown): RsvpInput {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const str = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");
  return {
    fullName: str("fullName"),
    attending: record["attending"] === true,
    undecided: record["undecided"] === true,
    hasCompanion: record["hasCompanion"] === true,
    companionName: str("companionName"),
    companionRelation: str("companionRelation"),
    companionRelationNote: str("companionRelationNote"),
    correctionCode: str("correctionCode"),
  };
}

export function attendanceLabel(row: { attending: boolean; undecided?: boolean }): string {
  if (row.attending) return "Vai participar";
  if (row.undecided) return "Ainda não sabe (confirma até 30/11)";
  return "Não vai participar";
}
