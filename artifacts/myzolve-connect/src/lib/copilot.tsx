import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/react";
import {
  useListCopilotGrants,
  getListCopilotGrantsQueryKey,
  type CopilotGrant,
} from "@workspace/api-client-react";

interface CopilotContextValue {
  actingFor: Record<number, number | null>;
  setActingFor: (circleId: number, userId: number | null) => void;
  grantsAsHelper: CopilotGrant[];
  grantsAsGrantor: CopilotGrant[];
  pendingInvitesAsHelper: CopilotGrant[];
  isLoading: boolean;
}

const CopilotContext = createContext<CopilotContextValue>({
  actingFor: {},
  setActingFor: () => {},
  grantsAsHelper: [],
  grantsAsGrantor: [],
  pendingInvitesAsHelper: [],
  isLoading: false,
});

export function CopilotProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useUser();
  const [actingFor, setActingForState] = useState<Record<number, number | null>>({});
  const { data, isLoading } = useListCopilotGrants({
    query: {
      enabled: !!isSignedIn,
      queryKey: getListCopilotGrantsQueryKey(),
    },
  });

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
  const pendingInvitesAsHelper = useMemo(
    () => (data?.peopleIHelp ?? []).filter((g) => g.status === "pending"),
    [data],
  );

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
      pendingInvitesAsHelper,
      isLoading,
    }),
    [actingFor, setActingFor, helpers, grantors, pendingInvitesAsHelper, isLoading],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot() {
  return useContext(CopilotContext);
}

export function useCopilotGrantsForCircle(circleId: number): CopilotGrant[] {
  const { grantsAsHelper } = useCopilot();
  return useMemo(
    () => grantsAsHelper.filter((g) => g.circleId === circleId),
    [grantsAsHelper, circleId],
  );
}

export function useActingForInCircle(circleId: number): number | null {
  const { actingFor } = useCopilot();
  const grants = useCopilotGrantsForCircle(circleId);
  const target = actingFor[circleId] ?? null;
  if (target == null) return null;
  const stillActive = grants.some((g) => g.grantorUserId === target);
  return stillActive ? target : null;
}
