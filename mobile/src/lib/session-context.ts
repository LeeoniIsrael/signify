import { createContext } from "react";
import type { useSessionState } from "./session-state";

// Keep context identity outside the provider's Fast Refresh boundary.
export const SessionContext = createContext<ReturnType<
  typeof useSessionState
> | null>(null);
