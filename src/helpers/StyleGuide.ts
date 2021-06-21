import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range } from 'vscode';

export class StyleGuide {
  private static dictionary: { words: string[]; content: string }[];

  public static verify(collection: DiagnosticCollection) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    if (!this.dictionary) {
      const fullPath = path.join(__dirname, `../../dictionary.json`);
      if (fs.existsSync(fullPath)) { 
        const file = fs.readFileSync(fullPath);
        if (file) {
          this.dictionary = JSON.parse(file.toString());
        }
      }
    }

    const textDocument = editor.document;
    const text = textDocument.getText();

    const diagnostics: Diagnostic[] = [];
    let hints = 0;

    for (const entry of this.dictionary) {
      for (const word of entry.words) {
        try {
          const pattern = new RegExp(`\\b${word}\\b`, "ig");
          let m: RegExpExecArray | null;

          while ((m = pattern.exec(text)) && hints < 1000) {
            if (m[0] !== null) {
              const match = m[0];
              const hint = this.dictionary.find(d => d.words.includes(match.toLowerCase()));

              if (hint) {
                hints++;
              
                const diagnostic: Diagnostic = {
                  severity: DiagnosticSeverity.Information,
                  range: new Range(textDocument.positionAt(m.index), textDocument.positionAt(m.index + word.length)),
                  message: entry.content,
                  source: 'Writing Style Guide'
                };
                
                diagnostics.push(diagnostic);
              }
            }
          }
        } catch (e) {
          console.error(e?.message || e);
        }
      }
    }

    collection.set(editor.document.uri, [...diagnostics]);
  }
}