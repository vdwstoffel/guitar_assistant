<#
.SYNOPSIS
    Trust the guitar assistant's Caddy root CA on this Windows machine.

.DESCRIPTION
    The app is served over HTTPS by Caddy using `tls internal`, which signs its
    certificates with a private CA. The certificates are valid; nothing trusts
    the authority that signed them, which is what produces the browser's
    "Your connection is not private" (ERR_CERT_AUTHORITY_INVALID) screen.

    This downloads that CA, checks it against a pinned SHA-256 fingerprint, and
    adds it to the Windows "Trusted Root Certification Authorities" store.
    Chrome, Edge and Brave all read that store, so one run covers all of them.

    Run it once per machine. It is idempotent.

.EXAMPLE
    # In an ELEVATED PowerShell (right-click > Run as administrator):
    powershell -ExecutionPolicy Bypass -File .\install-ca.ps1

.EXAMPLE
    # Without admin rights — installs for your account only. Chrome, Edge and
    # Brave honour this too, but other users on the PC are unaffected.
    powershell -ExecutionPolicy Bypass -File .\install-ca.ps1 -CurrentUser

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\install-ca.ps1 -HostAddress 10.0.0.5

.NOTES
    Firefox is the exception: it keeps its own certificate store. On Windows it
    reads the Windows root store anyway, because security.enterprise_roots.enabled
    defaults to true there. If a Firefox install has that turned off, either set
    it to true on about:config, or import the certificate by hand under
    Settings > Privacy & Security > Certificates > View Certificates > Authorities.
#>

[CmdletBinding()]
param(
    # Do not name this $Host — that is a reserved PowerShell automatic variable.
    [string] $HostAddress = "192.168.129.11",

    # SHA-256 of the CA Caddy minted on 2026-05-31, valid until 2036-04-08.
    # Pinning it means the plain-HTTP download cannot be substituted by anyone
    # else on the network: a swapped certificate aborts the script.
    #
    # This changes ONLY if the caddy_data Docker volume is destroyed and Caddy
    # mints a fresh CA. The server prints the new value with (the caddy image
    # has no openssl of its own, so the certificate is piped to the host's):
    #   docker compose exec -T caddy cat /data/caddy/pki/authorities/local/root.crt \
    #     | openssl x509 -noout -fingerprint -sha256
    [string] $ExpectedFingerprint = "1AFC17066F2ECFD976D7866F36CAD7E413CF67EA727574D76A56639A48BE5367",

    # Install for the current user instead of the whole machine (no admin needed).
    [switch] $CurrentUser
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string] $Text) Write-Host "`n== $Text" -ForegroundColor Cyan }
function Write-Detail { param([string] $Text) Write-Host "   $Text" }

# Some older Windows builds still default to TLS 1.0 for outbound requests,
# which the verification step at the bottom needs raised.
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
    # Already fine on modern builds; nothing to do.
}

$scope = if ($CurrentUser) { "CurrentUser" } else { "LocalMachine" }

if (-not $CurrentUser) {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host ""
        Write-Host "This needs to run as administrator to write to the machine-wide store." -ForegroundColor Red
        Write-Host "Either reopen PowerShell with 'Run as administrator', or re-run with" -ForegroundColor Red
        Write-Host "-CurrentUser to install for your account only." -ForegroundColor Red
        exit 1
    }
}

# --- fetch and authenticate the CA ------------------------------------------

Write-Step "Fetching the root CA from http://$HostAddress/rootca.crt"

$crtPath = Join-Path $env:TEMP "guitar-assistant-root-ca.crt"
try {
    Invoke-WebRequest -Uri "http://$HostAddress/rootca.crt" -OutFile $crtPath -UseBasicParsing
} catch {
    Write-Host "`nERROR: could not download the CA from $HostAddress." -ForegroundColor Red
    Write-Host "Is the app running, and is the machine reachable on the network?" -ForegroundColor Red
    exit 1
}

try {
    $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $crtPath
} catch {
    Write-Host "`nERROR: the downloaded file is not a certificate." -ForegroundColor Red
    exit 1
}

# Refuse anything that is not actually a CA, so a mis-pointed host cannot get a
# plain server certificate installed as a trust anchor.
$basicConstraints = $cert.Extensions | Where-Object {
    $_ -is [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]
}
if (-not $basicConstraints -or -not $basicConstraints.CertificateAuthority) {
    Write-Host "`nERROR: that certificate is not a CA certificate. Refusing to install it." -ForegroundColor Red
    exit 1
}

# .Thumbprint is SHA-1, so compute SHA-256 over the DER bytes to match what
# `openssl x509 -fingerprint -sha256` reports on the server.
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
    $actual = -join ($sha256.ComputeHash($cert.RawData) | ForEach-Object { $_.ToString("X2") })
} finally {
    $sha256.Dispose()
}

$expected = ($ExpectedFingerprint -replace '[:\s]', '').ToUpperInvariant()
if ($actual -ne $expected) {
    Write-Host "`nERROR: fingerprint mismatch - NOT installing." -ForegroundColor Red
    Write-Host "  expected: $expected" -ForegroundColor Red
    Write-Host "  received: $actual"   -ForegroundColor Red
    Write-Host "`nEither the CA was regenerated (see the notes in this script), or" -ForegroundColor Red
    Write-Host "something on the network served a different certificate." -ForegroundColor Red
    exit 1
}

Write-Detail "Subject:     $($cert.Subject)"
Write-Detail "Expires:     $($cert.NotAfter.ToString('yyyy-MM-dd'))"
Write-Detail "Fingerprint: $actual  (matches pinned value)"

# --- install -----------------------------------------------------------------

Write-Step "Installing into the Windows $scope root store"

# X509Store rather than Import-Certificate: it needs no PKI module, works on
# Windows PowerShell 5.1 and PowerShell 7 alike, and re-adding a certificate
# that is already there is a no-op, which keeps this script idempotent.
$store = New-Object Security.Cryptography.X509Certificates.X509Store("Root", $scope)
try {
    $store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($cert)
} catch {
    Write-Host "`nERROR: could not write to the $scope root store: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    $store.Close()
}

Write-Detail "Added to Cert:\$scope\Root"
Write-Detail "Chrome, Edge and Brave all read this store."

# --- verify ------------------------------------------------------------------

Write-Step "Verifying"

try {
    Invoke-WebRequest -Uri "https://$HostAddress/" -UseBasicParsing -TimeoutSec 15 | Out-Null
    Write-Detail "https://$HostAddress/ validates without warnings. Trust is working."
} catch {
    Write-Detail "WARNING: https://$HostAddress/ still did not validate."
    Write-Detail "Detail: $($_.Exception.Message)"
}

Write-Host @"

Done. Fully quit and reopen your browser (close every window, not just the tab)
and visit:

    https://$HostAddress/

Browsers cache TLS failures for the life of a session, so a window that is
already open may keep showing the old warning until it is restarted.
"@
