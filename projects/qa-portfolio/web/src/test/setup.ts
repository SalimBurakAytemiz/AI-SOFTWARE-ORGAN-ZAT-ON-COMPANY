import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Her testten sonra jsdom DOM'unu temizle (Testing Library).
afterEach(() => {
  cleanup();
});
