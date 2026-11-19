import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { OTHER_RELATION, RELATIONS, validateRsvp, type RsvpInput, type RsvpRecord } from "@/lib/rsvp-model";
import { cn } from "@/lib/cn";
import { Alert, Button, SelectField, TextField } from "@/components/ui";

type Choice = boolean | null;

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
  const [companionName, setCompanionName] = useState(initial?.companionName ?? "");
  const [relation, setRelation] = useState(initial?.companionRelation ?? "");
  const [relationNote, setRelationNote] = useState(initial?.companionRelationNote ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const showCompanion = attending === true;
  const showCompanionFields = attending === true && companion === true;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (attending === null) {
      setError("Informe se você vai participar.");
      return;
    }
    if (attending && companion === null) {
      setError("Informe se você vai levar um acompanhante.");
      return;
    }
    const parsed = validateRsvp({
      fullName,
      attending: attending === true,
      undecided: attendance === "maybe",
      hasCompanion: attending ? companion === true : false,
      companionName,
      companionRelation: relation,
      companionRelationNote: relationNote,
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
            <ChoiceButton selected={companion === true} onSelect={() => setCompanion(true)} label="Sim." />
            <ChoiceButton selected={companion === false} onSelect={() => setCompanion(false)} label="Não." />
          </fieldset>
        </div>
      </div>

      <div className="reveal" data-open={showCompanionFields ? "true" : "false"}>
        <div className="flex flex-col gap-4 pb-1">
          <TextField
            label="Nome e idade do acompanhante"
            name="companionName"
            autoComplete="off"
            value={companionName}
            onChange={(event) => setCompanionName(event.target.value)}
            required={showCompanionFields}
          />
          <SelectField
            label="Qual é o parentesco ou relação com você?"
            name="companionRelation"
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
            required={showCompanionFields}
          >
            <option value="">Selecione</option>
            {RELATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>
          <div className="reveal" data-open={relation === OTHER_RELATION ? "true" : "false"}>
            <div>
              <TextField
                label="Escreva o parentesco"
                name="companionRelationNote"
                value={relationNote}
                onChange={(event) => setRelationNote(event.target.value)}
                placeholder="Ex.: primo, colega, sogra"
              />
            </div>
          </div>
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
