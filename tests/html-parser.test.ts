import { describe, expect, it } from "vitest";
import { parseHTML } from "../src/plugin/html-parser";

describe("HTML Parser", () => {
  it("parses a simple template", () => {
    const html = `<template><div>Hello</div></template>`;
    const root = parseHTML(html);
    expect(root.tagName).toBe("TEMPLATE");
    const div = root.content.firstElementChild;
    expect(div?.tagName).toBe("DIV");
    expect(div?.childNodes[0].textContent).toBe("Hello");
  });

  it("handles attributes with various quoting styles", () => {
    const html = `<template><div id="d1" class='c1' data-val=v1 disabled></div></template>`;
    const root = parseHTML(html);
    const div = root.content.firstElementChild;
    expect(div?.getAttribute("id")).toBe("d1");
    expect(div?.getAttribute("class")).toBe("c1");
    expect(div?.getAttribute("data-val")).toBe("v1");
    expect(div?.hasAttribute("disabled")).toBe(true);
    expect(div?.getAttribute("disabled")).toBe("");
  });

  it("handles self-closing tags", () => {
    const html = `<template><br/><img src="img.jpg" /></template>`;
    const root = parseHTML(html);
    const nodes = root.content.childNodes.filter(n => n.nodeType === 1);
    expect(nodes.length).toBe(2);
    expect(nodes[0].nodeName).toBe("BR");
    expect(nodes[1].nodeName).toBe("IMG");
  });

  it("handles nested structures", () => {
    const html = `<template><ul><li>A</li><li>B</li></ul></template>`;
    const root = parseHTML(html);
    const ul = root.content.firstElementChild;
    expect(ul?.children.length).toBe(2);
    expect(ul?.children[0].tagName).toBe("LI");
    expect(ul?.children[0].childNodes[0].textContent).toBe("A");
  });

  it("throws on mismatched tags", () => {
    expect(() => parseHTML(`<template><div></span></template>`)).toThrow(/Mismatched tags/);
  });

  it("throws on unclosed tags", () => {
    expect(() => parseHTML(`<template><div></template>`)).toThrow(/Unclosed tags/);
  });
  
  it("handles whitespace in attributes", () => {
     const html = `<template><div class = " foo " ></div></template>`;
     const root = parseHTML(html);
     const div = root.content.firstElementChild;
     expect(div?.getAttribute("class")).toBe(" foo ");
  });
});
