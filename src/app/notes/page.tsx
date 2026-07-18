import {
  getOrCreateProject,
  listQuickNotes,
  createQuickNoteAction,
  deleteQuickNoteAction,
  promoteQuickNoteAction,
} from "@/lib/actions";

const COLUMNS = [
  { id: "have", label: "Idées qu'on a", color: "var(--accent)" },
  { id: "study", label: "À étudier / vérifier", color: "var(--hold)" },
  { id: "random", label: "Résultats & pensées random", color: "var(--signal)" },
];

type QuickNote = { id: string; column_name: string; text: string };

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const project = await getOrCreateProject();
  const notes: QuickNote[] = await listQuickNotes(project.id);

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
        Capture rapide, en points — pas besoin de phrases complètes. Tout ce
        qui est ici est lu par les fonctionnalités IA (Séquencer, Corriger,
        Aujourd&apos;hui...). Quand un point mûrit en vraie idée, envoie-le
        vers la boîte à idées avec la flèche.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = notes.filter((n) => n.column_name === col.id);
          return (
            <div
              key={col.id}
              className="card p-3"
              style={{ borderTop: `3px solid ${col.color}` }}
            >
              <h2
                className="mono text-xs uppercase tracking-wide mb-2"
                style={{ color: col.color }}
              >
                {col.label}
              </h2>
              <form action={createQuickNoteAction} className="flex gap-1 mb-2">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="column_name" value={col.id} />
                <input
                  type="text"
                  name="text"
                  placeholder="+ ajouter..."
                  style={{ fontSize: 13, padding: "7px 10px" }}
                  required
                />
                <button type="submit" className="btn-ghost px-2">
                  +
                </button>
              </form>
              <div className="space-y-1.5">
                {items.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                    — vide —
                  </p>
                )}
                {items.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start justify-between gap-2"
                    style={{
                      background: "var(--surface-2)",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  >
                    <span className="text-sm flex-1">• {n.text}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <form action={promoteQuickNoteAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="text" value={n.text} />
                        <button
                          type="submit"
                          style={{ color: col.color }}
                          title="Envoyer vers la boîte à idées"
                        >
                          →
                        </button>
                      </form>
                      <form action={deleteQuickNoteAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          style={{ color: "var(--ink-soft)" }}
                          title="Supprimer"
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
