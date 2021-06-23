import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CancellationToken, Diagnostic, DiagnosticCollection, DiagnosticSeverity, Hover, Position, ProviderResult, Range, TextDocument } from 'vscode';
import { CONFIG_DISABLED, CONFIG_KEY, EXTENSION_NAME } from '../extension';

export class StyleGuide {
  private static dictionary: { words: string[]; content: string }[];
  private static exceptions: { word: string; exclude: { before: string[]; after: string[]; } }[];

  /**
   * Verify the words used in the markdown file
   * @param collection 
   * @returns 
   */
  public static verify(collection: DiagnosticCollection) {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const isDisabled = config.get(CONFIG_DISABLED) as boolean;

    const editor = vscode.window.activeTextEditor;

    if (!editor || isDisabled) {
      if (collection) {
        collection.clear();
      }
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

    // Check if there is front matter in the file
    let startContentIdx = 0;
    const frontMatter = /---([^`]*)---/;
    const fmMatch = text.match(frontMatter);
    if (fmMatch) {
      startContentIdx = (fmMatch?.index || 0) + fmMatch[0].length;
    }

    // Get all code blocks
    const codeBlock = /```([^`]*)```/g;
    let codeMatch: RegExpExecArray | null;
    let codeIndexes = [];
    while ((codeMatch = codeBlock.exec(text)) !== null) {
      codeIndexes.push({
        startIdx: codeMatch.index,
        endIdx: codeMatch.index + codeMatch[0].length
      });
    }

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
                // Checks the word(s) before the current one
                const prevWordIdx = text.substring(0, m.index).trim().replace(/\n/g, " ").lastIndexOf(" ");
                const lastWord = text.substring(prevWordIdx, m.index).trim();

                if (lastWord && toExclude?.exclude?.before) {
                  if (toExclude.exclude.before.map(w => w.toLowerCase()).includes(lastWord.toLowerCase())) {
                    exclude = true;
                  }
                }

                // Checks the word(s) after the current one
                if (!exclude) {
                  const wordIdx = (m.index + word.length);
                  const nextWordIdx = text.substring(wordIdx).trim().replace(/\n/g, " ").indexOf(" ");

                  let nextWord = text.substring(wordIdx).trim();
                  if (nextWordIdx !== -1) {
                    nextWord = text.substring(wordIdx, (wordIdx + nextWordIdx)).trim();
                  }
  
                  if (nextWord && toExclude?.exclude?.after) {
                    const allExceptions = toExclude.exclude.after.map(w => w.toLowerCase());
  
                    const exists = allExceptions.filter(w => nextWord.startsWith(w));
  
                    if (exists && exists.length > 0) {
                      exclude = true;
                    }
                  }

                  console.log(nextWord, exclude)
                }
              }

              // Validate if word is not used in a codeblock
              let isInCodeBlock = false;
              for (const codeIdx of codeIndexes) {
                if (!isInCodeBlock && codeIdx.startIdx < m.index && codeIdx.endIdx > m.index) {
                  isInCodeBlock = true;
                }
              }

              // Check if the word exists in the front matter
              const beforeContentStart = startContentIdx > m.index;

              if (hint && !exclude && !isInCodeBlock && !beforeContentStart) {
                hints++;
              
                const diagnostic: Diagnostic = {
                  severity: DiagnosticSeverity.Information,
                  range: new Range(textDocument.positionAt(m.index), textDocument.positionAt(m.index + word.length)),
                  message: `${EXTENSION_NAME} Recommendation`,
                  code: match
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
   * Provide the hover information for the diagnostic warning
   * @param document 
   * @param position 
   * @param token 
   * @param collection 
   * @returns 
   */
  public static hoverProvider(document: TextDocument, position: Position, token: CancellationToken, collection: vscode.DiagnosticCollection): ProviderResult<Hover> {
    const range = document.getWordRangeAtPosition(position);

    if (range && collection) {
      const diagnostics = collection.get(document.uri);
      const diagnostic = diagnostics?.find(d => {
        if (range.start.line === d.range.start.line) {
          if (range.start.character >= d.range.start.character && range.end.character <= d.range.end.character) {
            return true;
          }
        }
        return false;
      });

      if (diagnostic && diagnostic.code) {
        const word = diagnostic.code as string;
        
        if (!this.dictionary) {
          this.dictionary = this.getFile(`../../dictionary.json`);
        }

        const record = this.dictionary.find(entry => entry.words.includes(word.toLowerCase().trim()));

        if (record) {
          return new vscode.Hover(new vscode.MarkdownString(record.content));
        }
      }
    }
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