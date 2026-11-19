import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPanel } from "@/components/admin-panel";
import { adminSession, loadDashboard } from "@/lib/rsvp.functions";

export const Route = createFileRoute("/admin/painel")({
  head: () => ({
    meta: [{ title: "Painel · BB Confraternização 2026" }],
  }),
  beforeLoad: async () => {
    const session = await adminSession();
    if (!session.authenticated) throw redirect({ to: "/admin" });
  },
  loader: () => loadDashboard(),
  component: Painel,
});

function Painel() {
  const data = Route.useLoaderData();
  if (!data.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-6 text-center text-ink">
        <p>{data.error}</p>
      </main>
    );
  }
  return <AdminPanel username={data.username} stats={data.stats} rows={data.rows} />;
}
