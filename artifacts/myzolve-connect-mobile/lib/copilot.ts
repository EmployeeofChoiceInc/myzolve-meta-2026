import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useListCopilotGrants,
  type CopilotGrant,
} from "@workspace/api-client-react";

interface CopilotContextValue {
  // Map of circleId -> the user we're currently posting on behalf of (null = post as self)
  actingFor: Record<number, number | null>;
  setActingFor: (circleId: number, userId: number | null) => void;
  // All grants where I am the helper (i.e. people I help)
  grantsAsHelper: CopilotGrant[];
  // All grants where I am the represented member (i.e. people who help me)
  grantsAsGrantor: CopilotGrant[];
  isLoading: boolean;
}

const CopilotContext = createContext<CopilotContextValue>({
  actingFor: {},
  setActingFor: () => {},
  grantsAsHelper: [],
  grantsAsGrantor: [],
  isLoading: false,
});

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [actingFor, setActingForState] = useState<Record<number, number | null>>({});
  const { data, isLoading } = useListCopilotGrants();

  const setActingFor = useCallback((circleId: number, userId: number | null) => {
    setActingForState((prev) => ({ ...prev, [circleId]: userId }));
  }, []);

  const helpers = useMemo(
    () => (data?.peopleIHelp ?? []).filter((g) => g.status === "active"),
    [data],
  );
  const grantors = useMemo(
    () => (data?.peopleWhoHelpMe ?? []).filter((g) => g.status === "active"),
    [data],
  );

  // Sanitize: if a grant is no longer active (revoked/declined/etc.),
  // drop the corresponding "acting for" entry so compose flows can't
  // submit a stale actingForUserId.
  useEffect(() => {
    if (!data) return;
    setActingForState((prev) => {
      let changed = false;
      const next: Record<number, number | null> = {};
      for (const [circleIdStr, userId] of Object.entries(prev)) {
        const circleId = Number(circleIdStr);
        if (userId == null) {
          next[circleId] = null;
          continue;
        }
        const stillActive = helpers.some(
          (g) => g.circleId === circleId && g.grantorUserId === userId,
        );
        if (stillActive) {
          next[circleId] = userId;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data, helpers]);

  const value = useMemo<CopilotContextValue>(
    () => ({
      actingFor,
      setActingFor,
      grantsAsHelper: helpers,
      grantsAsGrantor: grantors,
      isLoading,
    }),
    [actingFor, setActingFor, helpers, grantors, isLoading],
  );

  return React.createElement(CopilotContext.Provider, { value }, children);
}

export function useCopilot() {
  return useContext(CopilotContext);
}

/**
 * Returns the active grants where the current user can act on behalf of
 * someone else in this specific circle.
 */
export function useCopilotGrantsForCircle(circleId: number): CopilotGrant[] {
  const { grantsAsHelper } = useCopilot();
  return useMemo(
    () => grantsAsHelper.filter((g) => g.circleId === circleId),
    [grantsAsHelper, circleId],
  );
}

/**
 * Convenience: returns the userId we're currently acting on behalf of in
 * this circle (or null when posting as self). Defensively returns null
 * when no active grant exists for that target — so callers never submit
 * a stale actingForUserId.
 */
export function useActingForInCircle(circleId: number): number | null {
  const { actingFor } = useCopilot();
  const grants = useCopilotGrantsForCircle(circleId);
  const target = actingFor[circleId] ?? null;
  if (target == null) return null;
  const stillActive = grants.some((g) => g.grantorUserId === target);
  return stillActive ? target : null;
}
