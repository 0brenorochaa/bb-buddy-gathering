import { attendanceLabel } from "@/lib/rsvp-model";
import {
  displayRelation,
  formatWhen,
  type RsvpRecord,
  type Stats,
} from "@/lib/rsvp-model";
import * as XLSX from "xlsx";

const NAVY: [number, number, number] = [0.055, 0.153, 0.267];
const GOLD: [number, number, number] = [0.776, 0.631, 0.357];
const INK: [number, number, number] = [0.078, 0.125, 0.2];
const MUTED: [number, number, number] = [0.36, 0.42, 0.48];
const PAPER: [number, number, number] = [0.965, 0.945, 0.906];
const WHITE: [number, number, number] = [1, 1, 1];

function pdfText(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;
    let byte = 63;
    if (code === 9 || code === 10) byte = 32;
    else if (code < 128) byte = code;
    else if (code >= 160 && code <= 255) byte = code;
    if (byte === 40 || byte === 41 || byte === 92) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const chars = [...clean];
  if (chars.length <= max) return clean;
  return `${chars.slice(0, Math.max(1, max - 3)).join("")}...`;
}

function drawText(
  content: string,
  x: number,
  y: number,
  size: number,
  bold: boolean,
  color: [number, number, number],
) {
  const font = bold ? "/F2" : "/F1";
  return `${color.join(" ")} rg BT ${font} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfText(content)}) Tj ET\n`;
}

function fill(x: number, y: number, w: number, h: number, color: [number, number, number]) {
  return `${color.join(" ")} rg ${x} ${y} ${w} ${h} re f\n`;
}

function situation(row: RsvpRecord): string {
  return row.attending ? "Vai participar" : row.undecided ? "Ainda não sabe" : "Não vai";
}

function companionFlag(row: RsvpRecord): string {
  if (!row.attending) return "-";
  return row.hasCompanion ? "Sim" : "Não";
}

function assemblePdf(contents: string[]): string {
  const width = 842;
  const height = 595;
  const objects: string[] = [];
  const pageIds = contents.map((_, index) => 5 + index * 2);
  const contentIds = contents.map((_, index) => 6 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] =
    `<< /Type /Pages /Count ${contents.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  contents.forEach((stream, index) => {
    const pageId = pageIds[index]!;
    const contentId = contentIds[index]!;
    const length = new TextEncoder().encode(stream).length;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${length} >>\nstream\n${stream}endstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  const maxId = 4 + contents.length * 2;
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export function buildAttendancePdf(rows: RsvpRecord[], stats: Stats): string {
  const generated = formatWhen(new Date().toISOString());
  const firstCap = 15;
  const nextCap = 24;
  const pages: RsvpRecord[][] = [];
  if (rows.length === 0) pages.push([]);
  else {
    pages.push(rows.slice(0, firstCap));
    for (let index = firstCap; index < rows.length; index += nextCap) {
      pages.push(rows.slice(index, index + nextCap));
    }
  }

  const streams = pages.map((chunk, pageIndex) => {
    let content = fill(0, 0, 842, 595, PAPER);
    content += fill(0, 548, 842, 47, NAVY);
    content += fill(0, 548, 842, 3, GOLD);
    content += drawText("BB Confraternização 2026", 36, 568, 16, true, WHITE);
    content += drawText(
      `Página ${pageIndex + 1} de ${pages.length}`,
      700,
      568,
      9,
      false,
      GOLD,
    );

    let y = 526;
    if (pageIndex === 0) {
      content += drawText("Relatório de confirmações de presença", 36, y, 13, true, NAVY);
      y -= 20;
      content += drawText(
        `Cadastrados: ${stats.registered}    Vão participar: ${stats.attending}    Não vão: ${stats.absent}    Ainda não sabem: ${stats.undecided}    Acompanhantes: ${stats.companions}    Total geral confirmado: ${stats.confirmedPeople}`,
        36,
        y,
        9,
        false,
        INK,
      );
      y -= 14;
      content += drawText(
        "Acompanhantes só entram na conta quando a pessoa confirmou que vai participar.",
        36,
        y,
        8,
        false,
        MUTED,
      );
      y -= 22;
    }

    const headers: Array<[string, number]> = [
      ["Participante", 40],
      ["Situação", 228],
      ["Acomp.", 328],
      ["Nome do acompanhante", 390],
      ["Parentesco", 575],
      ["Data", 700],
      ["Hora", 768],
    ];
    content += fill(36, y - 4, 770, 16, NAVY);
    for (const [label, x] of headers) content += drawText(label, x, y, 8, true, WHITE);
    y -= 18;

    if (chunk.length === 0) {
      content += drawText("Nenhum registro ainda.", 40, y, 10, false, INK);
    }

    chunk.forEach((row, index) => {
      if (index % 2 === 0) content += fill(36, y - 4, 770, 16, WHITE);
      const when = formatWhen(row.createdAt);
      const cells: Array<[string, number]> = [
        [clip(row.fullName, 32), 40],
        [situation(row), 228],
        [companionFlag(row), 328],
        [
          row.attending && row.hasCompanion ? clip(row.companionName, 30) : "-",
          390,
        ],
        [
          row.attending && row.hasCompanion
            ? clip(displayRelation(row.companionRelation, row.companionRelationNote), 20)
            : "-",
          575,
        ],
        [when.date, 700],
        [when.time, 768],
      ];
      for (const [label, x] of cells) content += drawText(label, x, y, 8, false, INK);
      y -= 16;
    });

    content += drawText(
      `Documento restrito aos organizadores · Gerado em ${generated.date} às ${generated.time} (Brasília).`,
      36,
      22,
      8,
      false,
      MUTED,
    );
    if (!content.endsWith("\n")) content += "\n";
    return content;
  });

  return assemblePdf(streams);
}

function participantRows(rows: RsvpRecord[]): Array<Array<string | number>> {
  return rows.map((row) => {
    const when = formatWhen(row.createdAt);
    const withCompanion = row.attending && row.hasCompanion;
    return [
      row.fullName,
      attendanceLabel(row),
      withCompanion ? "Sim" : "Não",
      withCompanion ? row.companionName : "",
      withCompanion ? displayRelation(row.companionRelation, row.companionRelationNote) : "",
      when.date,
      when.time,
    ];
  });
}

export function downloadReport(kind: "pdf" | "xlsx", rows: RsvpRecord[], stats: Stats) {
  if (kind === "pdf") {
    const pdf = buildAttendancePdf(rows, stats);
    const blob = new Blob([pdf], { type: "application/pdf" });
    triggerDownload(blob, "BB-Confraternizacao-2026.pdf");
    return;
  }

  const summary: Array<Array<string | number>> = [
    ["BB Confraternização 2026"],
    ["Relatório de confirmação de presença"],
    [],
    ["Participantes cadastrados", stats.registered],
    ["Vão participar", stats.attending],
    ["Não vão participar", stats.absent],
    ["Ainda não sabem", stats.undecided],
    ["Acompanhantes", stats.companions],
    ["Total geral de pessoas confirmadas", stats.confirmedPeople],
    [],
    ["Acompanhantes de quem não vai participar não entram no total geral."],
  ];
  const table: Array<Array<string | number>> = [
    [
      "Participante",
      "Situação",
      "Levará acompanhante",
      "Nome do acompanhante",
      "Parentesco",
      "Data da confirmação",
      "Horário da confirmação",
    ],
    ...participantRows(rows),
    [],
    ["Total de participantes cadastrados", stats.registered],
    ["Total que vão participar", stats.attending],
    ["Total que não vão participar", stats.absent],
    ["Total que ainda não sabem", stats.undecided],
    ["Total de acompanhantes", stats.companions],
    ["Total geral de pessoas confirmadas", stats.confirmedPeople],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(summary), "Resumo");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(table), "Participantes");
  XLSX.writeFile(book, "BB-Confraternizacao-2026.xlsx");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
