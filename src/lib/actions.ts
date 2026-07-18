"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { supabaseAdmin } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";
import {
  sequencerSystemPrompt,
  exempleSystemPrompt,
  corrigerSystemPrompt,
  ideaFeedbackSystemPrompt,
  REFERENCE_SYSTEM_PROMPT,
  REFERENCE_EXTRACTION_SYSTEM_PROMPT,
  CHAPTER_GUIDE_SYSTEM_PROMPT,
  chapterSuggestionSystemPrompt,
  ROADMAP_UPDATE_SYSTEM_PROMPT,
  DAILY_INSTRUCTIONS,
  dailySystemPrompt,
  IDEA_GROUP_SYSTEM_PROMPT,
  FILE_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/prompts";

// ---- Projet & Modèle ----

export async function getOrCreateProject() {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("projects")
    .insert({})
    .select()
    .single();

  if (createError) throw new Error(createError.message);
  return created;
}

export async function updateProjectAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin
    .from("projects")
    .update({
      context: formData.get("context") as string,
      objectif: formData.get("objectif") as string,
      modele: formData.get("modele") as string,
      resultats_data: formData.get("resultats_data") as string,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/projet");
}

export async function updateRoadmapAction(formData: FormData) {
  const id = formData.get("id") as string;
  const roadmap = formData.get("roadmap") as string;

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ roadmap })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/projet");
}

export async function updateRoadmapWithAIAction(formData: FormData) {
  const id = formData.get("id") as string;

  const fullContext = await buildFullContext();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: ROADMAP_UPDATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: fullContext }],
  });

  const roadmap = extractTextBlock(response.content);

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ roadmap })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/projet");
}

// ---- Chapitres ----

export async function listChapters(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("chapters")
    .select("*, points(*)")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);

  for (const chapter of data) {
    chapter.points.sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position
    );
  }

  return data;
}

// Content-derived status for the hex progress chain: empty / notes / generated / final.
export async function listChaptersWithProgress(projectId: string) {
  const chapters = await listChapters(projectId);

  const { data: chapterDataRows } = await supabaseAdmin
    .from("chapter_data")
    .select("chapter_id, sequence, writing")
    .in(
      "chapter_id",
      chapters.map((c: { id: string }) => c.id)
    );

  const dataByChapter = new Map(
    (chapterDataRows ?? []).map((d: { chapter_id: string }) => [d.chapter_id, d])
  );

  return chapters.map(
    (chapter: {
      id: string;
      name: string;
      status: string;
      points: { id: string; text: string }[];
    }) => {
      const data = dataByChapter.get(chapter.id) as
        | { sequence: string | null; writing: string | null }
        | undefined;
      const progress: "empty" | "notes" | "generated" | "final" = data?.writing?.trim()
        ? "final"
        : data?.sequence
        ? "generated"
        : chapter.points.length > 0
        ? "notes"
        : "empty";
      return { ...chapter, progress };
    }
  );
}

export async function createChapterAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const { data: last } = await supabaseAdmin
    .from("chapters")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  const { error } = await supabaseAdmin
    .from("chapters")
    .insert({ project_id: projectId, name, position: nextPosition });

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

// Reads the Modèle field + any uploaded guide documents and creates
// whichever chapters from that structure don't already exist yet.
export async function generateChaptersFromGuideAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;

  const project = await getOrCreateProject();
  const { data: uploads } = await supabaseAdmin
    .from("uploads")
    .select("filename, extracted_text")
    .eq("project_id", projectId)
    .not("extracted_text", "is", null);

  const uploadsText = (uploads ?? [])
    .map(
      (u: { filename: string; extracted_text: string }) =>
        `--- ${u.filename} ---\n${u.extracted_text}`
    )
    .join("\n\n");

  if (!project.modele && !uploadsText) return;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: CHAPTER_GUIDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `MODELE (saisi manuellement):\n${project.modele || "(vide)"}\n\nDOCUMENTS UPLOADÉS:\n${
          uploadsText || "(aucun)"
        }`,
      },
    ],
  });

  const raw = extractTextBlock(response.content)
    .replace(/```json|```/g, "")
    .trim();

  let parsed: {
    chapters: { name: string; page_limit: number | null; style_note: string | null }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!parsed.chapters?.length) return;

  const { data: existing } = await supabaseAdmin
    .from("chapters")
    .select("name, position")
    .eq("project_id", projectId)
    .order("position", { ascending: false });

  let nextPosition = (existing?.[0]?.position ?? -1) + 1;
  const existingNames = new Set(
    (existing ?? []).map((c: { name: string }) => c.name.trim().toLowerCase())
  );

  const toInsert = parsed.chapters
    .filter((c) => c.name && !existingNames.has(c.name.trim().toLowerCase()))
    .map((c) => ({
      project_id: projectId,
      name: c.name.trim(),
      position: nextPosition++,
      page_limit: c.page_limit ?? null,
      style_note: c.style_note ?? null,
    }));

  if (toInsert.length === 0) return;

  const { error } = await supabaseAdmin.from("chapters").insert(toInsert);
  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

export async function renameChapterAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  const { error } = await supabaseAdmin
    .from("chapters")
    .update({ name })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

export async function setChapterStatusAction(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  const { error } = await supabaseAdmin
    .from("chapters")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

export async function deleteChapterAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("chapters").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

// ---- Points ----

export async function createPointAction(formData: FormData) {
  const chapterId = formData.get("chapter_id") as string;
  const text = (formData.get("text") as string)?.trim();
  if (!text) return;

  const { data: last } = await supabaseAdmin
    .from("points")
    .select("position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  const { error } = await supabaseAdmin
    .from("points")
    .insert({ chapter_id: chapterId, text, position: nextPosition });

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

export async function updatePointAction(formData: FormData) {
  const id = formData.get("id") as string;
  const text = (formData.get("text") as string)?.trim();
  if (!text) return;

  const { error } = await supabaseAdmin
    .from("points")
    .update({ text })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

export async function deletePointAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("points").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/chapitres");
}

export async function updateChapterDetailsAction(formData: FormData) {
  const id = formData.get("id") as string;
  const pageLimitRaw = (formData.get("page_limit") as string) ?? "";
  const styleNote = formData.get("style_note") as string;

  const { error } = await supabaseAdmin
    .from("chapters")
    .update({
      page_limit: pageLimitRaw.trim() ? parseInt(pageLimitRaw, 10) : null,
      style_note: styleNote || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/chapitres/${id}`);
}

// ---- Uploads (PDF/DOCX) ----

async function extractText(
  buffer: Buffer,
  fileType: string
): Promise<string | null> {
  if (fileType === "application/pdf") {
    // Loaded on demand: keeps every other page (which never touches PDFs)
    // from paying the import cost. unpdf ships its own serverless build of
    // pdf.js with zero native dependencies, unlike pdf-parse (which needs
    // browser Canvas APIs such as DOMMatrix that don't exist on Vercel).
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  }

  if (
    fileType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  // Images and other types: no text extraction here, file is still stored.
  return null;
}

export async function listUploads(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("uploads")
    .select("*, file_analyses(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

const ANALYZABLE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

async function runFileAnalysis(
  buffer: Buffer,
  fileType: string,
  extractedText: string | null,
  instruction: string
) {
  let content;
  if (fileType === "application/pdf") {
    content = [
      {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: buffer.toString("base64"),
        },
      },
      { type: "text" as const, text: instruction },
    ];
  } else if (fileType === "image/png" || fileType === "image/jpeg") {
    content = [
      {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: fileType as "image/png" | "image/jpeg",
          data: buffer.toString("base64"),
        },
      },
      { type: "text" as const, text: instruction },
    ];
  } else {
    // DOCX and other text-extracted types: Claude can't take these as a
    // binary block, so pass the already-extracted text as context instead.
    content = [
      {
        type: "text" as const,
        text: `DOCUMENT:\n${extractedText || "(aucun texte extrait)"}\n\nINSTRUCTION:\n${instruction}`,
      },
    ];
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: FILE_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  return extractTextBlock(response.content);
}

export async function uploadFileAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const file = formData.get("file") as File | null;
  const instruction = (formData.get("instruction") as string)?.trim();
  if (!file || file.size === 0) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${projectId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("uploads")
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  let extractedText: string | null = null;
  try {
    extractedText = await extractText(buffer, file.type);
  } catch {
    // Extraction failure shouldn't block storing the file itself.
    extractedText = null;
  }

  const { data: uploadRow, error: insertError } = await supabaseAdmin
    .from("uploads")
    .insert({
      project_id: projectId,
      filename: file.name,
      file_type: file.type,
      extracted_text: extractedText,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  if (instruction && ANALYZABLE_TYPES.includes(file.type)) {
    const result = await runFileAnalysis(buffer, file.type, extractedText, instruction);
    const { error } = await supabaseAdmin
      .from("file_analyses")
      .insert({ project_id: projectId, upload_id: uploadRow.id, instruction, result });
    if (error) throw new Error(error.message);
  }

  if (extractedText) {
    await extractReferencesFromText(projectId, extractedText);
  }

  revalidatePath("/projet");
  revalidatePath("/references");
}

export async function deleteUploadAction(formData: FormData) {
  const id = formData.get("id") as string;
  const storagePath = formData.get("storage_path") as string;

  await supabaseAdmin.storage.from("uploads").remove([storagePath]);

  const { error } = await supabaseAdmin.from("uploads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projet");
}

export async function analyzeUploadAction(formData: FormData) {
  const uploadId = formData.get("upload_id") as string;
  const instruction = (formData.get("instruction") as string)?.trim();
  if (!instruction) return;

  const { data: upload, error: fetchError } = await supabaseAdmin
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!ANALYZABLE_TYPES.includes(upload.file_type)) return;

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from("uploads")
    .download(upload.storage_path);
  if (downloadError || !fileData) {
    throw new Error(downloadError?.message ?? "download failed");
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());

  const result = await runFileAnalysis(
    buffer,
    upload.file_type,
    upload.extracted_text,
    instruction
  );

  const { error } = await supabaseAdmin
    .from("file_analyses")
    .insert({ project_id: upload.project_id, upload_id: uploadId, instruction, result });

  if (error) throw new Error(error.message);
  revalidatePath("/projet");
}

export async function deleteFileAnalysisAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("file_analyses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projet");
}

// ---- Shared AI helpers ----

function extractTextBlock(
  content: { type: string; text?: string }[]
): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

function parseJsonField(text: string, field: string): string {
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    return parsed[field] ?? clean;
  } catch {
    return clean;
  }
}

// Every AI action reads the whole project (not just the current chapter) so
// suggestions stay consistent with the roadmap, journal, and other chapters.
async function buildFullContext(): Promise<string> {
  const project = await getOrCreateProject();

  const { data: chapters } = await supabaseAdmin
    .from("chapters")
    .select("*, points(*)")
    .eq("project_id", project.id)
    .order("position", { ascending: true });

  const chaptersDigest = (chapters ?? [])
    .map(
      (c: { name: string; status: string; points: { text: string }[] }) => {
        const ptsSnippet = c.points
          .slice(0, 5)
          .map((p) => p.text)
          .join(" / ");
        return `- ${c.name} [${c.status}] — ${c.points.length} point(s)${
          ptsSnippet
            ? ` : ${ptsSnippet}${c.points.length > 5 ? "…" : ""}`
            : ""
        }`;
      }
    )
    .join("\n");

  const { data: journalEntries } = await supabaseAdmin
    .from("journal")
    .select("*")
    .eq("project_id", project.id)
    .order("date", { ascending: false })
    .limit(4);

  const journalDigest = (journalEntries ?? [])
    .map((j: { date: string; text: string }) => `- ${j.date}: ${j.text}`)
    .join("\n");

  const { data: quickNotes } = await supabaseAdmin
    .from("quick_notes")
    .select("*")
    .eq("project_id", project.id);

  const columnLabel: Record<string, string> = {
    have: "idée",
    study: "à étudier",
    random: "résultat/pensée",
  };
  const qnDigest = (quickNotes ?? [])
    .map(
      (n: { column_name: string; text: string }) =>
        `- (${columnLabel[n.column_name] ?? n.column_name}) ${n.text}`
    )
    .join("\n");

  return `CONTEXTE:
${project.context || "(non précisé)"}

OBJECTIF:
${project.objectif || "(non précisé)"}

MODELE DU MEMOIRE:
${project.modele || "(non fourni)"}

FEUILLE DE ROUTE (priorités recommandées, à respecter dans les suggestions):
${project.roadmap || "(non définie)"}

RESULTATS ET DONNEES DISPONIBLES:
${project.resultats_data || "(non précisé)"}

JOURNAL DE BORD RECENT (ce qui a été fait / bloqué récemment):
${journalDigest || "(aucune entrée)"}

NOTES RAPIDES EN VRAC:
${qnDigest || "(aucune)"}

APERCU DES CHAPITRES (statut + extrait des notes):
${chaptersDigest || "(pas encore de chapitres)"}`;
}

// ---- Rédaction (Séquencer / Corriger / Exemple) ----

export async function getChapter(chapterId: string) {
  const { data, error } = await supabaseAdmin
    .from("chapters")
    .select("*, points(*)")
    .eq("id", chapterId)
    .single();

  if (error) throw new Error(error.message);

  data.points.sort(
    (a: { position: number }, b: { position: number }) => a.position - b.position
  );

  return data;
}

export async function getOrCreateChapterData(chapterId: string) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("chapter_data")
    .select("*")
    .eq("chapter_id", chapterId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (existing) return existing;

  const { data: created, error: createError } = await supabaseAdmin
    .from("chapter_data")
    .insert({ chapter_id: chapterId })
    .select()
    .single();

  if (createError) throw new Error(createError.message);
  return created;
}

export async function updateWritingAction(formData: FormData) {
  const chapterId = formData.get("chapter_id") as string;
  const writing = formData.get("writing") as string;

  const { error } = await supabaseAdmin
    .from("chapter_data")
    .upsert({ chapter_id: chapterId, writing });

  if (error) throw new Error(error.message);
  revalidatePath(`/chapitres/${chapterId}`);
}

export async function sequencerAction(formData: FormData) {
  const chapterId = formData.get("chapter_id") as string;

  const chapter = await getChapter(chapterId);
  if (chapter.points.length < 2) return;

  const { data: linkedIdeas } = await supabaseAdmin
    .from("ideas")
    .select("*")
    .eq("chapter_id", chapterId);

  const pointsList = chapter.points
    .map((p: { text: string }, i: number) => `${i + 1}. ${p.text}`)
    .join("\n");
  const linkedIdeasList = (linkedIdeas ?? [])
    .map((i: { text: string }) => `- ${i.text}`)
    .join("\n");

  const fullContext = await buildFullContext();
  const styleNote =
    chapter.style_note || "(pas de note de style spécifique pour ce chapitre)";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: sequencerSystemPrompt(chapter.name, styleNote),
    messages: [
      {
        role: "user",
        content: `${fullContext}

SECTION ACTUELLE: ${chapter.name}

POINTS DE CE CHAPITRE (dans le désordre actuel):
${pointsList}

IDEES LIEES A CETTE SECTION (depuis la Boîte à idées):
${linkedIdeasList || "(aucune)"}`,
      },
    ],
  });

  const sequence = parseJsonField(extractTextBlock(response.content), "sequence");

  const { error } = await supabaseAdmin
    .from("chapter_data")
    .upsert({ chapter_id: chapterId, sequence });

  if (error) throw new Error(error.message);
  revalidatePath(`/chapitres/${chapterId}`);
}

export async function exempleAction(formData: FormData) {
  const chapterId = formData.get("chapter_id") as string;

  const chapter = await getChapter(chapterId);
  if (chapter.points.length === 0) return;

  const chapterData = await getOrCreateChapterData(chapterId);
  const fullContext = await buildFullContext();
  const styleNote =
    chapter.style_note || "(pas de note de style spécifique pour ce chapitre)";

  const pointsList = chapter.points
    .map((p: { text: string }, i: number) => `${i + 1}. ${p.text}`)
    .join("\n");
  const sequence =
    chapterData.sequence ||
    "(pas encore séquencé — utilise ton propre jugement sur l'ordre)";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: exempleSystemPrompt(chapter.name, styleNote),
    messages: [
      {
        role: "user",
        content: `${fullContext}

POINTS DE CE CHAPITRE:
${pointsList}

SEQUENCE/ORDRE DEJA ETABLI:
${sequence}`,
      },
    ],
  });

  const draftExample = parseJsonField(extractTextBlock(response.content), "example");

  const { error } = await supabaseAdmin
    .from("chapter_data")
    .upsert({ chapter_id: chapterId, draft_example: draftExample });

  if (error) throw new Error(error.message);
  revalidatePath(`/chapitres/${chapterId}`);
}

export async function corrigerAction(formData: FormData) {
  const chapterId = formData.get("chapter_id") as string;

  const chapter = await getChapter(chapterId);
  const chapterData = await getOrCreateChapterData(chapterId);

  if (!chapterData.writing?.trim()) return;

  const fullContext = await buildFullContext();
  const styleNote =
    chapter.style_note || "(pas de note de style spécifique pour ce chapitre)";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: corrigerSystemPrompt(chapter.name, styleNote),
    messages: [
      {
        role: "user",
        content: `${fullContext}

TEXTE REDIGE A CORRIGER (chapitre "${chapter.name}"):
${chapterData.writing}`,
      },
    ],
  });

  const feedback = parseJsonField(extractTextBlock(response.content), "feedback");

  const { error } = await supabaseAdmin
    .from("chapter_data")
    .upsert({ chapter_id: chapterId, feedback });

  if (error) throw new Error(error.message);
  revalidatePath(`/chapitres/${chapterId}`);
}

// ---- Notes rapides ----

export async function listQuickNotes(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("quick_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function createQuickNoteAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const columnName = formData.get("column_name") as string;
  const text = (formData.get("text") as string)?.trim();
  if (!text) return;

  const { error } = await supabaseAdmin
    .from("quick_notes")
    .insert({ project_id: projectId, column_name: columnName, text });

  if (error) throw new Error(error.message);
  revalidatePath("/notes");
}

export async function deleteQuickNoteAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("quick_notes").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/notes");
}

export async function promoteQuickNoteAction(formData: FormData) {
  const id = formData.get("id") as string;
  const projectId = formData.get("project_id") as string;
  const text = formData.get("text") as string;

  const { error: insertError } = await supabaseAdmin.from("ideas").insert({
    project_id: projectId,
    text,
    source: "notes rapides",
    status: "new",
  });
  if (insertError) throw new Error(insertError.message);

  const { error: deleteError } = await supabaseAdmin
    .from("quick_notes")
    .delete()
    .eq("id", id);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/notes");
  revalidatePath("/idees");
}

// ---- Boîte à idées ----

export async function listIdeas(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("ideas")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

async function suggestChapterForText(
  projectId: string,
  text: string
): Promise<string | null> {
  const { data: chapters } = await supabaseAdmin
    .from("chapters")
    .select("id, name")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (!chapters || chapters.length === 0) return null;

  const chapterList = chapters
    .map((c: { name: string }) => `- ${c.name}`)
    .join("\n");
  const fullContext = await buildFullContext();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: chapterSuggestionSystemPrompt(chapterList),
    messages: [{ role: "user", content: `${fullContext}\n\nIDEE:\n${text}` }],
  });

  const raw = extractTextBlock(response.content)
    .replace(/```json|```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(raw);
    const chapterName = parsed.chapter_name as string | null;
    if (!chapterName) return null;
    const match = chapters.find(
      (c: { name: string }) =>
        c.name.trim().toLowerCase() === chapterName.trim().toLowerCase()
    );
    return match ? (match as { id: string }).id : null;
  } catch {
    return null;
  }
}

export async function createIdeaAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const text = (formData.get("text") as string)?.trim();
  const source = formData.get("source") as string;
  if (!text) return;

  const suggestedChapterId = await suggestChapterForText(projectId, text);

  const { error } = await supabaseAdmin.from("ideas").insert({
    project_id: projectId,
    text,
    source: source || null,
    status: "new",
    suggested_chapter_id: suggestedChapterId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

export async function suggestChapterAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { data: idea, error: fetchError } = await supabaseAdmin
    .from("ideas")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const suggestedChapterId = await suggestChapterForText(
    idea.project_id,
    idea.text
  );

  const { error } = await supabaseAdmin
    .from("ideas")
    .update({ suggested_chapter_id: suggestedChapterId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

// ---- Idea groups (organize several loose ideas before assigning them) ----

export async function listIdeaGroups(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("idea_groups")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function sequenceIdeasAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const ideaIds = formData.getAll("idea_ids") as string[];
  if (ideaIds.length < 2) return;

  const { data: ideas } = await supabaseAdmin
    .from("ideas")
    .select("text")
    .in("id", ideaIds);

  const texts = (ideas ?? []).map((i: { text: string }) => i.text);
  const ideasList = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const fullContext = await buildFullContext();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: IDEA_GROUP_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `${fullContext}\n\nIDEES A ORGANISER:\n${ideasList}` },
    ],
  });

  const reasoning = parseJsonField(extractTextBlock(response.content), "sequence");

  const { error } = await supabaseAdmin.from("idea_groups").insert({
    project_id: projectId,
    idea_texts: texts,
    reasoning,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

export async function deleteIdeaGroupAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("idea_groups").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

export async function deleteIdeaAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("ideas").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

export async function assignIdeaAction(formData: FormData) {
  const id = formData.get("id") as string;
  const chapterId = formData.get("chapter_id") as string;
  if (!chapterId) return;

  const { data: idea, error: fetchError } = await supabaseAdmin
    .from("ideas")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { data: last } = await supabaseAdmin
    .from("points")
    .select("position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? -1) + 1;

  const { error: pointError } = await supabaseAdmin.from("points").insert({
    chapter_id: chapterId,
    text: idea.text,
    position: nextPosition,
  });
  if (pointError) throw new Error(pointError.message);

  const { error: updateError } = await supabaseAdmin
    .from("ideas")
    .update({ status: "placed", chapter_id: chapterId })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/idees");
  revalidatePath("/chapitres");
}

export async function unlinkIdeaAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin
    .from("ideas")
    .update({ status: "new", chapter_id: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

export async function ideaFeedbackAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { data: idea, error: fetchError } = await supabaseAdmin
    .from("ideas")
    .select("*, chapters(name, style_note)")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const fullContext = await buildFullContext();
  const chapterName = idea.chapters?.name ?? null;
  const styleNote =
    idea.chapters?.style_note || "(pas encore assignée à un chapitre précis)";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: ideaFeedbackSystemPrompt(chapterName, styleNote),
    messages: [
      {
        role: "user",
        content: `${fullContext}\n\nIDEE A CORRIGER:\n${idea.text}`,
      },
    ],
  });

  const feedback = parseJsonField(extractTextBlock(response.content), "feedback");

  const { error } = await supabaseAdmin
    .from("ideas")
    .update({ feedback })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/idees");
}

// ---- Références ----

export async function listReferences(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("references")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

async function insertFormattedReference(projectId: string, raw: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: REFERENCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: raw }],
  });

  const formatted = extractTextBlock(response.content);

  const { error } = await supabaseAdmin
    .from("references")
    .insert({ project_id: projectId, raw, formatted });
  if (error) throw new Error(error.message);
}

// Best-effort: scans extracted document text for real bibliographic
// references and adds each one (pre-formatted), skipped silently on any
// failure so it never blocks the upload itself.
async function extractReferencesFromText(projectId: string, text: string) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: REFERENCE_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text.slice(0, 100000) }],
    });

    const raw = extractTextBlock(response.content)
      .replace(/```json|```/g, "")
      .trim();
    const parsed = JSON.parse(raw);
    const refs: string[] = parsed.references ?? [];

    for (const ref of refs.slice(0, 20)) {
      if (ref?.trim()) await insertFormattedReference(projectId, ref.trim());
    }
  } catch {
    // Extraction is a bonus, not a requirement — swallow and move on.
  }
}

export async function createReferenceAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const raw = (formData.get("raw") as string)?.trim();
  if (!raw) return;

  await insertFormattedReference(projectId, raw);
  revalidatePath("/references");
}

export async function deleteReferenceAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("references").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/references");
}

export async function formatReferenceAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { data: reference, error: fetchError } = await supabaseAdmin
    .from("references")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: REFERENCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: reference.raw }],
  });

  const formatted = extractTextBlock(response.content);

  const { error } = await supabaseAdmin
    .from("references")
    .update({ formatted })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/references");
}

// ---- Journal de bord ----

export async function listJournal(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("journal")
    .select("*")
    .eq("project_id", projectId)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function createJournalAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const text = (formData.get("text") as string)?.trim();
  if (!text) return;

  const today = new Date().toISOString().slice(0, 10);
  const time = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const entry = `${time} — ${text}`;

  // One case per day: append to today's entry if it already exists, rather
  // than creating a new row every time. Most-recent-first in case older
  // data has duplicate same-day rows from before this behavior existed.
  const { data: existingRows } = await supabaseAdmin
    .from("journal")
    .select("id, text")
    .eq("project_id", projectId)
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1);

  const existing = existingRows?.[0];

  if (existing) {
    const { error } = await supabaseAdmin
      .from("journal")
      .update({ text: `${existing.text}\n\n${entry}` })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("journal")
      .insert({ project_id: projectId, date: today, text: entry });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/journal");
}

export async function deleteJournalAction(formData: FormData) {
  const id = formData.get("id") as string;

  const { error } = await supabaseAdmin.from("journal").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

// ---- Aujourd'hui ----

export async function getDaily(projectId: string) {
  const { data, error } = await supabaseAdmin
    .from("daily")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function generateDailyAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const type = formData.get("type") as string;

  const fullContext = await buildFullContext();
  const instruction = DAILY_INSTRUCTIONS[type] ?? DAILY_INSTRUCTIONS.quiz;
  const useSearch = type === "paper" || type === "idea";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: dailySystemPrompt(type),
    messages: [{ role: "user", content: `${fullContext}\n\n${instruction}` }],
    ...(useSearch
      ? { tools: [{ type: "web_search_20260209", name: "web_search" }] }
      : {}),
  });

  const content = extractTextBlock(response.content);

  const { error } = await supabaseAdmin
    .from("daily")
    .upsert({ project_id: projectId, date: new Date().toISOString().slice(0, 10), type, content });

  if (error) throw new Error(error.message);
  revalidatePath("/today");
}

export async function sendDailyAnswerAction(formData: FormData) {
  const projectId = formData.get("project_id") as string;
  const text = (formData.get("text") as string)?.trim();
  const target = formData.get("target") as string;
  if (!text || !target) return;

  if (target.startsWith("chapter:")) {
    const chapterId = target.slice("chapter:".length);
    const { data: last } = await supabaseAdmin
      .from("points")
      .select("position")
      .eq("chapter_id", chapterId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (last?.position ?? -1) + 1;

    const { error } = await supabaseAdmin
      .from("points")
      .insert({ chapter_id: chapterId, text, position: nextPosition });
    if (error) throw new Error(error.message);
  } else if (target.startsWith("quick:")) {
    const columnName = target.slice("quick:".length);
    const { error } = await supabaseAdmin
      .from("quick_notes")
      .insert({ project_id: projectId, column_name: columnName, text });
    if (error) throw new Error(error.message);
  } else if (target === "idea") {
    const { error } = await supabaseAdmin
      .from("ideas")
      .insert({ project_id: projectId, text, source: "Aujourd'hui", status: "new" });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/today");
}
