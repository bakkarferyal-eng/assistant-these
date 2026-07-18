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

    const [{ PDFParse }, path, { pathToFileURL }, fs] = await Promise.all([
      import("pdf-parse"),
      import("node:path"),
      import("node:url"),
      import("node:fs"),
    ]);

    const workerPath = path.join(
      process.cwd(),
      "node_modules/pdf-parse/dist/worker/pdf.worker.mjs"
    );
    const workerExists = fs.existsSync(workerPath);

    PDFParse.setWorker(pathToFileURL(workerPath).href);

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return NextResponse.json({
        success: true,
        filename: upload.filename,
        cwd: process.cwd(),
        workerPath,
        workerExists,
        textLength: result.text.length,
        preview: result.text.slice(0, 200),
      });
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    return NextResponse.json({
      success: false,
      cwd: process.cwd(),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}
