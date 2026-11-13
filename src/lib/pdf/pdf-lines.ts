// 2026-11-13 — a PDF ticket's text layer as lines, the way a picture's OCR
// gives them: the rules in picture-task.ts read line by line ("Fecha
// visita Inicio Fin" above "14/11/2026 19:30 21:30"). pdf.js hands out
// pieces of text with positions, in no promised order — these are put
// back into rows, top to bottom, each left to right.

/** The part of a pdf.js text item this reads. */
export type PdfTextItem = {
  str: string;
  /** [a, b, c, d, x, y] — x and y of the baseline's start, y up. */
  transform: number[];
  width: number;
  height: number;
};

export function pdfItemsToLines(items: PdfTextItem[]): string[] {
  const pieces = items
    .filter((item) => item.str.trim() !== "")
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      end: item.transform[4] + item.width,
      height: item.height || 10,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  // One row: baselines closer than half a letter's height.
  const rows: (typeof pieces)[] = [];
  for (const piece of pieces) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - piece.y) <= row[0].height / 2) {
      row.push(piece);
    } else {
      rows.push([piece]);
    }
  }

  return rows
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let end = -Infinity;
      for (const piece of row) {
        // Pieces of one word sit edge to edge; a gap is a space.
        const gap = piece.x - end > piece.height * 0.15;
        line += line && gap ? ` ${piece.text}` : piece.text;
        end = piece.end;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}
