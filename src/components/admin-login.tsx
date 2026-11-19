import { useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { adminLogin } from "@/lib/rsvp.functions";
import { Alert, Button, TextField } from "@/components/ui";

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await adminLogin({ data: { username, password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await router.navigate({ to: "/admin/painel" });
    } catch {
      setError("Não foi possível entrar agora. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-navy px-5 py-6 text-paper">
        <div className="mx-auto max-w-md">
          <Link to="/" className="text-xs font-semibold tracking-widest text-gold uppercase">
            BB Confraternização 2026
          </Link>
          <h1 className="mt-6 font-display text-4xl">Área administrativa</h1>
          <p className="mt-2 text-sm text-paper/75">Acesso exclusivo da organização.</p>
        </div>
      </header>
      <main className="mx-auto -mt-6 max-w-md px-4 pb-24">
        <form className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-card sm:p-8" onSubmit={onSubmit}>
          <TextField
            label="Usuário"
            name="username"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <div className="relative">
            <TextField
              label="Senha"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-24"
              required
            />
            <button
              type="button"
              className="absolute top-9 right-3 text-xs font-semibold tracking-wide text-navy uppercase"
              onClick={() => setShow((value) => !value)}
            >
              {show ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </main>
    </div>
  );
}
