# Security policy

## Supported versions

Only the latest release line receives security fixes.

## Reporting a vulnerability

Please report privately: use [GitHub security advisories](https://github.com/YOUR_USER/cross-window-state/security/advisories/new) ("Report a vulnerability"). Do not open public issues for suspected vulnerabilities.

Include reproduction steps and affected entry points (`/main`, `/preload`, `/renderer`, `/vue`) where possible.

## Scope notes

- The library trusts all renderers equally, matching Electron's IPC model. Loading untrusted remote content in windows that share state is out of scope by design.
- State files are JSON in the app's `userData` (or `localStorage` on web); they are not encrypted — do not store secrets in them.
