import * as vscode from 'vscode';
import { CancellationToken, Position, TextDocument } from 'vscode';
import { StyleGuide } from './helpers/StyleGuide';

export const EXTENSION_NAME = 'Writing Style Guide';

let debouncer: { (fnc: any, time: number): void; };
let collection: vscode.DiagnosticCollection;

export function activate({ subscriptions }: vscode.ExtensionContext) {
	collection = vscode.languages.createDiagnosticCollection('Microsoft Style Guide');

	vscode.languages.registerHoverProvider("markdown", {
		provideHover: (document: TextDocument, position: Position, token: CancellationToken) => StyleGuide.hoverProvider(document, position, token, collection)
	});
	
	debouncer = debounceVerifyText();
	
	subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			verifyText();
		}
	}));

	subscriptions.push(vscode.workspace.onDidChangeTextDocument(verifyText));

	subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)));

	if (vscode.window.activeTextEditor) {
		verifyText();
	}

	console.log(`${EXTENSION_NAME} extension enabled`);
}

export function deactivate() {}

const verifyText = () => {
	debouncer(() => {
		StyleGuide.verify(collection);
	}, 1000);
};

const debounceVerifyText = () => {
  let timeout: NodeJS.Timeout;

  return (fnc: any, time: number) => {
    const functionCall = (...args: any[]) => fnc.apply(args);
    clearTimeout(timeout);
    timeout = setTimeout(functionCall, time);
  };
};