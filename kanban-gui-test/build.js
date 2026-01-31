const rewire = require('rewire');
const defaults = rewire('react-scripts/scripts/build.js');
const config = defaults.__get__('config');

// Hier sagen wir React: "Lass den Hash weg!"
config.output.filename = 'static/js/main.js';
config.output.chunkFilename = 'static/js/[name].chunk.js';

// Auch für CSS (falls vorhanden)
const miniCssExtractPlugin = config.plugins.find(
  p => p.constructor.name === 'MiniCssExtractPlugin'
);
if (miniCssExtractPlugin) {
  miniCssExtractPlugin.options.filename = 'static/css/main.css';
  miniCssExtractPlugin.options.chunkFilename = 'static/css/[name].chunk.css';
}