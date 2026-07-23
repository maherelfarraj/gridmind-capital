/**
 * lib/email/render.ts
 * ───────────────────
 * Locale-aware email HTML rendering for GridMind Capital.
 *
 * Produces identical visual results for English and Arabic, with:
 *   - dir="rtl" + right-aligned text for Arabic
 *   - Noto Sans Arabic in the Arabic font stack (via Google Fonts @import)
 *   - All structural strings (footer, "Open Platform") translated
 *   - LTR spans for codes, amounts, and project codes that must stay LTR
 *     inside an RTL email (handled by the caller wrapping values in
 *     <span dir="ltr">…</span>).
 *
 * Usage:
 *   import { buildEmail } from '@/lib/email/render'
 *   const html = buildEmail({ locale: 'ar', subject: 'اعتماد', body: arabicHtml })
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridmind-gules.vercel.app'

// ─── Static translations used inside the email chrome ─────────────────────

const UI: Record<string, Record<string, string>> = {
  en: {
    brand:         'GridMind Capital',
    platform:      'EPC Project Platform',
    footer:        'This is an automated notification from GridMind Capital.',
    openPlatform:  'Open Platform',
    managePrefs:   'Manage email preferences',
    separator:     '·',
  },
  ar: {
    brand:         'GridMind Capital',
    platform:      'منصة مشاريع EPC',
    footer:        'هذا إشعار تلقائي من منصة GridMind Capital.',
    openPlatform:  'فتح المنصة',
    managePrefs:   'إدارة تفضيلات البريد',
    separator:     '·',
  },
}

function ui(locale: string, key: string): string {
  return (UI[locale] ?? UI['en'])[key] ?? (UI['en'][key] ?? '')
}

// ─── Locale-aware font import ──────────────────────────────────────────────

function fontImport(locale: string): string {
  if (locale === 'ar') {
    // Noto Sans Arabic from Google Fonts — works in most mail clients that
    // support @import (Gmail web, Outlook.com, Apple Mail, iOS Mail).
    // Clients that strip @import fall back to system Arabic fonts.
    return `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap');`
  }
  return `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`
}

function bodyFontStack(locale: string): string {
  if (locale === 'ar') {
    return `'Noto Sans Arabic', 'Segoe UI', Arial, sans-serif`
  }
  return `'Inter', 'Segoe UI', Helvetica, Arial, sans-serif`
}

// ─── Helpers for callers building body HTML ───────────────────────────────

/** Wrap a heading — locale-aware direction. */
export function heading(text: string, locale = 'en'): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  return `<h1 dir="${dir}" style="margin:0 0 8px;font-size:20px;font-weight:700;color:#e6f1ff;text-align:${locale === 'ar' ? 'right' : 'left'};">${text}</h1>`
}

/** Wrap a paragraph — locale-aware. */
export function para(text: string, locale = 'en'): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  return `<p dir="${dir}" style="margin:8px 0;font-size:14px;color:#8892b0;line-height:1.7;text-align:${locale === 'ar' ? 'right' : 'left'};">${text}</p>`
}

/** Key-value table row (key is translated by caller). */
export function kvRow(key: string, value: string, locale = 'en'): string {
  const valueDir = 'ltr' // amounts, codes, IDs always LTR
  return `<tr>
    <td style="padding:5px 0;font-size:12px;color:#8892b0;white-space:nowrap;${locale === 'ar' ? 'text-align:right;padding-left:16px;' : 'padding-right:16px;'}">${key}</td>
    <td dir="${valueDir}" style="padding:5px 0;font-size:12px;color:#ccd6f6;text-align:left;">${value}</td>
  </tr>`
}

/** Wrap multiple kvRows in a table. */
export function kvTable(rows: [string, string][], locale = 'en'): string {
  const tableDir = locale === 'ar' ? 'rtl' : 'ltr'
  return `<table dir="${tableDir}" role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;width:100%;background:#0a192f;border-radius:8px;padding:12px;">
    <tbody>${rows.map(([k, v]) => kvRow(k, v, locale)).join('')}</tbody>
  </table>`
}

/** CTA button — direction-neutral (buttons are always centered). */
export function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 22px;background:#64ffda;color:#0a192f;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">${text}</a>`
}

// ─── Main wrapper ─────────────────────────────────────────────────────────

export interface BuildEmailOptions {
  locale?: string
  subject?: string    // for <title> only
  body: string        // pre-built HTML body content
}

/**
 * Wrap email body content in the full GridMind Capital branded shell,
 * applying locale-correct direction, font, and footer strings.
 */
export function buildEmail({ locale = 'en', subject = 'GridMind Capital', body }: BuildEmailOptions): string {
  const dir          = locale === 'ar' ? 'rtl' : 'ltr'
  const textAlign    = locale === 'ar' ? 'right' : 'left'
  const fonts        = fontImport(locale)
  const fontStack    = bodyFontStack(locale)
  const footerSep    = ui(locale, 'separator')

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
  <style>
    ${fonts}
    * { box-sizing: border-box; }
  </style>
</head>
<body style="margin:0;padding:0;background:#0a192f;font-family:${fontStack};direction:${dir};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560"
          style="background:#112240;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f;direction:${dir};">

          <!-- Header -->
          <tr>
            <td style="background:#0a192f;padding:20px 32px;border-bottom:1px solid #1e3a5f;text-align:${textAlign};">
              <span style="font-size:18px;font-weight:700;color:#64ffda;letter-spacing:-0.5px;">${ui(locale, 'brand')}</span>
              <span style="font-size:12px;color:#8892b0;margin-${locale === 'ar' ? 'right' : 'left'}:8px;">${ui(locale, 'platform')}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;text-align:${textAlign};">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1e3a5f;background:#0a192f;text-align:${textAlign};">
              <p style="margin:0;font-size:11px;color:#495670;direction:${dir};">
                ${ui(locale, 'footer')}
                <a href="${BASE_URL}" style="color:#64ffda;text-decoration:none;">${ui(locale, 'openPlatform')}</a>
                &nbsp;${footerSep}&nbsp;
                <a href="${BASE_URL}/settings" style="color:#495670;text-decoration:none;">${ui(locale, 'managePrefs')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Server-side locale resolver ──────────────────────────────────────────

/**
 * Look up a user's stored locale from profiles.
 * Used by server actions before calling sendEmail.
 */
export async function getUserLocale(userId: string): Promise<string> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('locale')
      .eq('id', userId)
      .maybeSingle()
    return (data as { locale?: string } | null)?.locale ?? 'en'
  } catch {
    return 'en'
  }
}
