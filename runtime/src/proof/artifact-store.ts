import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import type { Clock } from "../core/clock.ts";
import { looksLikeSecret } from "../core/redaction.ts";
import { RuntimeError } from "../core/errors.ts";

/**
 * Durable per-stage proof artifacts (build spec sections 16, 40). Each stage
 * writes a small, attributable markdown file under build/proof/<task-id>/.
 * Every artifact carries front-matter: agent, task, workflow, stage, timestamp.
 * Clearly labelled PROOF_ONLY. A secret-looking artifact is refused, not stored.
 */

export interface ArtifactMeta {
  taskId: string;
  workflowId: string;
  stage: string;
  agentId: string;
  role: string;
  real: boolean;
}

export interface StoredArtifact {
  file: string;
  path: string;
  stage: string;
  agentId: string;
}

export class ProofArtifactStore {
  readonly dir: string;
  private readonly clock: Clock;
  private readonly stored: StoredArtifact[] = [];

  constructor(opts: { buildRoot: string; taskId: string; clock: Clock }) {
    this.clock = opts.clock;
    this.dir = resolve(join(opts.buildRoot, "proof", opts.taskId));
    mkdirSync(this.dir, { recursive: true });
  }

  private frontMatter(meta: ArtifactMeta, title: string): string {
    return [
      "---",
      "PROOF_ONLY: true",
      `title: ${JSON.stringify(title)}`,
      `task: ${meta.taskId}`,
      `workflow: ${meta.workflowId}`,
      `stage: ${meta.stage}`,
      `agent: ${meta.agentId}`,
      `role: ${JSON.stringify(meta.role)}`,
      `execution: ${meta.real ? "REAL_MODEL" : "MOCK_MODEL"}`,
      `generated_at: ${this.clock.isoNow()}`,
      "---",
      "",
    ].join("\n");
  }

  /** Standard per-stage report file: <stage>.md */
  writeStageReport(meta: ArtifactMeta, title: string, body: string): StoredArtifact {
    return this.write(meta, `${meta.stage}.md`, title, body);
  }

  /** Any additional artifact the agent produced (kept, but namespaced by stage). */
  writeExtra(meta: ArtifactMeta, relName: string, title: string, body: string): StoredArtifact {
    const safeName = `${meta.stage}__${basename(relName).replace(/[^\w.\-]+/g, "_")}`;
    return this.write(meta, safeName, title, body);
  }

  private write(meta: ArtifactMeta, fileName: string, title: string, body: string): StoredArtifact {
    if (looksLikeSecret(body)) {
      throw new RuntimeError(
        "ARTIFACT_SECRET",
        `refusing to store artifact '${fileName}': it contains secret-looking material`,
      );
    }
    const abs = join(this.dir, fileName);
    writeFileSync(abs, this.frontMatter(meta, title) + body.trimEnd() + "\n");
    const rec = { file: fileName, path: abs, stage: meta.stage, agentId: meta.agentId };
    this.stored.push(rec);
    return rec;
  }

  list(): StoredArtifact[] {
    return [...this.stored];
  }

  /** Read back a stored artifact (for later stages' bounded context). */
  read(fileName: string): string | null {
    const abs = join(this.dir, fileName);
    return existsSync(abs) ? readFileSync(abs, "utf8") : null;
  }

  onDisk(): string[] {
    return existsSync(this.dir) ? readdirSync(this.dir).sort() : [];
  }
}
