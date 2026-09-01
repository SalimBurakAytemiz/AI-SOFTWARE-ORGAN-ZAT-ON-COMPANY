import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { LocalSandbox } from "../src/sandbox/local-sandbox.ts";
import { paths } from "../src/config/paths.ts";

test("the local sandbox confines file writes to its workspace", () => {
  const sbx = new LocalSandbox();
  try {
    sbx.writeFile("src/added.txt", "hello");
    assert.equal(sbx.readFile("src/added.txt"), "hello");
    assert.throws(() => sbx.writeFile("../escape.txt", "x"), /must be relative|escapes/);
    assert.throws(() => sbx.readFile("/etc/passwd"), /must be relative/);
  } finally {
    sbx.dispose();
  }
});

test("the local sandbox classifies and blocks dangerous commands", async () => {
  const sbx = new LocalSandbox();
  try {
    assert.equal(sbx.classify("ls -la"), "READ_ONLY");
    assert.equal(sbx.classify("git push origin main"), "DESTRUCTIVE");
    assert.equal(sbx.classify("terraform apply"), "PRODUCTION_WRITE");
    assert.equal(sbx.classify("curl https://example.com"), "EXTERNAL_WRITE");
    assert.equal(sbx.classify("mkdir build"), "DEVELOPMENT_WRITE");

    const push = await sbx.exec("git push origin main");
    assert.equal(push.blocked, true);
    const rmrf = await sbx.exec("rm -rf /");
    assert.equal(rmrf.blocked, true);

    const ok = await sbx.exec("echo hello");
    assert.equal(ok.blocked, false);
    assert.match(ok.stdout, /hello/);

    const write = await sbx.exec("mkdir build");
    assert.equal(write.blocked, true, "development write needs an explicit grant");
    const writeOk = await sbx.exec("mkdir build", { allowWrite: true });
    assert.equal(writeOk.blocked, false);
  } finally {
    sbx.dispose();
  }
});

test("the local sandbox can be seeded from the demo-service fixture", () => {
  const sbx = new LocalSandbox({ seedFrom: join(paths.fixtures, "demo-service") });
  try {
    assert.ok(sbx.listFiles().includes("package.json"));
    assert.ok(sbx.listFiles().some((f) => f.endsWith("server.js")));
  } finally {
    sbx.dispose();
  }
});
