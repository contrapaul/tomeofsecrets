import { account, ApiError, type CarryOffer } from './account';

/**
 * The account forms: the game's only DOM UI, floated over the canvas, because
 * password managers, autofill and phone keyboards need real inputs and Pixi
 * has none. One overlay at a time; every form closes back to the game.
 */

export type AccountView = 'signin' | 'signup' | 'forgot' | 'newPassword' | 'delete';

const CSS = `
.tome-acct { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(6,6,10,.78); font-family: Alegreya, Georgia, serif; color: #efe4c8; }
.tome-acct form, .tome-acct .box { width: min(440px, calc(100vw - 32px)); background: #14121c; border: 2px solid #d4a83b; border-radius: 16px; padding: 28px 28px 22px; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.tome-acct h2 { font-family: Cinzel, serif; font-weight: 700; letter-spacing: .06em; color: #d4a83b; font-size: 22px; margin: 0 0 14px; }
.tome-acct p { margin: 0 0 12px; font-size: 17px; line-height: 1.4; color: #bfb193; }
.tome-acct label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #bfb193; margin: 12px 0 4px; }
.tome-acct input { width: 100%; box-sizing: border-box; font: inherit; font-size: 18px; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(212,168,59,.5); background: #0b0a0f; color: #efe4c8; }
.tome-acct input:focus { outline: none; border-color: #f2cf6b; }
.tome-acct .row { display: flex; gap: 10px; margin-top: 18px; align-items: center; flex-wrap: wrap; }
.tome-acct button { font-family: Cinzel, serif; font-weight: 700; letter-spacing: .04em; font-size: 16px; padding: 10px 18px; border-radius: 10px; border: 2px solid #d4a83b; cursor: pointer; background: #d4a83b; color: #0b0a0f; }
.tome-acct button.ghost { background: transparent; color: #efe4c8; }
.tome-acct button:disabled { opacity: .5; cursor: default; }
.tome-acct .err { color: #e07b7b; font-size: 16px; margin: 10px 0 0; min-height: 1.3em; }
.tome-acct .ok { color: #8fd18f; font-size: 16px; margin: 10px 0 0; }
.tome-acct .links { margin-top: 14px; font-size: 15px; display: flex; gap: 16px; flex-wrap: wrap; }
.tome-acct a { color: #f2cf6b; cursor: pointer; text-decoration: underline; }
.tome-acct .note { background: rgba(212,168,59,.08); border-left: 3px solid #d4a83b; padding: 8px 12px; border-radius: 0 8px 8px 0; font-size: 15px; margin: 10px 0 0; color: #efe4c8; }
`;

let root: HTMLDivElement | null = null;

function ensureStyles(): void {
  if (document.getElementById('tome-acct-css')) return;
  const style = document.createElement('style');
  style.id = 'tome-acct-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function closeAccountUi(): void {
  root?.remove();
  root = null;
}

function mount(html: string): HTMLDivElement {
  ensureStyles();
  closeAccountUi();
  root = document.createElement('div');
  root.className = 'tome-acct';
  root.innerHTML = html;
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) closeAccountUi();
  });
  document.body.appendChild(root);
  const first = root.querySelector<HTMLInputElement>('input');
  first?.focus();
  return root;
}

function field(name: string, label: string, type: string, extra = ''): string {
  return `<label for="acct-${name}">${label}</label><input id="acct-${name}" name="${name}" type="${type}" ${extra}>`;
}

async function submit(form: HTMLFormElement, work: () => Promise<void>): Promise<void> {
  const err = form.querySelector<HTMLElement>('.err')!;
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  err.textContent = '';
  button.disabled = true;
  try {
    await work();
  } catch (e) {
    err.textContent = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
    button.disabled = false;
  }
}

export interface AccountUiOptions {
  /** Called when the session state changed (signed in, out, carried). */
  onChange?: () => void;
  token?: string;
}

/** Open one of the account forms. */
export function openAccountUi(view: AccountView, opts: AccountUiOptions = {}): void {
  const acct = account();
  const done = () => {
    closeAccountUi();
    opts.onChange?.();
  };

  if (view === 'signin') {
    const el = mount(`<form autocomplete="on">
      <h2>Sign in</h2>
      <p>Your Tome follows you between devices once you are signed in.</p>
      ${field('login', 'Username or email', 'text', 'autocomplete="username" required')}
      ${field('password', 'Password', 'password', 'autocomplete="current-password" required')}
      <div class="err"></div>
      <div class="row"><button type="submit">Sign in</button><button type="button" class="ghost" data-close>Not now</button></div>
      <div class="links"><a data-go="signup">Make an account</a><a data-go="forgot">Forgot password</a></div>
    </form>`);
    wire(el, opts);
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      void submit(f, async () => {
        const offer = await acct.login({ login: f.login.value, password: f.password.value });
        if (offer) openCarryPrompt(offer, opts);
        else done();
      });
    });
    return;
  }

  if (view === 'signup') {
    const el = mount(`<form autocomplete="on">
      <h2>Make an account</h2>
      <p>Pick a username that is not your full name. Your email is only for verifying the account and resetting a forgotten password; nobody sees it.</p>
      ${field('username', 'Username', 'text', 'autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_-]+" required')}
      ${field('email', 'Email', 'email', 'autocomplete="email" required')}
      ${field('password', 'Password (8 or more characters)', 'password', 'autocomplete="new-password" minlength="8" required')}
      <div class="note" data-carry></div>
      <div class="err"></div>
      <div class="row"><button type="submit">Create account</button><button type="button" class="ghost" data-close>Not now</button></div>
      <div class="links"><a data-go="signin">I have an account</a></div>
    </form>`);
    wire(el, opts);
    const carryNote = el.querySelector<HTMLElement>('[data-carry]')!;
    const summary = acct.anonymousSummary();
    if (summary) carryNote.textContent = `Your Tome so far (${offerText(summary)}) will become this account's.`;
    else carryNote.remove();
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      void submit(f, async () => {
        await acct.signup({ username: f.username.value.trim(), email: f.email.value.trim(), password: f.password.value });
        done();
      });
    });
    return;
  }

  if (view === 'forgot') {
    const el = mount(`<form>
      <h2>Forgot password</h2>
      <p>Enter the email on your account and we will send a link to choose a new password.</p>
      ${field('email', 'Email', 'email', 'autocomplete="email" required')}
      <div class="err"></div>
      <div class="row"><button type="submit">Send the link</button><button type="button" class="ghost" data-close>Cancel</button></div>
      <div class="links"><a data-go="signin">Back to sign in</a></div>
    </form>`);
    wire(el, opts);
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      void submit(f, async () => {
        await acct.requestReset(f.email.value.trim());
        f.innerHTML = `<h2>Check your email</h2><p>If that address has an account, a link is on its way. It works for one hour.</p><div class="row"><button type="button" data-close>Back to the game</button></div>`;
        wire(el, opts);
      });
    });
    return;
  }

  if (view === 'newPassword') {
    const token = opts.token ?? '';
    const el = mount(`<form>
      <h2>Choose a new password</h2>
      ${field('password', 'New password (8 or more characters)', 'password', 'autocomplete="new-password" minlength="8" required')}
      <div class="err"></div>
      <div class="row"><button type="submit">Save password</button><button type="button" class="ghost" data-close>Cancel</button></div>
    </form>`);
    wire(el, opts);
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      void submit(f, async () => {
        await acct.resetPassword(token, f.password.value);
        f.innerHTML = `<h2>Password changed</h2><p>Sign in with it now.</p><div class="row"><button type="button" data-go="signin">Sign in</button></div>`;
        wire(el, opts);
      });
    });
    return;
  }

  if (view === 'delete') {
    const el = mount(`<form>
      <h2>Delete your account</h2>
      <p>This removes your account, your Tome and your run from the server. The copy on this device stays until you clear the browser. Type your password to confirm.</p>
      ${field('password', 'Password', 'password', 'autocomplete="current-password" required')}
      <div class="err"></div>
      <div class="row"><button type="submit">Delete my account</button><button type="button" class="ghost" data-close>Keep it</button></div>
    </form>`);
    wire(el, opts);
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      void submit(f, async () => {
        await acct.deleteAccount(f.password.value);
        done();
      });
    });
  }
}

/** "This browser has a Tome that is not tied to an account yet…" */
export function openCarryPrompt(offer: CarryOffer, opts: AccountUiOptions = {}): void {
  const acct = account();
  const el = mount(`<div class="box">
    <h2>A Tome without an account</h2>
    <p>This browser has progress that is not tied to any account yet: ${offerText(offer)}. If it is yours, merge it into your account. If a classmate made it, leave it here for them.</p>
    <div class="row"><button type="button" data-merge>Merge it into mine</button><button type="button" class="ghost" data-leave>Leave it</button></div>
  </div>`);
  el.querySelector('[data-merge]')!.addEventListener('click', () => {
    acct.acceptCarry();
    closeAccountUi();
    opts.onChange?.();
  });
  el.querySelector('[data-leave]')!.addEventListener('click', () => {
    acct.declineCarry();
    closeAccountUi();
    opts.onChange?.();
  });
}

/** A plain message box with one button. */
export function openMessage(title: string, text: string, opts: AccountUiOptions = {}): void {
  const el = mount(`<div class="box"><h2>${title}</h2><p>${text}</p><div class="row"><button type="button" data-close>Back to the game</button></div></div>`);
  wire(el, opts);
}

function wire(el: HTMLElement, opts: AccountUiOptions): void {
  el.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => {
    closeAccountUi();
    opts.onChange?.();
  }));
  el.querySelectorAll<HTMLElement>('[data-go]').forEach((a) => a.addEventListener('click', () => openAccountUi(a.dataset.go as AccountView, opts)));
}

function offerText(offer: CarryOffer): string {
  const parts = [`${offer.lore} Lore`, `${offer.pages} page${offer.pages === 1 ? '' : 's'}`, `${offer.bestiary} Bestiary page${offer.bestiary === 1 ? '' : 's'}`];
  if (offer.runFloor !== null) parts.push(`a run in progress on floor ${offer.runFloor}`);
  return parts.join(', ');
}
