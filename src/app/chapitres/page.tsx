import Link from "next/link";
import {
  getOrCreateProject,
  listChaptersWithProgress,
  createChapterAction,
  generateChaptersFromGuideAction,
  renameChapterAction,
  setChapterStatusAction,
  deleteChapterAction,
  createPointAction,
  updatePointAction,
  deletePointAction,
} from "@/lib/actions";

type ChapterWithProgress = {
  id: string;
  name: string;
  status: string;
  progress: "empty" | "notes" | "generated" | "final";
  points: { id: string; text: string }[];
};

export default async function ChapitresPage() {
  const project = await getOrCreateProject();
  const chapters: ChapterWithProgress[] = await listChaptersWithProgress(
    project.id
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <form action={generateChaptersFromGuideAction}>
          <input type="hidden" name="project_id" value={project.id} />
          <button type="submit" className="btn-ghost text-sm">
            Générer les chapitres depuis le guide
          </button>
        </form>
        <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Lit le champ Modèle et les documents uploadés (Projet & Modèle) pour
          créer les chapitres manquants selon la structure attendue.
        </span>
      </div>

      <form action={createChapterAction} className="flex gap-2 mb-6">
        <input type="hidden" name="project_id" value={project.id} />
        <input
          type="text"
          name="name"
          placeholder="Nom du nouveau chapitre"
          required
        />
        <button type="submit" className="btn-primary shrink-0">
          Ajouter
        </button>
      </form>

      {chapters.length > 0 && (
        <div className="flex items-center overflow-x-auto pb-2 mb-6">
          {chapters.map((chapter, i) => (
            <span key={chapter.id} className="flex items-center">
              {i > 0 && (
                <span
                  className={`bond ${chapter.progress !== "empty" ? "bond-active" : ""}`}
                />
              )}
              <Link
                href={`/chapitres/${chapter.id}`}
                title={chapter.name}
                className={`hex ${
                  chapter.progress === "notes" ? "hex-notes" : ""
                } ${chapter.progress === "generated" ? "hex-generated" : ""} ${
                  chapter.progress === "final" ? "hex-final" : ""
                }`}
              >
                {i + 1}
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <form action={renameChapterAction} className="flex-1 flex gap-2">
                <input type="hidden" name="id" value={chapter.id} />
                <input
                  type="text"
                  name="name"
                  defaultValue={chapter.name}
                  style={{ fontWeight: 500 }}
                />
                <button type="submit" className="btn-ghost px-2 py-1 text-xs">
                  Renommer
                </button>
              </form>

              <form
                action={setChapterStatusAction}
                className="flex items-center gap-1 shrink-0"
              >
                <input type="hidden" name="id" value={chapter.id} />
                <select
                  name="status"
                  defaultValue={chapter.status}
                  style={{ fontSize: 12, padding: "6px 8px", width: "auto" }}
                >
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminé</option>
                </select>
                <button type="submit" className="btn-ghost px-2 py-1 text-xs">
                  OK
                </button>
              </form>

              <form action={deleteChapterAction} className="shrink-0">
                <input type="hidden" name="id" value={chapter.id} />
                <button type="submit" className="text-xs btn-danger">
                  Supprimer
                </button>
              </form>
            </div>

            <Link
              href={`/chapitres/${chapter.id}`}
              className="btn-primary inline-flex mb-3"
              style={{ padding: "6px 14px", fontSize: 13 }}
            >
              Rédiger →
            </Link>

            <ul className="space-y-1.5 mb-3">
              {chapter.points.map((point) => (
                <li key={point.id} className="flex gap-2 items-center">
                  <form action={updatePointAction} className="flex-1 flex gap-2">
                    <input type="hidden" name="id" value={point.id} />
                    <input
                      type="text"
                      name="text"
                      defaultValue={point.text}
                      style={{ fontSize: 13, padding: "7px 10px" }}
                    />
                    <button type="submit" className="btn-ghost px-2 py-1 text-xs">
                      OK
                    </button>
                  </form>
                  <form action={deletePointAction}>
                    <input type="hidden" name="id" value={point.id} />
                    <button type="submit" className="text-xs btn-danger">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            <form action={createPointAction} className="flex gap-2">
              <input type="hidden" name="chapter_id" value={chapter.id} />
              <input
                type="text"
                name="text"
                placeholder="Nouveau point"
                style={{ fontSize: 13, padding: "7px 10px" }}
                required
              />
              <button type="submit" className="btn-ghost px-3 text-xs shrink-0">
                + Point
              </button>
            </form>
          </div>
        ))}

        {chapters.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun chapitre pour l&apos;instant.
          </p>
        )}
      </div>
    </div>
  );
}
