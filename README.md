# Check poster QR links with QRAcorn

Copy this request into an AI assistant that can access local files.

```text
Use the QRAcorn skill at https://raw.githubusercontent.com/qracorn/skills/main/skills/check-poster/SKILL.md to check my poster QR links against my approved list, first confirming that you can run Node.js 22+ locally and read the posters and list, asking me for anything missing, and offering the browser checker if local execution is unavailable.
```

Attach the final PNG or JPEG posters. Say where each link belongs, for example “registration on the left, schedule on the right,” and include the exact approved URLs. For a first try, ask to check the two bundled sample posters. The checker reads the images locally and reports differences without opening QR destinations. A chat’s own attachment and data settings still apply.

You can also choose your images directly in the [single poster checker](https://qracorn.com/poster-qr-code-checker) or [batch poster checker](https://qracorn.com/batch-poster-qr-code-checker).

## Run the CLI

With Node.js 22 or later installed, clone once and run the included checker. It works offline after download and needs no npm install.

```sh
git clone https://github.com/qracorn/skills.git qracorn-skills
cd qracorn-skills/skills/check-poster
node scripts/check-poster.mjs --batch examples/poster-batch.json
```

The sample reports two posters. Open Studio Weekend has its registration and schedule links swapped. Jazz Night matches both approved links. The command exits with **2** because it found a problem. To try one image or save a batch report, run these from the same directory.

```sh
node scripts/check-poster.mjs assets/sample-poster.png expected-sample.json
node scripts/check-poster.mjs --batch "/path/to/poster-batch.json" > poster-report.json
```

日本語の「陶芸工房の開放日」と「町家寄席」は `examples/ja/poster-batch.json` で試せます。繁中「大稻埕手沖茶體驗」與「河岸爵士之夜」的核對清單在 `examples/zh-tw/poster-batch.json`。

## Use your approved links

Copy the [two-poster sample manifest](skills/check-poster/examples/poster-batch.json) beside your images. Each image path is relative to the manifest. Use `left`, `right`, `top`, `bottom` or `any` for the position. Enter complete public HTTP(S) URLs, including their query parameters and fragments.

The batch returns JSON on stdout in manifest order. **0** means all passed. **2** means the report contains mismatches, unreadable items or input errors. **1** means the batch could not run and the error is on stderr. In single-poster mode, check the individual row statuses when the program returns 0. Each batch accepts up to 100 posters, each image up to 12 MiB and 16 megapixels. Split images that reach the 20-code detection limit.

## Install the agent skill

Copy the whole [check-poster](skills/check-poster) folder into the skills directory for your agent. For a project-scoped Codex skill, run these commands from your target project, using the checkout path from the CLI step.

```sh
mkdir -p .agents/skills
cp -R /path/to/qracorn-skills/skills/check-poster .agents/skills/
```

Start a new session and ask to check the two bundled examples. Your agent needs a local file executor and Node.js 22+. If either is unavailable, use the browser checker. [Skill instructions](skills/check-poster/SKILL.md)

## Source and license

The [CLI source](cli/src) includes the command-line entry, image handling and QR comparison code. To rebuild the bundled executable and decoder, run `npm ci --prefix cli` followed by `npm run build --prefix cli` from the repository root. Rebuilding requires the two pinned public dependencies.

QRAcorn’s original code, skill instructions and examples are covered by the [MIT License](LICENSE). The bundled reader and its dependencies retain their [third-party licenses and notices](skills/check-poster/licenses).
