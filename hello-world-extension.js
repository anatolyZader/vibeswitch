// Simple Hello World VS Code Extension
const vscode = require('vscode');

/**
 * This function is called when the extension is activated
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Hello World extension is now active!');

    // Register a command that shows a hello world message
    let disposable = vscode.commands.registerCommand('helloworld.sayHello', function () {
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from VS Code Extension!');
    });

    context.subscriptions.push(disposable);

    // Register another command that shows the current time
    let timeCommand = vscode.commands.registerCommand('helloworld.showTime', function () {
        const currentTime = new Date().toLocaleTimeString();
        vscode.window.showInformationMessage(`Current time is: ${currentTime}`);
    });

    context.subscriptions.push(timeCommand);

    // Register a command that creates a notification
    let notifyCommand = vscode.commands.registerCommand('helloworld.notify', function () {
        vscode.window.showInformationMessage(
            'This is a notification!',
            'Button 1',
            'Button 2'
        ).then(selection => {
            if (selection) {
                vscode.window.showInformationMessage(`You clicked: ${selection}`);
            }
        });
    });

    context.subscriptions.push(notifyCommand);
}

/**
 * This function is called when the extension is deactivated
 */
function deactivate() {
    console.log('Hello World extension is now deactivated.');
}

module.exports = {
    activate,
    deactivate
};

