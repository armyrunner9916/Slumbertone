// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add CAF as a recognized asset extension
config.resolver.assetExts.push('caf');

// Ensure CAF files are treated as assets, not source files
if (config.resolver.sourceExts.includes('caf')) {
  config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'caf');
}

module.exports = config;