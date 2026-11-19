import { useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  MAX_COMPANIONS,
  OTHER_RELATION,
  RELATIONS,
  validateRsvp,
  type Companion,
  type RsvpInput,
  type RsvpRecord,
} from "@/lib/rsvp-model";
import { cn } from "@/lib/cn";
import { Alert, Button, SelectField, TextField } from "@/components/ui";

type Choice = boolean | null;

const EMPTY_COMPANION: Companion = { name: "", relation: "", relationNote: "" };

function initialCompanions(initial?: RsvpRecord | null): Companion[] {
  if (!initial || !initial.attending || !initial.hasCompanion) return [];
  if (initial.companions.length > 0) return initial.companions.map((item) => ({ ...item }));
  if (initial.companionName) {
    return [
      {
        name: initial.companionName,
        relation: initial.companionRelation,
        relationNote: initial.companionRelationNote,
      },
    ];
  }
  return [{ ...EMPTY_COMPANION }];
}

export function RsvpForm({
  initial,
  correctionCode = "",
  submitLabel,
  onSubmit,
}: {
  initial?: RsvpRecord | null;
  correctionCode?: string;
  submitLabel: string;
  onSubmit: (value: RsvpInput) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [attendance, setAttendance] = useState<"yes" | "no" | "maybe" | null>(
    initial ? (initial.attending ? "yes" : initial.undecided ? "maybe" : "no") : null,
  );
  const attending: Choice = attendance === null ? null : attendance === "yes";
  const [companion, setCompanion] = useState<Choice>(
    initial && initial.attending ? initial.hasCompanion : null,
  );
  const [companions, setCompanions] = useState<Companion[]>(initialCompanions(initial));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const showCompanion = attending === true;
  const showCompanionFields = attending === true && companion === true;

  function updateCompanion(index: number, patch: Partial<Companion>) {
    setCompanions((list) =>
      list.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function chooseCompanion(next: boolean) {
    setCompanion(next);
    if (next && companions.length === 0) setCompanions([{ ...EMPTY_COMPANION }]);
  }

  function addCompanion() {
    setCompanions((list) => (list.length >= MAX_COMPANIONS ? list : [...list, { ...EMPTY_COMPANION }]));
  }

  function removeCompanion(index: number) {
    setCompanions((list) => list.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (attending === null) {
      setError("Informe se você vai participar.");
      return;
    }
    if (attending && companion === null) {
      setError("Informe se você vai levar acompanhante.");
      return;
    }
    const parsed = validateRsvp({
      fullName,
      attending: attending === true,
      undecided: attendance === "maybe",
      hasCompanion: attending ? companion === true : false,
      companions: attending && companion === true ? companions : [],
      companionName: "",
      companionRelation: "",
      companionRelationNote: "",
      correctionCode,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await onSubmit(parsed.value);
      if (!result.ok) setError(result.error);
    } catch {
      setError("Não foi possível registrar agora. Tente de novo em instantes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nome completo"
        name="fullName"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Como está no documento"
        required
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">
          Você vai participar da BB Confraternização 2026?
        </legend>
        <ChoiceButton
          selected={attendance === "yes"}
          onSelect={() => setAttendance("yes")}
          label="Sim, vou participar."
        />
        <ChoiceButton
          selected={attendance === "no"}
          onSelect={() => setAttendance("no")}
          label="Não vou participar."
        />
        <ChoiceButton
          selected={attendance === "maybe"}
          onSelect={() => setAttendance("maybe")}
          label="Ainda não sei, mas confirmarei até 30/11."
        />
      </fieldset>

      <div className="reveal" data-open={showCompanion ? "true" : "false"}>
        <div>
          <fieldset className="flex flex-col gap-3 pb-1">
            <legend className="text-sm font-medium text-ink">Você vai levar algum acompanhante?</legend>
            <ChoiceButton selected={companion === true} onSelect={() => chooseCompanion(true)} label="Sim." />
            <ChoiceButton selected={companion === false} onSelect={() => chooseCompanion(false)} label="Não." />
          </fieldset>
        </div>
      </div>

      <div className="reveal" data-open={showCompanionFields ? "true" : "false"}>
        <div className="flex flex-col gap-4 pb-1">
          {companions.map((item, index) => (
            <div key={index} className="flex flex-col gap-4 rounded-xl bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Acompanhante {index + 1}
                </p>
                {companions.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeCompanion(index)}
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-navy"
                    aria-label={`Remover acompanhante ${index + 1}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Remover
                  </button>
                ) : null}
              </div>
              <TextField
                label="Nome e idade do acompanhante"
                name={`companionName-${index}`}
                autoComplete="off"
                value={item.name}
                onChange={(event) => updateCompanion(index, { name: event.target.value })}
                required={showCompanionFields}
              />
              <SelectField
                label="Qual é o parentesco ou relação com você?"
                name={`companionRelation-${index}`}
                value={item.relation}
                onChange={(event) => updateCompanion(index, { relation: event.target.value })}
                required={showCompanionFields}
              >
                <option value="">Selecione</option>
                {RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </SelectField>
              <div className="reveal" data-open={item.relation === OTHER_RELATION ? "true" : "false"}>
                <div>
                  <TextField
                    label="Escreva o parentesco"
                    name={`companionRelationNote-${index}`}
                    value={item.relationNote}
                    onChange={(event) => updateCompanion(index, { relationNote: event.target.value })}
                    placeholder="Ex.: primo, colega, sogra"
                  />
                </div>
              </div>
            </div>
          ))}
          {companions.length < MAX_COMPANIONS ? (
            <Button variant="quiet" className="w-full" onClick={addCompanion}>
              <Plus className="size-4" aria-hidden="true" />
              Adicionar outro acompanhante
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Registrando…" : submitLabel}
      </Button>
    </form>
  );
}

function ChoiceButton({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.96]",
        selected ? "bg-navy text-paper" : "bg-card text-ink shadow-field",
      )}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-gold bg-gold text-navy" : "border-line bg-card",
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}
