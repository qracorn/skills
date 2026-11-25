# Poster checking

Checking compares encoded text and its position to the approved brief. It does not check HTTP availability or guarantee that the final physical print will scan.

Single-poster expectations are an array:

```json
[
  {"position":"left","url":"https://example.org/register"},
  {"position":"right","url":"https://example.org/schedule"}
]
```

Positions are `left`, `right`, `top`, `bottom` or `any`. Preserve URL query parameters and fragments exactly. Only use approved public HTTP(S) links; do not supply private hosts, passwords or signed access links. A proof needs 1–20 expectations. Request missing assignments instead of guessing.

Batch format:

```json
{
  "version":1,
  "posters":[
    {"image":"images/front.png","expected":[{"position":"any","url":"https://example.org/register"}]}
  ]
}
```

Image paths are relative to the manifest directory and must stay inside it. A batch has 1–100 entries; the manifest is at most 1 MiB. Use a supplied manifest or prepare a temporary one from the user's approved brief. If temporary image copies are necessary, keep them in private scratch space and remove only those copies after checking.

The check input supports still PNG/JPEG files up to 12 MiB, 16 megapixels and 16,384 pixels per side. A 20-code detection limit requires smaller sections and each section's own expectations. Use the current command help if the executable adds further accepted formats.

Report each row's position, expected URL, observed value and status. Explain `mismatch`, `unread`, `unexpected` and `ambiguous`; preserve redactions. For a batch, lead with total/pass/issues/input-error counts and continue through individual input failures. Do not infer a pass merely from successful process execution.

For an English demonstration, `check --batch examples/poster-batch.json` reports two proofs: Open Studio Weekend has swapped registration/schedule links; Jazz Night matches. Expected summary: 2 total, 1 passed, 1 with issues, 0 input errors. Japanese and Traditional Chinese sample directories contain the corresponding localized posters.
