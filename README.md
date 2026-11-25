# QRAcorn

Read, create and check QR codes locally. Copy this into an AI assistant that can work with local files:

```text
Use QRAcorn: https://raw.githubusercontent.com/qracorn/skills/main/skills/qracorn/SKILL.md . Help me read QR images, create a URL/text/Wi-Fi QR code, or check poster links. Choose the right subcommand for my request. Confirm local file access and Node.js 22+, ask only for missing inputs, and use qracorn.com if local execution is unavailable. Keep Wi-Fi passwords in local files, not in chat.
```

Then describe your task: “Read this screenshot,” “Create a QR code for this event link,” or “Check these posters against my approved list.” Your images are processed on your device; QR destinations are not opened. An AI assistant's own chat and attachment policies still apply.

Prefer the browser? [Read](https://qracorn.com) · [Generate](https://qracorn.com/qr-code-generator) · [Wi-Fi](https://qracorn.com/wifi-qr-code-generator) · [Check a poster](https://qracorn.com/poster-qr-code-checker) · [Check a batch](https://qracorn.com/batch-poster-qr-code-checker)

## Install the Skill

To install with skills.sh, run the following command from your project with Node.js 22.20 or later. Choose your AI agent when prompted.

```sh
npx skills add qracorn/skills --skill qracorn
```

Start a new agent session and ask “Use QRAcorn to check the two sample posters.” One poster has its links swapped and one passes. The installation includes the CLI, decoders and sample images. With Codex, you can also verify the installation from the project root with `node .agents/skills/qracorn/scripts/qracorn.mjs --version`. [skills.sh installer documentation](https://www.skills.sh/docs/cli)

For the dedicated poster checker, use `--skill check-poster` in the same command. To install from a local copy, place the complete `skills/qracorn/` folder in your agent’s project skills directory. The installed QR tools run with Node.js 22 or later. [Skill instructions](skills/qracorn/SKILL.md)

## One CLI, four subcommands

Download once with Node.js 22 or later available. The bundled CLI runs offline and needs no npm install.

```sh
git clone https://github.com/qracorn/skills.git qracorn-skills
cd qracorn-skills
node cli/bin/qracorn.mjs --help
```

| Task | Command after `node cli/bin/qracorn.mjs` |
| --- | --- |
| Read QR contents and locations | `read /path/to/image.png` |
| Create a URL QR code | `generate --url https://example.org/register --output /path/to/code.png` |
| Create a text QR code | `generate --input /path/to/message.txt --output /path/to/code.svg` |
| Create a Wi-Fi QR code | `wifi --input /path/to/wifi.json --output /path/to/wifi.png` |
| Check one poster | `check /path/to/poster.png /path/to/expected.json` |
| Check a batch | `check --batch /path/to/poster-batch.json` |

For a short `qracorn` command, optionally install the already bundled local package with `npm install --global ./cli`. This is not required for direct Node execution. Use `<command> --help` for accepted options and limits. Outputs and errors are JSON; generation requires a new output path and does not overwrite existing files.

`read` accepts PNG, JPEG and WebP. It returns ordinary decoded text without requiring expected links. Wi-Fi passwords are hidden in default reports; explicit `--raw-output /path/to/results.json` preserves exact results in a new private local file. PDF pages need an image export first. Generation supports PNG/SVG. Text-file input is encoded exactly, including line breaks. Use `generate --url --input /path/to/url.txt` to validate a file's contents as a web URL.

Wi-Fi settings use a local JSON file with `ssid`, `security` (`WPA`, `WEP` or `nopass`), `password` for secured networks, and optional `hidden`. See the [fictional example](skills/qracorn/examples/wifi.json). The `wifi --input -` form accepts JSON on stdin. Do not put real passwords in command arguments or paste them into chat. The resulting QR image contains the network credentials.

## Try a poster check

```sh
node cli/bin/qracorn.mjs check --batch skills/qracorn/examples/poster-batch.json
```

The two-poster demonstration reports one correct proof and one with swapped links. Exit **2** means the check finished with findings. Use `examples/ja/poster-batch.json` or `examples/zh-tw/poster-batch.json` under the same Skill folder for Japanese and Traditional Chinese posters. Expected links, positions and input limits are documented in the [check reference](skills/qracorn/references/checks.md).

Checking verifies encoded values and their positions in the supplied image. It does not visit links or guarantee final print legibility. Runtime/input errors use exit **1**, and completed commands without findings use **0**. The legacy `skills/check-poster/` folder keeps its previous CLI and raw instruction URL; its single-poster exit behavior is described in that Skill.

## Source and license

The [CLI source](cli/src) and pinned build dependencies are included. Rebuild from this repository with `npm ci --prefix cli` and `npm run build --prefix cli`. No private website source is needed.

QRAcorn's first-party CLI, Skill instructions and examples use the [MIT License](LICENSE). Bundled dependencies retain their licenses and notices in the Skill folders.
