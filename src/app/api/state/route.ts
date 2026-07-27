import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// Read-only snapshot of the whole project, meant for the companion
// artifact (opened next to a Claude chat) to display live data without
// going through the app's own pages.
export async function GET() {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Aucun projet trouvé" }, { status: 404, headers: corsHeaders });
  }

  const { data: chapters } = await supabaseAdmin
    .from("chapters")
    .select("*, points(*), chapter_data(sequence, writing)")
    .eq("project_id", project.id)
    .order("position", { ascending: true });

  const { data: quickNotes } = await supabaseAdmin
    .from("quick_notes")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  const { data: ideas } = await supabaseAdmin
    .from("ideas")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const { data: references } = await supabaseAdmin
    .from("references")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  const { data: journal } = await supabaseAdmin
    .from("journal")
    .select("*")
    .eq("project_id", project.id)
    .order("date", { ascending: false })
    .limit(10);

  const shaped = {
    project: {
      context: project.context,
      objectif: project.objectif,
      modele: project.modele,
      roadmap: project.roadmap,
    },
    chapters: (chapters ?? []).map((c) => {
      const cd = Array.isArray(c.chapter_data) ? c.chapter_data[0] : c.chapter_data;
      const progress = cd?.writing?.trim()
        ? "final"
        : cd?.sequence
        ? "generated"
        : (c.points?.length ?? 0) > 0
        ? "notes"
        : "empty";
      return {
        name: c.name,
        status: c.status,
        progress,
        page_limit: c.page_limit,
        style_note: c.style_note,
        points: (c.points ?? []).map((p: { text: string }) => p.text),
      };
    }),
    quick_notes: (quickNotes ?? []).map((n) => ({ column: n.column_name, text: n.text })),
    ideas: (ideas ?? []).map((i) => ({ text: i.text, status: i.status, source: i.source })),
    references: (references ?? []).map((r) => r.formatted || r.raw),
    journal_recent: (journal ?? []).map((j) => ({ date: j.date, text: j.text })),
  };

  return NextResponse.json(shaped, { headers: corsHeaders });
}
