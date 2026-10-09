'use client';

import { useState, useEffect, useCallback } from 'react';

interface CaInfo {
  host: string;
  fingerprint: string;
  subject: string;
  notAfter: string;
}

type Platform = 'windows' | 'unix' | 'android' | 'ios';

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: 'Windows',
  unix: 'Linux / macOS',
  android: 'Android',
  ios: 'iPhone / iPad',
};

/** Pick the tab to open on, so the common case needs no clicking. */
function detectPlatform(userAgent: string): Platform {
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return 'unix';
}

function windowsCommand(ca: CaInfo): string {
  return [
    `$f = Join-Path $env:TEMP 'ga-ca.crt'`,
    `Invoke-WebRequest http://${ca.host}/rootca.crt -OutFile $f -UseBasicParsing`,
    `$c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $f`,
    `$h = -join ([Security.Cryptography.SHA256]::Create().ComputeHash($c.RawData) | ForEach-Object { $_.ToString('X2') })`,
    `if ($h -ne '${ca.fingerprint}') { throw "FINGERPRINT MISMATCH: $h" }`,
    `$s = New-Object Security.Cryptography.X509Certificates.X509Store('Root','LocalMachine')`,
    `$s.Open('ReadWrite'); $s.Add($c); $s.Close()`,
    `"Installed. Fingerprint verified: $h"`,
  ].join('\n');
}

function unixCommand(ca: CaInfo): string {
  return [
    `curl -fsS http://${ca.host}/rootca.crt -o /tmp/ga-ca.crt`,
    `[ "$(openssl x509 -in /tmp/ga-ca.crt -noout -fingerprint -sha256 | sed 's/.*=//' | tr -d ':')" = "${ca.fingerprint}" ] \\`,
    `  || { echo "FINGERPRINT MISMATCH"; exit 1; }`,
    `sudo cp /tmp/ga-ca.crt /usr/local/share/ca-certificates/guitar-assistant-root-ca.crt`,
    `sudo update-ca-certificates`,
    `certutil -d sql:"$HOME/.pki/nssdb" -A -t "C,," -n "Guitar Assistant Caddy Local CA" -i /tmp/ga-ca.crt`,
  ].join('\n');
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; selecting the text by hand still works.
      setFailed(true);
    }
  }, [command]);

  return (
    <div className="relative">
      <pre className="bg-gray-900 border border-gray-700 rounded-md p-3 pr-20 text-xs text-gray-200 overflow-x-auto whitespace-pre-wrap">
        {command}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-white font-medium"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {failed && (
        <p className="text-amber-400 text-xs mt-1">
          Could not reach the clipboard — select the text above and copy it manually.
        </p>
      )}
    </div>
  );
}

export default function CertificateSetupCard() {
  const [ca, setCa] = useState<CaInfo | null>(null);
  const [error, setError] = useState(false);
  // Read once, lazily. There is no user agent to read during server rendering,
  // but nothing below depends on this until the fetch above resolves on the
  // client, so the server's fallback is never rendered and cannot mismatch.
  const [platform, setPlatform] = useState<Platform>(() =>
    typeof navigator === 'undefined' ? 'windows' : detectPlatform(navigator.userAgent)
  );

  useEffect(() => {
    fetch('/api/setup/ca')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('request failed'))))
      .then(setCa)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-white mb-2">Trust this server&apos;s certificate</h2>
      <p className="text-gray-400 text-sm mb-4">
        A machine visiting this app for the first time shows{' '}
        <span className="text-gray-300">&ldquo;Your connection is not private&rdquo;</span>. Nothing is
        wrong with the certificate — the machine just doesn&apos;t know the authority that signed it.
        Run the command below once on that machine and the warning is gone for good.
      </p>

      {error && (
        <p className="text-red-400 text-sm">
          Could not read the certificate authority from the server.
        </p>
      )}

      {!ca && !error && <p className="text-gray-400 text-sm">Loading certificate details...</p>}

      {ca && (
        <>
          <div className="flex gap-1 mb-4 flex-wrap">
            {(Object.keys(PLATFORM_LABELS) as Platform[]).map((key) => (
              <button
                key={key}
                onClick={() => setPlatform(key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  platform === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {PLATFORM_LABELS[key]}
              </button>
            ))}
          </div>

          {platform === 'windows' && (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">
                Open PowerShell as administrator (right-click &rarr; Run as administrator), then
                paste:
              </p>
              <CopyableCommand command={windowsCommand(ca)} />
              <p className="text-gray-500 text-xs">
                Covers Chrome, Edge and Brave at once — they share the Windows root store. Firefox
                reads it too. No admin rights? Change{' '}
                <code className="text-gray-400">LocalMachine</code> to{' '}
                <code className="text-gray-400">CurrentUser</code>.
              </p>
            </div>
          )}

          {platform === 'unix' && (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">Paste into a terminal:</p>
              <CopyableCommand command={unixCommand(ca)} />
              <p className="text-gray-500 text-xs">
                Needs <code className="text-gray-400">certutil</code> (
                <code className="text-gray-400">sudo apt install libnss3-tools</code>). This covers
                the system store and Chrome/Brave. If this machine has the repository checked out,
                run <code className="text-gray-400">./scripts/install-ca.sh</code> instead — it also
                handles Firefox profiles and snap browsers.
              </p>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-3 text-sm text-gray-400">
              <p>
                1. Download{' '}
                <a
                  href={`http://${ca.host}/rootca.crt`}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  rootca.crt
                </a>
              </p>
              <p>
                2. Open <span className="text-gray-300">Settings &rarr; Security &rarr; Encryption
                &amp; credentials &rarr; Install a certificate &rarr; CA certificate</span>, then
                pick the downloaded file.
              </p>
              <p className="text-gray-500 text-xs">
                Android deliberately refuses to install a CA straight from a web page, so this one
                has to go through Settings.
              </p>
            </div>
          )}

          {platform === 'ios' && (
            <div className="space-y-3 text-sm text-gray-400">
              <p>
                1. Download{' '}
                <a
                  href={`http://${ca.host}/rootca.crt`}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  rootca.crt
                </a>{' '}
                in Safari and allow the profile.
              </p>
              <p>
                2. <span className="text-gray-300">Settings &rarr; General &rarr; VPN &amp; Device
                Management</span> &rarr; install the profile.
              </p>
              <p>
                3. <span className="text-gray-300">Settings &rarr; General &rarr; About &rarr;
                Certificate Trust Settings</span> &rarr; switch it on. Missing this step is why it
                still fails for most people.
              </p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-700">
            <p className="text-gray-500 text-xs mb-1">
              The command checks the certificate against this fingerprint and refuses to install
              anything else:
            </p>
            <code className="block text-xs text-gray-400 break-all">{ca.fingerprint}</code>
            <p className="text-gray-500 text-xs mt-2">
              {ca.subject} &middot; expires {ca.notAfter}. To verify it independently, run{' '}
              <code className="text-gray-400 break-all">
                docker compose exec -T caddy cat
                /data/caddy/pki/authorities/local/root.crt | openssl x509 -noout -fingerprint
                -sha256
              </code>{' '}
              on the server.
            </p>
          </div>

          <p className="text-gray-500 text-xs mt-3">
            Afterwards, fully quit and reopen the browser — closing the tab is not enough, because
            browsers cache certificate failures for the life of a session.
          </p>
        </>
      )}
    </div>
  );
}
