import {
  getOrCreateProject,
  updateProjectAction,
  updateRoadmapAction,
  updateRoadmapWithAIAction,
  listUploads,
  uploadFileAction,
  deleteUploadAction,
  analyzeUploadAction,
  deleteFileAnalysisAction,
} from "@/lib/actions";

type FileAnalysis = {
  id: string;
  instruction: string;
  result: string | null;
};

type Upload = {
  id: string;
  filename: string;
  file_type: string;
  extracted_text: string | null;
  storage_path: string;
  file_analyses: FileAnalysis[];
};

const ANALYZABLE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const dynamic = "force-dynamic";

export default async function ProjetPage() {
  const project = await getOrCreateProject();
  const uploads: Upload[] = await listUploads(project.id);

  return (
    <div className="space-y-4">
      <div className="card p-4" style={{ borderLeft: "3px solid var(--hold)" }}>
        <label
          className="mono text-xs uppercase tracking-wide"
          style={{ color: "var(--hold)" }}
          htmlFor="roadmap"
        >
          Roadmap — par où commencer
        </label>
        <p className="text-xs mt-1 mb-2" style={{ color: "var(--ink-soft)" }}>
          Pas à remplir comme une simple case — c&apos;est l&apos;ordre dans
          lequel tu comptes avancer, vu l&apos;état réel du projet. Lu par
          toutes les fonctionnalités IA (Séquencer, Corriger,
          Aujourd&apos;hui...), donc si tu changes de priorité, modifie-le ici
          et ça s&apos;applique partout. Le bouton &laquo;&nbsp;Mettre à jour
          avec l&apos;IA&nbsp;&raquo; la réécrit automatiquement à partir de
          l&apos;état réel du projet (chapitres, journal, notes).
        </p>
        <form action={updateRoadmapAction} className="space-y-2">
          <input type="hidden" name="id" value={project.id} />
          <textarea
            id="roadmap"
            name="roadmap"
            defaultValue={project.roadmap ?? ""}
            rows={5}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-ghost text-sm">
              Enregistrer
            </button>
          </div>
        </form>
        <form action={updateRoadmapWithAIAction} className="mt-2">
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className="btn-primary text-sm">
            Mettre à jour avec l&apos;IA
          </button>
        </form>
      </div>

      <form action={updateProjectAction} className="space-y-4">
        <input type="hidden" name="id" value={project.id} />

        <div className="card p-4">
          <label
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
            htmlFor="context"
          >
            Contexte du projet
          </label>
          <textarea
            id="context"
            name="context"
            defaultValue={project.context ?? ""}
            rows={4}
            className="mt-1"
            placeholder="Sujet, cadre, université, encadrant..."
          />
        </div>

        <div className="card p-4">
          <label
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
            htmlFor="objectif"
          >
            Objectif du mémoire
          </label>
          <textarea
            id="objectif"
            name="objectif"
            defaultValue={project.objectif ?? ""}
            rows={3}
            className="mt-1"
            placeholder="Ce que le mémoire doit démontrer"
          />
        </div>

        <div className="card p-4">
          <label
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
            htmlFor="modele"
          >
            Modèle du mémoire
          </label>
          <p className="text-xs mt-1 mb-2" style={{ color: "var(--ink-soft)" }}>
            Colle ici les subdivisions attendues, les mini-titres, le style
            demandé.
          </p>
          <textarea
            id="modele"
            name="modele"
            defaultValue={project.modele ?? ""}
            rows={5}
            placeholder="Style, ton, contraintes de rédaction à suivre"
          />
        </div>

        <div className="card p-4">
          <label
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
            htmlFor="resultats_data"
          >
            Résultats & données
          </label>
          <p className="text-xs mt-1 mb-2" style={{ color: "var(--ink-soft)" }}>
            Résultats obtenus, chiffres clés, observations — référence rapide
            réutilisée par l&apos;IA dans tous les chapitres.
          </p>
          <textarea
            id="resultats_data"
            name="resultats_data"
            defaultValue={project.resultats_data ?? ""}
            rows={5}
            placeholder="Ex: valeur mesurée X = ..., observation clé..."
          />
        </div>

        <button type="submit" className="btn-primary">
          Enregistrer
        </button>
      </form>

      <div className="card p-4">
        <h2 className="disp text-lg font-medium mb-1">Documents</h2>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
          PDF, DOCX ou image. Le texte est extrait automatiquement. Ajoute une
          instruction si tu veux en plus une analyse IA (décrire un
          graphique, extraire des valeurs d&apos;un tableau, répondre à une
          question dessus...) — sinon laisse-la vide, le fichier est juste
          stocké avec son texte.
        </p>

        <form
          action={uploadFileAction}
          encType="multipart/form-data"
          className="space-y-2 mb-4"
        >
          <input type="hidden" name="project_id" value={project.id} />
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            required
            className="text-sm"
          />
          <textarea
            name="instruction"
            rows={2}
            placeholder="Instruction pour l'IA (optionnel) — ex: décris ce graphique..."
          />
          <button type="submit" className="btn-primary shrink-0">
            Envoyer
          </button>
        </form>

        <div className="space-y-2">
          {uploads.map((upload) => (
            <div key={upload.id} className="idea-card">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{upload.filename}</span>
                <form action={deleteUploadAction}>
                  <input type="hidden" name="id" value={upload.id} />
                  <input
                    type="hidden"
                    name="storage_path"
                    value={upload.storage_path}
                  />
                  <button type="submit" className="text-xs btn-danger">
                    Supprimer
                  </button>
                </form>
              </div>
              {upload.extracted_text ? (
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                  {upload.extracted_text.slice(0, 300)}
                  {upload.extracted_text.length > 300 ? "…" : ""}
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--ink-soft)" }}>
                  Pas de texte extrait (image, ou extraction impossible).
                </p>
              )}

              {upload.file_analyses.length > 0 && (
                <div className="mt-2 space-y-2">
                  {upload.file_analyses.map((a) => (
                    <div
                      key={a.id}
                      className="pt-2"
                      style={{ borderTop: "1px dashed var(--line)" }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                          Instruction : {a.instruction}
                        </p>
                        <form action={deleteFileAnalysisAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className="text-xs btn-danger shrink-0">
                            Supprimer
                          </button>
                        </form>
                      </div>
                      {a.result && (
                        <p className="text-sm whitespace-pre-wrap mt-1">{a.result}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {ANALYZABLE_TYPES.includes(upload.file_type) && (
                <form
                  action={analyzeUploadAction}
                  className="flex gap-1 mt-2 pt-2"
                  style={{ borderTop: "1px dashed var(--line)" }}
                >
                  <input type="hidden" name="upload_id" value={upload.id} />
                  <input
                    type="text"
                    name="instruction"
                    placeholder="Demander une analyse..."
                    style={{ fontSize: 12, padding: "6px 8px" }}
                    required
                  />
                  <button type="submit" className="btn-ghost px-2 py-1 text-xs shrink-0">
                    Analyser
                  </button>
                </form>
              )}
            </div>
          ))}

          {uploads.length === 0 && (
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Aucun document pour l&apos;instant.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
