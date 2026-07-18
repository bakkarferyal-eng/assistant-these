import {
  getOrCreateProject,
  listJournal,
  createJournalAction,
  deleteJournalAction,
} from "@/lib/actions";

type JournalEntry = { id: string; date: string; text: string };

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const project = await getOrCreateProject();
  const entries: JournalEntry[] = await listJournal(project.id);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
          Ce que tu as fait aujourd&apos;hui, où tu as été bloqué·e, ce que tu
          as compris — pas besoin que ce soit propre. Une seule case par jour
          : si tu écris plusieurs fois le même jour, ça s&apos;ajoute à la
          suite plutôt que de créer une nouvelle entrée. Les dernières
          entrées sont lues par les fonctionnalités IA.
        </p>
        <form action={createJournalAction} className="space-y-2">
          <input type="hidden" name="project_id" value={project.id} />
          <textarea
            name="text"
            rows={3}
            placeholder="Aujourd'hui j'ai... / je suis bloqué·e sur... / j'ai compris que..."
            required
          />
          <button type="submit" className="btn-primary">
            Ajouter
          </button>
        </form>
      </div>

      {entries.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: "var(--ink-soft)" }}>
          Aucune entrée pour l&apos;instant.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((j) => (
            <div key={j.id} className="idea-card">
              <div className="flex items-start justify-between gap-2">
                <span
                  className="mono text-xs flex items-center gap-1"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {formatDate(j.date)}
                </span>
                <form action={deleteJournalAction}>
                  <input type="hidden" name="id" value={j.id} />
                  <button type="submit" className="btn-ghost px-2 py-1 text-xs">
                    Supprimer
                  </button>
                </form>
              </div>
              <p className="text-sm mt-2 whitespace-pre-wrap">{j.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
