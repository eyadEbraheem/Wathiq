const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, '..');

function escapedPath(directory) {
  return directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build tools replace these directories while Metro is watching the workspace.
// Ignoring generated output prevents ENOENT watcher crashes when API and web run
// alongside the Expo development server.
const generatedDirectories = [
  path.join(repositoryRoot, 'backend', 'dist'),
  path.join(repositoryRoot, 'frontend', '.next'),
  path.join(repositoryRoot, 'frontend', 'out'),
  path.join(__dirname, 'dist'),
];

const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...existingBlockList,
  ...generatedDirectories.map(
    (directory) => new RegExp(`^${escapedPath(directory)}(?:[/\\\\].*)?$`),
  ),
];

module.exports = config;
