/**
 * jsdom (the test environment configured in `vite.config.ts`) doesn't
 * implement `ResizeObserver`. `@primereact/headless`'s `Tabs` primitive
 * (used by `apps/web/src/components/Header.tsx` for the nav, per spec
 * §7.1) uses it internally to detect list overflow for the prev/next
 * scroll buttons — without this stub, mounting any header-bearing route in
 * a test throws `ReferenceError: ResizeObserver is not defined`. A no-op
 * stub is sufficient here: no test in this repo asserts on the
 * overflow/scroll-button behavior itself.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub;
}
