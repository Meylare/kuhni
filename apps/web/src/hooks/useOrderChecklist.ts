import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeChecklistProgress,
  createInitialOrderChecklist,
  loadOrderChecklist,
  readChecklistFromLocal,
  syncChecklistItemToDb,
  toggleChecklistItem,
  updateChecklistItemNote,
} from "../lib/checklists";
import type { OrderChecklist } from "../types/database";

export function useOrderChecklist(orderId: string) {
  const [checklist, setChecklist] = useState<OrderChecklist>(() => {
    return readChecklistFromLocal(orderId) ?? createInitialOrderChecklist(orderId);
  });
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void loadOrderChecklist(orderId).then((loaded) => {
      if (active) {
        setChecklist(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  const checklistProgress = useMemo(
    () => computeChecklistProgress(checklist),
    [checklist],
  );

  const handleToggleChecklistItem = useCallback((itemCode: string) => {
    setChecklist((prev) => {
      const next = toggleChecklistItem(prev, itemCode);
      void syncChecklistItemToDb(next, itemCode);
      return next;
    });
  }, []);

  const handleUpdateChecklistItemNote = useCallback(
    (itemCode: string, note: string) => {
      setChecklist((prev) => {
        const next = updateChecklistItemNote(prev, itemCode, note);
        void syncChecklistItemToDb(next, itemCode);
        return next;
      });
    },
    [],
  );

  return {
    checklist,
    checklistProgress,
    isChecklistOpen,
    setIsChecklistOpen,
    handleToggleChecklistItem,
    handleUpdateChecklistItemNote,
  };
}
