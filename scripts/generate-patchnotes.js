const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function generatePatchnotes() {
  const commit = process.env.COMMIT_REF || git(["rev-parse", "HEAD"]);
  const subject = git(["show", "-s", "--format=%s", commit]);
  const body = git(["show", "-s", "--format=%b", commit])
    .split(/\r?\n/)
    .filter((line) => !/^Co-authored-by:/i.test(line))
    .join("\n")
    .trim();
  const shortCommit = commit.slice(0, 7);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const notes = [
    "GuardBot Patch Notes",
    `Date: ${date} (Philippine Time)`,
    `Commit: ${shortCommit}`,
    "",
    subject,
    ...(body ? ["", body] : []),
    "",
  ].join("\n");
  const outputs = [
    path.join(root, "PATCHNOTES.txt"),
    path.join(root, "apps", "web", "public", "patchnotes.txt"),
  ];

  for (const output of outputs) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, notes, "utf8");
  }

  console.log(`Generated patch notes for ${shortCommit}: ${outputs.join(", ")}`);
}

if (require.main === module) {
  generatePatchnotes();
}

module.exports = generatePatchnotes;
