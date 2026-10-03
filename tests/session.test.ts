import { describe, expect, it, vi } from "vitest";
import { createElement } from "../mobile/node_modules/react/index.js";
import { renderToStaticMarkup } from "../mobile/node_modules/react-dom/server.node.js";
import { SessionProvider } from "../mobile/src/lib/SessionProvider";
import { useSession } from "../mobile/src/lib/session";

// Native storage/speech are irrelevant to the provider/context wiring regression.
vi.mock("../mobile/src/lib/session-state", () => ({
  useSessionState: () => ({ message: "HELLO" }),
}));
function Message() {
  return createElement("span", null, useSession().message);
}
describe("mobile session context", () => {
  it("shares the root provider's message with a nested screen", () => {
    expect(
      renderToStaticMarkup(
        createElement(
          SessionProvider,
          null,
          createElement("div", null, createElement(Message)),
        ),
      ),
    ).toBe("<div><span>HELLO</span></div>");
  });
  it("keeps the same context when the provider module is re-evaluated", async () => {
    // A fresh provider module must still use the context that existing consumers use.
    const refreshed =
      await import("../mobile/src/lib/SessionProvider.tsx?refresh-test");
    expect(
      renderToStaticMarkup(
        createElement(refreshed.SessionProvider, null, createElement(Message)),
      ),
    ).toBe("<span>HELLO</span>");
  });
  it("still reports a genuinely missing provider", () => {
    expect(() => renderToStaticMarkup(createElement(Message))).toThrow(
      "SessionProvider missing",
    );
  });
});
