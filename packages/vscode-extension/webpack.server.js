// webpack.server.js
const path = require('path');

module.exports = {
  target: 'node', // Essential for Node.js environment (where your server.ts runs)
  entry: './src/server.ts', // Adjust this path if your server.ts is elsewhere
  output: {
    path: path.resolve(__dirname, 'dist'), // Output to a 'out' folder
    filename: 'server.js', // Name of the bundled server file
    libraryTarget: 'commonjs2', // Important for Node.js modules
    devtoolModuleFilenameTemplate: '../[resource-path]' // Helps with debugging source maps
  },
  resolve: {
    extensions: ['.ts', '.js'] // Resolve .ts and .js files
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /\.d\.ts$/],
        use: {
          loader: 'ts-loader',
          options: {
            // You might need to specify a tsconfig file here if you have multiple
            // project: path.resolve(__dirname, 'tsconfig.server.json')
          }
        }
      }
    ]
  },
  // Optional: Set to 'production' for optimized build, 'development' for faster build and more debug info
  mode: 'production',
  devtool: 'nosources-source-map', // Generates source maps for debugging without exposing original source in final package
  externals: {
    esbuild: 'commonjs esbuild',
    canvas: 'commonjs canvas',
  }
};