import * as fs from "fs";

export function getVirtualContent(uri: any) {
  var originalPath = uri.path;
  var fragment = uri.fragment; // e.g., 'script' or 'style'
  var fileContent = fs.readFileSync(originalPath, "utf8");
  if (fragment === "script") {
    var match = fileContent.match(/<script>([\s\S]*?)<\/script>/);
    return match ? match[1].trim() : "";
  } else if (fragment === "style") {
    var match = fileContent.match(/<style>([\s\S]*?)<\/style>/);
    return match ? match[1].trim() : "";
  }
  return fileContent; // Fallback to full content
}
