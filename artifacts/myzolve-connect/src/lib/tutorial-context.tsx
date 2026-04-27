import { useUser } from "@clerk/react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TutorialOverlay } from "@/components/tutorial-overlay";
import {
  hasSeenTutorial,
  resetTutorialSeen,
  setTutorialSeen,
} from "@/lib/tutorialFlag";

// Drives the guided in-app tutorial overlay on web.  Mirrors the mobile
// `useTutorial()` API:
//   - `start()`          — replay the tour from Settings; wipes the persisted
//                          flag and opens the overlay.
//   - `maybeAutoStart()` — first-time auto-launch, used on the dashboard.
//   - `close()`          — finish or skip; persists the seen flag.

type TutorialContextValue = {
  isOpen: boolean;
  start: () => void;
  maybeAutoStart: () => void;
  close: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used inside <TutorialProvider>");
  }
  return ctx;
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [autoStartedThisSession, setAutoStartedThisSession] = useState(false);

  useEffect(() => {
    setAutoStartedThisSession(false);
    setIsOpen(false);
  }, [userId]);

  const start = useCallback(() => {
    resetTutorialSeen(userId);
    setIsOpen(true);
  }, [userId]);

  const maybeAutoStart = useCallback(() => {
    if (!userId || autoStartedThisSession) return;
    setAutoStartedThisSession(true);
    if (!hasSeenTutorial(userId)) setIsOpen(true);
  }, [userId, autoStartedThisSession]);

  const close = useCallback(() => {
    setIsOpen(false);
    setTutorialSeen(userId);
  }, [userId]);

  const value = useMemo<TutorialContextValue>(
    () => ({ isOpen, start, maybeAutoStart, close }),
    [isOpen, start, maybeAutoStart, close],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <TutorialOverlay open={isOpen} onClose={close} />
    </TutorialContext.Provider>
  );
}
