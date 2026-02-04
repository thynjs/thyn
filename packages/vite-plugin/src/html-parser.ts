interface Node {
  nodeType: number;
  nodeName: string;
  textContent: string;
  childNodes: Node[];
}

interface Element extends Node {
  tagName: string;
  attributes: Array<{ name: string; value: string }>;
  children: Element[];
  firstElementChild: Element | null;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  classList: { add(className: string): void };
}

interface DocumentFragment {
  childNodes: Node[];
  firstElementChild: Element | null;
}

interface TemplateElement extends Element {
  content: DocumentFragment;
}

function parseAttributes(attrStr: string): Array<{ name: string; value: string }> {
  const attrs: Array<{ name: string; value: string }> = []
  let i = 0;

  while (i < attrStr.length) {
    // Skip whitespace
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++;
    if (i >= attrStr.length) break;

    // Parse attribute name
    let name = "";
    while (i < attrStr.length && !/[\s=]/.test(attrStr[i])) {
      name += attrStr[i];
      i++;
    }

    if (!name) break;

    // Skip whitespace
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++;

    let value = "";
    if (i < attrStr.length && attrStr[i] === "=") {
      i++; // skip '='
      // Skip whitespace
      while (i < attrStr.length && /\s/.test(attrStr[i])) i++;

      if (i < attrStr.length) {
        const quote = attrStr[i];
        if (quote === '"' || quote === "'") {
          i++; // skip opening quote
          while (i < attrStr.length && attrStr[i] !== quote) {
            value += attrStr[i];
            i++;
          }
          if (i < attrStr.length) i++; // skip closing quote
        } else {
          // Unquoted value - take until whitespace
          while (i < attrStr.length && !/\s/.test(attrStr[i])) {
            value += attrStr[i];
            i++;
          }
        }
      }
    }

    attrs.push({ name, value });
  }

  return attrs;
}

function createTextNode(text: string): Node {
  return {
    nodeType: 3,
    nodeName: "#text",
    textContent: text,
    childNodes: [],
  };
}

function createElement(tagName: string, attributes: Array<{ name: string; value: string }> = []): Element {
  const children: Element[] = [];
  const childNodes: Node[] = [];

  const element: Element = {
    nodeType: 1,
    nodeName: tagName.toUpperCase(),
    tagName: tagName.toUpperCase(),
    textContent: "",
    attributes: [...attributes],
    children,
    childNodes,
    firstElementChild: null,
    hasAttribute(name: string): boolean {
      return this.attributes.some((attr) => attr.name === name);
    },
    getAttribute(name: string): string | null {
      const attr = this.attributes.find((attr) => attr.name === name);
      return attr ? attr.value : null;
    },
    setAttribute(name: string, value: string): void {
      const existing = this.attributes.find((attr) => attr.name === name);
      if (existing) {
        existing.value = value;
      } else {
        this.attributes.push({ name, value });
      }
    },
    removeAttribute(name: string): void {
      this.attributes = this.attributes.filter((attr) => attr.name !== name);
    },
    classList: {
      add: (className: string) => {
        const existing = element.getAttribute("class");
        const classes = existing ? existing.split(" ").filter(Boolean) : [];
        if (!classes.includes(className)) {
          classes.push(className);
          element.setAttribute("class", classes.join(" "));
        }
      },
    },
  };

  return element;
}

// Find next tag position, properly handling quoted strings
function findNextTag(html: string, startIndex: number): { index: number; endIndex: number; isClose: boolean; tagName: string; attrs: string; isSelfClose: boolean } | null {
  let i = startIndex;
  
  while (i < html.length) {
    // Find the next '<'
    while (i < html.length && html[i] !== '<') {
      i++;
    }
    
    if (i >= html.length) return null;
    
    const tagStart = i;
    i++; // skip '<'
    
    // Check if it's a closing tag
    const isClose = i < html.length && html[i] === '/';
    if (isClose) i++;
    
    // Parse tag name
    let tagName = '';
    while (i < html.length && /[a-zA-Z0-9-]/.test(html[i])) {
      tagName += html[i];
      i++;
    }
    
    if (!tagName) {
      // Not a valid tag, continue searching
      i = tagStart + 1;
      continue;
    }
    
    // Parse attributes, respecting quotes
    let attrs = '';
    let inQuote: string | null = null;
    let tagEnd = -1;
    
    while (i < html.length) {
      const char = html[i];
      
      if (inQuote) {
        attrs += char;
        if (char === inQuote) {
          inQuote = null;
        }
        i++;
      } else if (char === '"' || char === "'") {
        attrs += char;
        inQuote = char;
        i++;
      } else if (char === '>') {
        tagEnd = i + 1; // Include the '>'
        i++;
        break;
      } else {
        attrs += char;
        i++;
      }
    }
    
    if (tagEnd === -1) {
      // Malformed tag (no closing >), continue searching
      i = tagStart + 1;
      continue;
    }
    
    // Check for self-closing
    const trimmedAttrs = attrs.trim();
    const isSelfClose = trimmedAttrs.endsWith('/');
    const finalAttrs = isSelfClose ? trimmedAttrs.slice(0, -1).trim() : trimmedAttrs;
    
    return {
      index: tagStart,
      endIndex: tagEnd,
      isClose,
      tagName,
      attrs: finalAttrs,
      isSelfClose
    };
  }
  
  return null;
}

export function parseHTML(html: string): TemplateElement {
  const match = html.match(/<template([^>]*)>([\s\S]*)<\/template>/i);

  if (!match) {
    throw new Error("No <template> tag found in HTML");
  }

  const content = match[2].trim();
  const stack: Element[] = [];
  const textChunks: string[] = [];
  const fragmentChildren: Node[] = [];
  const fragmentElements: Element[] = [];

  let pos = 0;

  const flushText = () => {
    if (textChunks.length > 0) {
      const text = textChunks.join("");
      textChunks.length = 0;
      const textNode = createTextNode(text);
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.childNodes.push(textNode);
      } else {
        fragmentChildren.push(textNode);
      }
    }
  };

  while (pos < content.length) {
    const tagInfo = findNextTag(content, pos);
    
    if (!tagInfo) {
      // No more tags, add remaining as text
      if (pos < content.length) {
        textChunks.push(content.slice(pos));
      }
      break;
    }
    
    // Add text before this tag
    if (tagInfo.index > pos) {
      textChunks.push(content.slice(pos, tagInfo.index));
    }
    
    const { isClose, tagName, attrs, isSelfClose, endIndex } = tagInfo;
    
    if (isClose) {
      flushText();
      if (stack.length > 0) {
        const closedElement = stack.pop()!;
        if (closedElement.tagName.toLowerCase() !== tagName.toLowerCase()) {
          throw new Error(`Mismatched tags: expected </${closedElement.tagName}>, got </${tagName}>`);
        }

        // Update parent's firstElementChild if needed
        const parent = stack.length > 0 ? stack[stack.length - 1] : null;
        if (parent && !parent.firstElementChild) {
          parent.firstElementChild = closedElement;
        }
      }
    } else {
      flushText();
      const attributes = parseAttributes(attrs);
      const element = createElement(tagName, attributes);

      if (stack.length === 0) {
        // Top-level element
        fragmentChildren.push(element);
        fragmentElements.push(element);
      } else {
        const parent = stack[stack.length - 1];
        parent.children.push(element);
        parent.childNodes.push(element);
        if (!parent.firstElementChild) {
          parent.firstElementChild = element;
        }
      }

      if (!isSelfClose) {
        stack.push(element);
      }
    }
    
    // Move position past this tag
    pos = endIndex;
  }

  // Flush any remaining text
  if (stack.length === 0) {
    flushText();
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed tags remain: ${stack.map(e => e.tagName).join(', ')}`);
  }

  const fragment: DocumentFragment = {
    childNodes: fragmentChildren,
    firstElementChild: fragmentElements[0] || null,
  };

  const templateAttrs = parseAttributes(match[1].trim());
  const templateElement: TemplateElement = {
    ...createElement("template", templateAttrs),
    content: fragment,
  };
  templateElement.childNodes = [...fragmentChildren];
  templateElement.children = [...fragmentElements];
  templateElement.firstElementChild = fragmentElements[0] || null;

  return templateElement;
}
