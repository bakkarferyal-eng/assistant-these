import {
  getOrCreateProject,
  listReferences,
  createReferenceAction,
  deleteReferenceAction,
  formatReferenceAction,
} from "@/lib/actions";

type Reference = { id: string; raw: string; formatted: string | null };

export default async function ReferencesPage() {
  const project = await getOrCreateProject();
  const references: Reference[] = await listReferences(project.id);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label
          className="mono text-xs uppercase tracking-wide"
          style={{ color: "var(--ink-soft)" }}
        >
          Nouvelle référence
        </label>
        <p className="text-xs mt-1 mb-2" style={{ color: "var(--ink-soft)" }}>
          Colle la référence telle que tu l&apos;as (même incomplète) — la
          bibliographie doit être en style IEEE.
        </p>
        <form action={createReferenceAction} className="space-y-2">
          <input type="hidden" name="project_id" value={project.id} />
          <textarea
            name="raw"
            rows={2}
            placeholder="Ex: Menges et al, APL Photonics, 2021, ..."
            required
          />
          <button type="submit" className="btn-primary">
            Ajouter
          </button>
        </form>
      </div>

      {references.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: "var(--ink-soft)" }}>
          Aucune référence pour l&apos;instant.
        </div>
      ) : (
        <div className="space-y-2">
          {references.map((r, i) => (
            <div key={r.id} className="idea-card">
              <div className="flex items-start justify-between gap-2">
                <span className="mono text-xs" style={{ color: "var(--ink-soft)" }}>
                  [{i + 1}]
                </span>
                <form action={deleteReferenceAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="btn-ghost px-2 py-1 text-xs">
                    Supprimer
                  </button>
                </form>
              </div>
              <p className="text-sm mt-1">{r.raw}</p>
              {r.formatted && (
                <div
                  className="mt-2 pt-2 text-sm whitespace-pre-wrap"
                  style={{ borderTop: "1px dashed var(--line)", color: "var(--accent)" }}
                >
                  {r.formatted}
                </div>
              )}
              <form action={formatReferenceAction} className="mt-2">
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="btn-ghost text-xs">
                  Formater en IEEE
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
