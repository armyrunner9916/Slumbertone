// @ts-nocheck
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Override deprecated proposal plugins with modern transform plugins
    plugins: [
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-logical-assignment-operators',
      '@babel/plugin-transform-numeric-separator',
      '@babel/plugin-transform-optional-catch-binding',
      '@babel/plugin-transform-async-generator-functions',
      '@babel/plugin-transform-object-rest-spread',
    ],
  };
};