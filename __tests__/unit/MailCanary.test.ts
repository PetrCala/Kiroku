/**
 * @jest-environment node
 */

/**
 * Guards `scripts/mail-canary.mjs`, the daily end-to-end check that Firebase
 * Authentication mail still reaches a real inbox (see
 * contributingGuides/MAIL_CANARY.md and .github/workflows/mailCanary.yml).
 *
 * The script is an ESM `.mjs` outside the Jest transform, so it is exercised
 * as a child process against two fakes that live in this file: an Identity
 * Toolkit HTTP server and a plaintext IMAP server holding a scripted mailbox.
 * Together they let every stage the canary can fail at (send, mailbox,
 * arrival, spam, sender, authentication, link) be driven deterministically.
 */

import {spawn} from 'child_process';
import * as http from 'http';
import * as net from 'net';
import {join} from 'path';

jest.useRealTimers();
jest.setTimeout(30000);

const REPO_ROOT = join(__dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'mail-canary.mjs');

const CANARY_EMAIL = 'kiroku.alcohol.tracker+canary@gmail.com';
const IMAP_USER = 'kiroku.alcohol.tracker@gmail.com';
const IMAP_PASSWORD = 'abcdefghijklmnop';
// Google shows app passwords in groups of four; the script must strip the spaces.
const IMAP_PASSWORD_AS_PASTED = 'abcd efgh ijkl mnop';
const EXPECTED_FROM = 'noreply@mail.kiroku.cz';
const OOB_CODE = 'CODE123abc_-XYZ';
const ACTION_LINK = `https://alcohol-tracker-db.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=${OOB_CODE}&apiKey=AIzaFake&lang=en`;

const PASSING_AUTH_RESULTS = [
  'Authentication-Results: mx.google.com;',
  '       dkim=pass header.i=@mail.kiroku.cz header.s=firebase1 header.b=AbCdEf12;',
  '       spf=pass (google.com: domain of noreply@mail.kiroku.cz designates 209.85.220.69 as permitted sender) smtp.mailfrom=noreply@mail.kiroku.cz;',
  '       dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=mail.kiroku.cz',
];

const FAILING_AUTH_RESULTS = [
  'Authentication-Results: mx.google.com;',
  '       dkim=fail header.i=@mail.kiroku.cz header.s=firebase1 header.b=AbCdEf12;',
  '       spf=softfail (google.com: domain of transitioning noreply@mail.kiroku.cz does not designate 1.2.3.4 as permitted sender) smtp.mailfrom=noreply@mail.kiroku.cz;',
  '       dmarc=fail (p=QUARANTINE sp=QUARANTINE dis=QUARANTINE) header.from=mail.kiroku.cz',
];

const MAILBOX_ATTRIBUTES = new Map<string, string>([
  ['INBOX', '\\HasNoChildren'],
  ['[Gmail]', '\\HasChildren \\Noselect'],
  ['[Gmail]/All Mail', '\\All \\HasNoChildren'],
  ['[Gmail]/Spam', '\\HasNoChildren \\Junk'],
  ['[Gmail]/Trash', '\\HasNoChildren \\Trash'],
]);

type FakeMessage = {uid: number; internalDate: string; raw: string};
type Mailboxes = Map<string, FakeMessage[]>;

function emptyMailboxes(): Mailboxes {
  return new Map<string, FakeMessage[]>([
    ['INBOX', []],
    ['[Gmail]/All Mail', []],
    ['[Gmail]/Spam', []],
    ['[Gmail]/Trash', []],
  ]);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** 03-Oct-2026 06:24:11 +0000, the IMAP INTERNALDATE format. */
function imapDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getUTCDate())}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

type MailOptions = {
  from?: string;
  to?: string;
  authResults?: string[];
  link?: string;
};

/**
 * A Firebase-style reset mail as Gmail stores it: multipart/alternative, both
 * parts quoted-printable (so `=` is `=3D` and long lines carry soft breaks),
 * and the HTML link's ampersands escaped as `&amp;`.
 */
function resetMail({
  from = `Kiroku <${EXPECTED_FROM}>`,
  to = CANARY_EMAIL,
  authResults = PASSING_AUTH_RESULTS,
  link = ACTION_LINK,
}: MailOptions = {}): string {
  const quotedPrintableLink = link.replace(/=/g, '=3D');
  const htmlLink = quotedPrintableLink.replace(/&/g, '&amp;');
  return [
    `Delivered-To: ${IMAP_USER}`,
    'Received: by 2002:a05:6a10:1234 with SMTP id abc; Sat, 3 Oct 2026 06:24:11 -0700 (PDT)',
    ...authResults,
    `From: ${from}`,
    `To: ${to}`,
    'Subject: Reset your password for Kiroku',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="000000000000abcdef"',
    '',
    '--000000000000abcdef',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Hello,',
    '',
    `Follow this link to reset your Kiroku password: ${quotedPrintableLink}`,
    '',
    '--000000000000abcdef',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    `<p>Hello,</p><p><a href=3D"${htmlLink}">Reset=`,
    ' your password</a></p>',
    '--000000000000abcdef--',
    '',
  ].join('\r\n');
}

/** A mail that merely shares the inbox with the canary (a DMARC report). */
function unrelatedMail(to: string): string {
  return [
    `From: noreply-dmarc-support@google.com`,
    `To: ${to}`,
    'Subject: Report domain: kiroku.cz',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    'This is an aggregate report.',
    '',
  ].join('\r\n');
}

function unquote(value: string): string {
  return value.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1');
}

/**
 * Just enough IMAP for the script: LOGIN, LIST, SELECT, UID SEARCH/FETCH/MOVE
 * and LOGOUT over a plaintext socket. SEARCH honours only the TO criterion,
 * which is all the script relies on; everything else is filtered client-side.
 */
class FakeImapServer {
  readonly commands: string[] = [];

  readonly moves: Array<{uid: number; to: string}> = [];

  port = 0;

  private readonly server: net.Server;

  private readonly sockets = new Set<net.Socket>();

  constructor(private readonly mailboxes: Mailboxes) {
    this.server = net.createServer(socket => this.serve(socket));
  }

  start(): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(0, '127.0.0.1', () => {
        this.port = (this.server.address() as net.AddressInfo).port;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    return new Promise(resolve => {
      this.server.close(() => resolve());
    });
  }

  private serve(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.write('* OK Gimap ready for requests from 127.0.0.1\r\n');
    let buffer = '';
    let selected: string | null = null;
    socket.on('data', chunk => {
      buffer += chunk.toString('latin1');
      let newline = buffer.indexOf('\r\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        this.commands.push(line);
        selected = this.handle(socket, line, selected);
        newline = buffer.indexOf('\r\n');
      }
    });
  }

  private handle(
    socket: net.Socket,
    line: string,
    selected: string | null,
  ): string | null {
    const [tag, rawCommand = '', ...rest] = line.split(' ');
    const reply = (text: string) => {
      socket.write(`${text}\r\n`);
    };
    switch (rawCommand.toUpperCase()) {
      case 'LOGIN': {
        const expected = `"${IMAP_USER}" "${IMAP_PASSWORD}"`;
        reply(
          rest.join(' ') === expected
            ? `${tag} OK LOGIN completed`
            : `${tag} NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)`,
        );
        return selected;
      }
      case 'LIST': {
        for (const [name, attributes] of MAILBOX_ATTRIBUTES) {
          reply(`* LIST (${attributes}) "/" "${name}"`);
        }
        reply(`${tag} OK Success`);
        return selected;
      }
      case 'SELECT': {
        const name = unquote(rest.join(' '));
        if (!this.mailboxes.has(name)) {
          reply(`${tag} NO [NONEXISTENT] Unknown Mailbox: ${name} (Failure)`);
          return selected;
        }
        reply(`* ${this.mailboxes.get(name)?.length ?? 0} EXISTS`);
        reply('* OK [UIDVALIDITY 1] UIDs valid');
        reply(`${tag} OK [READ-WRITE] ${name} selected. (Success)`);
        return name;
      }
      case 'UID':
        return this.handleUid(socket, tag, rest, selected);
      case 'LOGOUT':
        reply('* BYE LOGOUT Requested');
        reply(`${tag} OK 73 good day (Success)`);
        socket.end();
        return selected;
      default:
        reply(`${tag} BAD Unknown command`);
        return selected;
    }
  }

  private handleUid(
    socket: net.Socket,
    tag: string,
    rest: string[],
    selected: string | null,
  ): string | null {
    const reply = (text: string) => {
      socket.write(`${text}\r\n`);
    };
    const [subcommand = '', ...args] = rest;
    const messages = selected ? this.mailboxes.get(selected) ?? [] : [];
    switch (subcommand.toUpperCase()) {
      case 'SEARCH': {
        const to = /TO "([^"]+)"/i.exec(args.join(' '))?.[1]?.toLowerCase();
        const uids = messages
          .filter(message => !to || message.raw.toLowerCase().includes(to))
          .map(message => message.uid);
        reply(`* SEARCH ${uids.join(' ')}`.trimEnd());
        reply(`${tag} OK SEARCH completed (Success)`);
        return selected;
      }
      case 'FETCH': {
        const uid = Number(args[0]);
        const message = messages.find(candidate => candidate.uid === uid);
        if (message) {
          const literal = Buffer.from(message.raw, 'utf8');
          socket.write(
            `* 1 FETCH (UID ${uid} INTERNALDATE "${message.internalDate}" BODY[] {${literal.length}}\r\n`,
          );
          socket.write(literal);
          socket.write(')\r\n');
        }
        reply(`${tag} OK Success`);
        return selected;
      }
      case 'MOVE': {
        const uid = Number(args[0]);
        const to = unquote(args.slice(1).join(' '));
        const index = messages.findIndex(candidate => candidate.uid === uid);
        if (index === -1 || !this.mailboxes.has(to)) {
          reply(`${tag} NO [NONEXISTENT] Cannot move`);
          return selected;
        }
        const [message] = messages.splice(index, 1);
        this.mailboxes.get(to)?.push(message);
        this.moves.push({uid, to});
        reply(`${tag} OK MOVE completed`);
        return selected;
      }
      default:
        reply(`${tag} BAD Unknown UID command`);
        return selected;
    }
  }
}

type ToolkitBehavior = {
  /** Error message for `accounts:sendOobCode` (a 400), or undefined to accept. */
  sendError?: string;
  /** Error message for `accounts:resetPassword` (a 400), or undefined to accept. */
  resetError?: string;
};

type ToolkitRequest = {
  method: string;
  path: string;
  key: string | null;
  body: Record<string, unknown>;
};

type FakeIdentityToolkit = {
  requests: ToolkitRequest[];
  port: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

/** Identity Toolkit's two endpoints plus a click-tracking redirect. */
function createFakeIdentityToolkit(
  behavior: ToolkitBehavior = {},
): FakeIdentityToolkit {
  const requests: ToolkitRequest[] = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
    });
    request.on('end', () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      requests.push({
        method: request.method ?? 'GET',
        path: url.pathname,
        key: url.searchParams.get('key'),
        body: parsed,
      });
      const json = (status: number, payload: unknown) => {
        response.setHeader('Content-Type', 'application/json');
        response.writeHead(status);
        response.end(JSON.stringify(payload));
      };
      if (url.pathname.startsWith('/track/')) {
        response.writeHead(302, {Location: ACTION_LINK});
        response.end();
        return;
      }
      if (url.pathname === '/accounts:sendOobCode') {
        if (behavior.sendError) {
          json(400, {error: {code: 400, message: behavior.sendError}});
          return;
        }
        json(200, {email: parsed.email});
        return;
      }
      if (url.pathname === '/accounts:resetPassword') {
        if (behavior.resetError) {
          json(400, {error: {code: 400, message: behavior.resetError}});
          return;
        }
        json(200, {email: CANARY_EMAIL, requestType: 'PASSWORD_RESET'});
        return;
      }
      json(404, {error: {code: 404, message: 'NOT_FOUND'}});
    });
  });
  const fake: FakeIdentityToolkit = {
    requests,
    port: 0,
    start: () =>
      new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => {
          fake.port = (server.address() as net.AddressInfo).port;
          resolve();
        });
      }),
    stop: () => {
      server.closeAllConnections();
      return new Promise(resolve => {
        server.close(() => resolve());
      });
    },
  };
  return fake;
}

type RunResult = {status: number; output: string};

let imap: FakeImapServer;
let toolkit: FakeIdentityToolkit;
let mailboxes: Mailboxes;

async function startServers(behavior: ToolkitBehavior = {}): Promise<void> {
  mailboxes = emptyMailboxes();
  imap = new FakeImapServer(mailboxes);
  toolkit = createFakeIdentityToolkit(behavior);
  await Promise.all([imap.start(), toolkit.start()]);
}

afterEach(async () => {
  await Promise.all([imap?.stop(), toolkit?.stop()]);
});

function runCanary(
  args: string[],
  extraEnv: Record<string, string> = {},
): Promise<RunResult> {
  return new Promise(resolve => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      FIREBASE_API_KEY: 'test-api-key',
      CANARY_EMAIL,
      CANARY_IMAP_USER: IMAP_USER,
      CANARY_IMAP_PASSWORD: IMAP_PASSWORD_AS_PASTED,
      CANARY_IMAP_HOST: '127.0.0.1',
      CANARY_IMAP_PORT: String(imap.port),
      CANARY_IMAP_TLS: 'off',
      CANARY_IDENTITY_TOOLKIT_URL: `http://127.0.0.1:${toolkit.port}`,
      CANARY_POLL_SECONDS: '1',
      ...extraEnv,
    };
    // Keep Actions annotations and the step summary out of the test output.
    delete env.GITHUB_ACTIONS;
    delete env.GITHUB_STEP_SUMMARY;
    const child = spawn('node', [SCRIPT, ...args], {env, stdio: 'pipe'});
    child.stdin.end();
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('close', (status: number | null) =>
      resolve({status: status ?? 1, output}),
    );
  });
}

function folder(name: string): FakeMessage[] {
  const messages = mailboxes.get(name);
  if (!messages) {
    throw new Error(`No such fake mailbox: ${name}`);
  }
  return messages;
}

function inbox(message: FakeMessage): void {
  folder('INBOX').push(message);
}

describe('mail-canary run', () => {
  it('passes when the reset mail lands in INBOX with aligned authentication', async () => {
    await startServers();
    // Yesterday's canary mail and an unrelated report share the inbox; only
    // the fresh reset mail counts.
    inbox({
      uid: 40,
      internalDate: imapDate(new Date(Date.now() - 60 * 60 * 1000)),
      raw: resetMail(),
    });
    inbox({uid: 41, internalDate: imapDate(new Date()), raw: resetMail()});
    inbox({
      uid: 42,
      internalDate: imapDate(new Date()),
      raw: unrelatedMail(CANARY_EMAIL),
    });

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(output).toContain('oobCode is valid and unexpired');
    expect(status).toBe(0);

    expect(toolkit.requests).toEqual([
      {
        method: 'POST',
        path: '/accounts:sendOobCode',
        key: 'test-api-key',
        body: {requestType: 'PASSWORD_RESET', email: CANARY_EMAIL},
      },
      {
        method: 'POST',
        path: '/accounts:resetPassword',
        key: 'test-api-key',
        body: {oobCode: OOB_CODE},
      },
    ]);
    expect(imap.moves).toEqual([{uid: 41, to: '[Gmail]/Trash'}]);
    // The pasted app password is sent without its spaces, and never logged.
    expect(imap.commands).toContain(
      `A1 LOGIN "${IMAP_USER}" "${IMAP_PASSWORD}"`,
    );
    expect(output).not.toContain(IMAP_PASSWORD);
    expect(output).not.toContain('test-api-key');
  });

  it('keeps polling until the mail arrives', async () => {
    await startServers();
    setTimeout(() => {
      inbox({uid: 7, internalDate: imapDate(new Date()), raw: resetMail()});
    }, 1500);

    const {status, output} = await runCanary(['run', '--timeout', '15']);

    expect(output).toContain('nothing yet');
    expect(status).toBe(0);
  });

  it('fails when the mail lands in Spam, and still trashes it', async () => {
    await startServers();
    folder('[Gmail]/Spam').push({
      uid: 9,
      internalDate: imapDate(new Date()),
      raw: resetMail(),
    });

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(status).toBe(1);
    expect(output).toContain('[spam]');
    expect(output).toContain('[Gmail]/Spam');
    expect(imap.moves).toEqual([{uid: 9, to: '[Gmail]/Trash'}]);
  });

  it('fails at the send stage when Identity Toolkit refuses', async () => {
    await startServers({
      sendError:
        'QUOTA_EXCEEDED : Exceeded quota for sending password reset email.',
    });

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(status).toBe(1);
    expect(output).toContain('[send]');
    expect(output).toContain('QUOTA_EXCEEDED');
    expect(imap.commands.some(line => line.includes('FETCH'))).toBe(false);
  });

  it('fails at the arrival stage when nothing comes before the timeout', async () => {
    await startServers();

    const {status, output} = await runCanary(['run', '--timeout', '3']);

    expect(status).toBe(1);
    expect(output).toContain('[arrival]');
    expect(toolkit.requests.map(request => request.path)).toEqual([
      '/accounts:sendOobCode',
    ]);
  });

  it('fails when the mail came from the wrong sender', async () => {
    await startServers();
    inbox({
      uid: 3,
      internalDate: imapDate(new Date()),
      raw: resetMail({from: 'noreply@alcohol-tracker-db.firebaseapp.com'}),
    });

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(status).toBe(1);
    expect(output).toContain('[sender]');
    expect(output).toContain('noreply@alcohol-tracker-db.firebaseapp.com');
  });

  it('fails when DKIM or DMARC did not pass', async () => {
    await startServers();
    inbox({
      uid: 3,
      internalDate: imapDate(new Date()),
      raw: resetMail({authResults: FAILING_AUTH_RESULTS}),
    });

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(status).toBe(1);
    expect(output).toContain('[authentication]');
    expect(output).toContain('dmarc=fail');
  });

  it('finds the oobCode behind a click-tracking redirect', async () => {
    await startServers();
    inbox({
      uid: 5,
      internalDate: imapDate(new Date()),
      raw: resetMail({link: `http://127.0.0.1:${toolkit.port}/track/1`}),
    });

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(output).toContain('behind a redirect');
    expect(status).toBe(0);
    expect(
      toolkit.requests.map(request => `${request.method} ${request.path}`),
    ).toEqual([
      'POST /accounts:sendOobCode',
      'GET /track/1',
      'POST /accounts:resetPassword',
    ]);
  });

  it('fails at the link stage when the oobCode is rejected', async () => {
    await startServers({resetError: 'INVALID_OOB_CODE'});
    inbox({uid: 5, internalDate: imapDate(new Date()), raw: resetMail()});

    const {status, output} = await runCanary(['run', '--timeout', '10']);

    expect(status).toBe(1);
    expect(output).toContain('[link]');
    expect(output).toContain('INVALID_OOB_CODE');
  });

  it('fails at the mailbox stage when the app password is wrong', async () => {
    await startServers();

    const {status, output} = await runCanary(['run', '--timeout', '10'], {
      CANARY_IMAP_PASSWORD: 'wrong',
    });

    expect(status).toBe(1);
    expect(output).toContain('[mailbox]');
    expect(toolkit.requests).toEqual([]);
  });

  it('refuses to run without the canary address', async () => {
    await startServers();

    const {status, output} = await runCanary(['run'], {CANARY_EMAIL: ''});

    expect(status).toBe(1);
    expect(output).toContain('[usage]');
    expect(output).toContain('CANARY_EMAIL');
    expect(imap.commands).toEqual([]);
  });
});

describe('mail-canary imap-check', () => {
  it('signs in, lists the folders and sends nothing', async () => {
    await startServers();

    const {status, output} = await runCanary(['imap-check']);

    expect(status).toBe(0);
    expect(output).toContain('[Gmail]/Spam');
    expect(output).toContain('\\Junk');
    expect(output).toContain('Spam folder: [Gmail]/Spam');
    expect(toolkit.requests).toEqual([]);
  });
});
