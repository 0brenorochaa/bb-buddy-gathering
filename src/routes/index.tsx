import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/home-page";
import { fetchOwn } from "@/lib/rsvp.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BB Confraternização 2026 · Confirme sua presença" },
      { name: "description", content: "Confirme sua presença na BB Confraternização 2026." },
      { property: "og:title", content: "BB Confraternização 2026" },
      { property: "og:description", content: "Confirme sua presença na BB Confraternização 2026." },
    ],
  }),
  loader: () => fetchOwn({ data: {} }),
  component: Home,
});

function Home() {
  const own = Route.useLoaderData();
  if (!own.ok) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-6 text-center text-ink">
        <p>{own.error}</p>
      </main>
    );
  }
  return <HomePage own={own.rsvp} code={own.code} />;
}
