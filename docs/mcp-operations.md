# MCP operations

## Release

Use Bun to install, build, and test; ship the CLI under Node. Resolve dependency
updates with `bun update --latest --minimum-release-age=259200`. Commit `bun.lock`
with `package.json`. After upgrading Biome run `bunx biome migrate --write`.

Bump the package version for a release and run:

```sh
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run lint
bun run format:check
bun test
```

Merge the reviewed change through a GitHub PR. Tag that main-branch commit with
`v<package-version>` and push the tag. `.github/workflows/release.yml` tests the
commit, publishes to npm with GitHub OIDC provenance, then creates the GitHub
release. Publishing uses npm trusted publishing; no local npm token or OTP is
needed for this path. Check the actual workflow outcome, registry version, and
installed artifact's `--version` before declaring currency.

## Capability and authentication boundaries

Full mode is the default (27 tools). `--mode read-only` registers 16 tools and
excludes all ten create/update/delete tools and `get_perspective_tasks`, which
changes the user's front window. The same allowlist filters `search_tools`.
Excluded tools are unregistered and direct calls fail. A listener owns its mode;
caller claims do not select a mode. Issue a credential for a separate read-only
listener when a principal needs fewer capabilities.

HTTP JWT enforcement is enabled by configuring both `--access-team-domain` and
`--access-audience` (or `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUDIENCE`). Partial
configuration fails startup. Authenticated HTTP requires the
`Cf-Access-Jwt-Assertion` header even on localhost; neither Host nor a service-token
identity header bypasses it. The origin verifies RS256 signature, exact issuer,
application audience, required expiry, and not-before when present. JOSE obtains
and caches rotating keys from the configured team's `/cdn-cgi/access/certs`.
Key-fetch and verification failures reject the request. Do not log assertion or
service-token values.

Service-token clients send `CF-Access-Client-Id` and `CF-Access-Client-Secret` to
Cloudflare. Access validates those credentials and supplies the signed assertion
to the origin. The origin never treats client-supplied identity as authorization.
Interactive clients use the Access application's Managed OAuth configuration.

HTTP request capacity and OmniFocus execution capacity are separate. Disconnects
free HTTP capacity; an OmniFocus execution retains its slot until its promise
settles. The limit applies across all requests to that listener.

## Mac Mini public deployment example

The files in [deployment/](deployment/) are templates. Replace the example
hostname `omnifocus.example.com`, team domain placeholder
`example.cloudflareaccess.com`, and `YOUR_ACCESS_AUDIENCE` with your Cloudflare
Access configuration. Replace `/Users/you` with your home directory and choose
your own `com.example.` labels and bundle identifier, keeping them consistent
across the plists. Plist paths must be absolute; launchd does not expand `$HOME`
or `~`. The paths and pinned versions illustrate one installation layout.

The private fallback is independent: `com.example.omnifocus-mcp` listens on
127.0.0.1:3939. Its example Tailscale hostname is
`mac-mini.example-tailnet.ts.net`, with Serve 8443 → 127.0.0.1:3939. Use your
own machine's hostname. Preserve the fallback's plist, absolute Node binary path,
and Serve configuration during upgrades.

The public service is `com.example.omnifocus-mcp-public`, bound only to
127.0.0.1:3940, allowing Host `omnifocus.example.com`. Its configured issuer is
`https://example.cloudflareaccess.com`, using the team domain placeholder above.
The Access application owner supplies the application audience. Replace
`YOUR_ACCESS_AUDIENCE` in both public LaunchAgent templates with that value.
Changing the audience does not require rebuilding the package.

Install a pinned npm artifact in:

```text
~/Library/Application Support/omnifocus-mcp-public/releases/2.10.0/
```

Use `npm install --prefix <release-directory> --ignore-scripts --save-exact
@stephendolan/omnifocus-cli@2.10.0`, then run its `dist/cli.js` with an absolute,
versioned Node path. The existing global installation remains the fallback's
artifact. Templates are in [deployment/](deployment/). Substitute `__NODE_PATH__`
and `__INSTALL_ROOT__`, render the public plist into `~/Library/LaunchAgents/`,
and use `launchctl bootstrap gui/$(id -u) <plist>`. Reload only this public service
when changing its audience or mode. Keep the installation directory mode 700.

For an upgrade with fixed LaunchAgent paths, install the pinned npm artifact into
the public agent's existing prefix (which can retain an older version in its
directory name). Update the fallback's global package from that same npm artifact,
preserving unrelated global packages. Do not change either plist's Node or CLI
paths. Both agents must retain their approved absolute Node binary path, for
example `$HOME/.local/share/mise/installs/node/26.13.0/bin/node` expanded to an
absolute path.
Restart both listeners after updating their artifacts:

```sh
launchctl kickstart -k gui/$(id -u)/com.example.omnifocus-mcp-public
launchctl kickstart -k gui/$(id -u)/com.example.omnifocus-mcp
```

Verify changed PIDs and launch times, then initialize each localhost endpoint and
check version `2.10.0` and its tool list. Full mode has 27 tools; read-only has 16.
The public endpoint requires a real Access assertion even on localhost.

`folder create <name>` and the full-mode `create_folder` tool return the folder
fields plus `alreadyExisted`. They match exact top-level names, including dropped
folders, and reuse a match without changing it. Nested names do not match.

Prepare `com.example.omnifocus-cloudflared` from the separate template,
substituting `__TOKEN_DIRECTORY__` with `~/.cloudflared` expanded to an absolute
path. Keep that directory mode 700 and the agent unloaded until the securely
transferred token is present at `~/.cloudflared/omnifocus-tunnel.token`, mode 600.
The template also waits for the token path before starting if launchd loads it
at login. Never put the token in a plist, command argument, repository, or chat.
Do not create a dummy token. The remotely managed tunnel routes the host to
`http://127.0.0.1:3940`, with a final 404 ingress. The external endpoint is
`https://omnifocus.example.com/mcp`.

For encrypted token handoff, generate a one-time RSA-4096 private key at
`~/.cloudflared/transfer-key.pem`, mode 600. Share only its public key. Use
RSA-OAEP with SHA-256 and MGF1-SHA-256, transfer the ciphertext as base64, and
decrypt directly into the mode-600 token file. Verify cloudflared can read the
token before removing the transfer private key.

## Health and macOS automation

An MCP initialize or tools/list response proves transport availability. A tool
response with HTTP 200 can still contain `result.isError: true`. Health requires
successful `list_perspectives` and a task read, with valid parsed tool content.
`get_inbox_count` traverses and serializes the inbox; it is not a cheap liveness
probe. Avoid `get_perspective_tasks` for health because it switches the user's view.

Agent contexts (BB threads and shells under unapproved ancestors) must NEVER
probe OmniFocus with `node dist/cli.js`, `osascript`, or JXA. Live reads route
through the existing localhost MCP listeners. If a listener read times out,
stop live calls and leave dialogs and the permission queue untouched. Do not
interact with a locked session, reset grants, or relaunch OmniFocus unattended.

macOS attributes child Apple Events to a responsible ancestor. An absolute Node
path does not guarantee attribution to that Node binary: a BB thread can inherit
the BB daemon's unapproved TCC identity. Consent dialogs from unapproved contexts
can block OmniFocus script access. Retain each listener's approved runtime path
until attended launcher cutover. Do not run mise commands during staging or
deployment: they can prune installed runtimes.

The only sanctioned direct check in an agent context is `of doctor` without
`--request-consent`. It calls `AEDeterminePermissionToAutomateTarget` for
`com.omnigroup.OmniFocus4`, with wildcard event class/ID and
`askUserIfNeeded=false`; it sends no Apple event and cannot prompt. The same
preflight guards every operation before `evaluateJavascript`. Status -1744
returns `automation_consent_required`; -1743 returns `automation_denied`. CLI
errors exit 1 and include `statusCode: 403`, `osStatus`, and `execPath`; MCP
returns the typed JSON with `isError: true`. Other nonzero preflight statuses
also stop the operation (for example, OmniFocus not running). `execPath` names
the CLI runtime, not necessarily the ancestor TCC considers responsible.

`of doctor --request-consent` is the only path that sets `askUserIfNeeded=true`.
It is reserved for attended setup in the intended client context; never run it
from an agent context. Tests use bridge and executable mocks, never live Apple
events or real `osascript`.

A successful signal command does not prove a service restarted. Verify its PID
and launch time before calling a check post-restart. TCC enables
`EnablePressuredExit`; the Mac's `launchd.plist(5)` manual documents that these
jobs can handle SIGTERM without exiting. Preserve this distinction when a
permission-dialog wait survives the signal.

Validate the public origin locally with missing and forged assertions (401), then
with a real Access-issued assertion for the exact configured audience. Use a
private token file and a test client that never prints its contents. Repeat real
reads through Tailscale 8443 and compare the original plist and Serve configuration
with the saved inventory. Valid local test signatures prove verifier behavior;
they do not prove the real Access application or tunnel configuration.

## Launcher and runtime templates

An app at `~/Applications/OmniFocus MCP.app` can be built from
[launcher/](deployment/launcher/). Its bundle identifier is
`com.example.omnifocus-mcp`; it is background-only, declares an Automation
usage description, and carries `com.apple.security.automation.apple-events`.
Build to a fresh absolute output path with:

```sh
SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
  docs/deployment/launcher/build.sh "/absolute/output/OmniFocus MCP.app"
```

Set `SIGNING_IDENTITY` to your Developer ID Application identity or certificate
fingerprint; the example above is a placeholder. The build requires this input
and uses hardened runtime and an Apple timestamp. Verify with `codesign -d -r-`
and `codesign --verify --strict`. The launcher uses `posix_spawn`, forwards SIGTERM,
SIGINT, and SIGHUP, and exits with the child's exit code (128 + signal for a
signal termination). Node and JavaScript remain outside the bundle. A stable
signed bundle provides the intended TCC client identity across runtime upgrades;
actual attribution and initial consent must be verified during attended cutover.

The official `node-v26.13.0-darwin-arm64.tar.gz` from
[nodejs.org](https://nodejs.org/dist/v26.13.0/) is checked against that release's
`SHASUMS256.txt` before extraction to
`~/Library/Application Support/omnifocus-mcp/runtime/node-v26.13.0/`. Its SHA-256
is `d38bd5e5a2ddce6bbb5ce45e46e208337da4d51fffe611e567fd32073d6439f6`.
Verify the unpacked `bin/node` with `codesign --verify`; do not re-sign Node.

Example listener definitions are provided at
[com.example.omnifocus-mcp.staged.plist](deployment/com.example.omnifocus-mcp.staged.plist)
and
[com.example.omnifocus-mcp-public.staged.plist](deployment/com.example.omnifocus-mcp-public.staged.plist).
Their arguments prepend the launcher and staged Node to the existing CLI entry
and listener arguments. They add `AssociatedBundleIdentifiers` for the launcher.
These are templates, **not installed LaunchAgents**. Do not bootstrap them, run
the app, or point either live listener at the staged runtime until the user is
present for cutover and any initial consent.

For an artifact-only upgrade, preserve both installed plists byte for byte and
update their installed CLI artifacts. Rebuild the repository `dist`, then
kickstart each listener once using the commands above. Verify HTTP initialization on 3939
(the expected installed version) and unauthenticated rejection on 3940 (401), and
confirm both plists still pin their approved runtime path with `plutil`. Do not
stop or change the tunnel. Transport verification does not prove live OmniFocus
access.
