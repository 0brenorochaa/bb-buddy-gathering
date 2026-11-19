import { attendanceLabel } from "@/lib/rsvp-model";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Download, FileText, LogOut, Pencil, Search, Trash2 } from "lucide-react";
import {
  adminLogout,
  changePassword,
  deleteRegistration,
  updateRegistration,
} from "@/lib/rsvp.functions";
import {
  displayRelation,
  formatWhen,
  normalizeName,
  type RsvpRecord,
  type Stats,
} from "@/lib/rsvp-model";
import { cn } from "@/lib/cn";
import { RsvpForm } from "@/components/rsvp-form";
import { Alert, Button, TextField } from "@/components/ui";

type FilterId = "all" | "yes" | "no" | "with" | "without";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "yes", label: "Confirmados" },
  { id: "no", label: "Não vão" },
  { id: "with", label: "Com acompanhante" },
  { id: "without", label: "Sem acompanhante" },
];

export function AdminPanel({
  username,
  stats,
  rows,
}: {
  username: string;
  stats: Stats;
  rows: RsvpRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [editing, setEditing] = useState<RsvpRecord | null>(null);
  const [removing, setRemoving] = useState<RsvpRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const needle = normalizeName(query);
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!needle) return true;
      const relation = displayRelation(row.companionRelation, row.companionRelationNote);
      return (
        normalizeName(row.fullName).includes(needle) ||
        normalizeName(row.companionName).includes(needle) ||
        normalizeName(relation).includes(needle)
      );
    });
  }, [rows, query, filter]);

  async function exportReport(kind: "pdf" | "xlsx") {
    const { downloadReport } = await import("@/lib/report");
    downloadReport(kind, rows, stats);
  }

  async function refresh() {
    await router.invalidate();
  }

  async function signOut() {
    await adminLogout();
    await router.navigate({ to: "/admin" });
  }

  async function confirmDelete() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteRegistration({ data: { id: removing.id } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRemoving(null);
      setNotice("Registro excluído.");
      await refresh();
    } catch {
      setError("Não foi possível excluir agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-28 text-ink">
      <header className="bg-navy text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-gold uppercase">Organização</p>
            <h1 className="font-display text-2xl sm:text-3xl">BB Confraternização 2026</h1>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold tracking-wide text-gold uppercase"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <p className="text-sm text-muted">
          Sessão de <span className="font-semibold text-ink">{username}</span>. Os números vêm dos
          registros salvos.
        </p>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Cadastrados" value={stats.registered} hint="Respostas recebidas" />
          <Stat label="Vão participar" value={stats.attending} hint="Participantes confirmados" />
          <Stat label="Não vão" value={stats.absent} hint="Ausências registradas" />
          <Stat label="Ainda não sabem" value={stats.undecided} hint="Confirmam até 30/11" />
          <Stat label="Acompanhantes" value={stats.companions} hint="Somente de quem vai" />
          <article className="col-span-2 rounded-2xl bg-navy p-5 text-paper shadow-card md:col-span-4">
            <p className="text-xs font-semibold tracking-widest text-gold uppercase">
              Total geral de pessoas confirmadas
            </p>
            <p className="mt-2 font-display text-5xl tabular-nums">{stats.confirmedPeople}</p>
            <p className="mt-1 text-sm text-paper/75">
              Quem confirmou presença, já com os acompanhantes.
            </p>
          </article>
        </section>

        {notice ? <Alert tone="ok">{notice}</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}

        <section className="rounded-2xl bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-10 left-3 size-4 text-muted" aria-hidden="true" />
              <TextField
                label="Pesquisar por nome"
                name="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Participante ou acompanhante"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="quiet"
                className="h-11 px-4"
                onClick={() => void exportReport("pdf")}
              >
                <FileText className="size-4" aria-hidden="true" />
                PDF
              </Button>
              <Button
                variant="quiet"
                className="h-11 px-4"
                onClick={() => void exportReport("xlsx")}
              >
                <Download className="size-4" aria-hidden="true" />
                Excel
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">A exportação inclui todos os registros e os totais gerais.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "h-11 rounded-full px-4 text-sm font-semibold",
                  filter === item.id ? "bg-navy text-paper" : "bg-paper text-navy",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted tabular-nums">{visible.length} nesta visão</p>

          {visible.length === 0 ? (
            <p className="mt-6 rounded-xl bg-paper px-4 py-8 text-center text-sm text-muted">
              Nenhum participante encontrado.
            </p>
          ) : (
            <>
              <ul className="mt-4 flex flex-col gap-3 md:hidden">
                {visible.map((row) => (
                  <li key={row.id} className="rounded-xl bg-paper p-4">
                    <PersonBody row={row} />
                    <div className="mt-3 flex gap-2">
                      <Button variant="quiet" className="h-11 flex-1" onClick={() => setEditing(row)}>
                        Editar
                      </Button>
                      <Button variant="quiet" className="h-11 flex-1" onClick={() => setRemoving(row)}>
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead className="text-xs tracking-wide text-muted uppercase">
                    <tr className="border-b border-line">
                      <th className="py-3 pr-3 font-semibold">Participante</th>
                      <th className="py-3 pr-3 font-semibold">Situação</th>
                      <th className="py-3 pr-3 font-semibold">Acompanhante</th>
                      <th className="py-3 pr-3 font-semibold">Nome</th>
                      <th className="py-3 pr-3 font-semibold">Parentesco</th>
                      <th className="py-3 pr-3 font-semibold">Data</th>
                      <th className="py-3 pr-3 font-semibold">Hora</th>
                      <th className="py-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const when = formatWhen(row.createdAt);
                      const withCompanion = row.attending && row.hasCompanion;
                      return (
                        <tr key={row.id} className="border-b border-line align-top">
                          <td className="py-3 pr-3 font-medium">{row.fullName}</td>
                          <td className="py-3 pr-3">{row.attending ? "Vai" : row.undecided ? "Ainda não sabe" : "Não vai"}</td>
                          <td className="py-3 pr-3">{withCompanion ? "Sim" : "Não"}</td>
                          <td className="py-3 pr-3">{withCompanion ? row.companionName : "—"}</td>
                          <td className="py-3 pr-3">
                            {withCompanion
                              ? displayRelation(row.companionRelation, row.companionRelationNote)
                              : "—"}
                          </td>
                          <td className="py-3 pr-3 tabular-nums">{when.date}</td>
                          <td className="py-3 pr-3 tabular-nums">{when.time}</td>
                          <td className="py-2">
                            <div className="flex">
                              <button
                                type="button"
                                className="grid size-11 place-items-center rounded-full text-navy"
                                aria-label={`Editar ${row.fullName}`}
                                onClick={() => setEditing(row)}
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                className="grid size-11 place-items-center rounded-full text-navy"
                                aria-label={`Excluir ${row.fullName}`}
                                onClick={() => setRemoving(row)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <PasswordCard
          onDone={(message) => {
            setError("");
            setNotice(message);
          }}
          onError={(message) => {
            setNotice("");
            setError(message);
          }}
        />

        <p className="text-center text-xs text-muted">
          <Link to="/" className="font-semibold text-navy underline decoration-gold underline-offset-4">
            Voltar à página pública
          </Link>
        </p>
      </main>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/70 p-3 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-card"
          >
            <h2 id="edit-title" className="font-display text-2xl text-navy">
              {editing.fullName}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Confirmado em {formatWhen(editing.createdAt).date} às {formatWhen(editing.createdAt).time}.
              {editing.updatedAt !== editing.createdAt
                ? ` Atualizado em ${formatWhen(editing.updatedAt).date} às ${formatWhen(editing.updatedAt).time}.`
                : ""}
            </p>
            <div className="mt-5">
              <RsvpForm
                key={editing.updatedAt}
                initial={editing}
                submitLabel="Salvar alterações"
                onSubmit={async (value) => {
                  const result = await updateRegistration({ data: { id: editing.id, ...value } });
                  if (result.ok) {
                    setEditing(null);
                    setNotice("Registro atualizado.");
                    await refresh();
                  }
                  return result;
                }}
              />
            </div>
            <Button variant="quiet" className="mt-3 w-full" onClick={() => setEditing(null)}>
              Fechar
            </Button>
          </div>
        </div>
      ) : null}

      {removing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/70 p-3 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-card"
          >
            <h2 id="delete-title" className="font-display text-2xl text-navy">
              Excluir registro?
            </h2>
            <p className="mt-2 text-sm text-muted">
              A confirmação de {removing.fullName} será apagada. Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => void confirmDelete()} disabled={busy}>
                {busy ? "Excluindo…" : "Excluir registro"}
              </Button>
              <Button variant="quiet" onClick={() => setRemoving(null)} disabled={busy}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function matchesFilter(row: RsvpRecord, filter: FilterId) {
  if (filter === "yes") return row.attending;
  if (filter === "no") return !row.attending && !row.undecided;
  if (filter === "with") return row.attending && row.hasCompanion;
  if (filter === "without") return !(row.attending && row.hasCompanion);
  return true;
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="rounded-2xl bg-card p-4 shadow-card">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-4xl text-navy tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}

function PersonBody({ row }: { row: RsvpRecord }) {
  const when = formatWhen(row.createdAt);
  const withCompanion = row.attending && row.hasCompanion;
  return (
    <div>
      <p className="font-semibold">{row.fullName}</p>
      <p className="mt-1 text-sm text-muted">
        {attendanceLabel(row)} · {when.date} às {when.time}
      </p>
      <p className="mt-1 text-sm">
        {withCompanion
          ? `Acompanhante: ${row.companionName} · ${displayRelation(row.companionRelation, row.companionRelationNote)}`
          : "Sem acompanhante"}
      </p>
    </div>
  );
}

function PasswordCard({
  onDone,
  onError,
}: {
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (nextPassword !== confirm) {
      onError("A confirmação da nova senha não confere.");
      return;
    }
    setPending(true);
    try {
      const result = await changePassword({ data: { currentPassword, nextPassword } });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      setCurrentPassword("");
      setNextPassword("");
      setConfirm("");
      onDone("Senha alterada. A senha anterior não funciona mais.");
    } catch {
      onError("Não foi possível alterar a senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <h2 className="font-display text-2xl text-navy">Alterar senha</h2>
      <p className="mt-1 text-sm text-muted">
        A senha é guardada apenas como hash. Use pelo menos 8 caracteres.
      </p>
      <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={onSubmit}>
        <TextField
          label="Senha atual"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <TextField
          label="Nova senha"
          name="nextPassword"
          type="password"
          autoComplete="new-password"
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
          required
        />
        <TextField
          label="Confirmar nova senha"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
        <Button type="submit" disabled={pending} className="sm:col-span-3">
          {pending ? "Salvando…" : "Atualizar senha"}
        </Button>
      </form>
    </section>
  );
}
