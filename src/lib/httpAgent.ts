import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import tls from "tls";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const caCertPath = join(__dirname, "..", "..", "certs", "ca-certificates.crt");

let globalHttpsAgent: https.Agent | null = null;
let caBundles: (string | Buffer)[] | null = null;

export function getCertificates(): (string | Buffer)[] {
  if (caBundles) return caBundles;

  try {
    const customCa = readFileSync(caCertPath, "utf-8");
    const systemCas = tls.rootCertificates || [];
    caBundles = [customCa, ...systemCas];
    return caBundles;
  } catch (err: any) {
    const systemCas = tls.rootCertificates || [];
    caBundles = [...systemCas];
    return caBundles;
  }
}

export function getHttpsAgent(): https.Agent {
  if (globalHttpsAgent) return globalHttpsAgent;

  const certs = getCertificates();
  
  globalHttpsAgent = new https.Agent({
    ca: certs,
    rejectUnauthorized: true,
  });

  return globalHttpsAgent;
}

// Initialize agent at module load time to ensure it's set for global fetch
getHttpsAgent();
