import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { fetchOwn, submitRegistration } from "@/lib/rsvp.functions";
import type { RsvpRecord } from "@/lib/rsvp-model";
import { RsvpForm } from "@/components/rsvp-form";
import { Alert, Button, TextField } from "@/components/ui";

export function CorrectPage({
  initial,
  initialCode,
}: {
  initial: RsvpRecord | null;
  initialCode: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [record, setRecord] = useState<RsvpRecord | null>(initial);
  const [activeCode, setActiveCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setDone("");
    try {
      const result = await fetchOwn({ data: { code } });
      if (!result.ok) {
        setRecord(null);
        setError(result.error);
        return;
      }
      if (!result.rsvp) {
        setRecord(null);
        setError("Informe o código recebido ao confirmar.");
        return;
      }
      setRecord(result.rsvp);
      setActiveCode(result.code);
    } catch {
      setError("Não foi possível buscar agora. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-8 pb-28 text-ink">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="text-xs font-semibold tracking-widest text-navy uppercase">
          BB Confraternização 2026
        </Link>
        <h1 className="mt-4 font-display text-4xl text-navy">Corrigir resposta</h1>
        <p className="mt-2 text-sm text-muted">
          O código abre somente o seu registro. Nenhuma outra confirmação fica visível.
        </p>

        <form className="mt-6 flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card" onSubmit={search}>
          <TextField
            label="Código de correção"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="XXXXX-XXXXX"
          />
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Buscando…" : "Buscar minha resposta"}
          </Button>
        </form>

        {record ? (
          <section className="mt-4 rounded-2xl bg-card p-5 shadow-card sm:p-8">
            {done ? <div className="mb-5"><Alert tone="ok">{done}</Alert></div> : null}
            <RsvpForm
              key={`${record.id}-${record.updatedAt}`}
              initial={record}
              correctionCode={activeCode}
              submitLabel="Confirmar resposta"
              onSubmit={async (value) => {
                const response = await submitRegistration({
                  data: { ...value, correctionCode: activeCode },
                });
                if (response.ok) {
                  setDone(response.message);
                  setRecord(response.rsvp);
                  setActiveCode(response.code);
                }
                return response;
              }}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
