import type { ReactNode } from "react";
import { SessionContext } from "./session-context";
import { useSessionState } from "./session-state";

// This component owns the refresh boundary; the context object stays stable.
export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionState();
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
