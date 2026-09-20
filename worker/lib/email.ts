/**
 * Transactional email via the Resend REST API, ported from flashstone. With
 * no RESEND_API_KEY, sending is a logged no-op rather than an error: a local
 * dev run must not fail sign-up because it cannot send mail, and a student
 * who mistyped their address must not lose access.
 */

export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

const DEFAULT_FROM = 'Tome of Secrets <tome@send.contrapaul.com>';

async function sendEmail(env: EmailEnv, to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY unset; would have sent "${subject}" to ${to}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM || DEFAULT_FROM, to: [to], subject, html }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text());
}

export function sendVerifyEmail(env: EmailEnv, to: string, link: string): Promise<void> {
  return sendEmail(
    env,
    to,
    'Verify your email for Tome of Secrets',
    `<p>Welcome to the Tome.</p>
     <p><a href="${link}">Click here to verify your email address</a> (the link works for 24 hours).</p>
     <p>If you did not make an account, ignore this email.</p>`,
  );
}

export function sendResetEmail(env: EmailEnv, to: string, link: string): Promise<void> {
  return sendEmail(
    env,
    to,
    'Reset your password for Tome of Secrets',
    `<p><a href="${link}">Click here to choose a new password</a> (the link works for 1 hour).</p>
     <p>If you did not ask for this, ignore this email. Your password is unchanged.</p>`,
  );
}
