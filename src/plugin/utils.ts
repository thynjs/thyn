export function extractParts(code: string) {
  // Helper to check if a position is inside a string literal or comment
  // within a specific range (used for checking script content only)
  function isInsideStringOrComment(code: string, startPos: number, endPos: number): boolean {
    let inString = false;
    let stringChar = '';
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;
    
    for (let i = startPos; i < endPos; i++) {
      const char = code[i];
      const nextChar = code[i + 1];
      
      if (inLineComment) {
        if (char === '\n') {
          inLineComment = false;
        }
        continue;
      }
      
      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++; // skip the '/'
        }
        continue;
      }
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      // Check for comment start
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++; // skip the second '/'
        continue;
      }
      
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++; // skip the '*'
        continue;
      }
      
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }
    
    return inString || inLineComment || inBlockComment;
  }

  // Find all script tag positions with their boundaries
  function findScriptBoundaries(code: string): Array<{ start: number; end: number; attrs: string }> {
    const boundaries = [];
    const openRegex = /<script([^>]*)>/gi;
    const closeRegex = /<\/script>/gi;
    let openMatch;
    
    while ((openMatch = openRegex.exec(code)) !== null) {
      const openIndex = openMatch.index;
      const openLength = openMatch[0].length;
      const attrs = openMatch[1] || '';
      
      // Find matching close tag
      closeRegex.lastIndex = openIndex + openLength;
      let closeMatch;
      while ((closeMatch = closeRegex.exec(code)) !== null) {
        // Check if this close tag is inside a JS string within this script
        const contentStart = openIndex + openLength;
        if (!isInsideStringOrComment(code, contentStart, closeMatch.index)) {
          boundaries.push({
            start: openIndex,
            end: closeMatch.index + closeMatch[0].length,
            attrs
          });
          break;
        }
      }
    }
    
    return boundaries;
  }

  // Find the real script section (not inside a string of another script)
  function findScriptSection(code: string): { start: number; contentStart: number; contentEnd: number; end: number; attrs: string } | null {
    const allBoundaries = findScriptBoundaries(code);
    if (allBoundaries.length === 0) return null;
    
    // The first script tag is the real one if it's not inside any other script's string
    // Check each boundary to see if it's inside another script's content
    for (const boundary of allBoundaries) {
      let isInsideAnotherScript = false;
      
      for (const other of allBoundaries) {
        if (other === boundary) continue;
        
        // Check if this boundary is inside another script's content
        const otherContentStart = other.start + code.slice(other.start, other.end).indexOf('>') + 1;
        const otherContentEnd = other.end - code.slice(other.end - 10, other.end).indexOf('<') - 10 + code.slice(other.end - 10, other.end).indexOf('<');
        
        if (boundary.start > otherContentStart && boundary.start < other.end) {
          // This boundary is inside another script's content area
          // Check if it's inside a JS string
          if (isInsideStringOrComment(code, otherContentStart, boundary.start)) {
            isInsideAnotherScript = true;
            break;
          }
        }
      }
      
      if (!isInsideAnotherScript) {
        // This is the real script section
        const openTagEnd = code.indexOf('>', boundary.start) + 1;
        const closeTagStart = code.lastIndexOf('<', boundary.end - 1);
        return {
          start: boundary.start,
          contentStart: openTagEnd,
          contentEnd: closeTagStart,
          end: boundary.end,
          attrs: boundary.attrs
        };
      }
    }
    
    return null;
  }

  // Find the real style section (outside of script sections)
  function findStyleSection(code: string): { start: number; contentStart: number; contentEnd: number; end: number } | null {
    const scriptBoundaries = findScriptBoundaries(code);
    const openRegex = /<style[^>]*>/gi;
    const closeRegex = /<\/style>/gi;
    let openMatch;
    
    while ((openMatch = openRegex.exec(code)) !== null) {
      const openIndex = openMatch.index;
      
      // Check if this style tag is inside any script section
      let isInsideScript = false;
      for (const script of scriptBoundaries) {
        const contentStart = script.start + code.slice(script.start, script.end).indexOf('>') + 1;
        const contentEnd = script.end - code.slice(script.end - 10, script.end).indexOf('<') - 10 + code.slice(script.end - 10, script.end).indexOf('<');
        
        if (openIndex >= contentStart && openIndex < script.end) {
          // It's in the script section, check if inside a JS string
          if (isInsideStringOrComment(code, contentStart, openIndex)) {
            isInsideScript = true;
            break;
          }
        }
      }
      
      if (!isInsideScript) {
        // Found a real style tag, now find its close tag
        const contentStart = openIndex + openMatch[0].length;
        closeRegex.lastIndex = contentStart;
        let closeMatch;
        while ((closeMatch = closeRegex.exec(code)) !== null) {
          // Make sure close tag is also outside scripts
          let closeIsInsideScript = false;
          for (const script of scriptBoundaries) {
            const scriptContentStart = script.start + code.slice(script.start, script.end).indexOf('>') + 1;
            if (closeMatch.index >= scriptContentStart && closeMatch.index < script.end) {
              if (isInsideStringOrComment(code, scriptContentStart, closeMatch.index)) {
                closeIsInsideScript = true;
                break;
              }
            }
          }
          if (!closeIsInsideScript) {
            return {
              start: openIndex,
              contentStart: contentStart,
              contentEnd: closeMatch.index,
              end: closeMatch.index + closeMatch[0].length
            };
          }
        }
      }
    }
    return null;
  }

  // Extract sections
  const scriptSection = findScriptSection(code);
  const styleSection = findStyleSection(code);

  let script = "";
  let scriptLang = "js";
  
  if (scriptSection) {
    script = code.slice(scriptSection.contentStart, scriptSection.contentEnd).trim();
    const langMatch = scriptSection.attrs.match(/lang\s*=\s*["']([^"']+)["']/);
    if (langMatch) {
      scriptLang = langMatch[1];
    }
  }

  let style = "";
  if (styleSection) {
    style = code.slice(styleSection.contentStart, styleSection.contentEnd).trim();
  }

  // Build HTML by removing script and style sections
  // Remove from highest index to lowest to preserve indices
  let html = code;
  const sections = [];
  if (scriptSection) {
    sections.push({ start: scriptSection.start, end: scriptSection.end });
  }
  if (styleSection) {
    sections.push({ start: styleSection.start, end: styleSection.end });
  }
  // Sort by start position descending (remove from end first)
  sections.sort((a, b) => b.start - a.start);
  
  for (const section of sections) {
    html = html.slice(0, section.start) + html.slice(section.end);
  }
  html = html.trim();

  return {
    script,
    scriptLang,
    style,
    html,
  };
};

export function escapeTemplateLiteral(text: string): string {
  return text
    .replace(/\\/g, '\\\\')     // Escape backslashes
    .replace(/`/g, '\\`')       // Escape backticks
    .replace(/\$/g, '\\$');  // Escape interpolation
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function splitScript(script: string) {
  if (!script || typeof script !== "string") {
    return { imports: [], body: [] };
  }

  const lines = script.split("\n");
  const imports = [];
  const body = [];
  let currentImport: string[] = [];
  let inImport = false;
  let braceCount = 0;
  let inString = false;
  let stringChar = "";
  let inMultiLineComment = false;
  let escaped = false;

  // Helper function to check if import is complete without semicolon
  function isImportComplete(lineIndex: number, braceCount: number, inString: boolean): boolean {
    // If we have balanced braces and not in a string, check if next non-empty line starts a new statement
    if (braceCount === 0 && !inString) {
      // Look ahead to see if next line starts a new statement/declaration
      for (let i = lineIndex + 1; i < lines.length; i++) {
        const nextLine = lines[i].trim();
        if (
          !nextLine || nextLine.startsWith("//") || nextLine.startsWith("/*")
        ) {
          continue; // Skip empty lines and comments
        }
        // If next line starts with typical JS keywords/patterns, current import is complete
        return /^(const|let|var|function|class|export|if|for|while|switch|try|return|\w+\s*[=:]|\w+\()/
          .test(nextLine);
      }
      // If we reached end of file, import is complete
      return true;
    }
    return false;
  }

  // Process each line, maintaining string/comment state
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle multi-line comments
    if (inMultiLineComment) {
      if (inImport) {
        currentImport.push(line);
      } else {
        body.push(line);
      }

      // Check for end of multi-line comment, tracking strings
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = "";
        } else if (!inString && char === '*' && line[j + 1] === '/') {
          inMultiLineComment = false;
          break;
        }
      }
      continue;
    }

    // Check for start of multi-line comment (only if not in string)
    if (!inString && line.includes("/*")) {
      inMultiLineComment = true;
      if (inImport) {
        currentImport.push(line);
      } else {
        body.push(line);
      }

      // Check if comment ends on same line
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar) {
          inString = false;
          stringChar = "";
        } else if (!inString && char === '*' && line[j + 1] === '/') {
          inMultiLineComment = false;
          break;
        }
      }
      
      if (!inMultiLineComment) {
        // Comment ended on same line
        continue;
      }
    }

    // Skip single-line comments when not in import (only if not in string)
    if (!inString && !inImport && trimmed.startsWith("//")) {
      body.push(line);
      continue;
    }

    // Skip empty lines when not in import
    if (!trimmed && !inImport) {
      body.push(line);
      continue;
    }

    // Process the line character by character to maintain string state
    let lineBraceCount = 0;
    let lineInString = inString;
    let lineStringChar = stringChar;
    let lineEscaped = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (lineEscaped) {
        lineEscaped = false;
        continue;
      }

      if (char === '\\' && lineInString) {
        lineEscaped = true;
        continue;
      }

      if (!lineInString && (char === '"' || char === "'" || char === '`')) {
        lineInString = true;
        lineStringChar = char;
      } else if (lineInString && char === lineStringChar) {
        lineInString = false;
        lineStringChar = "";
      } else if (!lineInString && char === '{') {
        lineBraceCount++;
      } else if (!lineInString && char === '}') {
        lineBraceCount--;
      }
    }

    // Start of import statement (only if not inside a string)
    if (!inImport && !inString && trimmed.startsWith("import")) {
      inImport = true;
      currentImport = [line];
      braceCount = lineBraceCount;
      inString = lineInString;
      stringChar = lineStringChar;

      // Check if import is complete on this line
      if (
        (trimmed.endsWith(";") ||
          isImportComplete(i, braceCount, inString)) &&
        braceCount === 0 && !inString
      ) {
        imports.push(currentImport.join("\n"));
        currentImport = [];
        inImport = false;
      }
    } // Continue import statement
    else if (inImport) {
      currentImport.push(line);
      braceCount += lineBraceCount;
      inString = lineInString;
      stringChar = lineStringChar;

      // Check if import is complete
      if (
        (trimmed.endsWith(";") ||
          isImportComplete(i, braceCount, inString)) &&
        braceCount === 0 && !inString
      ) {
        imports.push(currentImport.join("\n"));
        currentImport = [];
        inImport = false;
      }
    } // Regular body content
    else {
      body.push(line);
      // Update global string state
      inString = lineInString;
      stringChar = lineStringChar;
    }
  }

  // Handle unterminated import (likely malformed or still in string)
  if (currentImport.length > 0) {
    if (inImport && !inString) {
      // Import seems complete but wasn't captured properly
      imports.push(currentImport.join("\n"));
    } else {
      // Still in string or incomplete, treat as body
      body.push(...currentImport);
    }
  }

  return {
    imports: imports.filter((imp) => imp.trim()),
    body: body.length > 0 ? body : [""],
  };
}
