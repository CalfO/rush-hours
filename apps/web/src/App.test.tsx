import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the time entry page at the root route", () => {
  render(<App />);
  const heading = screen.getByRole("heading", { name: /time entry/i });
  expect(heading).toBeDefined();
});
