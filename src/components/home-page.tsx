import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Users } from "lucide-react";
import { submitRegistration } from "@/lib/rsvp.functions";
import { formatWhen, type RsvpRecord, type SubmitResult } from "@/lib/rsvp-model";
import { RsvpForm } from "@/components/rsvp-form";
import { Button } from "@/components/ui";

export function HomePage({ own, code }: { own: RsvpRecord | null; code: string }) {
  const [result, setResult] = useState<Extract<SubmitResult, { ok: true }> | null>(null);
  const [editing, setEditing] = useState(false);
  const [fresh, setFresh] = useState(false);
  const saved = result?.rsvp ?? null;
  const activeCode = result?.code || code;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-navy text-paper">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-5 py-4">
          <p className="font-display text-lg tracking-wide">BB 2026</p>
          <Link
            to="/admin"
            className="text-xs font-semibold tracking-widest text-gold uppercase"
          >
            Área administrativa
          </Link>
        </div>
        <div className="mx-auto max-w-xl px-5 pt-6 pb-24 text-center">
          <div className="rise mx-auto mb-6 grid size-20 place-items-center rounded-full border border-gold">
            <span className="font-display text-3xl text-gold">BB</span>
          </div>
          <p className="rise rise-2 text-xs font-semibold tracking-widest text-gold uppercase">
            Celebração
          </p>
          <h1 className="rise rise-2 mt-3 font-display text-4xl leading-tight text-paper sm:text-5xl">
            BB Confraternização 2026
          </h1>
          <p className="rise rise-3 mx-auto mt-4 max-w-md text-base text-paper/80">
            Que bom receber você. Confirme sua presença para organizarmos a festa com cuidado —
            leva menos de um minuto.
          </p>
          <Button
            variant="gold"
            className="rise rise-3 mt-8"
            onClick={() => document.getElementById("confirmar")?.scrollIntoView({ behavior: "smooth" })}
          >
            Confirmar presença
          </Button>
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-xl px-4 pb-28">
        <section
          id="confirmar"
          className="scroll-mt-6 rounded-2xl bg-card p-5 shadow-card sm:p-8"
        >
          {saved && !editing ? (
            <SuccessPanel
              message={result?.message ?? ""}
              code={result?.code ?? ""}
              record={saved}
              onEdit={() => setEditing(true)}
            />
          ) : (
            <>
              <div className="mb-6 flex items-start gap-3">
                <Sparkles className="mt-1 size-5 shrink-0 text-gold" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-2xl text-navy">Sua confirmação</h2>
                  <p className="mt-1 text-sm text-muted">
                    A lista de participantes fica só com a organização. Você não vê os dados de
                    outras pessoas.
                  </p>
                </div>
              </div>
              {own && !fresh && !result ? (
                <div className="mb-6 rounded-xl bg-paper px-4 py-3 text-sm text-ink">
                  <p>
                    Neste aparelho já existe uma resposta de <strong>{own.fullName}</strong>.
                    Você pode atualizá-la abaixo.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-navy underline decoration-gold underline-offset-4"
                    onClick={() => setFresh(true)}
                  >
                    Não sou esta pessoa — nova confirmação
                  </button>
                </div>
              ) : null}
              <RsvpForm
                key={fresh ? "fresh" : (own?.id ?? "new")}
                initial={fresh ? null : own}
                correctionCode={fresh ? "" : activeCode}
                submitLabel="Confirmar resposta"
                onSubmit={async (value) => {
                  const response = await submitRegistration({
                    data: {
                      ...value,
                      correctionCode: fresh ? "" : activeCode || value.correctionCode,
                    },
                  });
                  if (response.ok) {
                    setResult(response);
                    setEditing(false);
                    setFresh(false);
                  }
                  return response;
                }}
              />
            </>
          )}
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Note icon={<Users className="size-5" />} title="Acompanhante" text="Se for levar alguém, o nome e o parentesco entram na conta." />
          <Note icon={<Sparkles className="size-5" />} title="Correção" text="Depois de enviar, você recebe um código para ajustar só a sua resposta." />
          <Note icon={<ShieldCheck className="size-5" />} title="Privacidade" text="Uso exclusivo da confraternização, em respeito à LGPD." />
        </section>

        <footer className="mt-10 text-center text-xs text-muted">
          <p>BB Confraternização 2026</p>
          <Link to="/corrigir" className="mt-2 inline-block font-semibold text-navy underline decoration-gold underline-offset-4">
            Corrigir uma resposta já enviada
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Note({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-2xl bg-card p-4 shadow-field">
      <div className="text-gold" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mt-3 font-display text-lg text-navy">{title}</h3>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </article>
  );
}

function SuccessPanel({
  message,
  code,
  record,
  onEdit,
}: {
  message: string;
  code: string;
  record: RsvpRecord;
  onEdit: () => void;
}) {
  const when = formatWhen(record.createdAt);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-2xl text-navy">{message}</p>
      <p className="text-sm text-muted">
        {record.attending ? "Presença confirmada" : record.undecided ? "Resposta pendente (confirme até 30/11)" : "Ausência registrada"} para {record.fullName}.
        Registro de {when.date} às {when.time}, horário de Brasília.
      </p>
      <div className="rounded-xl border border-gold bg-paper px-4 py-4 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">Código de correção</p>
        <p className="mt-2 font-display text-3xl tracking-widest text-navy">{code}</p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-navy underline decoration-gold underline-offset-4"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Código copiado" : "Copiar código"}
        </button>
      </div>
      <p className="text-sm text-muted">
        Guarde este código. Com ele você corrige a sua resposta sem ver nem alterar o registro de
        outra pessoa. Se perder o código, a organização pode ajustar no painel.
      </p>
      <div className="flex flex-col gap-3">
        <Button variant="quiet" onClick={onEdit}>
          Corrigir esta resposta
        </Button>
        <Link to="/corrigir" className="text-center text-sm font-semibold text-navy underline decoration-gold underline-offset-4">
          Usar o código em outro momento
        </Link>
      </div>
    </div>
  );
}
