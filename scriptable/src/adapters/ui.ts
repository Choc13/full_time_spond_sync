import { summariseOperations } from "../domain/describe";
import type { Operation, PreviewRow, PreviewSection } from "../domain/types";

declare const __VERSION__: string;

export const pick = async (title: string, message: string, options: string[]): Promise<number | null> => {
  const alert = new Alert();
  alert.title = title;
  alert.message = title === "FA Spond Sync" ? [message, `Version ${__VERSION__}`].filter(Boolean).join("\n\n") : message;
  options.forEach((option) => alert.addAction(option));
  alert.addCancelAction("Cancel");
  const choice = await alert.presentSheet();
  return choice === -1 ? null : choice;
};

export const askText = async (title: string, message: string, initial = ""): Promise<string | null> => {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addTextField("", initial);
  alert.addAction("OK");
  alert.addCancelAction("Cancel");
  if ((await alert.presentAlert()) === -1) return null;
  return alert.textFieldValue(0);
};

export const confirm = async (title: string, message: string, action: string, destructive: boolean): Promise<boolean> => {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  if (destructive) alert.addDestructiveAction(action);
  else alert.addAction(action);
  alert.addCancelAction("Cancel");
  return (await alert.presentAlert()) === 0;
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
  const colours: Partial<Record<PreviewRow["kind"], Color>> = { added: Color.green(), modified: Color.orange(), removed: Color.red(), kept: Color.gray(), blocked: Color.red() };
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
