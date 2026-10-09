import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import { describeCaCertificate } from "@/lib/caCertificate";

// Caddy serves the CA at /rootca.crt on the compose network. Overridable so a
// dev server running outside Docker can point at the real host instead.
const UPSTREAM_HOST = process.env.CA_UPSTREAM_HOST ?? "caddy";

// Caddy exposes /rootca.crt only on its explicit `http://192.168.129.11,
// http://localhost` site; a request arriving as Host: caddy falls through to
// the catch-all that redirects to HTTPS, where the certificate does not cover
// the name "caddy". Sending Host: localhost lands on the right site.
const UPSTREAM_HOST_HEADER = process.env.CA_UPSTREAM_HOST_HEADER ?? "localhost";

/**
 * Read the root CA PEM from Caddy.
 *
 * Deliberately node:http rather than fetch: undici silently ignores a Host
 * header override, so fetch cannot reach the site above.
 */
function fetchRootCaPem(): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: UPSTREAM_HOST,
        port: 80,
        path: "/rootca.crt",
        method: "GET",
        headers: { Host: UPSTREAM_HOST_HEADER },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Caddy returned ${response.statusCode} for /rootca.crt`));
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve(body));
        response.on("error", reject);
      }
    );
    request.on("error", reject);
    request.setTimeout(5000, () => request.destroy(new Error("Timed out reading the CA from Caddy")));
    request.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    const info = describeCaCertificate(await fetchRootCaPem());

    // The address this visitor actually typed, so the instructions quote it
    // back rather than a hardcoded LAN IP. The port is dropped because the CA
    // is always served by Caddy on port 80.
    const host = (request.headers.get("host") ?? "").split(":")[0];

    return NextResponse.json({ host, ...info });
  } catch (error) {
    console.error("Error describing the local CA:", error);
    return NextResponse.json(
      { error: "Failed to read the local certificate authority" },
      { status: 500 }
    );
  }
}
