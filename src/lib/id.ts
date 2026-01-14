import crypto from "node:crypto";

export function newId(prefix = ""): string {
  return prefix + crypto.randomBytes(8).toString("hex");
}
