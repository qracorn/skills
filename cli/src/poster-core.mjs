// reader.ts
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
async function createQrReader(wasm) {
  const overrides = wasm instanceof URL ? { locateFile: () => wasm.href } : { wasmBinary: wasm };
  await prepareZXingModule({ fireImmediately: true, overrides });
  return async (image) => {
    const codes = await readBarcodes(image, {
      formats: ["QRCode"],
      maxNumberOfSymbols: 20,
      tryHarder: true
    });
    return codes.map(({ text, position }) => ({ text, position }));
  };
}

// poster-check.ts
function half(values, size) {
  if (Math.max(...values) < size / 2) return -1;
  if (Math.min(...values) > size / 2) return 1;
  return 0;
}
function center(values, size) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(0, Math.min(1, mean / size));
}
function locate(code, width, height) {
  const corners = Object.values(code.position);
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const horizontal = half(xs, width);
  const vertical = half(ys, height);
  return {
    actual: code.text,
    x: center(xs, width),
    y: center(ys, height),
    // Positive means wholly in the requested half, zero means crossing its boundary.
    fit: { left: -horizontal, right: horizontal, top: -vertical, bottom: vertical }
  };
}
function assign(row, code) {
  row.actual = code.actual;
  row.x = code.x;
  row.y = code.y;
  row.status = row.expected === code.actual ? "match" : "mismatch";
}
function checkPoster(codes, width, height, expected) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("Poster dimensions must be positive finite numbers.");
  }
  const located = codes.map((code) => locate(code, width, height));
  const rows = expected.map(({ position, url }) => ({
    position,
    expected: url,
    actual: null,
    status: "unread",
    x: null,
    y: null
  }));
  const candidates = rows.map(({ position }) => position === "any" ? [] : located.filter((code) => code.fit[position] >= 0));
  const claimCounts = /* @__PURE__ */ new Map();
  for (const group of candidates) {
    for (const code of group) claimCounts.set(code, (claimCounts.get(code) ?? 0) + 1);
  }
  const remaining = new Set(located);
  const uncertain = /* @__PURE__ */ new Set();
  rows.forEach((row, index) => {
    const group = candidates[index];
    if (row.position === "any" || group.length === 0) return;
    const [code] = group;
    if (group.length === 1 && code.fit[row.position] > 0 && claimCounts.get(code) === 1) {
      assign(row, code);
      remaining.delete(code);
    } else {
      row.status = "ambiguous";
      for (const candidate of group) uncertain.add(candidate);
    }
  });
  const free = new Set([...remaining].filter((code) => !uncertain.has(code)));
  const unresolved = [];
  for (const row of rows.filter((row2) => row2.position === "any")) {
    const exact = [...free].find((code) => code.actual === row.expected);
    if (exact) {
      assign(row, exact);
      free.delete(exact);
      remaining.delete(exact);
    } else {
      unresolved.push(row);
    }
  }
  if (unresolved.length === 1 && free.size === 1 && uncertain.size === 0) {
    const [code] = free;
    assign(unresolved[0], code);
    remaining.delete(code);
  } else if (unresolved.length > 0 && remaining.size > 0) {
    for (const row of unresolved) row.status = "ambiguous";
    for (const code of free) uncertain.add(code);
  }
  for (const code of remaining) {
    rows.push({
      position: "any",
      expected: null,
      actual: code.actual,
      status: uncertain.has(code) ? "ambiguous" : "unexpected",
      x: code.x,
      y: code.y
    });
  }
  return rows;
}

// payload.ts
function webLink(value) {
  if (!/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007F]/.test(value)) return null;
  try {
    const url = new URL(value);
    return !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
var escapeWifi = (s) => s.replace(/[\\;,":]/g, "\\$&");
function wifiPayload(ssid, security, password, hidden) {
  return "WIFI:T:" + security + ";S:" + escapeWifi(ssid) + ";" + (security === "nopass" ? "" : "P:" + escapeWifi(password) + ";") + (hidden ? "H:true;" : "") + ";";
}
function wifiFields(value) {
  if (!value.startsWith("WIFI:")) return null;
  const fields = /* @__PURE__ */ Object.create(null);
  let current = "", escaped = false;
  for (const char of value.slice(5) + ";") {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") escaped = true;
    else if (char === ";") {
      const colon = current.indexOf(":");
      if (colon > 0) fields[current.slice(0, colon)] = current.slice(colon + 1);
      current = "";
    } else current += char;
  }
  return fields.S !== void 0 ? fields : null;
}

// poster-batch.ts
var batchLimits = { maxPosters: 100, manifestBytes: 1024 * 1024 };
function manifestPosters(value) {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("posters" in value)) return null;
  const posters = value.posters;
  return Array.isArray(posters) && posters.length > 0 && posters.length <= batchLimits.maxPosters ? posters : null;
}
function validImagePath(value) {
  if (typeof value !== "string" || value.length > 1024 || /[\\:*?"<>|\u0000-\u001f\u007f]/u.test(value)) return false;
  return value.split("/").every((part) => part !== "" && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
var positions = /* @__PURE__ */ new Set(["left", "right", "top", "bottom", "any"]);
var internalHost = /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|corp|lan|home|test|invalid|onion|arpa|example)$/i;
var secretField = /(?:token|pass(?:word|wd)|secret|credential|signature|session|apikey|accesskey|authcode|oauth|^auth$|^sig$|^key$|^otp$|^codeverifier$|^xamz|^xgoog|^saml|^jwt$|^hmac$)/i;
var sensitivePath = /(?:^|\/)(?:auth|credentials?|login|otp|password|private|reset(?:-password)?|secrets?|sessions?|signin|sign-in|tokens?|verify|invites?|magic(?:-link)?)(?:\/|$)/i;
var publicLabels = new Set("about activities agenda book booking calendar conference contact details en event events exhibition expo faq form forms hall home info ja join live map menu new news old page program programme public register registration schedule signup speakers stream ticket tickets venue watch workshop workshops".split(" "));
function publicUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u0020\u007f]/u.test(value) || !webLink(value)) return null;
  const url = new URL(value);
  const host = url.hostname;
  if (url.port || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z][a-z\d-]*$/i.test(host) || internalHost.test(host)) return null;
  try {
    const decoded = decodeURIComponent(url.pathname + url.search + url.hash);
    if (/[\u0000-\u001f\u007f]/u.test(decoded) || sensitivePath.test(decodeURIComponent(url.pathname))) return null;
    if (/(?:eyJ[\w-]{8,}\.[\w-]+\.[\w-]+|(?:gh[pousr]_|sk-(?:proj-)?|AKIA)[A-Za-z0-9_-]{16,})/.test(decoded)) return null;
    const fields = [];
    for (const params of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
      params.forEach((_, key) => fields.push(key));
    }
    if (fields.some((key) => secretField.test(key.replace(/[^a-z0-9]/gi, "")))) return null;
  } catch {
    return null;
  }
  return url;
}
function validExpectations(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 20) return false;
  return entries.every((entry) => {
    if (!entry || !positions.has(entry.position)) return false;
    return Boolean(publicUrl(entry.url));
  });
}
function safeReport(rows, expectations) {
  const allowedUrls = new Set(expectations.map(({ url }) => url));
  const origins = new Set([...allowedUrls].map((value) => new URL(value).origin));
  return rows.map((row) => {
    if (row.actual === null || allowedUrls.has(row.actual)) return row;
    const url = publicUrl(row.actual);
    let actual = "[non-public or unsupported payload hidden]";
    if (url && !origins.has(url.origin)) {
      actual = "[different origin; destination hidden]";
    } else if (url) {
      const labels = url.pathname.toLowerCase().split(/[/-]/).filter(Boolean);
      const showPath = labels.length <= 5 && labels.every((label) => publicLabels.has(label));
      const path = showPath ? url.pathname : "/[path hidden]";
      actual = url.origin + path + (url.search || url.hash ? " [query or fragment hidden]" : "");
    }
    return { ...row, actual };
  });
}
function completedPoster(index, image, decodedCount, rows, expected) {
  const passed = rows.length > 0 && rows.every((row) => row.status === "match");
  return { index, image, status: passed ? "passed" : "issues", decodedCount, rows: safeReport(rows, expected) };
}
function summarizeBatch(posters) {
  const summary = { total: posters.length, passed: 0, issues: 0, inputErrors: 0 };
  for (const poster of posters) {
    if (poster.status === "input_error") summary.inputErrors++;
    else summary[poster.status]++;
  }
  return { version: 1, summary, posters };
}

// generate.ts
async function generateStaticQr(content) {
  const { default: qr } = await import("qrcode");
  const options = {
    margin: 4,
    width: 896,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" }
  };
  const [png, svg] = await Promise.all([
    qr.toDataURL(content, options),
    qr.toString(content, { ...options, type: "svg" })
  ]);
  return { png, svg };
}
export {
  batchLimits,
  checkPoster,
  completedPoster,
  createQrReader,
  generateStaticQr,
  manifestPosters,
  safeReport,
  summarizeBatch,
  validExpectations,
  validImagePath,
  webLink,
  wifiFields,
  wifiPayload
};
