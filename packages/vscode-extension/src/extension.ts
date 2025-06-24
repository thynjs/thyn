import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import { getVirtualContent } from "./virtual-content";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Register the virtual content provider
  const virtualDocumentProvider: vscode.TextDocumentContentProvider = {
    provideTextDocumentContent(uri: vscode.Uri) {
      return getVirtualContent(uri);
    },
  };

  const virtualDocumentScheme = "thyn-virtual"; // Or whatever scheme you're using
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      virtualDocumentScheme,
      virtualDocumentProvider,
    ),
  );

  // Language Server Client Setup
  const serverOptions: ServerOptions = {
    command: "node", // or path to your server executable
    args: [
      context.asAbsolutePath("./dist/server.js"), // Adjust path to your compiled server
      "--stdio",
    ],
    options: {
      env: process.env,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "thyn" }, // For regular files
      { scheme: virtualDocumentScheme }, // For your virtual documents
    ],
    synchronize: {
      // Synchronize these configuration sections
      configurationSection: ["thyn"],
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.thyn"),
    },
  };

  // Create and start the language client
  client = new LanguageClient(
    "thynLanguageServer",
    "Thyn Language Server",
    serverOptions,
    clientOptions,
  );

  // Start the client and add to subscriptions
  client.start();
  context.subscriptions.push(client);

  // Register any commands
  context.subscriptions.push(
    vscode.commands.registerCommand("thyn.showVirtualContent", async () => {
      const uri = vscode.Uri.parse(
        `${virtualDocumentScheme}:sample.thyn`,
      );
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    }),
  );

  // Other activation code...
  console.log("Thyn extension is now active!");
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
