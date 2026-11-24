# Code signing: installing Melo without "unknown publisher" warnings

Windows (SmartScreen: "Windows protected your PC", "Unknown publisher") and macOS (Gatekeeper: "Melo can't be
opened because Apple cannot check it") warn about any installer that is not signed by an identity they trust.
The fix is a code-signing certificate on each platform. Both are tied to a verified person or company, so the
owner has to buy them and pass the identity check. The build is ready: once the secrets below are added to
GitHub, the "Release installers" workflow signs everything by itself and checks the signatures.

| | Windows | macOS |
|---|---|---|
| What to get | **Microsoft Azure Artifact Signing** (formerly "Trusted Signing"), Basic tier | **Apple Developer Program** membership: "Developer ID Application" certificate + notarization |
| Who can get it | Organizations in the US, Canada, EU, UK, Australia, New Zealand, Japan, South Korea, Singapore, Switzerland, Norway, Israel; **individuals only in the US or Canada** | Any individual or organization (organizations need a D-U-N-S number) |
| Cost | Monthly Azure subscription (check the current price on the Azure pricing page) | USD 99 per year |
| Alternative | An OV code-signing certificate from a CA (DigiCert, Sectigo, SSL.com...), stored on a hardware token or cloud HSM, signed with `signtool` | none (Apple is the only issuer) |
| Result | Publisher shows your verified name; SmartScreen warnings fade as the signed installer builds reputation (a brand-new certificate can still show a warning for the first downloads; no certificate type removes this instantly) | Opens with a normal double-click, no warning |

## Windows: Azure Artifact Signing

1. Create an Azure account and subscription (https://portal.azure.com).
2. Create an **Artifact Signing account** (resource provider `Microsoft.CodeSigning`), Basic SKU. Note its region
   endpoint, for example `https://eus.codesigning.azure.net/`.
3. **Identity validation** → *Public Trust* (organization or individual). Approval takes from hours to a few days.
   The person doing this needs the role *Artifact Signing Identity Verifier*.
4. Create a **certificate profile** of type *Public Trust* using that validated identity.
5. Create an **app registration** (Microsoft Entra ID) with a client secret, and give it the role
   *Artifact Signing Certificate Profile Signer* on the signing account.
6. In GitHub → repository → Settings → Secrets and variables → Actions, add these **secrets**:

   | Secret | Value |
   |---|---|
   | `AZURE_TENANT_ID` | Directory (tenant) ID of the app registration |
   | `AZURE_CLIENT_ID` | Application (client) ID |
   | `AZURE_CLIENT_SECRET` | The client secret value |
   | `AZURE_SIGNING_ENDPOINT` | e.g. `https://eus.codesigning.azure.net/` |
   | `AZURE_SIGNING_ACCOUNT` | Artifact Signing account name |
   | `AZURE_CERT_PROFILE` | Certificate profile name |

   and the **variable** `MELO_PUBLISHER` = the exact name on the validated identity (Windows shows it as the
   publisher in Setup and in Apps & features).

The workflow then signs `Melo.exe`, rebuilds the installer around it (`build.ps1 -InstallerOnly`), signs
`Melo-Setup-<version>.exe`, timestamps both (they stay valid after the certificate expires) and fails if
`Get-AuthenticodeSignature` is not `Valid`.

## macOS: Developer ID + notarization

1. Join the Apple Developer Program (https://developer.apple.com/programs/).
2. Create a **Developer ID Application** certificate (Xcode → Settings → Accounts → Manage Certificates, or the
   developer website with a CSR). Export it from Keychain Access as a `.p12` file with a password.
3. App Store Connect → Users and Access → Integrations → **App Store Connect API** → create a key with the
   *Developer* role. Download the `.p8` file (only once) and note the Key ID and Issuer ID.
4. Add these GitHub **secrets**:

   | Secret | Value |
   |---|---|
   | `MACOS_CERT_P12` | `base64 -i DeveloperID.p12` output |
   | `MACOS_CERT_PASSWORD` | the `.p12` password |
   | `MACOS_SIGN_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID1234)` |
   | `APPLE_NOTARY_KEY_P8` | contents of the `.p8` file |
   | `APPLE_NOTARY_KEY_ID` | Key ID |
   | `APPLE_NOTARY_ISSUER` | Issuer ID |

The workflow imports the certificate into a temporary keychain; PyInstaller signs every binary with the hardened
runtime and `packaging/macos/entitlements.plist` (the two exceptions a Python app needs); `build.sh` signs the
DMG, submits it to Apple's notary service, staples the ticket (so it opens offline too) and checks it with
`spctl`.

## Building signed copies by hand

* Windows: sign with the Artifact Signing dlib and `signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com
  /td SHA256 /dlib <path>\Azure.CodeSigning.Dlib.dll /dmdf metadata.json dist\Melo\Melo.exe`, then run
  `build.ps1 -InstallerOnly` and sign `dist\Melo-Setup-*.exe` the same way.
* macOS: `export MELO_CODESIGN_IDENTITY="Developer ID Application: ..." MELO_NOTARY_KEY_FILE=key.p8
  MELO_NOTARY_KEY_ID=... MELO_NOTARY_ISSUER=...` then `./packaging/build.sh`.

## Linux

Linux has no central gatekeeper. The AppImage and the archive run as they are. Optionally publish a SHA-256
checksum (or a GPG signature) next to the downloads so families can check the file.
