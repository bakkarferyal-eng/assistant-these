import {
  getOrCreateProject,
  getDaily,
  generateDailyAction,
  sendDailyAnswerAction,
  listChapters,
} from "@/lib/actions";

const DAILY_LABELS: Record<string, string> = {
  quiz: "question de compréhension",
  homework: "devoir d'écriture",
  idea: "idée du jour",
  paper: "article à lire",
};

const DAILY_OPTIONS = [
  { type: "quiz", label: "Question", color: "var(--ink)" },
  { type: "homework", label: "Devoir", color: "var(--signal)" },
  { type: "idea", label: "Idée du jour", color: "var(--hold)" },
  { type: "paper", label: "Article à lire", color: "var(--accent)" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function TodayPage() {
  const project = await getOrCreateProject();
  const daily = await getDaily(project.id);
  const chapters: { id: string; name: string }[] = await listChapters(
    project.id
  );

  const isToday = !!(daily && daily.date === todayStr() && daily.content);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="disp font-medium capitalize">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      {isToday ? (
        <div className="mt-3">
          <span className="badge badge-placed mb-2">
            {DAILY_LABELS[daily.type] ?? daily.type}
          </span>
          <div
            className="text-sm whitespace-pre-wrap mt-2"
            style={{ lineHeight: 1.6 }}
          >
            {daily.content}
          </div>

          <form action={generateDailyAction} className="mt-4">
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="type" value={daily.type} />
            <button type="submit" className="btn-ghost text-sm">
              Une autre
            </button>
          </form>

          <div className="mt-4 pt-4" style={{ borderTop: "1px dashed var(--line)" }}>
            <form action={sendDailyAnswerAction} className="space-y-2">
              <input type="hidden" name="project_id" value={project.id} />
              <label
                className="mono text-xs uppercase tracking-wide"
                style={{ color: "var(--ink-soft)" }}
              >
                Ta réponse (optionnel)
              </label>
              <textarea
                name="text"
                rows={3}
                className="mt-1"
                placeholder="Écris ta réponse ici pour qu'elle soit rangée directement au bon endroit..."
              />
              <div className="flex flex-wrap gap-2">
                <select name="target">
                  <option value="">Où l&apos;envoyer...</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={`chapter:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                  <option value="quick:have">
                    Notes rapides — idées qu&apos;on a
                  </option>
                  <option value="quick:study">Notes rapides — à étudier</option>
                  <option value="quick:random">
                    Notes rapides — résultats/pensées
                  </option>
                  <option value="idea">Boîte à idées</option>
                </select>
                <button type="submit" className="btn-primary">
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
            Choisis ton format du jour :
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DAILY_OPTIONS.map((opt) => (
              <form action={generateDailyAction} key={opt.type}>
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="type" value={opt.type} />
                <button
                  type="submit"
                  className="btn-primary w-full justify-center"
                  style={{ background: opt.color }}
                >
                  {opt.label}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs mt-4" style={{ color: "var(--ink-soft)" }}>
        Pas grave si tu ne le fais pas aujourd&apos;hui — tu peux en redemander
        un autre demain.
      </p>
    </div>
  );
}
