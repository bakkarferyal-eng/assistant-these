import {
  getOrCreateProject,
  listIdeas,
  listChapters,
  listIdeaGroups,
  createIdeaAction,
  deleteIdeaAction,
  assignIdeaAction,
  suggestChapterAction,
  ideaFeedbackAction,
  sequenceIdeasAction,
  deleteIdeaGroupAction,
} from "@/lib/actions";

type Idea = {
  id: string;
  text: string;
  source: string | null;
  status: string;
  chapter_id: string | null;
  suggested_chapter_id: string | null;
  feedback: string | null;
};

type Chapter = { id: string; name: string };

type IdeaGroup = {
  id: string;
  idea_texts: string[];
  reasoning: string | null;
};

export const dynamic = "force-dynamic";

export default async function IdeesPage() {
  const project = await getOrCreateProject();
  const ideas: Idea[] = await listIdeas(project.id);
  const chapters: Chapter[] = await listChapters(project.id);
  const ideaGroups: IdeaGroup[] = await listIdeaGroups(project.id);

  const pending = ideas.filter((i) => i.status !== "placed");
  const placed = ideas.filter((i) => i.status === "placed");

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <label
          className="mono text-xs uppercase tracking-wide"
          style={{ color: "var(--ink-soft)" }}
        >
          Nouvelle idée
        </label>
        <form action={createIdeaAction} className="space-y-2 mt-2">
          <input type="hidden" name="project_id" value={project.id} />
          <textarea
            name="text"
            rows={3}
            placeholder="Un paragraphe déjà écrit, une idée random, un bout de raisonnement..."
            required
          />
          <div className="flex gap-2">
            <input
              type="text"
              name="source"
              placeholder="Source (optionnel — ex: discussion de groupe, article X)"
            />
            <button type="submit" className="btn-primary shrink-0">
              Ajouter
            </button>
          </div>
        </form>
      </div>

      {ideaGroups.length > 0 && (
        <section>
          <span
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
          >
            Groupes organisés
          </span>
          <div className="space-y-2 mt-2">
            {ideaGroups.map((group) => (
              <div key={group.id} className="card p-4" style={{ borderTop: "3px solid var(--accent)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <ul className="text-sm list-disc pl-4 space-y-0.5">
                    {group.idea_texts.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                  <form action={deleteIdeaGroupAction}>
                    <input type="hidden" name="id" value={group.id} />
                    <button type="submit" className="btn-ghost px-2 py-1 text-xs shrink-0">
                      Supprimer
                    </button>
                  </form>
                </div>
                {group.reasoning && (
                  <div
                    className="text-sm whitespace-pre-wrap pt-2"
                    style={{ borderTop: "1px dashed var(--line)", lineHeight: 1.6 }}
                  >
                    {group.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <span
              className="mono text-xs uppercase tracking-wide"
              style={{ color: "var(--ink-soft)" }}
            >
              En attente ({pending.length})
            </span>
            <form action={sequenceIdeasAction} id="idea-select-form">
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="btn-ghost text-xs">
                Organiser la sélection
              </button>
            </form>
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
            Coche au moins 2 idées ci-dessous pour demander à l&apos;IA de les
            organiser ensemble, avant même de savoir dans quel chapitre elles
            iront.
          </p>
          <div className="space-y-2">
            {pending.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} chapters={chapters} selectable />
            ))}
          </div>
        </section>
      )}

      {placed.length > 0 && (
        <section>
          <span
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
          >
            Placées ({placed.length})
          </span>
          <div className="space-y-2 mt-2">
            {placed.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} chapters={chapters} />
            ))}
          </div>
        </section>
      )}

      {ideas.length === 0 && (
        <div className="card p-8 text-center" style={{ color: "var(--ink-soft)" }}>
          Ta boîte à idées est vide — ajoute un paragraphe écrit ou une idée en
          attente ici.
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  chapters,
  selectable,
}: {
  idea: Idea;
  chapters: Chapter[];
  selectable?: boolean;
}) {
  const chapter = chapters.find((c) => c.id === idea.chapter_id);
  const suggested = chapters.find((c) => c.id === idea.suggested_chapter_id);

  return (
    <div className="idea-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              name="idea_ids"
              value={idea.id}
              form="idea-select-form"
              className="mt-1"
            />
          )}
          <span className={`badge ${chapter ? "badge-placed" : "badge-pending"}`}>
            {chapter ? chapter.name : "à placer"}
          </span>
        </div>
        <form action={deleteIdeaAction}>
          <input type="hidden" name="id" value={idea.id} />
          <button type="submit" className="btn-ghost px-2 py-1 text-xs">
            Supprimer
          </button>
        </form>
      </div>
      <p className="text-sm mt-2">{idea.text}</p>
      {idea.source && (
        <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
          Source : {idea.source}
        </p>
      )}

      {!chapter && suggested && (
        <p className="text-xs mt-2" style={{ color: "var(--signal)" }}>
          Suggestion IA : {suggested.name}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {chapters.length > 0 && (
          <form action={assignIdeaAction} className="flex gap-1">
            <input type="hidden" name="id" value={idea.id} />
            <select
              name="chapter_id"
              defaultValue={idea.suggested_chapter_id ?? ""}
              style={{ fontSize: 12, padding: "6px 8px" }}
            >
              <option value="">Choisir un chapitre...</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.id === idea.suggested_chapter_id ? " (suggéré)" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ghost px-2 py-1 text-xs">
              Assigner
            </button>
          </form>
        )}
        {chapters.length > 0 && !chapter && (
          <form action={suggestChapterAction}>
            <input type="hidden" name="id" value={idea.id} />
            <button type="submit" className="btn-ghost px-2 py-1 text-xs">
              Suggérer un chapitre
            </button>
          </form>
        )}
        <form action={ideaFeedbackAction}>
          <input type="hidden" name="id" value={idea.id} />
          <button type="submit" className="btn-ghost px-2 py-1 text-xs">
            Corriger
          </button>
        </form>
      </div>
      {idea.feedback && (
        <div
          className="mt-3 pt-3 text-sm whitespace-pre-wrap"
          style={{ borderTop: "1px dashed var(--line)", color: "var(--hold)" }}
        >
          {idea.feedback}
        </div>
      )}
    </div>
  );
}
