import { promises as fs } from "node:fs";
import pdf from "pdf-parse";

/**
 * Extract plain text from a PDF buffer using pdf-parse.
 * This runs locally (no network).
 */
export async function extractPdfText(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  const data = await pdf(buf);
  // Normalize whitespace to make downstream parsing more reliable
  return (data.text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
