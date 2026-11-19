import { describe, expect, it } from "vitest";
import { RELATIONS, validateRsvp } from "@/lib/rsvp-model";

const base = {
  fullName: "Ana Souza",
  attending: true,
  undecided: false,
  hasCompanion: true,
  companionName: "João Souza, 8 anos",
  companionRelation: "Filho(a)",
  companionRelationNote: "",
  correctionCode: "",
};

describe("regras do formulário", () => {
  it("aceita nome e idade do acompanhante", () => {
    expect(validateRsvp(base).ok).toBe(true);
  });
  it("oferece Amigo(a) como parentesco", () => {
    expect(RELATIONS).toContain("Amigo(a)");
  });
  it("'ainda não sei' fica pendente e sem acompanhante", () => {
    const r = validateRsvp({ ...base, attending: false, undecided: true });
    expect(r.ok && r.value.undecided).toBe(true);
    expect(r.ok && r.value.hasCompanion).toBe(false);
  });
});
