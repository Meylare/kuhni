import { describe, expect, it } from "vitest";
import {
  computeChecklistProgress,
  createInitialOrderChecklist,
  formatMeasurementChecklistReport,
  groupChecklistItemsByBlock,
  MEASUREMENT_CHECKLIST_ITEMS,
  MEASUREMENT_CHECKLIST_TITLE,
  toggleChecklistItem,
  updateChecklistItemNote,
} from "./checklists";

describe("measurement checklist logic", () => {
  it("contains all 5 blocks and 18 items in the default measurement checklist template", () => {
    expect(MEASUREMENT_CHECKLIST_TITLE).toBe("Единый чек-лист замера мебельного объекта");
    expect(MEASUREMENT_CHECKLIST_ITEMS).toHaveLength(18);

    const codes = MEASUREMENT_CHECKLIST_ITEMS.map((i) => i.item_code);
    expect(codes).toEqual([
      "1.1",
      "1.2",
      "1.3",
      "1.4",
      "2.1",
      "2.2",
      "2.3",
      "2.4",
      "2.5",
      "3.1",
      "3.2",
      "3.3",
      "3.4",
      "4.1",
      "4.2",
      "5.1",
      "5.2",
      "5.3",
    ]);
  });

  it("initializes an unchecked order checklist and groups items into 5 blocks", () => {
    const checklist = createInitialOrderChecklist("order-123");
    expect(checklist.order_id).toBe("order-123");
    expect(checklist.status).toBe("in_progress");
    expect(checklist.items).toHaveLength(18);

    const progress = computeChecklistProgress(checklist);
    expect(progress).toEqual({
      total: 18,
      checked: 0,
      notesCount: 0,
      percent: 0,
      isAllChecked: false,
    });

    const blocks = groupChecklistItemsByBlock(checklist.items);
    expect(blocks).toHaveLength(5);
    expect(blocks[0].blockNumber).toBe(1);
    expect(blocks[0].items).toHaveLength(4);
    expect(blocks[1].blockNumber).toBe(2);
    expect(blocks[1].items).toHaveLength(5);
    expect(blocks[2].blockNumber).toBe(3);
    expect(blocks[2].items).toHaveLength(4);
    expect(blocks[3].blockNumber).toBe(4);
    expect(blocks[3].items).toHaveLength(2);
    expect(blocks[4].blockNumber).toBe(5);
    expect(blocks[4].items).toHaveLength(3);
  });

  it("toggles item check state and updates progress and completion status", () => {
    let checklist = createInitialOrderChecklist("order-123");

    checklist = toggleChecklistItem(checklist, "1.1");
    const item11 = checklist.items.find((i) => i.item_code === "1.1");
    expect(item11?.is_checked).toBe(true);
    expect(computeChecklistProgress(checklist).checked).toBe(1);
    expect(computeChecklistProgress(checklist).percent).toBe(6);

    // Toggle all items on
    for (const item of checklist.items) {
      checklist = toggleChecklistItem(checklist, item.item_code, true);
    }

    const fullProgress = computeChecklistProgress(checklist);
    expect(fullProgress.checked).toBe(18);
    expect(fullProgress.percent).toBe(100);
    expect(fullProgress.isAllChecked).toBe(true);
    expect(checklist.status).toBe("completed");
  });

  it("updates item note and formats a readable report for WhatsApp/Technologist", () => {
    let checklist = createInitialOrderChecklist("order-123");
    checklist = toggleChecklistItem(checklist, "1.1", true);
    checklist = updateChecklistItemNote(
      checklist,
      "1.1",
      "По полу 3180 мм, пояс 3175 мм, верх 3170 мм",
    );
    checklist = updateChecklistItemNote(checklist, "3.1", "Высота столешницы 900 мм");

    const progress = computeChecklistProgress(checklist);
    expect(progress.notesCount).toBe(2);

    const report = formatMeasurementChecklistReport("Кухня ЖК Астана", "Айгуль", checklist);
    expect(report).toContain("Кухня ЖК Астана");
    expect(report).toContain("Айгуль");
    expect(report).toContain("1 / 18");
    expect(report).toContain("1.1. Ширина и глубина в 3 уровнях");
    expect(report).toContain("По полу 3180 мм, пояс 3175 мм, верх 3170 мм");
    expect(report).toContain("Высота столешницы 900 мм");
  });
});
