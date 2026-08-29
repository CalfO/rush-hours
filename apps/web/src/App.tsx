import { PrimeReactProvider } from "@primereact/core";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { primeReactLocaleFr } from "./i18n/primereact-locale-fr";
import { router } from "./router";

/**
 * `PrimeReactProvider` is required at the app root for any PrimeReact
 * component, Primitive layer included — it doesn't apply a theme (spec
 * §2.1 forbids one), it only makes the primitives' shared context
 * available (see .claude/skills/primereact §Theming and the PrimeReact
 * docs). `WorkScheduleModal` (built on the `Dialog`/`Select`/etc.
 * Primitives) is this app's first real PrimeReact consumer, so this wiring
 * is new in this lot.
 *
 * `locale`/`locales` wire PrimeReact's own separate locale system (the
 * `DatePicker` Primitive's calendar month/day names) to this app's
 * `react-i18next` language — otherwise it stays in PrimeReact's English
 * defaults regardless of the header's FR/EN switch. `useTranslation()`
 * already re-renders this component on every language change (the same
 * mechanism every other `t()` consumer in this app relies on), so `locale`
 * stays in sync without any extra effect.
 */
function App() {
  const { i18n } = useTranslation();
  // `resolvedLanguage` (not `language`) -- `language` can carry a regional
  // tag straight from the browser/detector (e.g. "en-US"), which isn't a
  // locale PrimeReact's own `Locale` registry has ever heard of and crashes
  // its `DatePicker` headless hook reading e.g. `dayNamesMin[0]` off an
  // unregistered locale. `resolvedLanguage` is i18next's own post-
  // `supportedLngs`-matching result, always "fr" or "en" here.
  const primeReactLocale = i18n.resolvedLanguage ?? "fr";

  return (
    <PrimeReactProvider
      locale={primeReactLocale}
      locales={{ fr: primeReactLocaleFr }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PrimeReactProvider>
  );
}

export default App;
