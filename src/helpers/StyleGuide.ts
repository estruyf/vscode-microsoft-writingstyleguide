import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CancellationToken, Diagnostic, DiagnosticCollection, DiagnosticSeverity, Hover, Position, ProviderResult, Range, TextDocument } from 'vscode';
import { CONFIG_TERMS_DISABLED, CONFIG_BIASFREE_DISABLED, CONFIG_KEY, EXTENSION_NAME } from '../extension';

export class StyleGuide {
  private static hints: number = 0;
  private static dictionary: { words: string[]; content: string }[];
  private static biasFree: { words: string[]; alternatives: string[] }[];
  private static exceptions: { word: string; exclude: { before: string[]; after: string[]; } }[];

  /**
   * Verify the words used in the markdown file
   * @param collection 
   * @returns 
   */
  public static verify(collection: DiagnosticCollection) {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const isTermsDisabled = config.get(CONFIG_TERMS_DISABLED) as boolean;
    const isBiasFreeDisabled = config.get(CONFIG_BIASFREE_DISABLED) as boolean;

    const editor = vscode.window.activeTextEditor;

    if (!editor || (isTermsDisabled && isBiasFreeDisabled)) {
      if (collection) {
        collection.clear();
      }
      return;
    }

    this.hints = 0;

    this.dictionary = this.getDictionary();
    this.biasFree = this.getBiasFree();

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
    const codeBlock = /`([^`]*)`/g;
    let codeMatch: RegExpExecArray | null;
    let codeIndexes = [];
    while ((codeMatch = codeBlock.exec(text)) !== null) {
      codeIndexes.push({
        startIdx: codeMatch.index,
        endIdx: codeMatch.index + codeMatch[0].length
      });
    }

    if (!isTermsDisabled) {
      for (const entry of this.dictionary) {
        for (const word of entry.words) {
          this.processWord(word, text, diagnostics, codeIndexes, startContentIdx, textDocument, "recommendation");
        }
      }
    }

    if (!isBiasFreeDisabled) {
      for (const entry of this.biasFree) {
        for (const word of entry.words) {
          this.processWord(word, text, diagnostics, codeIndexes, startContentIdx, textDocument, "bias-free communication");
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
        
        this.dictionary = this.getDictionary();
        this.biasFree = this.getBiasFree();

        const record = this.dictionary.find(entry => entry.words.includes(word.toLowerCase().trim()));
        if (record) {
          return new vscode.Hover(new vscode.MarkdownString(record.content));
        }

        const bias = this.biasFree.find(entry => entry.words.includes(word.toLowerCase().trim()));
        if (bias) {
          return new vscode.Hover(new vscode.MarkdownString(`# ${bias.words.join(', ')}
          
Use bias-free communication, alternatives are:
${bias.alternatives.map(a => `
- ${a}`)}
`));
        }
      }
    }
  }

  /**
   * Retrieve the dictionary recommendations
   * @returns 
   */
  private static getDictionary() {
    if (!this.dictionary) {
      this.dictionary = this.getFile(`../../dictionary.json`);
    }
    return this.dictionary;
  }

  /**
   * Get the bias free recommendations
   * @returns 
   */
  private static getBiasFree() {
    if (!this.biasFree) {
      this.biasFree = this.getFile(`../../bias-free.json`);
    }
    return this.biasFree;
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

  /**
   * Process each word from the dictionary
   * @param word 
   * @param text 
   * @param diagnostics 
   * @param codeIndexes 
   * @param startContentIdx 
   * @param textDocument 
   * @param type 
   */
  private static processWord(word: string, text: string, diagnostics: Diagnostic[], codeIndexes: { startIdx: number, endIdx: number }[], startContentIdx: number, textDocument: vscode.TextDocument, type: "recommendation" | "bias-free communication") {
    try {
      const pattern = new RegExp(`\\b${word}\\b`, "ig");
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(text)) && this.hints < 1000) {
        if (m[0] !== null) {
          const match = m[0];
          let hint = null;
          if (type === "recommendation") {
            hint = this.dictionary.find(d => d.words.includes(match.toLowerCase()));
          } else if (type === "bias-free communication") {
            hint = this.biasFree.find(d => d.words.includes(match.toLowerCase()));
          }

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
            this.hints++;
          
            const diagnostic: Diagnostic = {
              severity: DiagnosticSeverity.Information,
              range: new Range(textDocument.positionAt(m.index), textDocument.positionAt(m.index + word.length)),
              message: `${EXTENSION_NAME} - ${type}`,
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