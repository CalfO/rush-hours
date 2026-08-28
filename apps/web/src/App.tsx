import { PrimeReactProvider } from "@primereact/core";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { router } from "./router";

/**
 * `PrimeReactProvider` is required at the app root for any PrimeReact
 * component, Primitive layer included — it doesn't apply a theme (spec
 * §2.1 forbids one), it only makes the primitives' shared context
 * available (see .claude/skills/primereact §Theming and the PrimeReact
 * docs). `WorkScheduleModal` (built on the `Dialog`/`Select`/etc.
 * Primitives) is this app's first real PrimeReact consumer, so this wiring
 * is new in this lot.
 */
function App() {
  return (
    <PrimeReactProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PrimeReactProvider>
  );
}

export default App;
