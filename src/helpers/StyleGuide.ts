import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range } from 'vscode';

export class StyleGuide {
  private static dictionary: { words: string[]; content: string }[];
  private static exceptions: { word: string; exclude: { previous: string; next: string; } }[];

  public static verify(collection: DiagnosticCollection) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    if (!this.dictionary) {
      this.dictionary = this.getFile(`../../dictionary.json`);
    }

    if (!this.exceptions) {
      this.exceptions = this.getFile(`../../exceptions.json`);
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

              // Check if the word can be excluded
              const toExclude = this.exceptions.find(e => e.word === word.toLowerCase());
              let exclude = false;

              if (toExclude) {
                const prevWordIdx = text.substring(0, m.index).trim().replace(/\n/g, " ").lastIndexOf(" ");
                const lastWord = text.substring(prevWordIdx, m.index).trim();

                if (lastWord && toExclude?.exclude?.previous?.toLowerCase() && lastWord.toLowerCase() === toExclude.exclude.previous.toLowerCase()) {
                  exclude = true;
                }
              }

              if (hint && !exclude) {
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

  /**
   * Retrieve the file from the path
   * @param filePath 
   * @returns 
   */
  private static getFile(filePath: string) {
    const dicPath = path.join(__dirname, filePath);
    if (fs.existsSync(dicPath)) { 
      const file = fs.readFileSync(dicPath);
      return JSON.parse(file.toString());
    }

    return null;
  }
}