import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Aucun projet trouvé" }, { status: 404 });
  }

  const { data: chapters } = await supabaseAdmin
    .from("chapters")
    .select("*, chapter_data(writing)")
    .eq("project_id", project.id)
    .order("position", { ascending: true });

  const { data: references } = await supabaseAdmin
    .from("references")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  const children: Paragraph[] = [
    new Paragraph({ text: "Mémoire", heading: HeadingLevel.TITLE }),
  ];

  if (project.context) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: project.context, italics: true })],
      })
    );
  }

  for (const chapter of chapters ?? []) {
    children.push(new Paragraph({ text: chapter.name, heading: HeadingLevel.HEADING_1 }));

    const chapterData = Array.isArray(chapter.chapter_data)
      ? chapter.chapter_data[0]
      : chapter.chapter_data;
    const writing: string | null | undefined = chapterData?.writing;

    if (writing && writing.trim()) {
      for (const line of writing.split(/\n+/)) {
        if (line.trim()) children.push(new Paragraph({ text: line.trim() }));
      }
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "(pas encore rédigé)", italics: true })],
        })
      );
    }
  }

  if (references && references.length > 0) {
    children.push(new Paragraph({ text: "Références", heading: HeadingLevel.HEADING_1 }));
    references.forEach((ref, i) => {
      children.push(new Paragraph({ text: `[${i + 1}] ${ref.formatted || ref.raw}` }));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=memoire.docx",
    },
  });
}
