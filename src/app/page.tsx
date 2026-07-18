import Link from "next/link";

export default function Home() {
  return (
    <div className="card p-6">
      <h2 className="disp text-lg font-medium mb-1">Bienvenue</h2>
      <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
        Organise ton mémoire section par section — projet, chapitres, idées,
        références, journal, et une suggestion par jour.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/projet" className="btn-primary">
          Projet & Modèle
        </Link>
        <Link href="/chapitres" className="btn-ghost">
          Chapitres
        </Link>
      </div>
    </div>
  );
}
