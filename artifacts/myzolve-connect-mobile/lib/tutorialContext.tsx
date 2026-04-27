import { useAuth } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { TutorialOverlay } from "@/components/TutorialOverlay";
import {
  hasSeenTutorial,
  resetTutorialSeen,
  setTutorialSeen,
} from "@/lib/tutorialFlag";

// Drives the guided in-app tutorial overlay.  Anyone in the tree can call
// `useTutorial()` to:
//   - `start()`    — open the walkthrough.  Will reset the persisted seen
//                    flag so it actually opens (used by Settings → "Show me
//                    around again").
//   - `maybeAutoStart()` — open it ONLY if the user hasn't seen it before.
//                          Used by the Home screen after onboarding so the
//                          tour kicks off automatically the first time.
//
// On dismiss/finish the provider persists the flag so the tutorial does not
// reappear on the next cold launch.

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
  const { userId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Synchronous in-memory guard so we don't auto-start the tour twice in a
  // single session (e.g. if Home re-mounts after a navigation round-trip, or
  // if multiple effects fire maybeAutoStart() in the same tick before the
  // async storage check resolves).  Persistence is still owned by the flag
  // file.
  const autoStartAttemptedRef = useRef(false);

  // If the signed-in user changes, allow auto-start to fire again for the
  // new user.
  useEffect(() => {
    autoStartAttemptedRef.current = false;
    setIsOpen(false);
  }, [userId]);

  const start = useCallback(() => {
    // Replays from Settings should always open even if the user has seen the
    // tour before — wipe the persisted flag first so any other surface
    // checking it sees a clean slate.
    void resetTutorialSeen(userId);
    setIsOpen(true);
  }, [userId]);

  const maybeAutoStart = useCallback(() => {
    if (!userId) return;
    // Mark synchronously BEFORE awaiting storage so concurrent callers in the
    // same tick don't all kick off parallel checks and each open the modal.
    if (autoStartAttemptedRef.current) return;
    autoStartAttemptedRef.current = true;
    void hasSeenTutorial(userId).then((seen) => {
      if (!seen) setIsOpen(true);
    });
  }, [userId]);

  const close = useCallback(() => {
    setIsOpen(false);
    void setTutorialSeen(userId);
  }, [userId]);

  const value = useMemo<TutorialContextValue>(
    () => ({ isOpen, start, maybeAutoStart, close }),
    [isOpen, start, maybeAutoStart, close],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <TutorialOverlay visible={isOpen} onClose={close} />
    </TutorialContext.Provider>
  );
}
