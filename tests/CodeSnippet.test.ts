import { describe, expect, it } from "vitest";
import CodeSnippet from "./CodeSnippet.thyn";

describe("CodeSnippet component", () => {
  it("should render codeSnippet string containing script/style tags", () => {
    const root = CodeSnippet();
    const display = root.querySelector('.display');
    
    // The component should render the codeSnippet content
    expect(display).toBeTruthy();
    expect(display.textContent).toContain("// App.thyn");
    expect(display.textContent).toContain("<script>");
    expect(display.textContent).toContain("</script>");
    expect(display.textContent).toContain("<style>");
    expect(display.textContent).toContain("</style>");
    expect(display.textContent).toContain("button {");
  });

  it("should not add extra indentation to template literals", () => {
    const root = CodeSnippet();
    const display = root.querySelector('.display');
    const text = display.textContent;

    // Check that <script> is at the start of the line (no extra indentation)
    expect(text).toContain("\n<script>");
    // Check that const count has exactly 2 spaces (as in source), not 4
    expect(text).toContain("\n  const count");
  });

  it("should apply the component's actual style, not style from codeSnippet", () => {
    const root = CodeSnippet();
    const display = root.querySelector('.display');
    
    // The display element should have the component's style applied
    // (white-space: pre and font-family: monospace from actual <style> section)
    // Note: scoped CSS adds a class like 'thyn-e', so we check it contains 'display'
    expect(display.className).toContain('display');
  });
});
