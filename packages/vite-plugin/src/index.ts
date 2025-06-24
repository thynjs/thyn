import * as acorn from "acorn";
import * as acornwalk from "acorn-walk";
import * as esbuild from "esbuild";
import { JSDOM } from "jsdom";
import MagicString from "magic-string";
import { extractParts, splitScript } from "./utils.js";

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

function parseAttributes(el) {
  const result: { [key: string]: { raw: string } | { quoted: string } } = {};
  for (const attr of el.attributes) {
    let { name, value } = attr;
    name = name.replace(
      /__thyn_attribute_(:?[a-z-]+)/g,
      (match, kebabName) => {
        // Convert kebab-case back to camelCase
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
      const reactive = isReactiveExpression(value);
      if (reactive && name !== ":key" && name !== ":each" && name !== ":if") {
        value = `() => ${value}`;
        result[name.slice(1)] = { raw: value };
      } else {
        result[name.slice(1)] = { raw: value };
      }
    } else {
      result[name] = { quoted: value };
    }
  }
  return result;
}

function parseTextContent(text: string) {
  text = text.trim();
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;
  const parts = [];
  let hasReactive = false;
  let hasInterpolations = false;
  while ((match = regex.exec(text)) !== null) {
    const staticText = text.slice(lastIndex, match.index);
    if (staticText) {
      parts.push(staticText);
    }
    const expr = match[1].trim();
    const isReactive = isReactiveExpression(expr);
    hasReactive || (hasReactive = isReactive);
    hasInterpolations = true;
    parts.push({ expr, isReactive });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (!hasInterpolations) {
    return { code: `document.createTextNode(\`${text}\`)`, hasReactive: false }; // plain text
  }
  const interpolated = parts.map((part) => {
    if (typeof part === "string") {
      return part.replace(/[`\\$]/g, "\\$&"); // escape backticks and ${
    }
    return `$\{${part.expr}\}`;
  }).join("");
  if (hasReactive) {
    let code = `__SPARKI__CORE__.createReactiveTextNode(() => \`${interpolated}\`)`;
    const ast = acorn.parseExpressionAt(interpolated.slice(2, -1), 0, {
      ecmaVersion: 2022,
    });
    if (ast.type === "CallExpression" && !ast.arguments.length) {
      code = `__SPARKI__CORE__.createReactiveTextNode(${interpolated.slice(2, -1).replace(/\(\s*\)\s*$/, "")})`;
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

function generateTextContentTemplate(text: string, parent: string, prevSibling?: string): { root: string, static: string, dynamic: string, staticRoot: string } {
  text = text.trim();
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;
  const parts = [];
  let hasReactive = false;
  let hasInterpolations = false;
  while ((match = regex.exec(text)) !== null) {
    const staticText = text.slice(lastIndex, match.index);
    if (staticText) {
      parts.push(staticText);
    }
    const expr = match[1].trim();
    const isReactive = isReactiveExpression(expr);
    hasReactive || (hasReactive = isReactive);
    hasInterpolations = true;
    parts.push({ expr, isReactive });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  const root = makeVariable();
  if (!hasInterpolations) {
    return { static: `const ${root} = document.createTextNode(\`${text}\`);\n`, dynamic: "", root: "", staticRoot: root }; // plain text
  }
  const interpolated = parts.map((part) => {
    if (typeof part === "string") {
      return part.replace(/[`\\$]/g, "\\$&"); // escape backticks and ${
    }
    return `$\{${part.expr}\}`;
  }).join("");
  const textNode = prevSibling ? `${prevSibling}.nextSibling` : `${parent}.firstChild`;
  if (hasReactive) {
    let fn = `(() => \`${interpolated}\`)`;
    const ast = acorn.parseExpressionAt(interpolated.slice(2, -1), 0, {
      ecmaVersion: 2022,
    });
    if (ast.type === "CallExpression" && !ast.arguments.length) {
      fn = interpolated.slice(2, -1).replace(/\(\s*\)\s*$/, "");
    }
    const stat = `const ${root} = document.createTextNode("");\n`;
    const dynamic = `$effect(() => {
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

function makeTemplate(node: Node, parent?: string, prevSibling?: string): { root: string, staticRoot: string, static: string, dynamic: string } {
  if (node.nodeType === 3) {
    const text = node.textContent;
    return generateTextContentTemplate(text, parent, prevSibling);
  }

  const tag = (node as Element).tagName.toLowerCase();
  const attrs = parseAttributes(node);

  const statRoot = makeVariable();
  let template = `const ${statRoot} = document.createElement("${tag}");\n`;
  let code = "";
  let dynRoot = makeVariable();
  const childNodes = Array.from(node.childNodes).filter(n => n.nodeType !== 3 || n.textContent.trim());
  const children = [];
  let ps: string | undefined = undefined;
  for (const cn of childNodes) {
    const ch = makeTemplate(cn, dynRoot, ps);
    children.push(ch);
    ps = ch.root;
  }
  if (!parent) {
    code = `const ${dynRoot} = ${statRoot}.cloneNode(true);\n`;
  } else if (!prevSibling) {
    code = `const ${dynRoot} = ${parent}.firstChild;\n`;
  } else {
    code = `const ${dynRoot} = ${prevSibling}.nextSibling;\n`;
  }
  for (const [key, val] of Object.entries(attrs)) {
    if (["each", "if", "then"].includes(key)) continue;
    if ("quoted" in val) {
      if (key === "class" || key.includes("-")) {
        template += `${statRoot}.setAttribute("${key}", "${val.quoted}");\n`;
      } else {
        template += `${statRoot}["${key}"] = "${val.quoted}";\n`;
      }
    }
  }
  for (const [key, val] of Object.entries(attrs)) {
    if (["each", "if", "then"].includes(key)) continue;
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
        code += `$effect(() => {
            const val = ${val.raw};
            if (val !== ${prev}) {
              if (val) ${dynRoot}.className = val;
              else ${dynRoot}.removeAttribute("class")
              ${prev} = val;
            }
          });\n`
        continue;
      }
      if (key.includes("-")) {
        const ran = makeVariable();
        code += `let ${ran} = false;\n`;
        code += `$effect(() => {
            const val = ${val.raw};
            if (val === undefined) {
              if (${ran} && ${dynRoot}.hasAttribute("${key}")) {
                ${dynRoot}.removeAttribute("${key}");
              }
            } else {
              ${dynRoot}.setAttribute("${key}", val);\n
            }
            ${ran} = true;
          });\n`
      } else {
        code += `$effect(() => {
          const val = ${val.raw};
          if (val === undefined) {
            if (${dynRoot}.${key}) {
              delete ${dynRoot}.${key};
            }
          } else {
            ${dynRoot}.${key} = val;\n
          }
        });\n`
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

  const lineCount = code.split("\n").length;
  if (parent && lineCount === 2) {
    code = "";
  }

  return {
    root: dynRoot,
    staticRoot: statRoot,
    static: template,
    dynamic: code,
  };
}

function walk(node, hoist: string[]) {
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
  const makeArg = isComponent ? el.getAttribute("__thyn_component") : `"${tag}"`;
  el.removeAttribute("__thyn_component");
  const attrs = parseAttributes(el);
  const children = Array.from(el.childNodes).map((n) => walk(n, hoist))
    .filter(
      Boolean,
    );

  const hasReactiveChildren = children.some((c) => c.hasReactive);
  const hasComponentChildren = children.some((c) => c.isComponent);
  let hasReactive = hasReactiveChildren || hasComponentChildren;
  if (tag === "slot") {
    return {
      code: `...$props.slot ?? ${children.map((c) => cloneIfNeeded(c.code)).join(", ") || "[]"}`,
      isComponent: false,
      hasReactive,
    };
  }

  let code = "";
  let hasOwnEffects = false;
  if (isComponent) {
    const props: any = {};
    for (const [key, val] of Object.entries(attrs)) {
      if (["each", "if", "then"].includes(key)) continue;
      const value = "raw" in val ? val.raw : JSON.stringify(val.quoted);
      props[key] = value;
    }
    if (children.length) {
      props.slot = `[${children.map((c) => cloneIfNeeded(c.code)).join(", ")}]`;
    }
    code = `__SPARKI__CORE__.component(${makeArg}, ${createObjectCode(props)})`;
  } else {
    code = createHoisting(`document.createElement(${makeArg})`, hoist);
    for (const [key, val] of Object.entries(attrs)) {
      if (["each", "if", "then"].includes(key)) continue;
      if ("quoted" in val) {
        if (key === "class" || key.includes("-")) {
          code = createHoisting(
            `__SPARKI__CORE__.setAttribute(${cloneIfNeeded(code)}, "${key}", "${val.quoted}")`,
            hoist,
          );
        } else {
          code = createHoisting(
            `__SPARKI__CORE__.setProperty(${cloneIfNeeded(code)}, "${key}", "${val.quoted}")`,
            hoist,
          );
        }
      }
    }
    for (const [key, val] of Object.entries(attrs)) {
      if (["each", "if", "then"].includes(key)) continue;
      if (!("raw" in val)) continue;
      if (key.startsWith("on")) {
        code = `__SPARKI__CORE__.setProperty(${cloneIfNeeded(code)}, "${key}", ${val.raw})`;
        continue;
      }
      const reactive = isReactiveExpression(val.raw.replace(/^\(\) => /, ""));
      if (reactive) {
        hasOwnEffects = true;
        hasReactive = true;
        if (key === "class" || key.includes("-")) {
          code = `__SPARKI__CORE__.setReactiveAttribute(${cloneIfNeeded(code)}, "${key}", ${val.raw})`;
        } else {
          code = `__SPARKI__CORE__.setReactiveProperty(${cloneIfNeeded(code)}, "${key}", ${val.raw})`;
        }
        continue;
      }
      if (key === "class" || key.includes("-")) {
        code = createHoisting(
          `__SPARKI__CORE__.setAttribute(${cloneIfNeeded(code)}, "${key}", ${val.raw})`,
          hoist,
        );
      } else {
        code = createHoisting(
          `__SPARKI__CORE__.setProperty(${cloneIfNeeded(code)}, "${key}", ${val.raw})`,
          hoist,
        );
      }
    }
    if (children.length) {
      code = `__SPARKI__CORE__.addChildren(${cloneIfNeeded(code)}, [${children.map((c) => cloneIfNeeded(c.code)).join(", ")}])`;
    }
    if (!hasOwnEffects && hasReactiveChildren) {
      code = `__SPARKI__CORE__.markAsReactive(${cloneIfNeeded(code)})`;
    }
  }

  if ("each" in attrs && "raw" in attrs.each) {
    const eachAttr = attrs.each.raw;
    const [item, iterable] = eachAttr.split(" in ").map((s) => s.trim());
    code = `__SPARKI__CORE__.component(${hasComponentChildren ? "__SPARKI__CORE__.list" : "__SPARKI__CORE__.terminalList"}, {
      items: () => ${iterable},
      render: (${item}) => ${code},
    })`;
    isComponent = true;
  }

  if ("if" in attrs && "raw" in attrs.if) {
    const ifCond = attrs.if.raw;
    code = `__SPARKI__CORE__.component(__SPARKI__CORE__.show, {
      if: () => ${ifCond},
      then: () => ${code},
    })`;
    isComponent = true;
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
    if ([":each", ":if", ":then"].includes(attr.name)) return true;
  }
  return Array.from(node.childNodes).some((n) => hasComponentChildren(n as Element));
}

const forcedChildren = new Map([
  ["tbody", "tr"],
  ["thead", "tr"],
  ["tfoot", "tr"],
  ["ul", "li"],
  ["ol", "li"],
  ["select", "option"],
]);

const COMPONENT_TAG_REGEX = /<\/?([A-Z][a-zA-Z0-9]*)(\s(?:[^"'<>\/]|"[^"]*"|'[^']*')*)?(\/?)>/g;

function preprocessHTML(html: string): string {
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
              : selfClose ? `<${childTag}${attributes || ""} __thyn_component="${componentName}"/>` : `<${childTag}${attributes || ""} __thyn_component="${componentName}">`;
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

function transformHTMLtoJSX(html: string, style: string) {
  const scopeId = `thyn-${(styleId++).toString(36)}`;
  const div = new JSDOM("").window.document.createElement("div");
  const processedHTML = preprocessHTML(html);
  div.innerHTML = "<template>" + processedHTML + "</template>";
  const template = div.firstElementChild;
  const rootElement = (template as HTMLTemplateElement).content.firstElementChild;

  let scopedStyle = null;
  if (style) {
    addScopeId(rootElement, scopeId);
    scopedStyle = style.replace(
      /(^|\})\s*([^{\}]+)\s*\{/g,
      (_, sep, selector) => {
        const scoped = selector
          .split(",")
          .map((s: string) => {
            const trimmed = s.trim();
            return `${trimmed}.${scopeId}`;
          })
          .join(", ");
        return `${sep} ${scoped} {`;
      },
    );
  }

  if (hasComponentChildren(rootElement)) {
    const hoist = [];
    const { code } = walk(rootElement, hoist);
    const root = makeVariable();
    return [root, `const ${root} = ${code};`, hoist, scopedStyle];
  }
  const { root, static: tmpl, dynamic } = makeTemplate(rootElement);
  const hoist = [tmpl];
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

export function transformSFC(source: string, id: string) {
  const name = id.split("/").pop()?.replace(/\.thyn$/, "");
  const { script, scriptLang, html, style } = extractParts(source);
  const { imports, body } = splitScript(script);

  const s = new MagicString("");
  if (!imports.some((imp) => imp.includes("$state"))) {
    s.prepend("import { $state } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$effect"))) {
    s.prepend("import { $effect } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$computed"))) {
    s.prepend("import { $computed } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$compare"))) {
    s.prepend("import { $compare } from '@thyn/core';\n");
  }
  s.prepend("import * as __SPARKI__CORE__ from '@thyn/core';\n");
  s.append(imports.join("\n") + "\n");

  let [root, transformed, hoist, scopedStyle] = transformHTMLtoJSX(html, style);
  s.append(hoist.join("\n") + "\n");

  s.append([
    "",
    `export default function ${name}($props) {`,
    ...body.map((l) => "  " + l),
    `  ${transformed} return ${root};`,
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
  let { scriptLang, output, sourceMap, scopedStyle } = transformSFC(source, id);

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
  if (!imports.some((imp) => imp.includes("$state"))) {
    s.prepend("import { $state } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$effect"))) {
    s.prepend("import { $effect } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$compare"))) {
    s.prepend("import { $compare } from '@thyn/core';\n");
  }
  if (!imports.some((imp) => imp.includes("$computed"))) {
    s.prepend("import { $computed } from '@thyn/core';\n");
  }

  let output = s.toString();
  let sourceMap = s.generateMap({
    source: id,
    includeContent: true,
    hires: true,
  });

  // Transform TypeScript if it's a .ts file
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

let styleId = 1e6;

export default function thyn() {
  const collectedCSS = [];
  let isDev = false;

  return {
    name: "thyn",
    enforce: "pre",

    configResolved(config) {
      isDev = config.command === 'serve';
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
  };
}
