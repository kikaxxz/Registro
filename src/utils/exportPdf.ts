import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { Attendance } from "../types";
import {
  dayKey,
  formatDay,
  formatTime,
  minutesLabel,
  summarize,
  totalsOf,
} from "./time.ts";

export interface ReportFilter {
  from: string;
  to: string;
  employee: string;
  showEmployee: boolean;
}
export function createAttendancePdf(
  records: Attendance[],
  filter: ReportFilter,
  generatedAt = new Date(),
) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const total = summarize(records);
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setProperties({
    title: "Historial de asistencia · Electricidad",
    author: "Registro · Electricidad",
  });
  pdf.setFillColor(24, 48, 45);
  pdf.rect(0, 0, pageWidth, 25, "F");
  pdf.setTextColor(255);
  pdf.setFontSize(19);
  pdf.text("Registro de asistencia", 14, 16);
  pdf.setTextColor(24, 48, 45);
  pdf.setFontSize(10);
  pdf.text(
    `Electricidad | ${filter.from} al ${filter.to} | Hora de Nicaragua`,
    14,
    34,
  );
  const employeeLines = pdf.splitTextToSize(
    `Personal: ${filter.employee}`,
    pageWidth - 28,
  );
  pdf.text(employeeLines, 14, 41);
  let y = 41 + employeeLines.length * 5;
  pdf.setFontSize(9);
  pdf.text(
    `${records.length} registros | Trabajado: ${minutesLabel(total.workedMinutes)} | Normal: ${minutesLabel(total.normalMinutes)} | Extra: ${minutesLabel(total.overtimeMinutes)}`,
    14,
    y + 3,
  );
  pdf.setTextColor(85);
  const note = pdf.splitTextToSize(
    "Horario declarado: horas escritas por el trabajador; Guardado: confirmación del servidor. Los totales incluyen solo jornadas finalizadas. Cada registro conserva la regla de horas extra vigente al guardarse (al iniciarse en marcaciones anteriores).",
    pageWidth - 28,
  );
  pdf.text(note, 14, y + 10);
  y += 14 + note.length * 4;
  const body = records.map((record) => {
    const totals = totalsOf(record);
    const exit = record.exitTime?.toDate();
    const entry = record.entryTime.toDate();
    return [
      ...(filter.showEmployee ? [record.employeeName] : []),
      dayKey(entry),
      formatTime(entry),
      exit
        ? `${formatTime(exit)}${dayKey(exit) !== dayKey(entry) ? `\n${dayKey(exit)}` : ""}`
        : "Sin salida",
      exit ? minutesLabel(totals.workedMinutes) : "-",
      exit ? minutesLabel(totals.overtimeMinutes) : "-",
      record.source === "manual" ? "Horario declarado" : "Marcación anterior",
      record.submittedAt
        ? `${dayKey(record.submittedAt.toDate())}\n${formatTime(record.submittedAt.toDate())}`
        : "-",
    ];
  });
  autoTable(pdf, {
    startY: y,
    margin: { left: 14, right: 14, top: 15, bottom: 19 },
    head: [
      [
        ...(filter.showEmployee ? ["Trabajador"] : []),
        "Fecha",
        "Entrada",
        "Salida",
        "Trabajado",
        "Extra",
        "Origen",
        "Guardado",
      ],
    ],
    body: body.length
      ? body
      : [
          [
            {
              content: "No hay registros en el período seleccionado.",
              colSpan: filter.showEmployee ? 8 : 7,
            },
          ],
        ],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: { fillColor: [24, 48, 45] },
    alternateRowStyles: { fillColor: [242, 246, 245] },
    rowPageBreak: "avoid",
    showHead: "everyPage",
  });
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text(
      `Registro · Electricidad | Exportado: ${formatDay(generatedAt)} ${formatTime(generatedAt)}`,
      14,
      201,
    );
    pdf.text(`Página ${i} de ${pages}`, pageWidth - 14, 201, {
      align: "right",
    });
  }
  return pdf;
}
export function exportAttendancePdf(
  records: Attendance[],
  filter: ReportFilter,
) {
  createAttendancePdf(records, filter).save(
    `registro-${filter.from}-a-${filter.to}.pdf`,
  );
}
