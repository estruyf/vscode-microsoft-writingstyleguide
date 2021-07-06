import { verify } from 'crypto';
import * as vscode from 'vscode';
import { CancellationToken, Position, TextDocument } from 'vscode';
import { StyleGuide } from './helpers/StyleGuide';

export const EXTENSION_NAME = 'Writing Style Guide';
export const CONFIG_KEY = "eliostruyf";
export const CONFIG_TERMS_DISABLED = "writingstyleguide.terms.isDisabled";
export const CONFIG_BIASFREE_DISABLED = "writingstyleguide.biasFree.isDisabled";

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

	subscriptions.push(
		vscode.commands.registerCommand('writingstyleguide.website', async () => {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://docs.microsoft.com/en-us/style-guide/welcome/'));
		})
	);

	subscriptions.push(
		vscode.commands.registerCommand('writingstyleguide.enable', async () => {
			const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    	await config.update(CONFIG_TERMS_DISABLED, false, vscode.ConfigurationTarget.Workspace);
    	await config.update(CONFIG_BIASFREE_DISABLED, false, vscode.ConfigurationTarget.Workspace);
			verifyText();
		})
	);

	subscriptions.push(
		vscode.commands.registerCommand('writingstyleguide.disable', async () => {
			const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    	await config.update(CONFIG_TERMS_DISABLED, true, vscode.ConfigurationTarget.Workspace);
    	await config.update(CONFIG_BIASFREE_DISABLED, true, vscode.ConfigurationTarget.Workspace);
			verifyText();
		})
	);

	subscriptions.push(
		vscode.commands.registerCommand('writingstyleguide.terms.toggle', async () => {
			const config = vscode.workspace.getConfiguration(CONFIG_KEY);
			const value = config.get(CONFIG_TERMS_DISABLED) || false;

    	await config.update(CONFIG_TERMS_DISABLED, !value, vscode.ConfigurationTarget.Workspace);
			verifyText();
		})
	);

	subscriptions.push(
		vscode.commands.registerCommand('writingstyleguide.biasFree.toggle', async () => {
			const config = vscode.workspace.getConfiguration(CONFIG_KEY);
			const value = config.get(CONFIG_BIASFREE_DISABLED) || false;
    	await config.update(CONFIG_BIASFREE_DISABLED, !value, vscode.ConfigurationTarget.Workspace);
			verifyText();
		})
	);

	subscriptions.push(vscode.commands.registerCommand('eliostruyf.vscode-microsoft-writingstyleguide.panel.registration', () => {
		const config = vscode.workspace.getConfiguration(CONFIG_KEY);

		return {
			id: 'vscode-microsoft-writingstyleguide',
			title: 'Writing Style Guide Actions',
			description: 'You can perform the following action(s) for the writing style guide extension:',
			actions: [{
				title: 'Guidance enabled',
				command: 'writingstyleguide.terms.toggle',
				data: config.get(CONFIG_TERMS_DISABLED, vscode.ConfigurationTarget.Workspace) ? false : true,
				type: "checkbox"
			}, {
				title: 'Bias free communication enabled',
				command: 'writingstyleguide.biasFree.toggle',
				data: config.get(CONFIG_BIASFREE_DISABLED, vscode.ConfigurationTarget.Workspace) ? false : true,
				type: "checkbox"
			}, {
				title: 'Go to website',
				command: 'writingstyleguide.website',
				type: "button"
			}]
		};
	}));

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