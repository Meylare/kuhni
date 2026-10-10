import { useCallback, useEffect, useRef, useState } from "react";

export interface PendingDeleteAction {
  id: string;
  label: string;
  executeDelete: () => Promise<void> | void;
  restore: () => void;
}

export function useUndoDelete() {
  const [pendingAction, setPendingAction] = useState<PendingDeleteAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActionRef = useRef<PendingDeleteAction | null>(null);
  pendingActionRef.current = pendingAction;

  const flushPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingActionRef.current) {
      void pendingActionRef.current.executeDelete();
      setPendingAction(null);
    }
  }, []);

  const scheduleDelete = useCallback(
    (action: PendingDeleteAction) => {
      // Если уже было действие в очереди — применяем его немедленно
      if (pendingActionRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        void pendingActionRef.current.executeDelete();
      }

      setPendingAction(action);

      timerRef.current = setTimeout(() => {
        if (pendingActionRef.current?.id === action.id) {
          void pendingActionRef.current.executeDelete();
          setPendingAction(null);
          timerRef.current = null;
        }
      }, 6000);
    },
    [],
  );

  const undoDelete = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingActionRef.current) {
      pendingActionRef.current.restore();
      setPendingAction(null);
    }
  }, []);

  // Очистка при размонтировании — применяем удаление
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (pendingActionRef.current) {
        void pendingActionRef.current.executeDelete();
      }
    };
  }, []);

  return {
    pendingAction,
    scheduleDelete,
    undoDelete,
    flushPending,
  };
}
