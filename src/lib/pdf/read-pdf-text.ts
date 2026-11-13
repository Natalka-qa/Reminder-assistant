import "server-only";
import { getDocumentProxy } from "unpdf";
import { pdfItemsToLines, type PdfTextItem } from "./pdf-lines";

// 2026-11-13 — a PDF's own text (a ticket or a booking made by a program
// has it), read on our server by pdf.js (unpdf's serverless build): free,
// no keys, nothing kept — like the pictures (sprint-24-tasks.md решение
// 11, 13). A scan has no text: "" — the caller asks for a screenshot.

/** A ticket's date is on its first pages; a 40-page manual isn't a ticket. */
export const PDF_MAX_PAGES = 3;

export async function readPdfText(pdf: Buffer): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(pdf));
  try {
    const lines: string[] = [];
    const pages = Math.min(document.numPages, PDF_MAX_PAGES);
    for (let number = 1; number <= pages; number++) {
      const page = await document.getPage(number);
      const { items } = await page.getTextContent();
      lines.push(
        ...pdfItemsToLines(
          items.filter(
            (item): item is PdfTextItem & typeof item => "str" in item,
          ),
        ),
      );
    }
    return lines.join("\n");
  } finally {
    await document.loadingTask.destroy();
  }
}
