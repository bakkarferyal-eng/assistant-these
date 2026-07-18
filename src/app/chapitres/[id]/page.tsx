import Link from "next/link";
import {
  getChapter,
  getOrCreateChapterData,
  sequencerAction,
  exempleAction,
  corrigerAction,
  updateWritingAction,
  updateChapterDetailsAction,
  listIdeas,
  unlinkIdeaAction,
} from "@/lib/actions";

const WORDS_PER_PAGE = 400;

function estimateWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = await getChapter(id);
  const chapterData = await getOrCreateChapterData(id);
  const allIdeas = await listIdeas(chapter.project_id);
  const linkedIdeas = allIdeas.filter(
    (idea: { chapter_id: string | null }) => idea.chapter_id === id
  );

  const hasWriting = !!chapterData.writing?.trim();
  const estWords = estimateWords(
    hasWriting
      ? chapterData.writing
      : chapter.points.map((p: { text: string }) => p.text).join(" ")
  );
  const estPages = estWords / WORDS_PER_PAGE;
  const pageRatio = chapter.page_limit
    ? Math.min(1, estPages / chapter.page_limit)
    : 0;
  const pageColor =
    pageRatio >= 1
      ? "var(--danger)"
      : pageRatio >= 0.7
      ? "var(--signal)"
      : "var(--accent)";

  return (
    <div>
      <Link href="/chapitres" className="text-sm" style={{ color: "var(--ink-soft)" }}>
        ← Chapitres
      </Link>
      <h1 className="disp text-lg font-medium mt-2 mb-1">{chapter.name}</h1>

      {chapter.page_limit && (
        <div className="mb-4">
          <div
            className="mono flex items-center justify-between text-xs mb-1"
            style={{ color: "var(--ink-soft)" }}
          >
            <span>
              ~{estPages.toFixed(1)} page{estPages >= 2 ? "s" : ""} estimée
              {estPages >= 2 ? "s" : ""}
            </span>
            <span>limite : {chapter.page_limit} pages</span>
          </div>
          <div
            style={{
              height: 5,
              borderRadius: 3,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pageRatio * 100}%`,
                background: pageColor,
                transition: "width .3s ease",
              }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
            {hasWriting
              ? "Basé sur ta rédaction"
              : "Basé sur tes points (moins précis)"}{" "}
            — estimation ~{WORDS_PER_PAGE} mots/page, à titre indicatif.
          </p>
        </div>
      )}

      <details className="mb-6 text-sm">
        <summary className="cursor-pointer" style={{ color: "var(--ink-soft)" }}>
          Limite de pages et style attendu pour ce chapitre
        </summary>
        <form
          action={updateChapterDetailsAction}
          className="card p-3 mt-2 space-y-2"
        >
          <input type="hidden" name="id" value={chapter.id} />
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--ink-soft)" }}>
              Limite de pages (optionnel)
            </label>
            <input
              type="number"
              name="page_limit"
              min={1}
              defaultValue={chapter.page_limit ?? ""}
              style={{ width: 96 }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--ink-soft)" }}>
              Façon d&apos;écrire attendue pour ce chapitre (optionnel)
            </label>
            <textarea
              name="style_note"
              defaultValue={chapter.style_note ?? ""}
              rows={2}
              placeholder="Ex: partir du général vers le spécifique, ton accessible..."
            />
          </div>
          <button type="submit" className="btn-ghost text-xs">
            Enregistrer
          </button>
        </form>
      </details>

      {chapter.style_note && (
        <div
          className="mb-4 p-3 text-sm"
          style={{
            background: "var(--surface-2)",
            borderRadius: 10,
            borderLeft: "3px solid var(--ink-soft)",
          }}
        >
          <span
            className="mono text-xs uppercase tracking-wide"
            style={{ color: "var(--ink-soft)" }}
          >
            Façon d&apos;écrire attendue
          </span>
          <p className="mt-1">{chapter.style_note}</p>
        </div>
      )}

      {linkedIdeas.length > 0 && (
        <section className="mb-6">
          <h2
            className="mono text-xs uppercase tracking-wide mb-2"
            style={{ color: "var(--ink-soft)" }}
          >
            Idées liées
          </h2>
          <div className="space-y-2">
            {linkedIdeas.map((idea: { id: string; text: string }) => (
              <div key={idea.id} className="idea-card flex items-start justify-between gap-2">
                <p className="text-sm">{idea.text}</p>
                <form action={unlinkIdeaAction}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button type="submit" className="btn-ghost px-2 py-1 text-xs shrink-0">
                    Délier
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2
          className="mono text-xs uppercase tracking-wide mb-2"
          style={{ color: "var(--ink-soft)" }}
        >
          Points
        </h2>
        {chapter.points.length > 0 ? (
          <ul className="space-y-1.5">
            {chapter.points.map(
              (point: { id: string; text: string }, i: number) => (
                <li key={point.id} className="text-sm">
                  <span className="mono text-xs" style={{ color: "var(--ink-soft)" }}>
                    {i + 1}.
                  </span>{" "}
                  {point.text}
                </li>
              )
            )}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun point pour l&apos;instant — ajoute des points depuis la liste
            des chapitres.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <form action={sequencerAction}>
          <input type="hidden" name="chapter_id" value={chapter.id} />
          <button type="submit" className="btn-primary" disabled={chapter.points.length < 2}>
            Séquencer les points
          </button>
        </form>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--ink-soft)" }}>
        Ajoute au moins 2 points, puis clique quand tu veux l&apos;ordre et la
        logique pour les relier — ce n&apos;est jamais automatique.
      </p>

      {chapterData.sequence && (
        <div className="card p-4 mb-6" style={{ borderTop: "3px solid var(--accent)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="mono text-xs uppercase tracking-wide"
              style={{ color: "var(--accent)" }}
            >
              Ordre & logique proposés
            </span>
          </div>
          <div className="text-sm whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
            {chapterData.sequence}
          </div>
        </div>
      )}

      <section className="mb-6 pt-4" style={{ borderTop: "1px dashed var(--line)" }}>
        <span
          className="mono text-xs uppercase tracking-wide"
          style={{ color: "var(--ink-soft)" }}
        >
          Rédaction
        </span>
        <form action={updateWritingAction} className="space-y-2 mt-2">
          <input type="hidden" name="chapter_id" value={chapter.id} />
          <textarea
            name="writing"
            defaultValue={chapterData.writing ?? ""}
            rows={12}
            placeholder="Écris ton texte ici..."
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-ghost text-sm">
              Enregistrer
            </button>
            <form action={exempleAction} className="inline">
              <input type="hidden" name="chapter_id" value={chapter.id} />
              <button
                type="submit"
                disabled={chapter.points.length === 0}
                className="btn-ghost text-sm"
              >
                Exemple
              </button>
            </form>
            <form action={corrigerAction} className="inline">
              <input type="hidden" name="chapter_id" value={chapter.id} />
              <button type="submit" disabled={!hasWriting} className="btn-ghost text-sm">
                Corriger
              </button>
            </form>
          </div>
        </form>

        {chapterData.draft_example && (
          <div
            className="card p-4 mt-3"
            style={{ borderTop: "3px solid var(--signal)" }}
          >
            <span
              className="mono text-xs uppercase tracking-wide"
              style={{ color: "var(--signal)" }}
            >
              Exemple (une façon possible, pas la seule)
            </span>
            <div className="text-sm whitespace-pre-wrap mt-2" style={{ lineHeight: 1.6 }}>
              {chapterData.draft_example}
            </div>
          </div>
        )}

        {chapterData.feedback && (
          <div className="card p-4 mt-3" style={{ borderTop: "3px solid var(--hold)" }}>
            <span
              className="mono text-xs uppercase tracking-wide"
              style={{ color: "var(--hold)" }}
            >
              Corrections & pistes
            </span>
            <div className="text-sm whitespace-pre-wrap mt-2" style={{ lineHeight: 1.6 }}>
              {chapterData.feedback}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
