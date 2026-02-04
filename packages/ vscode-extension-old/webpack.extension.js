// webpack.extension.js
const path = require('path');

module.exports = {
  target: 'node', // VS Code extensions run in a Node.js context within VS Code
  entry: './src/extension.ts', // Adjust this path
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  externals: {
    vscode: 'commonjs vscode' // The 'vscode' module is provided by VS Code API
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /\.d\.ts$/],
        use: {
          loader: 'ts-loader'
        }
      }
    ]
  },
  mode: 'production',
  devtool: 'nosources-source-map'
};