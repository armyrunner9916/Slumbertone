// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add CAF to asset extensions
config.resolver.assetExts = [...config.resolver.assetExts, 'caf'];

module.exports = config;