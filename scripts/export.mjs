import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  copyFileSync,
  mkdtempSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
execFileSync(process.execPath, ["scripts/check-secrets.mjs"], {
  stdio: "inherit",
});
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw new Error("Commit source changes before export.");
const output = resolve(process.argv[2] || "../messmate-smart-mess-system.zip");
const temporary = mkdtempSync(resolve(tmpdir(), "messmate-export-"));
try {
  const root = resolve(temporary, "messmate-smart-mess-system");
  mkdirSync(root);
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    const target = resolve(root, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
  execFileSync("git", [
    "bundle",
    "create",
    resolve(root, "source-history.bundle"),
    "--all",
  ]);
  mkdirSync(dirname(output), { recursive: true });
  // Python's stdlib zipfile is available on standard developer installations.
  const script =
    "import pathlib,zipfile,sys\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:\n for p in sorted(root.rglob('*')):\n  if p.is_file(): z.write(p,p.relative_to(root.parent))\n";
  execFileSync(process.platform === "win32" ? "python" : "python3", [
    "-c",
    script,
    root,
    output,
  ]);
  const bytes = readFileSync(output);
  console.log(
    JSON.stringify(
      {
        file: output,
        sourceFiles: files.length,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
