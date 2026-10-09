#!/usr/bin/env bash
#
# Trust the guitar assistant's Caddy root CA on this machine.
#
# The app is served over HTTPS by Caddy using `tls internal`, which signs
# certificates with a private CA. The certificates are valid; nothing trusts
# the authority that signed them, which is what produces the browser's
# "Your connection is not private" (ERR_CERT_AUTHORITY_INVALID) screen.
#
# Run this once per machine. It is idempotent, so re-running after a browser
# install or a new Firefox profile is safe and is the intended way to fix one.
#
#   ./scripts/install-ca.sh                  # defaults to 192.168.129.11
#   ./scripts/install-ca.sh --skip-system    # browsers only, no root needed
#   GUITAR_ASSISTANT_HOST=10.0.0.5 ./scripts/install-ca.sh
#
# Windows machines use scripts/install-ca.ps1 instead.

set -euo pipefail

SKIP_SYSTEM=0
for arg in "$@"; do
  case "$arg" in
    --skip-system) SKIP_SYSTEM=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

HOST="${GUITAR_ASSISTANT_HOST:-192.168.129.11}"
NICKNAME="Guitar Assistant Caddy Local CA"
BASENAME="guitar-assistant-root-ca.crt"

# SHA-256 of the CA that Caddy minted on 2026-05-31, valid until 2036-04-08.
# Pinning it means the plain-HTTP download below cannot be substituted by
# anyone else on the network: a swapped certificate aborts the script.
#
# This changes ONLY if the `caddy_data` Docker volume is destroyed and Caddy
# mints a fresh CA. If that happens the new value is printed by (the caddy
# image has no openssl of its own, so the certificate is piped to the host's):
#   docker compose exec -T caddy cat /data/caddy/pki/authorities/local/root.crt \
#     | openssl x509 -noout -fingerprint -sha256
# Set GUITAR_ASSISTANT_CA_FINGERPRINT to override it for a one-off run.
EXPECTED_FP="${GUITAR_ASSISTANT_CA_FINGERPRINT:-1AFC17066F2ECFD976D7866F36CAD7E413CF67EA727574D76A56639A48BE5367}"

say()  { printf '  %s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v openssl >/dev/null || die "openssl is required but not installed."
command -v curl    >/dev/null || die "curl is required but not installed."

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
CRT="$WORKDIR/$BASENAME"

# --- fetch and authenticate the CA -----------------------------------------

step "Fetching the root CA from http://$HOST/rootca.crt"
curl -fsS "http://$HOST/rootca.crt" -o "$CRT" \
  || die "Could not download the CA. Is the app running, and is $HOST reachable?"

openssl x509 -in "$CRT" -noout >/dev/null 2>&1 \
  || die "The downloaded file is not a certificate."

openssl x509 -in "$CRT" -noout -ext basicConstraints 2>/dev/null | grep -q "CA:TRUE" \
  || die "The downloaded certificate is not a CA certificate. Refusing to install it."

ACTUAL_FP="$(openssl x509 -in "$CRT" -noout -fingerprint -sha256 | sed 's/.*=//' | tr -d ':' | tr '[:lower:]' '[:upper:]')"
if [ "$ACTUAL_FP" != "$(printf '%s' "$EXPECTED_FP" | tr -d ':' | tr '[:lower:]' '[:upper:]')" ]; then
  printf '\nERROR: fingerprint mismatch — NOT installing.\n' >&2
  printf '  expected: %s\n' "$EXPECTED_FP" >&2
  printf '  received: %s\n' "$ACTUAL_FP" >&2
  printf '\nEither the CA was regenerated (see the note in this script), or\n' >&2
  printf 'something on the network served a different certificate.\n' >&2
  exit 1
fi

say "Subject:     $(openssl x509 -in "$CRT" -noout -subject | sed 's/^subject=//')"
say "Expires:     $(openssl x509 -in "$CRT" -noout -enddate | sed 's/^notAfter=//')"
say "Fingerprint: $ACTUAL_FP  (matches pinned value)"

# --- system trust store ------------------------------------------------------
# Covers curl, wget, and anything else using OpenSSL. Browsers keep their own
# stores and are handled separately below.

if [ "$SKIP_SYSTEM" -eq 1 ]; then
  step "Skipping the system trust store (--skip-system)"
  say "Browsers below are still covered; curl and wget will not be."
else
  step "Installing into the system trust store"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null || die "Need root (or sudo) to write to the system trust store."
  SUDO="sudo"
  say "(sudo required)"
fi

if [ -d /usr/local/share/ca-certificates ]; then           # Debian / Ubuntu
  $SUDO install -m 644 "$CRT" "/usr/local/share/ca-certificates/$BASENAME"
  $SUDO update-ca-certificates >/dev/null
  say "Installed via update-ca-certificates."
elif [ -d /etc/pki/ca-trust/source/anchors ]; then         # Fedora / RHEL
  $SUDO install -m 644 "$CRT" "/etc/pki/ca-trust/source/anchors/$BASENAME"
  $SUDO update-ca-trust extract
  say "Installed via update-ca-trust."
elif [ -d /etc/ca-certificates/trust-source/anchors ]; then # Arch
  $SUDO install -m 644 "$CRT" "/etc/ca-certificates/trust-source/anchors/$BASENAME"
  $SUDO trust extract-compat
  say "Installed via trust extract-compat."
elif [ "$(uname -s)" = "Darwin" ]; then                    # macOS
  $SUDO security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain "$CRT"
  say "Installed into the System keychain."
else
  say "WARNING: unrecognised system — skipped. Browsers below are still covered."
fi
fi

# --- browser (NSS) trust stores ---------------------------------------------
# Chromium-family browsers and Firefox each keep a private NSS database and
# ignore the system store, so every one of them needs its own copy.

step "Installing into browser certificate stores"

if ! command -v certutil >/dev/null; then
  say "WARNING: certutil not found, so browser stores were skipped."
  say "Install it and re-run:  sudo apt install libnss3-tools"
else
  installed=0

  add_to_nssdb() {
    local db="$1" label="$2"
    certutil -d "sql:$db" -D -n "$NICKNAME" >/dev/null 2>&1 || true   # idempotent
    if certutil -d "sql:$db" -A -t "C,," -n "$NICKNAME" -i "$CRT" 2>/dev/null; then
      say "$label"
      installed=$((installed + 1))
    else
      say "FAILED: $label (is the browser running? close it and re-run)"
    fi
  }

  # Chromium family: Chrome, Chromium, Brave, Edge, Vivaldi. The deb and
  # flatpak builds keep a single database at a fixed path. A snap's $HOME is
  # remapped to ~/snap/<name>/<revision>, so its database lives in a numbered
  # directory — and ~/snap/<name>/current must NOT be used to find it, because
  # that symlink can dangle at a revision snapd has already removed (it does
  # on at least one machine here, pointing at a long-gone revision while two
  # newer ones sit beside it). Writing to every revision present sidesteps
  # that: snapd copies this data forward on refresh, so whichever revision the
  # browser actually runs from is covered.
  # Only browsers. Plenty of other Chromium/Electron apps (Discord, Spotify,
  # Postman...) keep an NSS database too, and a glob over every snap sweeps
  # them in. They never open this app, so widening what trusts a private CA
  # whose key sits in a Docker volume on the LAN buys nothing.
  CHROMIUM_SNAPS="brave chromium chrome google-chrome ungoogled-chromium opera vivaldi microsoft-edge edge"

  snap_browser_dbs() {
    local name rev
    for name in $CHROMIUM_SNAPS; do
      for rev in "$HOME/snap/$name"/[0-9]*/; do
        [ -d "$rev/.pki/nssdb" ] && printf '%s\n' "${rev%/}/.pki/nssdb"
      done
    done
  }

  for db in "$HOME/.pki/nssdb" \
            $(snap_browser_dbs) \
            "$HOME"/.var/app/*/.pki/nssdb; do
    [ -d "$db" ] || continue
    [ -f "$db/cert9.db" ] || certutil -d "sql:$db" -N --empty-password >/dev/null 2>&1 || true
    add_to_nssdb "$db" "$db"
  done

  # A Chromium-family snap that has never been launched has no database at
  # all yet. Create one in its installed revision so its first launch is clean.
  for name in $CHROMIUM_SNAPS; do
    [ -d "$HOME/snap/$name" ] || continue
    ls -d "$HOME/snap/$name"/[0-9]*/.pki/nssdb >/dev/null 2>&1 && continue
    rev="$(snap list "$name" 2>/dev/null | awk 'NR==2 {print $3}')"
    [ -n "${rev:-}" ] && [ -d "$HOME/snap/$name/$rev" ] || continue
    db="$HOME/snap/$name/$rev/.pki/nssdb"
    mkdir -p "$db"
    certutil -d "sql:$db" -N --empty-password >/dev/null 2>&1 || true
    add_to_nssdb "$db" "$db (created)"
  done

  # Firefox keeps one database per profile, including snap and flatpak builds.
  for profile in "$HOME"/.mozilla/firefox/*/ \
                 "$HOME"/snap/firefox/common/.mozilla/firefox/*/ \
                 "$HOME"/.var/app/org.mozilla.firefox/.mozilla/firefox/*/; do
    [ -f "$profile/cert9.db" ] || continue
    add_to_nssdb "${profile%/}" "${profile%/}"
  done

  [ "$installed" -gt 0 ] || say "No browser certificate stores found on this machine."
fi

# --- verify ------------------------------------------------------------------

step "Verifying"

if curl -fsS -o /dev/null "https://$HOST/" 2>/dev/null; then
  say "curl https://$HOST/ succeeds without -k. System trust is working."
elif [ "$SKIP_SYSTEM" -eq 1 ]; then
  say "curl still rejects https://$HOST/, as expected with --skip-system."
else
  say "WARNING: curl still rejects https://$HOST/ — the system store may not have taken."
fi

for db in "$HOME/.pki/nssdb" $(snap_browser_dbs 2>/dev/null); do
  [ -f "$db/cert9.db" ] || continue
  if certutil -d "sql:$db" -L -n "$NICKNAME" >/dev/null 2>&1; then
    say "present in $db"
  fi
done

cat <<EOF

Done. Fully quit and reopen your browser (not just the tab) and visit:

    https://$HOST/

Browsers cache TLS failures for a session, so an already-open window may keep
showing the old warning until it is restarted.
EOF
