#!/usr/bin/env node
/**
 * Kiroku transactional-mail canary (zero-dependency).
 *
 * Proves, end to end, that Firebase Authentication mail still reaches a real
 * inbox. Every Kiroku mail (email verification, password reset, email-change
 * confirmation) is sent by Firebase Auth on the app's behalf, so a dead SMTP
 * relay, a lapsed sender domain or a spam-folder regression is invisible to
 * the client: Identity Toolkit happily accepts the send and nothing arrives.
 *
 * The canary asks Identity Toolkit (the same REST endpoint the Firebase SDK
 * calls) to send a password-reset mail to a dedicated canary account, then
 * watches that account's Gmail inbox over IMAP until the mail lands, and checks
 *
 *   1. it reached INBOX, not Spam
 *   2. the From address is the configured sender (noreply@mail.kiroku.cz)
 *   3. Gmail's Authentication-Results say dkim=pass and dmarc=pass (spf is a warning)
 *   4. the action link carries a valid, unexpired oobCode, verified against
 *      Identity Toolkit without consuming it
 *
 * and finally moves the mail to Trash. Scheduled daily by
 * .github/workflows/mailCanary.yml; setup lives in
 * contributingGuides/MAIL_CANARY.md.
 *
 * Requires Node 18+ (global fetch). No npm dependencies.
 *
 * Usage:
 *   node scripts/mail-canary.mjs run [--env-file .env.production] [--timeout 900] [--keep]
 *   node scripts/mail-canary.mjs imap-check
 *
 * Commands:
 *   run         Send the reset mail, wait for it, verify it, trash it. Exit 1 on
 *               any failed stage; the stage name is printed in brackets.
 *   imap-check  Sign in to the mailbox and list its folders. Sends nothing; use
 *               it to validate the app password when setting up.
 *
 * Flags:
 *   --env-file  Read FIREBASE_API_KEY from a dotenv file's API_KEY= line (the
 *               CI job stages .env.production from a secret and uses this).
 *   --timeout   Seconds to wait for the mail after the send (default 900).
 *   --keep      Leave the mail in the mailbox instead of moving it to Trash.
 *
 * Environment:
 *   FIREBASE_API_KEY              Web API key of the Firebase project (or --env-file)
 *   CANARY_EMAIL                  Firebase account that receives the reset mail
 *   CANARY_IMAP_USER              Mailbox login (the Gmail address)
 *   CANARY_IMAP_PASSWORD          Gmail app password (spaces are ignored)
 *   CANARY_EXPECTED_FROM          Expected From address (default noreply@mail.kiroku.cz)
 *   CANARY_IMAP_HOST / _PORT      IMAP server (default imap.gmail.com / 993)
 *   CANARY_IMAP_TLS               'off' to use plaintext (local test servers only)
 *   CANARY_IDENTITY_TOOLKIT_URL   Identity Toolkit base (default the Google endpoint;
 *                                 point at the Auth emulator or a test server)
 *   CANARY_POLL_SECONDS           Seconds between mailbox checks (default 30)
 *
 * Secrets are never printed: the API key stays out of logs and the IMAP LOGIN
 * line is redacted.
 */
import {appendFileSync, readFileSync} from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';

const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1';
const DEFAULT_EXPECTED_FROM = 'noreply@mail.kiroku.cz';
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_POLL_SECONDS = 30;
// A mail stamped slightly before our send is still ours: the IMAP server's
// clock and this machine's rarely agree to the second.
const CLOCK_SKEW_MS = 2 * 60 * 1000;
const IMAP_IDLE_TIMEOUT_MS = 60 * 1000;
// Tracked links (a relay's click tracking) hide the target behind a redirect.
const MAX_LINKS_TO_FOLLOW = 5;
const MAX_REDIRECT_HOPS = 3;
const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

const USAGE = `Usage:
  node scripts/mail-canary.mjs run [--env-file .env.production] [--timeout 900] [--keep]
  node scripts/mail-canary.mjs imap-check

See the header of scripts/mail-canary.mjs for the environment variables.`;

/**
 * A failure in one named stage of the canary; the stage is what the alert
 * names. A plain Error carrying a `stage` rather than a subclass, so the file
 * keeps to its one class (the IMAP client).
 */
function canaryError(stage, message) {
  const error = new Error(message);
  error.name = 'CanaryError';
  error.stage = stage;
  return error;
}

function isCanaryError(error) {
  return error instanceof Error && typeof error.stage === 'string';
}

// ─── Logging ──────────────────────────────────────────────────────────────────

const startedAt = Date.now();

function log(message) {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1).padStart(6);
  console.log(`[${elapsed}s] ${message}`);
}

/** GitHub Actions annotation; a no-op outside Actions. */
function annotate(level, message) {
  if (!process.env.GITHUB_ACTIONS) {
    return;
  }
  console.log(
    `::${level} title=Mail canary::${message.replace(/\r?\n/g, ' ')}`,
  );
}

/** Append to the Actions job summary; a no-op outside Actions. */
function writeStepSummary(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) {
    return;
  }
  appendFileSync(file, `${lines.join('\n')}\n`);
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// ─── CLI and configuration ────────────────────────────────────────────────────

function parseArgs(argv) {
  const [command = 'run', ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (!arg.startsWith('--')) {
      throw canaryError('usage', `Unexpected argument: ${arg}\n${USAGE}`);
    }
    const equals = arg.indexOf('=');
    if (equals !== -1) {
      flags[arg.slice(2, equals)] = arg.slice(equals + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      index++;
    } else {
      flags[key] = 'true';
    }
  }
  return {command, flags};
}

/** Minimal dotenv reader: KEY=value lines, optional quotes, # comments. */
function readEnvFile(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const equals = line.indexOf('=');
    if (equals < 1) {
      continue;
    }
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadConfig(flags, {requireFirebase}, env = process.env) {
  const fromFile = flags['env-file'] ? readEnvFile(flags['env-file']) : {};
  const config = {
    apiKey: env.FIREBASE_API_KEY || fromFile.API_KEY || '',
    identityToolkitUrl: (
      env.CANARY_IDENTITY_TOOLKIT_URL || IDENTITY_TOOLKIT_URL
    ).replace(/\/+$/, ''),
    canaryEmail: (env.CANARY_EMAIL || '').trim(),
    expectedFrom: (env.CANARY_EXPECTED_FROM || DEFAULT_EXPECTED_FROM)
      .trim()
      .toLowerCase(),
    imap: {
      host: env.CANARY_IMAP_HOST || 'imap.gmail.com',
      port: Number(env.CANARY_IMAP_PORT || 993),
      tls: env.CANARY_IMAP_TLS !== 'off',
      user: (env.CANARY_IMAP_USER || '').trim(),
      // Google displays app passwords in groups of four; pasting keeps the spaces.
      password: (env.CANARY_IMAP_PASSWORD || '').replace(/\s+/g, ''),
    },
    timeoutMs:
      Number(
        flags.timeout || env.CANARY_TIMEOUT_SECONDS || DEFAULT_TIMEOUT_SECONDS,
      ) * 1000,
    pollMs: Number(env.CANARY_POLL_SECONDS || DEFAULT_POLL_SECONDS) * 1000,
    keep: flags.keep === 'true',
  };

  const missing = [];
  if (!config.imap.user) {
    missing.push('CANARY_IMAP_USER');
  }
  if (!config.imap.password) {
    missing.push('CANARY_IMAP_PASSWORD');
  }
  if (requireFirebase && !config.apiKey) {
    missing.push(
      'FIREBASE_API_KEY (or --env-file pointing at a file with API_KEY=)',
    );
  }
  if (requireFirebase && !config.canaryEmail) {
    missing.push('CANARY_EMAIL');
  }
  if (missing.length) {
    throw canaryError('usage', `Missing configuration: ${missing.join(', ')}`);
  }
  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
    throw canaryError(
      'usage',
      '--timeout must be a positive number of seconds',
    );
  }
  if (!Number.isFinite(config.pollMs) || config.pollMs <= 0) {
    throw canaryError('usage', 'CANARY_POLL_SECONDS must be a positive number');
  }
  return config;
}

// ─── Identity Toolkit (Firebase Auth REST) ────────────────────────────────────

function isNetworkError(error) {
  return error instanceof TypeError || error?.name === 'AbortError';
}

/**
 * POST to `accounts:<method>`; one retry on a 5xx or a dropped connection, so a
 * blip on Google's side does not page anyone. 4xx are the real answer.
 */
async function identityToolkit(config, method, body) {
  const url = `${config.identityToolkitUrl}/accounts:${method}?key=${encodeURIComponent(config.apiKey)}`;
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (attempt === 1 && isNetworkError(error)) {
        log(`  Identity Toolkit ${method}: ${error.message}; retrying once`);
        await sleep(2000);
        continue;
      }
      throw new Error(`could not reach Identity Toolkit: ${error.message}`);
    }
    const text = await response.text();
    let json = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }
    }
    if (response.ok) {
      return json;
    }
    const message = json?.error?.message || `HTTP ${response.status}`;
    if (response.status >= 500 && attempt === 1) {
      log(
        `  Identity Toolkit ${method} answered ${response.status}; retrying once`,
      );
      await sleep(2000);
      continue;
    }
    throw new Error(message);
  }
}

async function sendPasswordReset(config) {
  try {
    await identityToolkit(config, 'sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email: config.canaryEmail,
    });
  } catch (error) {
    throw canaryError(
      'send',
      `Identity Toolkit refused to send the password-reset mail: ${error.message}`,
    );
  }
}

/**
 * `accounts:resetPassword` with only the oobCode is what the SDK's
 * verifyPasswordResetCode does: it reports the code's owner without consuming
 * the code or changing anything.
 */
async function verifyOobCode(config, oobCode) {
  try {
    return await identityToolkit(config, 'resetPassword', {oobCode});
  } catch (error) {
    throw canaryError(
      'link',
      `The oobCode in the mail was rejected by Identity Toolkit: ${error.message}`,
    );
  }
}

// ─── IMAP client ─────────────────────────────────────────────────────────────
//
// Just enough IMAP4rev1 for this job: LOGIN, LIST, SELECT, UID SEARCH,
// UID FETCH (with literals), UID MOVE / COPY+STORE+EXPUNGE, LOGOUT. One
// command in flight at a time.

function quote(value) {
  return `"${String(value).replace(/(["\\])/g, '\\$1')}"`;
}

/** 03-Oct-2026 06:24:11 +0000 → Date */
function parseInternalDate(value) {
  const match =
    /^\s*(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})\s*$/.exec(
      value,
    );
  if (!match) {
    return null;
  }
  const [, day, monthName, year, hh, mm, ss, sign, zoneH, zoneM] = match;
  const month = MONTHS.indexOf(monthName.toLowerCase());
  if (month === -1) {
    return null;
  }
  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}T${hh}:${mm}:${ss}${sign}${zoneH}:${zoneM}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → 02-Oct-2026 (UTC), the only date format IMAP SEARCH accepts. */
function formatImapDate(date) {
  const month = MONTHS[date.getUTCMonth()];
  return `${String(date.getUTCDate()).padStart(2, '0')}-${month[0].toUpperCase()}${month.slice(1)}-${date.getUTCFullYear()}`;
}

class ImapClient {
  #options;

  #socket = null;

  #buffer = Buffer.alloc(0);

  #tagCounter = 0;

  /** The command awaiting its tagged response: {tag, untagged, resolve, reject}. */
  #pending = null;

  /** A response line still waiting for literal octets: {text, literals, awaiting}. */
  #partial = null;

  #greeting = null;

  #closed = false;

  constructor(options) {
    this.#options = options;
  }

  connect() {
    const {host, port, tls: useTls} = this.#options;
    return new Promise((resolve, reject) => {
      this.#greeting = {resolve, reject};
      const onConnect = () => {
        log(
          `  IMAP connected to ${host}:${port}${useTls ? ' (TLS)' : ' (plaintext)'}`,
        );
      };
      this.#socket = useTls
        ? tls.connect({host, port, servername: host}, onConnect)
        : net.connect({host, port}, onConnect);
      // Idle between polls must not look like a dead connection.
      const idleTimeoutMs = Math.max(
        IMAP_IDLE_TIMEOUT_MS,
        (this.#options.pollMs ?? 0) * 2,
      );
      this.#socket.setTimeout(idleTimeoutMs, () => {
        this.#fail(new Error('the IMAP connection went quiet for too long'));
        this.#socket.destroy();
      });
      this.#socket.on('data', chunk => this.#onData(chunk));
      this.#socket.on('error', error => this.#fail(error));
      this.#socket.on('close', () => {
        this.#closed = true;
        this.#fail(new Error('the IMAP connection closed unexpectedly'));
      });
    });
  }

  #fail(error) {
    if (this.#greeting) {
      const {reject} = this.#greeting;
      this.#greeting = null;
      reject(error);
    }
    if (this.#pending) {
      const {reject} = this.#pending;
      this.#pending = null;
      reject(error);
    }
  }

  #onData(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    for (;;) {
      if (this.#partial?.awaiting) {
        const need = this.#partial.awaiting;
        if (this.#buffer.length < need) {
          return;
        }
        this.#partial.literals.push(this.#buffer.subarray(0, need));
        this.#buffer = this.#buffer.subarray(need);
        this.#partial.awaiting = 0;
      }
      const end = this.#buffer.indexOf('\r\n');
      if (end === -1) {
        return;
      }
      const line = this.#buffer.subarray(0, end).toString('latin1');
      this.#buffer = this.#buffer.subarray(end + 2);
      const partial = this.#partial ?? {text: '', literals: [], awaiting: 0};
      partial.text += line;
      const literal = /\{(\d+)\}$/.exec(line);
      if (literal) {
        partial.awaiting = Number(literal[1]);
        this.#partial = partial;
        continue;
      }
      this.#partial = null;
      this.#handleResponse(partial);
    }
  }

  #handleResponse(response) {
    const {text} = response;
    if (text.startsWith('* ')) {
      if (this.#greeting) {
        const {resolve, reject} = this.#greeting;
        this.#greeting = null;
        if (/^\* (OK|PREAUTH)\b/.test(text)) {
          resolve(text);
        } else {
          reject(new Error(`unexpected IMAP greeting: ${text}`));
        }
        return;
      }
      this.#pending?.untagged.push(response);
      return;
    }
    if (text.startsWith('+')) {
      return;
    }
    const match = /^(\S+) (OK|NO|BAD)(?: (.*))?$/.exec(text);
    if (!match || !this.#pending || match[1] !== this.#pending.tag) {
      this.#fail(new Error(`unexpected IMAP response: ${text}`));
      return;
    }
    const {resolve, untagged} = this.#pending;
    this.#pending = null;
    resolve({status: match[2], text: match[3] ?? '', untagged});
  }

  /**
   * Send one command and wait for its tagged reply. `display` replaces the raw
   * line in logs and errors (used to keep the LOGIN password out of both).
   */
  async command(line, {allowFailure = false, display} = {}) {
    if (this.#pending) {
      throw new Error('IMAP command already in flight');
    }
    if (!this.#socket || this.#closed) {
      throw new Error('IMAP connection is not open');
    }
    const tag = `A${++this.#tagCounter}`;
    const shown = display ?? line;
    const result = await new Promise((resolve, reject) => {
      this.#pending = {tag, untagged: [], resolve, reject};
      this.#socket.write(`${tag} ${line}\r\n`);
    });
    if (result.status !== 'OK' && !allowFailure) {
      throw new Error(
        `IMAP ${shown} failed: ${result.status} ${result.text}`.trim(),
      );
    }
    return result;
  }

  async login(user, password) {
    await this.command(`LOGIN ${quote(user)} ${quote(password)}`, {
      display: `LOGIN ${quote(user)} ****`,
    });
  }

  /** Every mailbox with its attributes, so special-use folders can be found by flag. */
  async listMailboxes() {
    const result = await this.command('LIST "" "*"');
    const mailboxes = [];
    for (const {text} of result.untagged) {
      const match =
        /^\* LIST \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (?:"((?:[^"\\]|\\.)*)"|(\S+))$/.exec(
          text,
        );
      if (!match) {
        continue;
      }
      const name =
        match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : match[3];
      mailboxes.push({
        name,
        attributes: match[1].split(/\s+/).filter(Boolean),
      });
    }
    return mailboxes;
  }

  async select(mailbox) {
    const result = await this.command(`SELECT ${quote(mailbox)}`);
    const exists = result.untagged
      .map(({text}) => /^\* (\d+) EXISTS$/.exec(text))
      .find(Boolean);
    return {exists: exists ? Number(exists[1]) : null};
  }

  async uidSearch(criteria) {
    const result = await this.command(`UID SEARCH ${criteria}`);
    const uids = [];
    for (const {text} of result.untagged) {
      if (!text.startsWith('* SEARCH')) {
        continue;
      }
      uids.push(
        ...text
          .slice('* SEARCH'.length)
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(Number),
      );
    }
    return uids;
  }

  /** The full RFC 822 message plus the server's arrival timestamp. */
  async fetchMessage(uid) {
    const result = await this.command(
      `UID FETCH ${uid} (INTERNALDATE BODY.PEEK[])`,
    );
    for (const response of result.untagged) {
      if (!/^\* \d+ FETCH /.test(response.text) || !response.literals.length) {
        continue;
      }
      const date = /INTERNALDATE "([^"]+)"/.exec(response.text);
      return {
        uid,
        internalDate: date ? parseInternalDate(date[1]) : null,
        raw: response.literals[0].toString('utf8'),
      };
    }
    throw new Error(`IMAP FETCH returned no message for UID ${uid}`);
  }

  async moveTo(uid, mailbox) {
    const moved = await this.command(`UID MOVE ${uid} ${quote(mailbox)}`, {
      allowFailure: true,
    });
    if (moved.status === 'OK') {
      return;
    }
    await this.command(`UID COPY ${uid} ${quote(mailbox)}`);
    await this.command(`UID STORE ${uid} +FLAGS.SILENT (\\Deleted)`);
    await this.command('EXPUNGE');
  }

  async logout() {
    if (!this.#socket || this.#closed) {
      return;
    }
    try {
      await this.command('LOGOUT', {allowFailure: true});
    } catch {
      // The server may drop the connection before the tagged OK; fine.
    }
    this.#socket.destroy();
  }
}

// ─── Message parsing ─────────────────────────────────────────────────────────

/** Split a raw message into unfolded headers and the body text. */
function splitMessage(raw) {
  const normalized = raw.replace(/\r?\n/g, '\r\n');
  const split = normalized.indexOf('\r\n\r\n');
  const headerText = split === -1 ? normalized : normalized.slice(0, split);
  const body = split === -1 ? '' : normalized.slice(split + 4);
  return {headers: parseHeaders(headerText), body};
}

function parseHeaders(text) {
  const headers = [];
  for (const line of text.split('\r\n')) {
    if (/^[ \t]/.test(line) && headers.length) {
      headers[headers.length - 1].value += ` ${line.trim()}`;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 1) {
      continue;
    }
    headers.push({
      name: line.slice(0, colon).trim().toLowerCase(),
      value: line.slice(colon + 1).trim(),
    });
  }
  return headers;
}

function headerValues(headers, name) {
  return headers
    .filter(header => header.name === name)
    .map(header => header.value);
}

function headerValue(headers, name) {
  return headerValues(headers, name)[0] ?? '';
}

function extractAddress(from) {
  const match = /<([^>]+)>/.exec(from);
  return (match ? match[1] : from).trim().toLowerCase();
}

function contentParameter(contentType, name) {
  const match = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`,
    'i',
  ).exec(contentType);
  return match ? match[1] ?? match[2] : undefined;
}

function decodeQuotedPrintable(text) {
  const joined = text.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let index = 0; index < joined.length; index++) {
    const char = joined[index];
    const hex = joined.slice(index + 1, index + 3);
    if (char === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      index += 2;
    } else {
      // eslint-disable-next-line no-bitwise
      bytes.push(char.charCodeAt(0) & 0xff);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeTransferEncoding(body, encoding) {
  const normalized = (encoding || '').trim().toLowerCase();
  if (normalized === 'quoted-printable') {
    return decodeQuotedPrintable(body);
  }
  if (normalized === 'base64') {
    return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  return body;
}

/** Every leaf part of the message, transfer-decoded; multipart is walked recursively. */
function decodedParts(headers, body, depth = 0) {
  const contentType = headerValue(headers, 'content-type');
  const boundary = /^multipart\//i.test(contentType)
    ? contentParameter(contentType, 'boundary')
    : undefined;
  if (!boundary || depth > 5) {
    return [
      decodeTransferEncoding(
        body,
        headerValue(headers, 'content-transfer-encoding'),
      ),
    ];
  }
  const parts = [];
  for (const section of body.split(`--${boundary}`).slice(1)) {
    if (section.startsWith('--')) {
      break;
    }
    const part = splitMessage(section.replace(/^\r\n/, ''));
    parts.push(...decodedParts(part.headers, part.body, depth + 1));
  }
  return parts;
}

function extractLinks(parts) {
  const links = new Set();
  for (const part of parts) {
    const unescaped = part
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'");
    for (const match of unescaped.matchAll(/https?:\/\/[^\s"'<>\])]+/g)) {
      links.add(match[0].replace(/[.,;:!?]+$/, ''));
    }
  }
  return [...links];
}

function oobCodeIn(url) {
  return /[?&]oobCode=([A-Za-z0-9_-]+)/.exec(url)?.[1] ?? null;
}

/**
 * The oobCode from the first link that carries one. When none does, the links
 * are probably wrapped by click tracking: follow a few redirects (without
 * rendering anything) and look again. Unsubscribe-looking links are skipped so
 * the canary never acts on the mailbox's behalf.
 */
async function resolveOobCode(links) {
  for (const link of links) {
    const code = oobCodeIn(link);
    if (code) {
      return {oobCode: code, link};
    }
  }
  const candidates = links
    .filter(link => !/unsubscribe|mailto:/i.test(link))
    .slice(0, MAX_LINKS_TO_FOLLOW);
  for (const link of candidates) {
    let url = link;
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
      let response;
      try {
        response = await fetch(url, {method: 'GET', redirect: 'manual'});
      } catch {
        break;
      }
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location) {
        break;
      }
      url = new URL(location, url).href;
      const code = oobCodeIn(url);
      if (code) {
        log(`  oobCode found behind a redirect from ${link}`);
        return {oobCode: code, link: url};
      }
    }
  }
  return null;
}

/**
 * Gmail's own Authentication-Results header (authserv-id mx.google.com), the
 * verdict receivers act on. "pass" wins when several results disagree.
 */
function parseAuthenticationResults(headers) {
  const all = headerValues(headers, 'authentication-results');
  const google = all.filter(value => /^mx\.google\.com\b/i.test(value));
  const chosen = google.length ? google : all;
  const result = {
    spf: 'missing',
    dkim: 'missing',
    dmarc: 'missing',
    dkimDomain: '',
  };
  for (const value of chosen) {
    for (const match of value.matchAll(/\b(spf|dkim|dmarc)=([a-z]+)/gi)) {
      const method = match[1].toLowerCase();
      const verdict = match[2].toLowerCase();
      if (result[method] === 'missing' || verdict === 'pass') {
        result[method] = verdict;
      }
    }
    const domain =
      /dkim=pass[^;]*header\.i=@?([^\s;]+)/i.exec(value) ??
      /dkim=pass[^;]*header\.d=([^\s;]+)/i.exec(value);
    if (domain) {
      result.dkimDomain = domain[1].toLowerCase();
    }
  }
  return result;
}

// ─── The canary ──────────────────────────────────────────────────────────────

/**
 * Poll INBOX and the Junk folder for a mail to the canary address that
 * arrived after `sentAt`. Searching by recipient rather than sender means a
 * mail from the wrong sender (the custom domain fell back to firebaseapp.com)
 * is found and reported as such instead of "never arrived".
 */
async function waitForMail(imap, config, sentAt, junkMailbox) {
  const deadline = sentAt.getTime() + config.timeoutMs;
  const since = formatImapDate(
    new Date(sentAt.getTime() - 24 * 60 * 60 * 1000),
  );
  const criteria = `SINCE ${since} TO ${quote(config.canaryEmail)}`;
  const seen = new Set();
  for (;;) {
    for (const mailbox of ['INBOX', junkMailbox]) {
      await imap.select(mailbox);
      const uids = (await imap.uidSearch(criteria)).sort((a, b) => b - a);
      for (const uid of uids) {
        const key = `${mailbox}:${uid}`;
        if (seen.has(key)) {
          continue;
        }
        const message = await imap.fetchMessage(uid);
        if (
          message.internalDate &&
          message.internalDate.getTime() < sentAt.getTime() - CLOCK_SKEW_MS
        ) {
          seen.add(key);
          continue;
        }
        const {headers, body} = splitMessage(message.raw);
        const parts = decodedParts(headers, body);
        const fromAddress = extractAddress(headerValue(headers, 'from'));
        const isOurs =
          fromAddress === config.expectedFrom ||
          parts.some(part => /oobCode=/i.test(part));
        if (!isOurs) {
          // Something else landed in the window (a DMARC report, an alert);
          // remember it so it is not re-fetched on every poll.
          seen.add(key);
          continue;
        }
        return {
          mailbox,
          isSpam: mailbox === junkMailbox,
          message,
          headers,
          parts,
          fromAddress,
        };
      }
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw canaryError(
        'arrival',
        `No mail for ${config.canaryEmail} reached INBOX or ${junkMailbox} within ${Math.round(config.timeoutMs / 1000)}s of the send.`,
      );
    }
    log(
      `  nothing yet; checking again in ${Math.round(config.pollMs / 1000)}s`,
    );
    await sleep(Math.min(config.pollMs, remaining));
  }
}

async function connectMailbox(config) {
  const imap = new ImapClient({...config.imap, pollMs: config.pollMs});
  try {
    await imap.connect();
    await imap.login(config.imap.user, config.imap.password);
  } catch (error) {
    throw canaryError(
      'mailbox',
      `Could not sign in to the canary mailbox over IMAP: ${error.message}`,
    );
  }
  return imap;
}

function findSpecialUse(mailboxes, attribute, fallback) {
  return (
    mailboxes.find(mailbox => mailbox.attributes.includes(attribute))?.name ??
    fallback
  );
}

async function run(config, results) {
  const record = (stage, status, detail) => {
    results.push({stage, status, detail});
  };

  log('Signing in to the canary mailbox');
  const imap = await connectMailbox(config);
  let found = null;
  try {
    const mailboxes = await imap.listMailboxes();
    const junkMailbox = findSpecialUse(mailboxes, '\\Junk', '[Gmail]/Spam');
    const trashMailbox = findSpecialUse(mailboxes, '\\Trash', '[Gmail]/Trash');
    record('mailbox', 'ok', `signed in; spam folder is ${junkMailbox}`);

    const sentAt = new Date();
    log(
      `Asking Identity Toolkit to send a password-reset mail to ${config.canaryEmail}`,
    );
    await sendPasswordReset(config);
    record('send', 'ok', 'Identity Toolkit accepted the send');
    log('Send accepted; waiting for the mail');

    found = await waitForMail(imap, config, sentAt, junkMailbox);
    const {mailbox, isSpam, message, headers, parts, fromAddress} = found;
    const arrived = message.internalDate
      ? message.internalDate.toISOString()
      : 'unknown time';
    const latency = message.internalDate
      ? `${Math.max(0, Math.round((message.internalDate.getTime() - sentAt.getTime()) / 1000))}s after the send`
      : '';
    log(
      `Mail found in ${mailbox}: "${headerValue(headers, 'subject')}" from ${fromAddress}, received ${arrived} ${latency}`.trim(),
    );
    const auth = parseAuthenticationResults(headers);
    log(
      `  Authentication-Results: spf=${auth.spf} dkim=${auth.dkim}${auth.dkimDomain ? ` (${auth.dkimDomain})` : ''} dmarc=${auth.dmarc}`,
    );

    const cleanup = async () => {
      if (config.keep) {
        log(`Leaving the mail in ${mailbox} (--keep)`);
        return;
      }
      try {
        await imap.moveTo(message.uid, trashMailbox);
        log(`Moved the mail to ${trashMailbox}`);
      } catch (error) {
        log(`  could not move the mail to ${trashMailbox}: ${error.message}`);
      }
    };

    try {
      if (isSpam) {
        record('arrival', 'fail', `landed in ${mailbox}`);
        throw canaryError(
          'spam',
          `The mail landed in ${mailbox}, not INBOX (spf=${auth.spf} dkim=${auth.dkim} dmarc=${auth.dmarc}). Users will not see it.`,
        );
      }
      record('arrival', 'ok', `in INBOX ${latency}`);

      if (fromAddress !== config.expectedFrom) {
        record('sender', 'fail', fromAddress);
        throw canaryError(
          'sender',
          `The mail came from ${fromAddress}, expected ${config.expectedFrom}. The custom sender domain is no longer applied in the Firebase console.`,
        );
      }
      record('sender', 'ok', fromAddress);

      if (auth.dkim !== 'pass' || auth.dmarc !== 'pass') {
        record(
          'authentication',
          'fail',
          `spf=${auth.spf} dkim=${auth.dkim} dmarc=${auth.dmarc}`,
        );
        throw canaryError(
          'authentication',
          `Gmail reports spf=${auth.spf} dkim=${auth.dkim} dmarc=${auth.dmarc}; dkim and dmarc must pass or the apex DMARC policy (p=quarantine) sends the mail to Spam at other receivers.`,
        );
      }
      if (auth.spf !== 'pass') {
        record(
          'authentication',
          'warn',
          `spf=${auth.spf} (dkim and dmarc pass)`,
        );
        annotate(
          'warning',
          `SPF did not pass (spf=${auth.spf}); DKIM and DMARC did.`,
        );
      } else {
        record('authentication', 'ok', 'spf, dkim and dmarc pass');
      }

      const links = extractLinks(parts);
      const resolved = await resolveOobCode(links);
      if (!resolved) {
        record('link', 'fail', `no oobCode in ${links.length} link(s)`);
        throw canaryError(
          'link',
          `No oobCode found in the mail (${links.length} link(s) checked). The template's action link may be broken.`,
        );
      }
      const verified = await verifyOobCode(config, resolved.oobCode);
      const owner = (verified.email ?? '').toLowerCase();
      if (owner && owner !== config.canaryEmail.toLowerCase()) {
        record('link', 'fail', `code belongs to ${owner}`);
        throw canaryError(
          'link',
          `The oobCode belongs to ${owner}, not the canary account.`,
        );
      }
      record('link', 'ok', `oobCode valid for ${owner || config.canaryEmail}`);
      log(
        `The action link's oobCode is valid and unexpired (${new URL(resolved.link).host})`,
      );
    } finally {
      await cleanup();
    }
  } finally {
    await imap.logout();
  }
}

async function imapCheck(config) {
  log('Signing in to the canary mailbox');
  const imap = await connectMailbox(config);
  try {
    const mailboxes = await imap.listMailboxes();
    log(`Signed in as ${config.imap.user}; ${mailboxes.length} folder(s):`);
    for (const {name, attributes} of mailboxes) {
      console.log(
        `    ${name}${attributes.length ? `  (${attributes.join(' ')})` : ''}`,
      );
    }
    const inbox = await imap.select('INBOX');
    log(`INBOX holds ${inbox.exists ?? '?'} message(s)`);
    const junk = findSpecialUse(mailboxes, '\\Junk', null);
    const trash = findSpecialUse(mailboxes, '\\Trash', null);
    log(`Spam folder: ${junk ?? 'not advertised (will assume [Gmail]/Spam)'}`);
    log(
      `Trash folder: ${trash ?? 'not advertised (will assume [Gmail]/Trash)'}`,
    );
  } finally {
    await imap.logout();
  }
}

function summaryLines(results, failure) {
  const icon = {ok: '✅', warn: '⚠️', fail: '❌'};
  const lines = [
    '### Mail delivery canary',
    '',
    '| Stage | Result | Detail |',
    '|---|---|---|',
  ];
  for (const {stage, status, detail} of results) {
    lines.push(`| ${stage} | ${icon[status]} ${status} | ${detail} |`);
  }
  if (failure) {
    const stage = isCanaryError(failure) ? failure.stage : 'unexpected';
    lines.push('', `**Failed at \`${stage}\`:** ${failure.message}`);
  }
  return lines;
}

async function main() {
  const {command, flags} = parseArgs(process.argv.slice(2));
  if (command === 'help' || flags.help === 'true') {
    console.log(USAGE);
    return;
  }
  if (command === 'imap-check') {
    await imapCheck(loadConfig(flags, {requireFirebase: false}));
    return;
  }
  if (command !== 'run') {
    throw canaryError('usage', `Unknown command: ${command}\n${USAGE}`);
  }
  const config = loadConfig(flags, {requireFirebase: true});
  // `run` records the stages it got through, so a failure still shows them.
  const results = [];
  try {
    await run(config, results);
  } catch (error) {
    writeStepSummary(summaryLines(results, error));
    throw error;
  }
  writeStepSummary(summaryLines(results, null));
  log('✔ Transactional mail is flowing');
}

main().catch(error => {
  const stage = isCanaryError(error) ? error.stage : 'unexpected';
  const message = error instanceof Error ? error.message : String(error);
  console.error(`✖ [${stage}] ${message}`);
  annotate('error', `[${stage}] ${message}`);
  process.exit(1);
});
