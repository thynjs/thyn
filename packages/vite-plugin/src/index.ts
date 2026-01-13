import * as acorn from "acorn";
import * as acornwalk from "acorn-walk";
import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";
import MagicString from "magic-string";
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { escapeTemplateLiteral, extractParts, splitScript } from "./utils.js";

async function scopeSelectors(css: string, scopeId: string) {
  const result = await postcss([
    {
      postcssPlugin: 'postcss-scope-thyn',
      Rule(rule) {
        if (!rule.selector) return;

        const processor = selectorParser((selectors) => {
          selectors.walkClasses(() => { }); // just to trigger full parse
          selectors.each((sel) => {
            sel.append(selectorParser.className({ value: scopeId }));
          });
        });

        rule.selector = processor.processSync(rule.selector);
      },
    },
  ]).process(css, { from: undefined });
  return result.css;
}

const DIRECTIVES = ["#for", "#if", "#then", "#else", "#else-if"];

function isReactiveExpression(expr) {
  const ast = acorn.parseExpressionAt(expr, 0, { ecmaVersion: 2022 });
  if (["ArrowFunctionExpression", "FunctionExpression"].includes(ast.type)) {
    return false;
  }
  let isReactive = false;
  acornwalk.simple(ast, {
    CallExpression(node) {
      isReactive = true;
    },
  });
  return isReactive;
}

const DOUBLE_QUOTE = "__THYN__DOUBLE_QUOTE__";

function parseAttributes(el) {
  const result: { [key: string]: { raw: string } | { quoted: string } } = {};
  for (const attr of el.attributes) {
    let { name, value } = attr;
    name = name.replace(
      /__thyn_attribute_(:?[a-z-]+)/g,
      (match, kebabName) => {
        const camelCase = kebabName.replace(
          /-([a-z])/g,
          (_, letter) => letter.toUpperCase(),
        );
        return camelCase;
      },
    );
    if (name.startsWith(":")) {
      if (name.startsWith(":on")) {
        let pipes;
        [name, ...pipes] = name.split(".");
        for (const pipe of pipes) {
          if (pipe === "stop") {
            value = `(e) => { e.stopPropagation(); (${value})(e); }`;
          } else if (pipe === "prevent") {
            value = `(e) => { e.preventDefault(); (${value})(e); }`;
          } else if (pipe === "enter") {
            value = `(e) => { if (e.key === 'Enter') (${value})(e); }`;
          } else if (pipe === "ctrl") {
            value = `(e) => { if (e.ctrlKey) (${value})(e); }`;
          } else if (pipe === "meta") {
            value = `(e) => { if (e.metaKey) (${value})(e); }`;
          } else if (pipe === "alt") {
            value = `(e) => { if (e.altKey) (${value})(e); }`;
          } else if (pipe === "shift") {
            value = `(e) => { if (e.shiftKey) (${value})(e); }`;
          } else {
            throw new Error(`Unknown event modifier: ${pipe}`);
          }
        }
      }
      const reactive = value && isReactiveExpression(value);
      if (
        reactive && name !== ":#for" && name !== ":#if" &&
        name !== ":#else-if" && name !== ":#else"
      ) {
        value = `() => ${value}`;
        result[name.slice(1)] = { raw: value.replace(new RegExp(DOUBLE_QUOTE, "g"), '"') };
      } else {
        result[name.slice(1)] = { raw: value.replace(new RegExp(DOUBLE_QUOTE, "g"), '"') };
      }
    } else {
      result[name] = { quoted: value };
    }
  }
  return result;
}

function parseTextContent(text: string) {
  text = text.trim();

  // First, handle escaped braces by temporarily replacing them
  const escapedOpenBrace = '\u0001'; // Use control character as placeholder
  const escapedCloseBrace = '\u0002';

  // Replace escaped braces with placeholders
  text = text.replace(/\\(\{\{|\}\})/g, (match, braces) => {
    return braces === '{{' ? escapedOpenBrace : escapedCloseBrace;
  });

  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;
  const parts = [];
  let hasReactive = false;
  let hasInterpolations = false;

  while ((match = regex.exec(text)) !== null) {
    const staticText = text.slice(lastIndex, match.index);
    if (staticText) {
      // Restore escaped braces in static text
      const restoredText = staticText
        .replace(new RegExp(escapedOpenBrace, 'g'), '{{')
        .replace(new RegExp(escapedCloseBrace, 'g'), '}}');
      parts.push(restoredText);
    }

    const expr = match[1].trim();
    const isReactive = isReactiveExpression(expr);
    hasReactive || (hasReactive = isReactive);
    hasInterpolations = true;
    parts.push({ expr, isReactive });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    // Restore escaped braces in remaining text
    const remainingText = text.slice(lastIndex)
      .replace(new RegExp(escapedOpenBrace, 'g'), '{{')
      .replace(new RegExp(escapedCloseBrace, 'g'), '}}');
    parts.push(remainingText);
  }

  if (!hasInterpolations) {
    // Restore escaped braces if no interpolations
    const finalText = text
      .replace(new RegExp(escapedOpenBrace, 'g'), '{{')
      .replace(new RegExp(escapedCloseBrace, 'g'), '}}');
    return {
      code: `document.createTextNode(\`${escapeTemplateLiteral(finalText)}\`)`,
      hasReactive: false,
    };
  }

  const interpolated = parts.map((part) => {
    if (typeof part === "string") {
      return escapeTemplateLiteral(part);
    }
    return `$\{${part.expr}\}`;
  }).join("");

  if (hasReactive) {
    let code = `__THYN__CORE__.createReactiveTextNode(() => \`${interpolated}\`)`;
    if (parts.length === 1) {
      const ast = acorn.parseExpressionAt(interpolated.slice(2, -1), 0, {
        ecmaVersion: 2022,
      });
      if (ast.type === "CallExpression" && !ast.arguments.length) {
        code = `__THYN__CORE__.createReactiveTextNode(${interpolated.slice(2, -1).replace(/\(\s*\)\s*$/, "")})`;
      }
    }
    return {
      code,
      hasReactive,
    };
  }

  if (parts.length === 1) {
    return {
      code: `document.createTextNode(${interpolated.slice(2, -1)})`,
      hasReactive,
    };
  }

  return {
    code: `document.createTextNode(\`${interpolated}\`)`,
    hasReactive,
  };
}

function generateTextContentTemplate(
  text: string,
  parent: string,
  prevSibling?: string,
): { root: string; static: string; dynamic: string; staticRoot: string } {
  text = text.trim();

  // First, handle escaped braces by temporarily replacing them
  const escapedOpenBrace = '\u0001'; // Use control character as placeholder
  const escapedCloseBrace = '\u0002';

  // Replace escaped braces with placeholders
  text = text.replace(/\\(\{\{|\}\})/g, (match, braces) => {
    return braces === '{{' ? escapedOpenBrace : escapedCloseBrace;
  });

  const regex = /\{\{([^}]+)\}\}/g;

  let lastIndex = 0;
  let match;
  const parts = [];
  let hasReactive = false;
  let hasInterpolations = false;

  while ((match = regex.exec(text)) !== null) {
    const staticText = text.slice(lastIndex, match.index);
    if (staticText) {
      // Restore escaped braces in static text
      const restoredText = staticText
        .replace(new RegExp(escapedOpenBrace, 'g'), '{{')
        .replace(new RegExp(escapedCloseBrace, 'g'), '}}');
      parts.push(restoredText);
    }

    const expr = match[1].trim();
    const isReactive = isReactiveExpression(expr);
    hasReactive || (hasReactive = isReactive);
    hasInterpolations = true;
    parts.push({ expr, isReactive });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    // Restore escaped braces in remaining text
    const remainingText = text.slice(lastIndex)
      .replace(new RegExp(escapedOpenBrace, 'g'), '{{')
      .replace(new RegExp(escapedCloseBrace, 'g'), '}}');
    parts.push(remainingText);
  }

  const root = makeVariable();

  if (!hasInterpolations) {
    // Restore escaped braces if no interpolations
    const finalText = text
      .replace(new RegExp(escapedOpenBrace, 'g'), '{{')
      .replace(new RegExp(escapedCloseBrace, 'g'), '}}');
    return {
      static: `const ${root} = document.createTextNode(\`${escapeTemplateLiteral(finalText)}\`);\n`,
      dynamic: "",
      root: "",
      staticRoot: root,
    };
  }

  const interpolated = parts.map((part) => {
    if (typeof part === "string") {
      return escapeTemplateLiteral(part);
    }
    return `$\{${part.expr}\}`;
  }).join("");

  const textNode = prevSibling
    ? `${prevSibling}.nextSibling`
    : `${parent}.firstChild`;

  if (hasReactive) {
    let fn = `(() => \`${interpolated}\`)`;
    if (parts.length === 1) {
      const ast = acorn.parseExpressionAt(interpolated.slice(2, -1), 0, {
        ecmaVersion: 2022,
      });
      if (ast.type === "CallExpression" && !ast.arguments.length) {
        fn = interpolated.slice(2, -1).replace(/\(\s*\)\s*$/, "");
      }
    }
    const stat = `const ${root} = document.createTextNode("");\n`;
    const dynamic = `__THYN__CORE__.staticEffect(() => {
      ${textNode}.nodeValue = ${fn}();
    });\n`;
    return {
      static: stat,
      dynamic,
      root: "",
      staticRoot: root,
    };
  }

  if (parts.length === 1) {
    return {
      dynamic: `${textNode}.nodeValue = ${interpolated.slice(2, -1)};\n`,
      static: `const ${root} = document.createTextNode("");\n`,
      root: "",
      staticRoot: root,
    };
  }

  return {
    dynamic: `${textNode}.nodeValue = \`${interpolated}\`;\n`,
    static: `const ${root} = document.createTextNode("");\n`,
    root: "",
    staticRoot: root,
  };
}

const NAMESPACE = "__THYN__";
const HOIST_PREFIX = `${NAMESPACE}HOIST__`;

function cloneIfNeeded(code: string): string {
  if (code.startsWith(HOIST_PREFIX)) {
    return `${code}.cloneNode()`;
  }
  return code;
}

function createHoisting(code: string, hoist: string[]) {
  const existing = hoist.find((h) => h.endsWith(` = ${code};`));
  if (existing) {
    return existing.slice(6, existing.indexOf(" = "));
  }
  const id = `${HOIST_PREFIX}${hoist.length}`;
  hoist.push(`const ${id} = ${code};`);
  return id;
}

function createObjectCode(obj: object): string {
  const keys = Object.keys(obj);
  if (!keys.length) return "null";
  return `{${keys.map((k) => `'${k}': ${obj[k]}`).join(",")}}`;
}

let varId = 0;

function makeVariable() {
  return `${NAMESPACE}${varId++}`;
}

function makeTemplate(
  node: Node,
  parent?: string,
  prevSibling?: string,
): { root: string; staticRoot: string; static: string; dynamic: string } {
  if (node.nodeType === 3) {
    const text = node.textContent;
    return generateTextContentTemplate(text, parent, prevSibling);
  }

  const tag = (node as Element).tagName.toLowerCase();
  const attrs = parseAttributes(node);

  let statRoot = makeVariable();
  let template = `const ${statRoot} = document.createElement("${tag}");\n`;
  if (!parent) {
    statRoot = "__THYN__template";
    template = `${statRoot} = document.createElement("${tag}");\n`;
  }
  let code = "";
  let dynRoot = makeVariable();
  const childNodes = Array.from(node.childNodes).filter((n) =>
    n.nodeType !== 3 || n.textContent.trim()
  );
  const children = [];
  let ps: string | undefined = undefined;
  for (let i = 0; i < childNodes.length; i++) {
    const cn = childNodes[i];
    const ch = makeTemplate(cn, dynRoot, ps);
    children.push(ch);
    ps = ch.root || `${dynRoot}.childNodes[${i}]`;
  }
  if (!parent) {
    code = `const ${dynRoot} = __THYN__template_generate();\n`;
  } else if (!prevSibling) {
    code = `const ${dynRoot} = ${parent}.firstChild;\n`;
  } else {
    code = `const ${dynRoot} = ${prevSibling}.nextSibling;\n`;
  }
  for (const [key, val] of Object.entries(attrs)) {
    if (DIRECTIVES.includes(key)) continue;
    if ("quoted" in val) {
      if (key === "class") {
        template += `${statRoot}.className = "${val.quoted}";\n`;
      } else if (key.includes("-")) {
        template += `${statRoot}.setAttribute("${key}", "${val.quoted}");\n`;
      } else {
        template += `${statRoot}["${key}"] = "${val.quoted}";\n`;
      }
    }
  }
  for (const [key, val] of Object.entries(attrs)) {
    if (DIRECTIVES.includes(key)) continue;
    if (!("raw" in val)) continue;
    if (key.startsWith("on")) {
      code += `${dynRoot}.${key} = ${val.raw};\n`;
      continue;
    }
    const reactive = isReactiveExpression(val.raw.replace(/^\(\) => /, ""));
    if (reactive) {
      val.raw = val.raw.replace(/^\(\) => /, "");
      if (key === "class") {
        const prev = makeVariable();
        code += `let ${prev};\n`;
        code += `__THYN__CORE__.staticEffect(() => {
            const val = ${val.raw};
            if (val !== ${prev}) {
              if (val) ${dynRoot}.className = val;
              else ${dynRoot}.removeAttribute("class")
              ${prev} = val;
            }
          });\n`;
        continue;
      }
      if (key.includes("-")) {
        const ran = makeVariable();
        code += `let ${ran} = false;\n`;
        code += `__THYN__CORE__.staticEffect(() => {
            const val = ${val.raw};
            if (val === undefined) {
              if (${ran} && ${dynRoot}.hasAttribute("${key}")) {
                ${dynRoot}.removeAttribute("${key}");
              }
            } else {
              ${dynRoot}.setAttribute("${key}", val);\n
            }
            ${ran} = true;
          });\n`;
      } else {
        code += `__THYN__CORE__.staticEffect(() => {
          const val = ${val.raw};
          if (val === undefined) {
            if (${dynRoot}.${key}) {
              delete ${dynRoot}.${key};
            }
          } else {
            ${dynRoot}.${key} = val;\n
          }
        });\n`;
      }
      continue;
    }
    if (key === "class") {
      code += `${dynRoot}.className = ${val.raw};\n`;
      continue;
    }
    if (key.includes("-")) {
      code += `${dynRoot}.setAttribute("${key}", ${val.raw});\n`;
    } else {
      code += `${dynRoot}.${key} = ${val.raw};\n`;
    }
  }
  if (children.length) {
    for (let i = 0; i < children.length; i++) {
      const ch = children[i];
      if (ch.static) {
        template += ch.static;
        const childStaticRoot = ch.staticRoot || ch.root;
        template += `${statRoot}.appendChild(${childStaticRoot});\n`;
      }
      if (ch.dynamic) {
        code += ch.dynamic;
      }
    }
  }
  return {
    root: dynRoot,
    staticRoot: statRoot,
    static: template,
    dynamic: code,
  };
}

function walkConditionChain(nodes: Node[], i: number) {
  const chain = [];
  for (; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const attrs = parseAttributes(el);
    if ("#if" in attrs || "#else-if" in attrs || "#else" in attrs) {
      chain.push({ node, attrs });
    } else {
      break;
    }
    if ("#else" in attrs) break;
  }
  return chain;
}

function walk(node, hoist: string[], siblings?: Node[], index?: number) {
  if (node.nodeType === 3) {
    const text = node.textContent;
    if (!text.trim()) return null;
    const result = parseTextContent(text);
    return {
      code: result.code,
      isComponent: false,
      hasReactive: result.hasReactive,
    };
  }

  if (node.nodeType !== 1) return null;

  const el = node;
  const tag = el.tagName.toLowerCase();

  let isComponent = el.hasAttribute("__thyn_component");
  const makeArg = isComponent
    ? el.getAttribute("__thyn_component")
    : `"${tag}"`;
  el.removeAttribute("__thyn_component");
  const attrs = parseAttributes(el);
  if (isComponent) el.setAttribute("__thyn_component", makeArg);

  const children = [];
  let skip = 0;
  for (let i = 0; i < node.childNodes.length; i++) {
    const result = walk(node.childNodes[i], hoist, node.childNodes, i);
    if (result) {
      if (skip) {
        skip--;
        continue;
      }
      children.push(result);
      if ("skip" in result) {
        skip = result.skip;
      }
    }
  }
  const hasReactiveChildren = children.some((c) => c.hasReactive);
  const hasComponentChildren = children.some((c) => c.isComponent);
  let hasReactive = hasReactiveChildren || hasComponentChildren;
  if (tag === "slot") {
    return {
      code: `...$props.slot ?? ${children.map((c) => cloneIfNeeded(c.code)).join(", ") || "[]"
        }`,
      isComponent: false,
      hasReactive,
    };
  }

  let code = "";
  let hasOwnEffects = false;
  if (isComponent) {
    const props: any = {};
    for (const [key, val] of Object.entries(attrs)) {
      if (["#for", "#if", "#then", "#else", "#else-if"].includes(key)) {
        continue;
      }
      const value = "raw" in val ? val.raw : JSON.stringify(val.quoted);
      props[key] = value;
    }
    if (children.length) {
      props.slot = `[${children.map((c) => cloneIfNeeded(c.code)).join(", ")}]`;
    }
    code = `__THYN__CORE__.${hasComponentChildren ? 'component' : 'fixedComponent'}(${makeArg}, ${createObjectCode(props)})`;
  } else {
    code = createHoisting(`document.createElement(${makeArg})`, hoist);
    for (const [key, val] of Object.entries(attrs)) {
      if (DIRECTIVES.includes(key)) continue;
      if ("quoted" in val) {
        if (key === "class" || key.includes("-")) {
          code = createHoisting(
            `__THYN__CORE__.setAttribute(${cloneIfNeeded(code)
            }, "${key}", "${val.quoted}")`,
            hoist,
          );
        } else {
          code = createHoisting(
            `__THYN__CORE__.setProperty(${cloneIfNeeded(code)
            }, "${key}", "${val.quoted}")`,
            hoist,
          );
        }
      }
    }
    for (const [key, val] of Object.entries(attrs)) {
      if (DIRECTIVES.includes(key)) continue;
      if (!("raw" in val)) continue;
      if (key.startsWith("on")) {
        code = `__THYN__CORE__.setProperty(${cloneIfNeeded(code)
          }, "${key}", ${val.raw})`;
        continue;
      }
      const reactive = isReactiveExpression(val.raw.replace(/^\(\) => /, ""));
      if (reactive) {
        hasOwnEffects = true;
        hasReactive = true;
        if (key === "class" || key.includes("-")) {
          code = `__THYN__CORE__.setReactiveAttribute(${cloneIfNeeded(code)
            }, "${key}", ${val.raw})`;
        } else {
          code = `__THYN__CORE__.setReactiveProperty(${cloneIfNeeded(code)
            }, "${key}", ${val.raw})`;
        }
        continue;
      }
      if (key === "class" || key.includes("-")) {
        code = `__THYN__CORE__.setAttribute(${cloneIfNeeded(code)
          }, "${key}", ${val.raw})`;
      } else {
        code = `__THYN__CORE__.setProperty(${cloneIfNeeded(code)
          }, "${key}", ${val.raw})`;
      }
    }
    if (children.length) {
      code = `__THYN__CORE__.addChildren(${cloneIfNeeded(code)}, [${children.map((c) => cloneIfNeeded(c.code)).join(", ")
        }])`;
    }
    if (!hasOwnEffects && hasReactiveChildren) {
      code = `__THYN__CORE__.markAsReactive(${cloneIfNeeded(code)})`;
    }
  }

  if ("#for" in attrs && "raw" in attrs["#for"]) {
    const isolated = siblings ? Array.from(siblings).filter((n) => n.nodeType !== 3 || n.textContent.trim()).length === 1 : true;
    const forAttr = attrs["#for"].raw;
    const [item, iterable] = forAttr.split(" in ").map((s) => s.trim());
    code = `__THYN__CORE__.component(${hasComponentChildren
      ? "__THYN__CORE__.list"
      : (isolated ? "__THYN__CORE__.isolatedTerminalList" : "__THYN__CORE__.terminalList")
      }, {
      items: () => ${iterable},
      render: (${item}) => ${code},
    })`;
    isComponent = true;
  }

  if ("#if" in attrs) {
    const chain = walkConditionChain(siblings, index);
    const branches = [];
    for (const entry of chain) {
      const subEl = entry.node;
      const subAttrs = entry.attrs;
      subEl.removeAttribute(":#if");
      subEl.removeAttribute(":#else-if");
      subEl.removeAttribute(":#else");
      const ch = walk(subEl, hoist);
      if ("#if" in subAttrs || "#else-if" in subAttrs) {
        const cond = subAttrs["#if"]?.raw ?? subAttrs["#else-if"].raw;
        branches.push(`{ if: () => ${cond}, then: () => ${ch.code} }`);
      } else if ("#else" in subAttrs) {
        branches.push(`{ then: () => ${ch.code} }`);
      }
    }
    code = `__THYN__CORE__.component(__THYN__CORE__.show, [\n${branches.join(",\n")
      }\n])`;
    return {
      code,
      isComponent: true,
      hasReactive: true,
      skip: chain.length - 1,
    };
  }

  return {
    code,
    isComponent,
    hasReactive: hasOwnEffects || isComponent || hasReactiveChildren,
  };
}

function hasComponentChildren(node: Element): boolean {
  if (node.nodeType === 3) {
    return false;
  }
  if (node.nodeType !== 1) return false;
  const tag = node.tagName.toLowerCase();
  if (tag === "slot") return true;
  let isComponent = node.hasAttribute("__thyn_component");
  if (isComponent) return true;
  for (const attr of node.attributes) {
    if ([":#for", ":#if", ":#else", ":#else-if"].includes(attr.name)) {
      return true;
    }
  }
  return Array.from(node.childNodes).some((n) =>
    hasComponentChildren(n as Element)
  );
}

const forcedChildren = new Map([
  ["tbody", "tr"],
  ["thead", "tr"],
  ["tfoot", "tr"],
  ["ul", "li"],
  ["ol", "li"],
  ["select", "option"],
]);

const COMPONENT_TAG_REGEX =
  /<\/?([A-Z][a-zA-Z0-9]*)(\s(?:[^"'<>\/]|"[^"]*"|'[^']*')*)?(\/?)>/g;

function convertToColonBindings(html: string): string {
  let result = '';
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('={', i);
    if (start === -1) {
      result += html.slice(i);
      break;
    }
    // Check if we're inside escaped HTML (&lt; ... &gt;)
    let beforeStart = html.slice(0, start);
    let lastLt = beforeStart.lastIndexOf('<');
    let lastAmpLt = beforeStart.lastIndexOf('&lt;');
    // If the last &lt; is more recent than the last <, we're in escaped HTML
    if (lastAmpLt > lastLt) {
      result += html.slice(i, start + 2);
      i = start + 2;
      continue;
    }
    // Find the most recent < and > before our position
    let lastTagOpen = beforeStart.lastIndexOf('<');
    let lastTagClose = beforeStart.lastIndexOf('>');

    // If there's no unclosed tag (last > is more recent than last <), skip
    if (lastTagClose >= lastTagOpen) {
      result += html.slice(i, start + 2);
      i = start + 2;
      continue;
    }
    // Find the attribute name by going backwards
    let attrEnd = start - 1;
    while (attrEnd >= 0 && /\s/.test(html[attrEnd])) attrEnd--;
    let attrStart = attrEnd;
    // Updated to include dots in attribute names
    while (attrStart >= 0 && /[a-zA-Z0-9_#.-]/.test(html[attrStart])) {
      attrStart--;
    }
    attrStart++; // Move to first character of attribute name
    if (attrStart > attrEnd) {
      // No valid attribute name found
      result += html.slice(i, start + 2);
      i = start + 2;
      continue;
    }
    const attrName = html.slice(attrStart, attrEnd + 1);
    // Updated validation to allow dots in attribute names
    if (!/^[#a-zA-Z_][\w\-\.]*$/.test(attrName)) {
      result += html.slice(i, start + 2);
      i = start + 2;
      continue;
    }
    // Parse balanced {}
    let braceCount = 1;
    let j = start + 2;
    while (j < html.length && braceCount > 0) {
      if (html[j] === '{') braceCount++;
      else if (html[j] === '}') braceCount--;
      j++;
    }
    if (braceCount !== 0) {
      // Unbalanced braces, treat as raw
      result += html.slice(i, j);
      i = j;
      continue;
    }
    const jsExpr = html.slice(start + 2, j - 1).trim();
    const prefix = attrName.startsWith('#') ? ':#' + attrName.slice(1) : ':' + attrName;
    const beforeAttr = html.slice(i, attrStart);
    result += beforeAttr + `${prefix}="${jsExpr.replace(/"/g, DOUBLE_QUOTE)}"`;
    i = j;
  }
  return result;
}

function preprocessHTML(html: string): string {
  html = convertToColonBindings(html);
  html = addComponentAttributes(html);
  html = preserveCamelCaseAttributes(html);
  return html;
}

function preserveCamelCaseAttributes(html: string): string {
  return html.replace(/<([^>]+)>/g, (match, tagContent) => {
    const processedContent = tagContent.replace(
      /\s+(:?[a-z][a-zA-Z]*[A-Z][a-zA-Z]*)\s*=/g,
      (_attrMatch, attrName) => {
        const kebabCase = attrName.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        );
        return ` __thyn_attribute_${kebabCase}=`;
      },
    );
    return `<${processedContent}>`;
  });
}

function addComponentAttributes(html: string): string {
  let processedHTML = html;
  for (const [parentTag, childTag] of forcedChildren) {
    const parentRegex = new RegExp(
      `<${parentTag}([^>]*)>([\\s\\S]*?)<\\/${parentTag}>`,
      "gis",
    );

    processedHTML = processedHTML.replace(
      parentRegex,
      (match, attributes, content) => {
        const processedContent = content.replace(
          COMPONENT_TAG_REGEX,
          (componentMatch, componentName, attributes, selfClose) => {
            const isClosing = componentMatch.startsWith("</");
            return isClosing
              ? `</${childTag}>`
              : selfClose
                ? `<${childTag}${attributes || ""
                } __thyn_component="${componentName}"/>`
                : `<${childTag}${attributes || ""
                } __thyn_component="${componentName}">`;
          },
        );
        return `<${parentTag}${attributes}>${processedContent}</${parentTag}>`;
      },
    );
  }

  processedHTML = processedHTML.replace(
    COMPONENT_TAG_REGEX,
    (componentMatch, componentName, attributes, selfClose) => {
      const isClosing = componentMatch.startsWith("</");
      return isClosing
        ? "</div>"
        : selfClose
          ? `<div${attributes || ""} __thyn_component="${componentName}"></div>`
          : `<div${attributes || ""} __thyn_component="${componentName}">`;
    },
  );

  return processedHTML;
}

function addScopeId(el, scopeId) {
  el.classList.add(scopeId);
  for (const child of el.children) {
    addScopeId(child, scopeId);
  }
}

function removeUnusedThynVars(code: string): string {
  const varDeclRE = /const (\__THYN__\d+) = ([^\n;]+);/g;

  const varToExpr = new Map<string, string>();
  const exprDeps = new Map<string, Set<string>>();
  const allVars = new Set<string>();
  const directlyUsed = new Set<string>();

  // 1. Collect variable declarations
  let match: RegExpExecArray | null;
  while ((match = varDeclRE.exec(code))) {
    const name = match[1];
    const expr = match[2];
    varToExpr.set(name, expr);
    allVars.add(name);

    // Track dependencies (i.e., const a = b.c → b is a dependency)
    const deps = new Set<string>();
    for (const dep of expr.match(/\__THYN__\d+/g) || []) {
      deps.add(dep);
    }
    exprDeps.set(name, deps);
  }

  // 2. Detect any variable used outside its own declaration
  for (const name of allVars) {
    const usageRE = new RegExp(`\\b${name}\\b`, "g");
    while ((match = usageRE.exec(code))) {
      const idx = match.index;
      const lineStart = code.lastIndexOf("\n", idx);
      const line = code.slice(lineStart + 1, code.indexOf("\n", idx + 1));
      if (!line.startsWith(`const ${name} =`)) {
        directlyUsed.add(name);
        break;
      }
    }
  }

  // 3. Add any variable that is `return`ed
  const returnRE = /return (\__THYN__\d+);/g;
  while ((match = returnRE.exec(code))) {
    directlyUsed.add(match[1]);
  }

  // 4. Walk transitive dependency graph
  const keep = new Set<string>(directlyUsed);
  const stack = [...directlyUsed];

  while (stack.length) {
    const current = stack.pop()!;
    const deps = exprDeps.get(current);
    if (!deps) continue;
    for (const dep of deps) {
      if (!keep.has(dep)) {
        keep.add(dep);
        stack.push(dep);
      }
    }
  }

  // 5. Remove any declaration not in the keep set
  const cleaned = code.replace(varDeclRE, (decl, name) => {
    return keep.has(name) ? decl : "";
  });

  return cleaned;
}


async function transformHTMLtoJSX(html: string, style: string) {
  const scopeId = `thyn-${(styleId++).toString(36)}`;
  const div = new JSDOM("").window.document.createElement("div");
  const processedHTML = preprocessHTML(html);
  div.innerHTML = "<template>" + processedHTML + "</template>";
  const template = div.firstElementChild;
  const rootElement =
    (template as HTMLTemplateElement).content.firstElementChild;

  let scopedStyle = null;
  if (style) {
    addScopeId(rootElement, scopeId);
    scopedStyle = await scopeSelectors(style, scopeId);
  }

  if (hasComponentChildren(rootElement)) {
    const hoist = [];
    const { code } = walk(rootElement, hoist);
    const root = makeVariable();
    return [root, `const ${root} = ${code};`, hoist, scopedStyle];
  }
  const { root, static: tmpl, dynamic } = makeTemplate(rootElement);
  const hoist = [`
  let __THYN__template;
  function __THYN__template_generate() {
    if (!__THYN__template) {
      ${tmpl}
      return __THYN__template;
    }
    return __THYN__template.cloneNode(true);
  }`];
  return [root, dynamic, hoist, scopedStyle];
}

async function transformTypeScript(code: string, id: string) {
  try {
    const result = await esbuild.transform(code, {
      loader: "ts",
      target: "es2022",
      format: "esm",
      sourcemap: true,
      sourcefile: id,
    });
    return {
      code: result.code,
      map: result.map,
    };
  } catch (error) {
    throw new Error(
      `TypeScript compilation failed for ${id}: ${error.message}`,
    );
  }
}

export async function transformSFC(source: string, id: string) {
  const name = id.split("/").pop()?.replace(/\.thyn$/, "");
  const { script, scriptLang, html, style } = extractParts(source);
  const { imports, body } = splitScript(script);

  const s = new MagicString("");
  if (!imports.some((imp) => imp.includes("$signal"))) {
    s.prepend("import { $signal } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$effect"))) {
    s.prepend("import { $effect } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$compare"))) {
    s.prepend("import { $compare } from '@thyn/core';\n");
  }
  s.prepend("import * as __THYN__CORE__ from '@thyn/core';\n");
  s.append(imports.join("\n") + "\n");

  let [root, transformed, hoist, scopedStyle] = await transformHTMLtoJSX(html, style);
  s.append(hoist.join("\n") + "\n");

  s.append([
    "",
    `export default function ${name}($props) {`,
    ...body.map((l) => "  " + l),
    removeUnusedThynVars(`  ${transformed} return ${root};`),
    `}`,
  ].join("\n"));

  let output = s.toString();
  let sourceMap = s.generateMap({
    source: id,
    includeContent: true,
    hires: true,
  });
  return { output, sourceMap, scopedStyle, scriptLang };
}

export async function compileSFC(source: string, id: string) {
  let { scriptLang, output, sourceMap, scopedStyle } = await transformSFC(source, id);

  if (scriptLang === "ts" || scriptLang === "typescript") {
    const tsResult = await transformTypeScript(output, id);
    output = tsResult.code;
    if (tsResult.map) {
      // @ts-expect-error
      sourceMap = tsResult.map;
    }
  }

  return {
    js: output,
    css: scopedStyle || null,
    cssModuleId: scopedStyle ? `${id}.css` : null,
    map: sourceMap,
  };
}

async function compileThynScript(source, id) {
  const s = new MagicString(source);
  const { imports } = splitScript(source);
  if (!imports.some((imp) => imp.includes("$signal"))) {
    s.prepend("import { $signal } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$effect"))) {
    s.prepend("import { $effect } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$compare"))) {
    s.prepend("import { $compare } from '@thyn/core';\n");
  }

  let output = s.toString();
  let sourceMap = s.generateMap({
    source: id,
    includeContent: true,
    hires: true,
  });

  if (id.endsWith(".thyn.ts")) {
    const tsResult = await transformTypeScript(output, id);
    output = tsResult.code;
    if (tsResult.map) {
      // @ts-expect-error
      sourceMap = tsResult.map;
    }
  }

  return {
    code: output,
    map: sourceMap,
  };
}

let styleId = 0;

export default function thyn() {
  const collectedCSS = [];
  let isDev = false;

  return {
    name: "thyn",
    enforce: "pre",

    configResolved(config) {
      isDev = config.command === "serve";
    },

    buildStart() {
      collectedCSS.length = 0;
    },

    async transform(code, id) {
      if (id.endsWith(".thyn.js") || id.endsWith(".thyn.ts")) {
        return await compileThynScript(code, id);
      }
      if (!id.endsWith(".thyn")) return;
      const { js, css, map } = await compileSFC(code, id);
      let finalCode = js;
      if (isDev && css) {
        const escapedCSS = JSON.stringify(css);
        finalCode += `\n
      if (typeof document !== 'undefined') {
        const style = document.createElement('style');
        style.textContent = ${escapedCSS};
        document.head.appendChild(style);
      }`;
      } else if (css) {
        collectedCSS.push(css);
      }
      return {
        code: finalCode,
        map,
      };
    },

    transformIndexHtml(html) {
      if (collectedCSS.length === 0) return html;

      const s = new MagicString(html);
      const headCloseIndex = html.indexOf("</head>");

      if (headCloseIndex !== -1) {
        if (isDev) {
          const combinedCSS = collectedCSS.join("\n");
          s.appendLeft(
            headCloseIndex,
            `  <style>\n${combinedCSS}\n  </style>\n`,
          );
        } else {
          s.appendLeft(
            headCloseIndex,
            '  <link rel="stylesheet" href="/main.css">\n',
          );
        }
      }

      return s.toString();
    },

    async generateBundle() {
      if (isDev || collectedCSS.length === 0) return;
      const combinedCSS = collectedCSS.join("\n");
      const result = await esbuild.transform(combinedCSS, {
        loader: "css",
        minify: true,
      });
      this.emitFile({
        type: "asset",
        fileName: "main.css",
        source: result.code,
      });
    },
  } as const;
}
