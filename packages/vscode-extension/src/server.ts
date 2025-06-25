import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import {
  CompletionItemKind,
  getCSSLanguageService,
  LanguageService as CSSLanguageService,
  Stylesheet,
} from "vscode-css-languageservice";
import {
  getLanguageService,
  TextDocument as HTMLTextDocument,
} from "vscode-html-languageservice";
import {
  CompletionItem,
  CompletionList,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  Hover,
  InitializeParams,
  ProposedFeatures,
  Range,
  TextDocumentChangeEvent,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

// @ts-expect-error
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;

let cssLanguageService: CSSLanguageService;
let tsLanguageService: ts.LanguageService;
let tsLanguageServiceHost: LanguageServiceHost;
const htmlLanguageService = getLanguageService();
const htmlCache = new Map<
  string,
  { document: HTMLTextDocument; stylesheet: any; version: number }
>();

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  cssLanguageService = getCSSLanguageService();

  tsLanguageServiceHost = createLanguageServiceHost(documents);
  tsLanguageService = ts.createLanguageService(
    tsLanguageServiceHost,
    ts.createDocumentRegistry(),
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }
});

interface LanguageServiceHost extends ts.LanguageServiceHost {
  getScriptFileNames(): string[];
  getScriptVersion(fileName: string): string;
  getScriptSnapshot(fileName: string): ts.IScriptSnapshot;
  getCurrentDirectory(): string;
  getCompilationSettings(): ts.CompilerOptions;
  getDefaultLibFileName(options: ts.CompilerOptions): string;
  getThynDocuments(): Map<string, TextDocument>;
  updateDocument(uri: string, content: string, version: number): void;

  fileExists(path: string): boolean;
  readFile(path: string, encoding?: string): string;
  directoryExists(directoryName: string): boolean;
  getDirectories(path: string): string[];
  readDirectory(
    path: string,
    extensions?: readonly string[],
    exclude?: readonly string[],
    include?: readonly string[],
    depth?: number,
  ): string[];
  getCanonicalFileName(fileName: string): string;
}

function uriToFsPath(uri: string): string {
  if (uri.startsWith("file://")) {
    // Handle Windows paths properly
    const decoded = decodeURIComponent(uri.substring("file://".length));
    return decoded.replace(/^\/([A-Za-z]:)/, "$1"); // Convert /C: to C:
  }
  return uri;
}

function fsPathToUri(fsPath: string): string {
  const normalized = path.resolve(fsPath).replace(/\\/g, "/");
  // Handle Windows drive letters
  const withPrefix = normalized.replace(/^([A-Za-z]:)/, "/$1");
  return "file://" + encodeURI(withPrefix).replace(/#/g, "%23");
}

function resolveThynModule(
  moduleName: string,
  containingFile: string,
): string | undefined {
  const containingDir = path.dirname(uriToFsPath(containingFile));

  // Handle relative imports
  if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
    const resolvedPath = path.resolve(containingDir, moduleName);

    // Try with .thyn extension first
    const thynPath = resolvedPath + ".thyn";
    if (fs.existsSync(thynPath)) {
      return fsPathToUri(thynPath);
    }

    // Try with .js extension
    const jsPath = resolvedPath + ".js";
    if (fs.existsSync(jsPath)) {
      return fsPathToUri(jsPath);
    }

    // Try with .ts extension
    const tsPath = resolvedPath + ".ts";
    if (fs.existsSync(tsPath)) {
      return fsPathToUri(tsPath);
    }

    // Try without extension if it already has an extension
    if (fs.existsSync(resolvedPath)) {
      return fsPathToUri(resolvedPath);
    }

    // Try index files
    const indexThyn = path.join(resolvedPath, "index.thyn");
    if (fs.existsSync(indexThyn)) {
      return fsPathToUri(indexThyn);
    }

    const indexJs = path.join(resolvedPath, "index.js");
    if (fs.existsSync(indexJs)) {
      return fsPathToUri(indexJs);
    }

    const indexTs = path.join(resolvedPath, "index.ts");
    if (fs.existsSync(indexTs)) {
      return fsPathToUri(indexTs);
    }
  }

  return undefined;
}

const scriptContents = new Map<
  string,
  { content: string; version: number }
>();

function loadUserTsConfig(workspaceRoot: string): ts.CompilerOptions {
  try {
    const configPath = ts.findConfigFile(
      workspaceRoot,
      ts.sys.fileExists,
      "tsconfig.json",
    );

    if (!configPath) {
      console.warn("No tsconfig.json found, using defaults");
      return getDefaultCompilerOptions();
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) throw configFile.error;

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );

    return { ...getDefaultCompilerOptions(), ...parsed.options };
  } catch (err) {
    console.error("Failed to load tsconfig.json:", err);
    return getDefaultCompilerOptions();
  }
}

function getDefaultCompilerOptions(): ts.CompilerOptions {
  return {
    allowNonTsExtensions: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    allowJs: true,
    allowArbitraryExtensions: true,
    lib: ["lib.dom.d.ts", "lib.esnext.d.ts"],
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    // Critical for .thyn files
    allowUmdGlobalAccess: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  };
}

// Track all .thyn files discovered during resolution
const thynFiles = new Set<string>();

function createLanguageServiceHost(
  mainDocuments: TextDocuments<TextDocument>,
): LanguageServiceHost {
  scriptContents.set("thyn:globals.d.ts", {
    version: 1,
    content: `
      declare function $signal<T>(value: T): ((() => T) | (((current: T) => T) => void) | ((value: T) => void));
      declare function $effect(fn: () => (() => void) | void): void;
      declare function $props<T = any>(): T;
    `,
  });

  // Add type declarations for .thyn modules
  scriptContents.set("thyn:module-types.d.ts", {
    version: 1,
    content: `
      declare module "*.thyn" {
        const component: any;
        export default component;
        export * from "*.thyn";
      }
    `,
  });

  const workspaceRoot = process.cwd();
  const compilerOptions = loadUserTsConfig(workspaceRoot);

  console.log("Final compiler options:", compilerOptions);

  const currentDirectory = process.cwd();

  const host: LanguageServiceHost = {
    resolveModuleNames: (
      moduleNames: string[],
      containingFile: string,
    ): (ts.ResolvedModule | undefined)[] => {
      return moduleNames.map((moduleName) => {
        console.log(`Resolving "${moduleName}" from "${containingFile}"`);

        // Convert URI to file system path for resolution
        const containingFilePath = uriToFsPath(containingFile);

        // First try custom resolution for .thyn and relative .js files
        const customResolved = resolveThynModule(moduleName, containingFile);
        if (customResolved) {
          const resolvedPath = uriToFsPath(customResolved);
          const extension = path.extname(resolvedPath);

          // Track .thyn files so they're included in the project
          if (extension === ".thyn") {
            thynFiles.add(customResolved);
            // Also add the transformed version to script contents
            try {
              const content = fs.readFileSync(resolvedPath, "utf8");
              const parsed = parseThyn(content);
              scriptContents.set(customResolved, {
                content: parsed.script.content,
                version: Date.now(),
              });
            } catch (e) {
              console.error(
                `Failed to load .thyn file ${customResolved}:`,
                e,
              );
            }
          }

          console.log(`✓ Custom resolved: ${customResolved}`);
          return {
            resolvedFileName: customResolved,
            isExternalLibraryImport: false,
            extension: extension as ts.Extension,
          };
        }

        // Let TypeScript handle standard module resolution
        const result = ts.resolveModuleName(
          moduleName,
          containingFilePath,
          compilerOptions,
          {
            ...ts.sys,
            fileExists: (fileName: string) => {
              // Normalize the fileName
              const normalizedFileName = path.resolve(fileName);
              const uri = fsPathToUri(normalizedFileName);

              const exists = scriptContents.has(fileName) ||
                scriptContents.has(normalizedFileName) ||
                scriptContents.has(uri) ||
                fs.existsSync(normalizedFileName);

              console.log(`[fileExists] ${fileName} -> ${exists}`);
              return exists;
            },
            readFile: (fileName: string, encoding?: string) => {
              const normalizedFileName = path.resolve(fileName);
              const uri = fsPathToUri(normalizedFileName);

              // Check cache first
              if (scriptContents.has(fileName)) {
                return scriptContents.get(fileName)!.content;
              }
              if (scriptContents.has(normalizedFileName)) {
                return scriptContents.get(normalizedFileName)!.content;
              }
              if (scriptContents.has(uri)) {
                return scriptContents.get(uri)!.content;
              }

              try {
                const content = fs.readFileSync(
                  normalizedFileName,
                ).toString();
                console.log(`[readFile] ${fileName}`);

                // Transform .thyn files
                if (fileName.endsWith(".thyn")) {
                  const parsed = parseThyn(content);
                  return parsed.script.content;
                }

                return content;
              } catch (e) {
                console.log(`[readFile] Failed to read: ${fileName}`, e);
                return "";
              }
            },
          },
        );

        console.log(
          `TypeScript resolution result for "${moduleName}":`,
          result,
        );

        // Convert resolved path back to URI if found
        if (result.resolvedModule) {
          const resolvedFileName = result.resolvedModule.resolvedFileName;
          const uri = resolvedFileName.startsWith("file://")
            ? resolvedFileName
            : fsPathToUri(resolvedFileName);

          return {
            ...result.resolvedModule,
            resolvedFileName: uri,
          };
        }

        return result.resolvedModule;
      });
    },

    getScriptFileNames: () => {
      // Include all cached files plus discovered .thyn files
      const allFiles = new Set([
        ...Array.from(scriptContents.keys()),
        ...Array.from(thynFiles),
        ...mainDocuments.all().map((doc) => doc.uri),
      ]);

      const fileNames = Array.from(allFiles);
      console.log("[getScriptFileNames]", fileNames);
      return fileNames;
    },

    getScriptSnapshot: (fileName: string): ts.IScriptSnapshot => {
      console.log(`[getScriptSnapshot] ${fileName}`);

      // Check cache first
      const entry = scriptContents.get(fileName);
      if (entry) {
        return ts.ScriptSnapshot.fromString(entry.content);
      }

      // Convert URI to file path if needed
      const filePath = uriToFsPath(fileName);
      const cacheEntry = scriptContents.get(filePath);
      if (cacheEntry) {
        return ts.ScriptSnapshot.fromString(cacheEntry.content);
      }

      // Try to read from file system
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf8");

          // Transform .thyn files
          if (filePath.endsWith(".thyn")) {
            const parsed = parseThyn(content);
            return ts.ScriptSnapshot.fromString(parsed.script.content);
          }

          return ts.ScriptSnapshot.fromString(content);
        }
      } catch (error) {
        console.warn(`Failed to read file ${fileName}:`, error);
      }

      return ts.ScriptSnapshot.fromString("");
    },

    getScriptVersion: (fileName: string) => {
      if (scriptContents.has(fileName)) {
        return scriptContents.get(fileName)!.version.toString();
      }

      const filePath = uriToFsPath(fileName);
      if (scriptContents.has(filePath)) {
        return scriptContents.get(filePath)!.version.toString();
      }

      try {
        const stats = fs.statSync(filePath);
        return stats.mtimeMs.toString();
      } catch {
        return "0";
      }
    },

    getCurrentDirectory: () => currentDirectory,
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options: ts.CompilerOptions) =>
      ts.getDefaultLibFilePath(options),

    log: (s) => console.log(`[TS Host] ${s}`),
    trace: (s) => console.log(`[TS Host Trace] ${s}`),
    error: (s) => console.error(`[TS Host Error] ${s}`),
    getNewLine: () => "\n",

    fileExists: (fileName: string): boolean => {
      const filePath = uriToFsPath(fileName);
      const normalizedPath = path.resolve(filePath);
      const uri = fsPathToUri(normalizedPath);

      const exists = scriptContents.has(fileName) ||
        scriptContents.has(filePath) ||
        scriptContents.has(normalizedPath) ||
        scriptContents.has(uri) ||
        fs.existsSync(normalizedPath);

      console.log(`[fileExists] ${fileName} -> ${exists}`);
      return exists;
    },

    readFile: (fileName: string, encoding?: string): string => {
      const filePath = uriToFsPath(fileName);
      const normalizedPath = path.resolve(filePath);
      const uri = fsPathToUri(normalizedPath);

      // Check cache first
      if (scriptContents.has(fileName)) {
        return scriptContents.get(fileName)!.content;
      }
      if (scriptContents.has(filePath)) {
        return scriptContents.get(filePath)!.content;
      }
      if (scriptContents.has(normalizedPath)) {
        return scriptContents.get(normalizedPath)!.content;
      }
      if (scriptContents.has(uri)) {
        return scriptContents.get(uri)!.content;
      }

      try {
        const content = fs.readFileSync(normalizedPath).toString();
        console.log(`[readFile] ${fileName}`);
        return content;
      } catch (e) {
        console.error(`[readFile] Failed to read ${fileName}:`, e);
        return "";
      }
    },

    directoryExists: (directoryName: string): boolean => {
      try {
        const filePath = uriToFsPath(directoryName);
        const isDir = fs.statSync(filePath).isDirectory();
        console.log(`[directoryExists] ${directoryName}: ${isDir}`);
        return isDir;
      } catch {
        console.log(`[directoryExists] ${directoryName}: false`);
        return false;
      }
    },

    getDirectories: (pathName: string): string[] => {
      try {
        const filePath = uriToFsPath(pathName);
        return fs.readdirSync(filePath).filter((name) => {
          try {
            return fs.statSync(path.join(filePath, name)).isDirectory();
          } catch {
            return false;
          }
        });
      } catch {
        return [];
      }
    },

    readDirectory: (
      pathName: string,
      extensions?: readonly string[],
      exclude?: readonly string[],
      include?: readonly string[],
      depth?: number,
    ): string[] => {
      try {
        const filePath = uriToFsPath(pathName);
        const filesAndDirs = fs.readdirSync(filePath);
        const results: string[] = [];

        for (const item of filesAndDirs) {
          const fullPath = path.join(filePath, item);
          const stat = fs.statSync(fullPath);

          if (stat.isFile()) {
            if (!extensions || extensions.some((ext) => item.endsWith(ext))) {
              results.push(fsPathToUri(fullPath));
            }
          } else if (stat.isDirectory()) {
            results.push(fsPathToUri(fullPath));
          }
        }

        return results;
      } catch {
        return [];
      }
    },

    getCanonicalFileName: (fileName: string): string => {
      // Normalize file names for case-insensitive file systems
      return fileName.toLowerCase();
    },

    getThynDocuments: () =>
      new Map(mainDocuments.all().map((doc) => [doc.uri, doc])),

    updateDocument: (uri: string, content: string, version: number) => {
      console.log(`[updateDocument] ${uri} v${version}`);

      // If it's a .thyn file, transform it and store both versions
      if (uri.endsWith(".thyn")) {
        thynFiles.add(uri);
        try {
          const parsed = parseThyn(content);
          scriptContents.set(uri, { content: parsed.script.content, version });
        } catch (e) {
          console.error(`Failed to parse .thyn file ${uri}:`, e);
          scriptContents.set(uri, { content: "", version });
        }
      } else {
        scriptContents.set(uri, { content, version });
      }

      // Also cache by file path for easier lookup
      const filePath = uriToFsPath(uri);
      if (filePath !== uri) {
        if (uri.endsWith(".thyn")) {
          thynFiles.add(filePath);
        }
        const cached = scriptContents.get(uri);
        if (cached) {
          scriptContents.set(filePath, cached);
        }
      }
    },
  };

  return host;
}

function parseThyn(content: string): {
  script: {
    content: string;
    range: Range | null;
    contentStartOffset: number | null;
  };
  style: {
    content: string;
    range: Range | null;
    contentStartOffset: number | null;
  };
  html: { content: string; range: Range | null };
} {
  const scriptMatch = content.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
  const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);

  let script: {
    content: string;
    range: Range | null;
    contentStartOffset: number | null;
  } = {
    content: "",
    range: null,
    contentStartOffset: null,
  };
  let style: {
    content: string;
    range: Range | null;
    contentStartOffset: number | null;
  } = {
    content: "",
    range: null,
    contentStartOffset: null,
  };
  let htmlContent = content;

  const docForRange = TextDocument.create(
    "file://dummy/dummy.thyn",
    "thyn",
    0,
    content,
  );

  if (scriptMatch) {
    // Add block scope by wrapping content in curly braces
    script.content = scriptMatch[1];

    const scriptStart = scriptMatch.index!;
    const scriptEnd = scriptStart + scriptMatch[0].length;
    script.range = Range.create(
      docForRange.positionAt(scriptStart),
      docForRange.positionAt(scriptEnd),
    );
    // Adjust offset to account for the added opening brace
    script.contentStartOffset = scriptStart +
      scriptMatch[0].indexOf(scriptMatch[1]);
    htmlContent = htmlContent.replace(scriptMatch[0], "");
  }

  if (styleMatch) {
    style.content = styleMatch[1];
    const styleStart = styleMatch.index!;
    const styleEnd = styleStart + styleMatch[0].length;
    style.range = Range.create(
      docForRange.positionAt(styleStart),
      docForRange.positionAt(styleEnd),
    );
    style.contentStartOffset = styleStart + "<style>".length;
    htmlContent = htmlContent.replace(styleMatch[0], "");
  }

  return {
    script,
    style,
    html: { content: htmlContent.trim(), range: null },
  };
}

const cssStyleSheetCache = new Map<
  string,
  { stylesheet: Stylesheet; version: number }
>();

documents.onDidChangeContent(
  (change: TextDocumentChangeEvent<TextDocument>) => {
    const doc = change.document;
    const parsed = parseThyn(doc.getText());

    tsLanguageServiceHost.updateDocument(
      doc.uri,
      parsed.script.content,
      doc.version,
    );
  },
);

documents.onDidClose((e) => {
  tsLanguageServiceHost.updateDocument(e.document.uri, "", 0);
  cssStyleSheetCache.delete(e.document.uri);
});
connection.onHover(async ({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;

  const content = doc.getText();
  const parsed = parseThyn(content);
  const offset = doc.offsetAt(position);

  if (
    parsed.style.range &&
    doc.offsetAt(parsed.style.range.start) <= offset &&
    offset <= doc.offsetAt(parsed.style.range.end)
  ) {
    console.log("hover inside <style>");
    if (
      parsed.style.contentStartOffset === null ||
      offset < parsed.style.contentStartOffset ||
      offset >= doc.offsetAt(parsed.style.range.end) - "</style>".length + 1
    ) {
      return null;
    }

    let stylesheet: Stylesheet | undefined;
    const cached = cssStyleSheetCache.get(textDocument.uri);

    if (cached && cached.version === doc.version) {
      stylesheet = cached.stylesheet;
    } else {
      const cssDocForParsing = TextDocument.create(
        textDocument.uri + "?style-parsed",
        "css",
        doc.version,
        parsed.style.content,
      );
      stylesheet = cssLanguageService.parseStylesheet(cssDocForParsing);
      cssStyleSheetCache.set(textDocument.uri, {
        stylesheet,
        version: doc.version,
      });
    }

    const cssContentRelativeOffset = offset - parsed.style.contentStartOffset;
    const cssPosition = TextDocument.create(
      textDocument.uri + "?style-hover-temp",
      "css",
      doc.version,
      parsed.style.content,
    ).positionAt(cssContentRelativeOffset);

    const hover = cssLanguageService.doHover(
      TextDocument.create(
        textDocument.uri + "?style-hover-final",
        "css",
        doc.version,
        parsed.style.content,
      ),
      cssPosition,
      stylesheet,
    );

    if (hover && hover.range) {
      const originalStartOffset = doc.offsetAt(hover.range.start) +
        parsed.style.contentStartOffset;
      const originalEndOffset = doc.offsetAt(hover.range.end) +
        parsed.style.contentStartOffset;

      hover.range = Range.create(
        doc.positionAt(originalStartOffset),
        doc.positionAt(originalEndOffset),
      );
    }
    return hover;
  } else if (
    parsed.script.range &&
    doc.offsetAt(parsed.script.range.start) <= offset &&
    offset <= doc.offsetAt(parsed.script.range.end)
  ) {
    console.log("hover inside <script>");
    if (
      parsed.script.contentStartOffset === null ||
      offset < parsed.script.contentStartOffset ||
      offset >= doc.offsetAt(parsed.script.range.end) - "</script>".length + 1
    ) {
      return null;
    }

    // Make sure the document is up to date in the TypeScript service
    const scriptEntry = scriptContents.get(textDocument.uri);
    if (!scriptEntry || scriptEntry.version !== doc.version) {
      console.log("Updating TypeScript service with latest content");
      tsLanguageServiceHost.updateDocument(
        textDocument.uri,
        content,
        doc.version,
      );
    }

    const scriptContentRelativeOffset = offset -
      parsed.script.contentStartOffset;

    console.log(
      `Getting hover info at offset ${scriptContentRelativeOffset} in ${textDocument.uri}: ${parsed.script.content.slice(
        scriptContentRelativeOffset - 10,
        scriptContentRelativeOffset + 10,
      )
      }`,
    );

    // Use the TypeScript language service with the document URI
    // The language service should already have the transformed content
    const hoverInfo = tsLanguageService.getQuickInfoAtPosition(
      textDocument.uri,
      scriptContentRelativeOffset,
    );
    console.log("TypeScript hover result:", hoverInfo);

    if (hoverInfo) {
      const startOffset = hoverInfo.textSpan.start;
      const endOffset = hoverInfo.textSpan.start + hoverInfo.textSpan.length;

      const originalStartOffset = startOffset +
        parsed.script.contentStartOffset;
      const originalEndOffset = endOffset + parsed.script.contentStartOffset;

      const hoverContents = hoverInfo.displayParts
        ? ts.displayPartsToString(hoverInfo.displayParts)
        : "No information available";

      console.log("Returning hover:", hoverContents);

      return {
        contents: hoverContents,
        range: Range.create(
          doc.positionAt(originalStartOffset),
          doc.positionAt(originalEndOffset),
        ),
      } as Hover;
    } else {
      console.log("No TypeScript hover info found");

      // Fallback: try to get diagnostics or other info
      const program = tsLanguageService.getProgram();
      if (program) {
        const sourceFile = program.getSourceFile(textDocument.uri);
        if (sourceFile) {
          console.log("Source file found in program");

          // Try getting symbol at position
          const typeChecker = program.getTypeChecker();
          const node = getNodeAtPosition(
            sourceFile,
            scriptContentRelativeOffset,
          );

          if (node) {
            const symbol = typeChecker.getSymbolAtLocation(node);
            if (symbol) {
              const type = typeChecker.getTypeOfSymbolAtLocation(symbol, node);
              const typeString = typeChecker.typeToString(type);

              return {
                contents: `${symbol.getName()}: ${typeString}`,
                range: Range.create(
                  doc.positionAt(node.pos + parsed.script.contentStartOffset),
                  doc.positionAt(node.end + parsed.script.contentStartOffset),
                ),
              } as Hover;
            }
          }
        } else {
          console.log("Source file not found in program");
        }
      }
    }
  } else {
    console.log("hover inside html");

    let htmlDoc: HTMLTextDocument | undefined;
    let htmlStylesheet: any;

    const cachedHtml = htmlCache.get(textDocument.uri);

    if (cachedHtml && cachedHtml.version === doc.version) {
      htmlDoc = cachedHtml.document;
      htmlStylesheet = cachedHtml.stylesheet;
    } else {
      htmlDoc = HTMLTextDocument.create(
        textDocument.uri,
        "html",
        doc.version,
        content,
      );
      htmlStylesheet = htmlLanguageService.parseHTMLDocument(htmlDoc);
      htmlCache.set(textDocument.uri, {
        document: htmlDoc,
        stylesheet: htmlStylesheet,
        version: doc.version,
      });
    }

    // Regular HTML hover
    const htmlPosition = HTMLTextDocument.create(
      textDocument.uri + "?html-hover-temp",
      "html",
      doc.version,
      content,
    ).positionAt(offset);

    const hover = htmlLanguageService.doHover(
      htmlDoc,
      htmlPosition,
      htmlStylesheet,
    );

    if (hover) {
      return hover;
    }
  }
  return null;
});

// Helper function to find the node at a specific position
function getNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (position >= node.getStart() && position < node.getEnd()) {
      return ts.forEachChild(node, find) || node;
    }
    return undefined;
  }
  return find(sourceFile);
}

connection.onCompletion(async ({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;

  const pos = position;

  const content = doc.getText();
  const parsed = parseThyn(content);
  const offset = doc.offsetAt(position);

  if (
    parsed.script.range &&
    doc.offsetAt(parsed.script.range.start) <= offset &&
    offset <= doc.offsetAt(parsed.script.range.end)
  ) {
    console.log("completion inside <script>");
    if (
      parsed.script.contentStartOffset === null ||
      offset < parsed.script.contentStartOffset ||
      offset >= doc.offsetAt(parsed.script.range.end) - "</script>".length + 1
    ) {
      return null;
    }

    const scriptContentRelativeOffset = offset -
      parsed.script.contentStartOffset;

    const completions = tsLanguageService.getCompletionsAtPosition(
      textDocument.uri,
      scriptContentRelativeOffset,
      {},
    );

    if (completions) {
      const items: CompletionItem[] = completions.entries.map((entry) => {
        return {
          label: entry.name,
          kind: convertTsCompletionKindToLspKind(entry.kind),
          detail: entry.sortText,
        };
      });
      return {
        items: items.map((i): CompletionItem => {
          if (["$effect", "$signal", "$props"].includes(i.label)) {
            return {
              ...i,
              insertText: i.label,
              textEdit: {
                newText: i.label.slice(1),
                range: {
                  start: { line: pos.line, character: pos.character },
                  end: pos,
                },
              },
            };
          }
          return i;
        }),
      } as CompletionList;
    }
  }
  return null;
});

connection.onCompletionResolve((item: CompletionItem) => {
  return item;
});

function convertTsCompletionKindToLspKind(
  tsKind: string,
): CompletionItemKind {
  switch (tsKind) {
    case ts.ScriptElementKind.alias:
      return 1;
    case ts.ScriptElementKind.callSignatureElement:
    case ts.ScriptElementKind.indexSignatureElement:
    case ts.ScriptElementKind.constructSignatureElement:
      return 2;
    case ts.ScriptElementKind.classElement:
      return 7;
    case ts.ScriptElementKind.enumElement:
      return 13;
    case ts.ScriptElementKind.interfaceElement:
      return 8;
    case ts.ScriptElementKind.moduleElement:
      return 9;
    case ts.ScriptElementKind.constElement:
      return 14;
    case ts.ScriptElementKind.letElement:
    case ts.ScriptElementKind.variableElement:
      return 6;
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.memberFunctionElement:
    case ts.ScriptElementKind.localFunctionElement:
      return 2;
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.parameterElement:
      return 10;
    case ts.ScriptElementKind.keyword:
      return 15;
    case ts.ScriptElementKind.scriptElement:
      return 17;
    case ts.ScriptElementKind.typeParameterElement:
      return 25;
    default:
      return 1;
  }
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const diagnostics: Diagnostic[] = [];
  const parsed = parseThyn(textDocument.getText());

  if (
    parsed.script.contentStartOffset !== null && parsed.script.range !== null
  ) {
    const tsDiagnostics = tsLanguageService.getSemanticDiagnostics(
      textDocument.uri,
    );

    tsDiagnostics.forEach((tsDiagnostic) => {
      const startOffset = tsDiagnostic.start! +
        parsed.script.contentStartOffset!;
      const endOffset = startOffset + tsDiagnostic.length!;

      const range = Range.create(
        textDocument.positionAt(startOffset),
        textDocument.positionAt(endOffset),
      );

      diagnostics.push({
        severity: convertTsDiagnosticCategoryToLspSeverity(
          tsDiagnostic.category,
        ),
        range: range,
        message: ts.flattenDiagnosticMessageText(
          tsDiagnostic.messageText,
          "\n",
        ),
        source: "ts",
        code: tsDiagnostic.code,
      });
    });

    const syntacticDiagnostics = tsLanguageService.getSyntacticDiagnostics(
      textDocument.uri,
    );
    syntacticDiagnostics.forEach((tsDiagnostic) => {
      const startOffset = tsDiagnostic.start! +
        parsed.script.contentStartOffset!;
      const endOffset = startOffset + tsDiagnostic.length!;

      const range = Range.create(
        textDocument.positionAt(startOffset),
        textDocument.positionAt(endOffset),
      );

      diagnostics.push({
        severity: convertTsDiagnosticCategoryToLspSeverity(
          tsDiagnostic.category,
        ),
        range: range,
        message: ts.flattenDiagnosticMessageText(
          tsDiagnostic.messageText,
          "\n",
        ),
        source: "ts",
        code: tsDiagnostic.code,
      });
    });
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function convertTsDiagnosticCategoryToLspSeverity(
  category: ts.DiagnosticCategory,
): DiagnosticSeverity | undefined {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return DiagnosticSeverity.Error;
    case ts.DiagnosticCategory.Warning:
      return DiagnosticSeverity.Warning;
    case ts.DiagnosticCategory.Message:
      return DiagnosticSeverity.Information;
  }
}

const documentValidationQueue = new Map<string, NodeJS.Timeout>();
documents.onDidChangeContent(
  (change: TextDocumentChangeEvent<TextDocument>) => {
    const doc = change.document;
    const uri = doc.uri;

    if (documentValidationQueue.has(uri)) {
      clearTimeout(documentValidationQueue.get(uri)!);
    }

    const timeout = setTimeout(() => {
      validateTextDocument(doc);
    }, 500);
    documentValidationQueue.set(uri, timeout);
  },
);

documents.listen(connection);
connection.listen();
