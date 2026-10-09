import { X509Certificate } from "node:crypto";

export interface CaCertificateInfo {
  /** SHA-256 over the DER bytes: uppercase hex, no separators. */
  fingerprint: string;
  /** Common name, e.g. "Caddy Local Authority - 2026 ECC Root". */
  subject: string;
  /** Expiry as YYYY-MM-DD. */
  notAfter: string;
}

/**
 * Describe the root CA that Caddy signs this server's certificates with, for
 * the setup instructions under Tools.
 *
 * The fingerprint is read from the live certificate rather than hardcoded so
 * that it stays correct if the caddy_data volume is ever lost and Caddy mints a
 * fresh CA — a stale value printed with confidence would make every copy-paste
 * of the install command abort.
 */
export function describeCaCertificate(pem: string): CaCertificateInfo {
  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(pem);
  } catch {
    throw new Error("The certificate could not be parsed.");
  }

  // Refuse a leaf certificate. Installing one as a trust anchor achieves
  // nothing, so failing loudly beats instructions that quietly do not work.
  if (!certificate.ca) {
    throw new Error("That certificate is not a certificate authority.");
  }

  return {
    // Node renders fingerprint256 colon-separated; the install scripts compare
    // against a bare uppercase string.
    fingerprint: certificate.fingerprint256.replace(/:/g, "").toUpperCase(),
    subject: commonName(certificate.subject),
    notAfter: new Date(certificate.validTo).toISOString().slice(0, 10),
  };
}

/**
 * Pull the CN out of a subject. Node renders one RDN per line, so a subject
 * carrying an organisation or country would otherwise be shown in full.
 */
function commonName(subject: string): string {
  for (const line of subject.split("\n")) {
    const match = /^CN=(.*)$/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return subject.trim();
}
