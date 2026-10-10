import { expect, vi } from "vitest";
import "@testing-library/jest-dom";

// Global test setup
vi.stubGlobal("IS_TEST", true);