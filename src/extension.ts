import * as vscode from 'vscode';
import { StyleGuide } from './helpers/StyleGuide';

let debouncer: { (fnc: any, time: number): void; };
let collection: vscode.DiagnosticCollection;

export function activate({ subscriptions }: vscode.ExtensionContext) {
	collection = vscode.languages.createDiagnosticCollection('Microsoft Style Guide');
	
	debouncer = debounceVerifyText();
	subscriptions.push(vscode.window.onDidChangeActiveTextEditor(verifyText));
	subscriptions.push(vscode.window.onDidChangeTextEditorSelection(verifyText));
	verifyText();

	console.log('Microsoft Styleguide Enabled');
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