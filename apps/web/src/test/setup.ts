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

/**
 * jsdom also doesn't implement `IntersectionObserver`, or `Element.scrollTo`
 * (used to actually move the scroll position). `@primereact/headless`'s
 * `Carousel` primitive (`apps/web/src/components/ui/carousel.tsx`, used by
 * `WeekCarousel` per spec §3) relies on both internally (in-view tracking
 * for its items, and programmatic scrolling between slides) — without these
 * stubs, mounting any carousel-bearing route in a test throws
 * `ReferenceError: IntersectionObserver is not defined` /
 * `TypeError: scrollTo is not a function`. No-op stubs are sufficient here:
 * no test in this repo asserts on the carousel's real scroll/in-view
 * mechanics (that's the primitive's own concern, not spec-as-test coverage).
 */
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

if (typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = function scrollToStub(): void {};
}
