import axios from "axios";
import { PDFParse } from "pdf-parse";
import { supabase } from "@/lib/supabase";

export async function downloadPdfTextFromUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const parser = new PDFParse({ data: response.data });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } catch (error: any) {
    console.warn("PDF Download/Parse Failed (skipping text extraction):", error.message);
    return "";
  }
}

export async function uploadPdfToSupabase(pdfUrl: string, bidNumber: string): Promise<string | null> {
  try {
    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    const fileName = `${bidNumber.replace(/\//g, "-")}.pdf`;

    const { data, error } = await supabase.storage
      .from("tender-documents")
      .upload(fileName, response.data, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from("tender-documents")
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error: any) {
    console.warn("Supabase Storage Upload Skip/Fail:", error.message);
    return null;
  }
}
