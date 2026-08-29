import type {
  LocaleAriaMessages,
  LocaleMessages,
} from "@primereact/types/core";

/**
 * French messages for PrimeReact's own internal locale system (separate
 * from this app's `react-i18next` bundles in `./locales/`) — registered
 * on `PrimeReactProvider` in `App.tsx` and switched reactively with
 * `i18n.language`. Without this, the `DatePicker` Primitive's calendar
 * (month/day names, the hour/minute steppers) stays in PrimeReact's English
 * defaults regardless of the app's own FR/EN toggle, since PrimeReact never
 * reads `react-i18next`'s state on its own.
 *
 * Only the fields this app's `DatePicker` usage actually renders are
 * translated (day/month names, today/clear, the month/year/decade/hour/
 * minute nav messages, `dateFormat`, and the generic `aria.close`/
 * `previous`/`next` fallbacks) — `defineLocale` deep-merges this over the
 * English defaults (see `@primeuix/locale`'s `add()`), so every other field
 * (DataTable filter operators, FileUpload, password-strength — none of
 * which this app uses, see `.claude/skills/primereact`) safely falls back
 * to English rather than needing a translation nobody will ever see.
 */
export const primeReactLocaleFr: Partial<LocaleMessages> = {
  dayNames: [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ],
  dayNamesShort: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
  dayNamesMin: ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"],
  monthNames: [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ],
  monthNamesShort: [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ],
  today: "Aujourd'hui",
  clear: "Effacer",
  weekHeader: "Sem.",
  dateFormat: "dd/mm/yy",
  chooseYear: "Choisir une année",
  chooseMonth: "Choisir un mois",
  chooseDate: "Choisir une date",
  prevDecade: "Décennie précédente",
  nextDecade: "Décennie suivante",
  prevYear: "Année précédente",
  nextYear: "Année suivante",
  prevMonth: "Mois précédent",
  nextMonth: "Mois suivant",
  prevHour: "Heure précédente",
  nextHour: "Heure suivante",
  prevMinute: "Minute précédente",
  nextMinute: "Minute suivante",
  prevSecond: "Seconde précédente",
  nextSecond: "Seconde suivante",
  am: "am",
  pm: "pm",
  // Partial by design (only the messages this app's DatePicker usage might
  // fall back to) -- `LocaleAriaMessages` itself has no partial variant, so
  // this is asserted rather than fully filled in with unused translations.
  aria: {
    close: "Fermer",
    previous: "Précédent",
    next: "Suivant",
  } as LocaleAriaMessages,
};
