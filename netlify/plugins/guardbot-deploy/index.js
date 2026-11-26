const fs = require("node:fs");
const path = require("node:path");
const generatePatchnotes = require("../../../scripts/generate-patchnotes");

const root = path.resolve(__dirname, "../../..");
const serverHandler = path.join(
  root,
  "apps",
  "web",
  ".netlify",
  "functions-internal",
  "___netlify-server-handler",
  "___netlify-server-handler.mjs",
);
const publicPatchnotes = path.join(root, "apps", "web", "public", "patchnotes.txt");
const publishedPatchnotes = path.join(root, "apps", "web", ".next", "patchnotes.txt");

function fixWindowsRuntimePaths() {
  if (!fs.existsSync(serverHandler)) {
    throw new Error(`Netlify Next.js server handler was not generated: ${serverHandler}`);
  }

  const original = fs.readFileSync(serverHandler, "utf8");
  const updated = original
    .split(String.raw`\var\task\apps\web`)
    .join("/var/task/apps/web")
    .split(String.raw`\.netlify\dist\run\handlers\server.js`)
    .join("/.netlify/dist/run/handlers/server.js");

  if (updated !== original) {
    fs.writeFileSync(serverHandler, updated, "utf8");
    console.log("Normalized Windows paths in the Netlify Next.js server handler.");
  }
}

function publishPatchnotes() {
  if (!fs.existsSync(publicPatchnotes)) {
    throw new Error(`Generated patch notes were not found: ${publicPatchnotes}`);
  }

  fs.copyFileSync(publicPatchnotes, publishedPatchnotes);
  console.log("Published patch notes at /patchnotes.txt.");
}

module.exports = {
  onPreBuild() {
    generatePatchnotes();
  },
  onBuild() {
    fixWindowsRuntimePaths();
  },
  onPostBuild() {
    publishPatchnotes();
  },
};
