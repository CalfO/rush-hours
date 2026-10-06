import { beforeAll, describe, expect, test } from "vitest";
import i18n from "./config";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

/**
 * Spec §8.1: i18next is configured with fr/en resource bundles and
 * `fallbackLng: 'fr'`. This is a light smoke test for a config-only lot:
 * it guards against the realistic failure mode (malformed JSON, or the
 * resources object wired to the wrong language keys) rather than
 * asserting exhaustive translation-key coverage — there are barely any
 * real keys yet, most UI text lands in later lots.
 */
describe("i18n config", () => {
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on("initialized", () => resolve());
      });
    }
  });

  test("both locale bundles load without throwing", () => {
    expect(i18n.getResourceBundle("fr", "translation")).toEqual(fr);
    expect(i18n.getResourceBundle("en", "translation")).toEqual(en);
  });

  test("a known key resolves in French", () => {
    expect(i18n.t("nav.entry", { lng: "fr" })).toBe("Saisie");
    expect(i18n.t("nav.analytics", { lng: "fr" })).toBe("Analyses");
  });

  test("a known key resolves in English", () => {
    expect(i18n.t("nav.entry", { lng: "en" })).toBe("Time entry");
    expect(i18n.t("nav.analytics", { lng: "en" })).toBe("Analytics");
  });

  test("falls back to French (fallbackLng) for an unconfigured language", () => {
    expect(i18n.t("nav.entry", { lng: "de" })).toBe("Saisie");
  });
});
