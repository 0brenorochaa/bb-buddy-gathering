import { createFileRoute } from "@tanstack/react-router";
import { CorrectPage } from "@/components/correct-page";
import { fetchOwn } from "@/lib/rsvp.functions";

export const Route = createFileRoute("/corrigir")({
  head: () => ({
    meta: [{ title: "Corrigir resposta · BB Confraternização 2026" }],
  }),
  loader: () => fetchOwn({ data: {} }),
  component: Corrigir,
});

function Corrigir() {
  const data = Route.useLoaderData();
  const record = data.ok ? data.rsvp : null;
  const code = data.ok ? data.code : "";
  return <CorrectPage initial={record} initialCode={code} />;
}
