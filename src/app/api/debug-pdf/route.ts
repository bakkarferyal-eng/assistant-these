import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: upload } = await supabaseAdmin
      .from("uploads")
      .select("storage_path, filename")
      .eq("file_type", "application/pdf")
      .limit(1)
      .maybeSingle();

    if (!upload) {
      return NextResponse.json({ error: "no pdf upload found in DB" });
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("uploads")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({
        error: "download failed",
        downloadError: downloadError?.message,
      });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });

    return NextResponse.json({
      success: true,
      filename: upload.filename,
      totalPages: result.totalPages,
      textLength: result.text.length,
      preview: result.text.slice(0, 200),
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}
