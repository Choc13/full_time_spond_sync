import { TEAMS } from "../config";
import { summariseOperations } from "../domain/describe";
import type { Operation, PreviewRow, PreviewSection, Team } from "../domain/types";

declare const __VERSION__: string;

export const chooseTeam = async (): Promise<Team | null> => {
  const alert = new Alert();
  alert.title = "Which team?";
  alert.message = `FA Spond Sync ${__VERSION__}`;
  TEAMS.forEach((team) => alert.addAction(team.name));
  alert.addCancelAction("Cancel");
  const choice = await alert.presentSheet();
  return choice === -1 ? null : TEAMS[choice];
};

export const showMessage = async (title: string, message: string): Promise<void> => {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addCancelAction("OK");
  await alert.presentAlert();
};

const lineCount = (text: string, perLine: number): number => text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);

const previewRow = (row: PreviewRow): UITableRow => {
  const colours: Partial<Record<PreviewRow["kind"], Color>> = { added: Color.green(), modified: Color.orange(), removed: Color.red(), blocked: Color.red() };
  const tableRow = new UITableRow();
  const cell = tableRow.addText(row.title, row.subtitle);
  cell.titleFont = Font.semiboldSystemFont(14);
  cell.subtitleFont = Font.systemFont(13);
  const colour = colours[row.kind];
  if (colour) cell.titleColor = colour;
  tableRow.height = 18 + 18 * lineCount(row.title, 40) + (row.subtitle ? 17 * lineCount(row.subtitle, 44) : 0);
  return tableRow;
};

const headerRow = (section: PreviewSection): UITableRow => {
  const row = new UITableRow();
  row.isHeader = true;
  row.addText(section.title, section.summary);
  row.height = 56;
  return row;
};

export const showPreview = async (sections: PreviewSection[], operations: Operation[]): Promise<boolean> => {
  let approved = false;
  const table = new UITable();
  if (operations.length > 0) {
    const apply = new UITableRow();
    apply.addButton(`Apply: ${summariseOperations(operations)}`).centerAligned();
    apply.height = 56;
    apply.dismissOnSelect = true;
    apply.onSelect = () => {
      approved = true;
    };
    table.addRow(apply);
  }
  sections.forEach((section) => {
    table.addRow(headerRow(section));
    section.rows.forEach((row) => table.addRow(previewRow(row)));
  });
  await table.present(true);
  return approved;
};

export const confirmApply = async (operations: Operation[]): Promise<boolean> => {
  const alert = new Alert();
  alert.title = "Update Spond?";
  alert.message = summariseOperations(operations);
  if (operations.some((o) => o.kind === "delete")) alert.addDestructiveAction("Apply");
  else alert.addAction("Apply");
  alert.addCancelAction("Cancel");
  return (await alert.presentAlert()) === 0;
};
