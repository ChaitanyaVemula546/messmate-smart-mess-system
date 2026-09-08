import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
describe("Mobile build parser mitigation", () => {
  it("rejects affected formats without hanging and still reads PNG", () => {
    const mobile = createRequire(resolve("apps/mobile/package.json"));
    const expo = createRequire(mobile.resolve("expo/package.json"));
    const config = createRequire(
      expo.resolve("@expo/metro-config/package.json"),
    );
    const metro = createRequire(config.resolve("metro/package.json"));
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `
      const assert = require('node:assert/strict');
      const size = require(${JSON.stringify(metro.resolve("image-size"))});
      for (const [offset,magic] of [[0,'icns'],[4,'ftyp'],[4,'JXL ']]) {
        const input=Buffer.alloc(32); input.write(magic,offset);
        assert.throws(()=>size(input),/disabled/);
      }
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1sAAAAASUVORK5CYII=','base64');
      assert.equal(size(png).width,1);
    `,
      ],
      { timeout: 3000, encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  });
});
