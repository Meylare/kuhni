import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { describe, expect, it } from "vitest";

function collectSource(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSource(full));
      continue;
    }
    if (
      [".ts", ".tsx", ".js", ".css", ".html", ".json"].includes(extname(full)) &&
      !entry.includes(".test.")
    ) {
      files.push(full);
    }
  }
  return files;
}

describe("секреты в интерфейсе", () => {
  it("не передаёт service_role в клиент Supabase", () => {
    const files = collectSource(join(process.cwd(), "src"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("SERVICE_ROLE"), file).toBe(false);
      expect(text.includes("serviceRole"), file).toBe(false);
    }
  });
});
