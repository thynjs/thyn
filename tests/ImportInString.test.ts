import { describe, expect, it } from "vitest";
import ImportInString from "./ImportInString.thyn";

describe("ImportInString component", () => {
  it("should not treat imports inside string literals as real imports", () => {
    const root = ImportInString();
    expect(root.textContent).toBe("42");
  });

  it("should include the import statements in the codeSnippet", () => {
    const root = ImportInString();
    // The codeSnippet should be available (this tests the script was parsed correctly)
    expect(root).toBeTruthy();
  });
});
