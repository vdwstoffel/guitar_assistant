import { describe, it, expect } from "vitest";
import { describeCaCertificate } from "./caCertificate";

// Caddy's local root CA, as served at http://<host>/rootca.crt. It is a public
// certificate — the matching private key never leaves the caddy_data volume.
const CADDY_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIBozCCAUmgAwIBAgIQZde1IXVxbyYN2UzTRo5o/DAKBggqhkjOPQQDAjAwMS4w
LAYDVQQDEyVDYWRkeSBMb2NhbCBBdXRob3JpdHkgLSAyMDI2IEVDQyBSb290MB4X
DTI2MDUzMTIwMTQ0MloXDTM2MDQwODIwMTQ0MlowMDEuMCwGA1UEAxMlQ2FkZHkg
TG9jYWwgQXV0aG9yaXR5IC0gMjAyNiBFQ0MgUm9vdDBZMBMGByqGSM49AgEGCCqG
SM49AwEHA0IABD0wMI7qRrI83OdaATQ815wTCJ3LtVMHX2s+4VxqSDvObWnBUk4V
auHgGcHK2A2ElEU3vTvhGqrtXtRo4zpxfAGjRTBDMA4GA1UdDwEB/wQEAwIBBjAS
BgNVHRMBAf8ECDAGAQH/AgEBMB0GA1UdDgQWBBQ5xcg/isbRDof/tSTG1ecaOk1M
MDAKBggqhkjOPQQDAgNIADBFAiBGG0LChez1G4hwwBlvPxsrCHySuiA2i3ph/6cG
KaOFrAIhAKl+0TxBOR1cQZTMtR1/8e7vI9/ayLvQwTy8WXATzdy0
-----END CERTIFICATE-----
`;

// A self-signed certificate with basicConstraints CA:FALSE, standing in for
// anything that is not a certificate authority.
const NOT_A_CA = `-----BEGIN CERTIFICATE-----
MIIDFDCCAfygAwIBAgIUFndQSaFObX2u+KVPHI5I0fn+CzQwDQYJKoZIhvcNAQEL
BQAwGzEZMBcGA1UEAwwQbm90LWEtY2EuZXhhbXBsZTAeFw0yNjEwMDkxODU2NDNa
Fw0yNjEwMTAxODU2NDNaMBsxGTAXBgNVBAMMEG5vdC1hLWNhLmV4YW1wbGUwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDf9emBnEX81vr6Xyo3OEbfVlZ1
oOdXT1blw8XaY8Y2FHH5fcaB6NvjDojLDF3T9aS2gyA4QcIf6yBARdZcFRDeFFzt
fP1inPv0LunXcyNmoo/bSM4YS0f7lHcH1pvlqnmrIaY3b/ARvUtu2cu9Ec6LKeJa
vtRHDeKc12U8Nvx7LnLEhYOQ8Z9tHqwsBx/xawTX5MvIIydrTbteO9EGfs/8nnrJ
fevF9zzDpueyA4hZF/+t8PSBFllSM4KmA1pNnFt5o0Ti//8uJ+q26C4QObV9e62f
i+0+XfynUgAzUNhkM80cDCuUrzfws4bt2QDTzESK89/+Xh2cwI3flGw8GQJ1AgMB
AAGjUDBOMB0GA1UdDgQWBBT+5BeQ4tGaUMLhj16ZOq4sKzlI4zAfBgNVHSMEGDAW
gBT+5BeQ4tGaUMLhj16ZOq4sKzlI4zAMBgNVHRMBAf8EAjAAMA0GCSqGSIb3DQEB
CwUAA4IBAQB3I0D3pCvoJ/SuCiaPaHp0hsgvsJb0qNojeqUd10iH2gOqhe+FzIe/
Oxf+dcnlZWWqELCvzD13l83Vv6f8hHZKuGk3aEuEXZeKxFeZPviBk5/A0yi5byYo
BMVHQ8B1YAokKmWrjlsuQ52E7AnJCmqGycXfHr2zh4nYrh1f0xb+0FktG6z/JNY5
ow38NIwSx0MXLyS92DKWL8peuIy85R4QjVg75SlzZqkl3a+3f3h6zGMptNycjh/b
s2NJ/IpsYooVPkcOa4zF4GnxVbmuoME40Ndluj3dPua8IU0j3Vy8wK1u5MtpNyIG
f6sXr/tu1Syq+GoWWXOS43se+uyZoUDp
-----END CERTIFICATE-----
`;

describe("describeCaCertificate", () => {
  it("reports the SHA-256 fingerprint as uppercase hex with no separators", () => {
    const { fingerprint } = describeCaCertificate(CADDY_ROOT_CA);

    // The same value `openssl x509 -noout -fingerprint -sha256` prints, and the
    // value pinned in scripts/install-ca.sh and scripts/install-ca.ps1. The
    // install scripts compare against exactly this shape, so a stray colon or a
    // lowercase digit here would make every copy-paste abort.
    expect(fingerprint).toBe(
      "1AFC17066F2ECFD976D7866F36CAD7E413CF67EA727574D76A56639A48BE5367"
    );
  });

  it("pulls the common name out of the subject", () => {
    expect(describeCaCertificate(CADDY_ROOT_CA).subject).toBe(
      "Caddy Local Authority - 2026 ECC Root"
    );
  });

  it("reports the expiry as an ISO date", () => {
    expect(describeCaCertificate(CADDY_ROOT_CA).notAfter).toBe("2036-04-08");
  });

  it("refuses a certificate that is not a CA", () => {
    // Guards against pointing the app at a host that serves an ordinary server
    // certificate: the page would otherwise invite people to install a leaf
    // certificate as a trust anchor, which silently does nothing useful.
    expect(() => describeCaCertificate(NOT_A_CA)).toThrow(/not a certificate authority/i);
  });

  it("refuses input that is not a certificate at all", () => {
    expect(() => describeCaCertificate("hello, world")).toThrow(/could not be parsed/i);
  });

  it("refuses an empty response", () => {
    expect(() => describeCaCertificate("")).toThrow(/could not be parsed/i);
  });
});
