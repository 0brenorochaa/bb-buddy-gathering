import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminLogin } from "@/components/admin-login";
import { adminSession } from "@/lib/rsvp.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Área administrativa · BB Confraternização 2026" }],
  }),
  beforeLoad: async () => {
    const session = await adminSession();
    if (session.authenticated) throw redirect({ to: "/admin/painel" });
  },
  component: AdminLogin,
});
