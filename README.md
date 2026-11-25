# QRAcorn print proof skill

`check-poster` compares QR codes on one poster or a batch of PNG and JPEG proofs with the intended public URLs and their positions. It runs locally with Node.js 22 or later. The decoder, its licenses, demo posters and sample manifest are included. After copying the repository, the checker runs offline without installing npm packages.

## Install the skill

Copy the whole `skills/check-poster` folder into the skills directory your agent reads. Keep the scripts, WASM and assets together. For a project-scoped installation with Codex, run these commands from the target project, substituting the path to your private checkout.

```sh
mkdir -p .agents/skills
cp -R "/path/to/private-skills/skills/check-poster" .agents/skills/
```

For Claude Code, use `.claude/skills/` in the project. Other clients that support Agent Skills can use their documented skills directory and need a local file executor with Node.js on PATH. Start a new session and ask “Run the bundled poster batch example.” You can also run the commands below directly from the private checkout.

## Try both workflows

```sh
cd skills/check-poster
node scripts/check-poster.mjs assets/sample-poster.png expected-sample.json
node scripts/check-poster.mjs --batch examples/poster-batch.json
```

The batch returns two posters. Open Studio Weekend has its registration and schedule codes swapped. Jazz Night matches both approved links. The demonstration exits with status 2 and prints the JSON report on stdout. Status 0 means every poster passed. Status 1 means the batch itself could not run. In single-poster mode, inspect the returned rows for mismatches.

## Check a print batch

Use `examples/poster-batch.json` as a template. Save the UTF-8 file beside the selected proofs. A poster in a subfolder can use a path such as `images/lobby.png`. Preserve the complete intended URLs, including query strings and fragments. Use the position visible on the poster, or `any` when placement is unimportant.

```json
{
  "version": 1,
  "posters": [
    {
      "image": "lobby.png",
      "expected": [{ "position": "left", "url": "https://example.org/register" }]
    }
  ]
}
```

From the skill directory, run `node scripts/check-poster.mjs --batch "/path/to/print-proofs/poster-batch.json"`. A proof is marked `passed` when every required code matches. A code that is missing, unexpected, ambiguous or pointed at the wrong URL produces `issues`. A missing, unreadable or unsupported input file produces `input_error`. The report preserves manifest order and includes a position and URL comparison for each processed code. Each expected destination's URL is part of the report. Unexpected content is masked according to the supplied public links.

The checker handles up to 100 proofs per manifest, 1 MiB of UTF-8 JSON, 12 MiB and 16 megapixels per image, and up to 20 intended public links per proof. Use still PNG or JPEG files and split any proof with 20 or more decoded codes into smaller sections. QR destinations are never opened.
