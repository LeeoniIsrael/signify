const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("onnx", "task", "cvdata");
// Share the tested, framework-independent classifier and stability gate with web.
config.watchFolders = [path.resolve(__dirname, "..")];
module.exports = config;
