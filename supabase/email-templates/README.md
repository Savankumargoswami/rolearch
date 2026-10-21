# Rolearch account emails

Account emails (today: the sign-up confirmation) are sent by Supabase Auth from **noreply@rolearch.com**
through a custom SMTP provider. The address is send-only; the site, Privacy Policy, Terms and every email
say so, and tell people to write to admin@rolearch.com instead.

## 1. Email provider (one-time)

Any SMTP provider works. These steps use [Resend](https://resend.com) (free tier: 3,000 emails/month).

1. Create an account and add the domain `rolearch.com` (Domains → Add domain).
2. Add the DNS records Resend shows (an SPF `TXT` record and DKIM records on a `send`/`resend` subdomain, plus the
   `MX` record for bounces) in Namecheap → Domain List → rolearch.com → Advanced DNS. Wait until Resend shows
   the domain as **Verified**.
3. Recommended: add a DMARC record, `TXT` host `_dmarc`, value `v=DMARC1; p=quarantine; rua=mailto:admin@rolearch.com`.
4. Create an API key with "Sending access" for `rolearch.com`. Keep it secret.

## 2. Supabase SMTP

Supabase dashboard → Authentication → Emails → **SMTP Settings** → Enable custom SMTP:

| Field | Value |
|---|---|
| Sender email | `noreply@rolearch.com` |
| Sender name | `Rolearch` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key |
| Minimum interval between emails | 60 seconds |

Then Authentication → **Rate Limits** → raise "Emails per hour" (the default of 2 applies only to Supabase's
built-in mailer; with custom SMTP start at 100).

## 3. Template

Authentication → Emails → **Templates** → *Confirm signup*:

- Subject: `Confirm your email for Rolearch`
- Body: paste `confirm-signup.html`

The link points at `https://www.rolearch.com/auth/confirm` with a one-time `token_hash` (written out in full, so a
wrong Site URL can't send people to localhost); the site's `/auth/confirm` route verifies it. Authentication → URL Configuration → **Site URL** must be
`https://www.rolearch.com`, and the Redirect URLs should include `https://www.rolearch.com/**`.

## 4. Check it

Sign up with a fresh address and confirm that the email arrives from `Rolearch <noreply@rolearch.com>`, passes
SPF and DKIM ("Show original" in Gmail), and the button signs you in on rolearch.com.
