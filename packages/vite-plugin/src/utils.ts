export function extractParts(code: string) {
  const scriptMatch = code.match(/<script([^>]*?)>([\s\S]*?)<\/script>/);
  const styleMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const html = code
    .replace(/<script[^>]*>[\s\S]*?<\/script>/, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/, "")
    .trim();

  let scriptLang = "js";
  if (scriptMatch && scriptMatch[1]) {
    const langMatch = scriptMatch[1].match(/lang\s*=\s*["']([^"']+)["']/);
    if (langMatch) {
      scriptLang = langMatch[1];
    }
  }

  return {
    script: scriptMatch?.[2]?.trim() ?? "",
    scriptLang,
    style: styleMatch?.[1]?.trim() ?? "",
    html,
  };
};

export function splitScript(script: string) {
  if (!script || typeof script !== "string") {
    return { imports: [], body: [] };
  }

  const lines = script.split("\n");
  const imports = [];
  const body = [];
  let currentImport = [];
  let inImport = false;
  let braceCount = 0;
  let inString = false;
  let stringChar = "";
  let inMultiLineComment = false;

  // Helper function to check if import is complete without semicolon
  function isImportComplete(line, braceCount, inString) {
    // If we have balanced braces and not in a string, check if next non-empty line starts a new statement
    if (braceCount === 0 && !inString) {
      // Look ahead to see if next line starts a new statement/declaration
      const nextLineIndex = lines.indexOf(line) + 1;
      for (let i = nextLineIndex; i < lines.length; i++) {
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

      if (line.includes("*/")) {
        inMultiLineComment = false;
      }
      continue;
    }

    // Check for start of multi-line comment
    if (line.includes("/*") && !inString) {
      inMultiLineComment = true;
      if (inImport) {
        currentImport.push(line);
      } else {
        body.push(line);
      }

      if (!line.includes("*/")) {
        continue;
      } else {
        inMultiLineComment = false;
      }
    }

    // Skip single-line comments when not in import
    if (trimmed.startsWith("//") && !inImport) {
      body.push(line);
      continue;
    }

    // Skip empty lines when not in import
    if (!trimmed && !inImport) {
      body.push(line);
      continue;
    }

    // Start of import statement
    if (!inImport && trimmed.startsWith("import")) {
      inImport = true;
      currentImport = [line];
      braceCount = 0;
      inString = false;

      // Count braces and track strings in the import line
      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (inString) {
          if (char === stringChar && line[j - 1] !== "\\") {
            inString = false;
            stringChar = "";
          }
        } else {
          if (char === '"' || char === "'" || char === "`") {
            inString = true;
            stringChar = char;
          } else if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
          }
        }
      }

      // Check if import is complete
      if (
        (trimmed.endsWith(";") ||
          isImportComplete(trimmed, braceCount, inString)) &&
        braceCount === 0 && !inString
      ) {
        imports.push(currentImport.join("\n"));
        currentImport = [];
        inImport = false;
      }
    } // Continue import statement
    else if (inImport) {
      currentImport.push(line);

      // Count braces and track strings in the current line
      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (inString) {
          if (char === stringChar && line[j - 1] !== "\\") {
            inString = false;
            stringChar = "";
          }
        } else {
          if (char === '"' || char === "'" || char === "`") {
            inString = true;
            stringChar = char;
          } else if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
          }
        }
      }

      // Check if import is complete
      if (
        (trimmed.endsWith(";") ||
          isImportComplete(trimmed, braceCount, inString)) &&
        braceCount === 0 && !inString
      ) {
        imports.push(currentImport.join("\n"));
        currentImport = [];
        inImport = false;
      }
    } // Regular body content
    else {
      body.push(line);
    }
  }

  // Handle unterminated import (likely malformed)
  if (currentImport.length > 0) {
    imports.push(currentImport.join("\n"));
  }

  return {
    imports: imports.filter((imp) => imp.trim()),
    body: body.length > 0 ? body : [""],
  };
}
