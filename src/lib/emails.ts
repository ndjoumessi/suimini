/**
 * Server-side email content (Atelier — Warm Brutalist).
 * Mirrors supabase/email-templates/approved.html and invite-member.html;
 * kept here so API routes can send them without filesystem access.
 * If you edit one, edit the other.
 */

export const APPROVED_SUBJECT = 'Votre compte est activé — Suimini';

export const INVITE_SUBJECT = (inviterName: string, treeName: string): string =>
  `${inviterName} vous invite sur ${treeName} — Suimini`;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function inviteEmailHtml(inviterName: string, treeName: string, inviteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invitation à collaborer — Suimini</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f1ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#faf9f6; border:2px solid #1b1b1b; border-radius:0;">
            <tr>
              <td style="background-color:#1b1b1b; padding:24px; font-family:'Hanken Grotesk', Arial, sans-serif; color:#ffffff; text-transform:uppercase; letter-spacing:2px; font-weight:700; font-size:22px;">SUIMINI</td>
            </tr>
            <tr>
              <td style="padding:32px 28px; color:#1b1b1b; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:15px; line-height:1.6;">
                <h1 style="margin:0 0 16px; font-family:'Hanken Grotesk', Arial, sans-serif; font-weight:700; font-size:26px; color:#1b1b1b;">Vous êtes invité(e) à collaborer</h1>
                <p style="margin:0 0 24px;"><strong>${esc(inviterName)}</strong> vous invite à rejoindre l'arbre généalogique <strong>« ${esc(treeName)} »</strong> sur Suimini. Acceptez l'invitation pour commencer à collaborer.</p>
                <p style="margin:0 0 24px;">
                  <a href="${esc(inviteUrl)}" style="background-color:#bf4b2c; color:#ffffff; border:2px solid #1b1b1b; box-shadow:4px 4px 0 #1b1b1b; border-radius:0; padding:14px 28px; font-family:'Hanken Grotesk', Arial, sans-serif; font-weight:700; font-size:15px; text-decoration:none; display:inline-block;">Accepter l'invitation →</a>
                </p>
                <p style="margin:0 0 8px; color:#6b6560; font-size:13px;">Cette invitation expire dans 7 jours.</p>
                <p style="margin:0 0 8px; color:#6b6560; font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
                <p style="margin:0; color:#6b6560; font-size:12px; word-break:break-all;">${esc(inviteUrl)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px; border-top:1px solid #d8d2c6; color:#6b6560; font-size:12px; font-family:Arial, sans-serif;">
                <p style="margin:0 0 4px;">© 2026 Suimini</p>
                <p style="margin:0;">Suimini — l'arbre généalogique moderne</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const MEMBER_JOINED_SUBJECT = (memberName: string, treeName: string): string =>
  `${memberName} a rejoint votre arbre ${treeName} — Suimini`;

export function memberJoinedEmailHtml(
  { ownerName, memberName, treeName, treeUrl }:
  { ownerName?: string; memberName: string; treeName: string; treeUrl: string },
): string {
  const greeting = ownerName?.trim()
    ? `<p style="margin:0 0 16px;">Bonjour ${esc(ownerName.trim())},</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Un membre a rejoint votre arbre — Suimini</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f1ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#faf9f6; border:2px solid #1b1b1b; border-radius:0;">
            <tr>
              <td style="background-color:#1b1b1b; padding:24px; font-family:'Bricolage Grotesque', Georgia, serif; color:#ffffff; text-transform:uppercase; letter-spacing:2px; font-weight:700; font-size:22px;">SUIMINI</td>
            </tr>
            <tr>
              <td style="padding:32px 28px; color:#1b1b1b; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:15px; line-height:1.6;">
                <h1 style="margin:0 0 16px; font-family:'Bricolage Grotesque', Georgia, serif; font-weight:700; font-size:26px; color:#1b1b1b;">Bonne nouvelle !</h1>
                ${greeting}
                <p style="margin:0 0 24px;"><strong>${esc(memberName)}</strong> a accepté votre invitation et a rejoint l'arbre <strong>« ${esc(treeName)} »</strong>. Vous pouvez maintenant collaborer ensemble sur votre histoire familiale.</p>
                <p style="margin:0 0 24px;">
                  <a href="${esc(treeUrl)}" style="background-color:#bf4b2c; color:#ffffff; border:2px solid #1b1b1b; box-shadow:4px 4px 0 #1b1b1b; border-radius:0; padding:14px 28px; font-family:'Bricolage Grotesque', Georgia, serif; font-weight:700; font-size:15px; text-decoration:none; display:inline-block;">Voir l'arbre →</a>
                </p>
                <p style="margin:0 0 8px; color:#6b6560; font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
                <p style="margin:0; color:#6b6560; font-size:12px; word-break:break-all;">${esc(treeUrl)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px; border-top:1px solid #d8d2c6; color:#6b6560; font-size:12px; font-family:Arial, sans-serif;">
                <p style="margin:0 0 4px;">© 2026 Suimini</p>
                <p style="margin:0;">Données hébergées en Europe</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function approvedEmailHtml(displayName?: string): string {
  const greeting = displayName?.trim()
    ? `<p style="margin:0 0 16px;">Bonjour ${esc(displayName.trim())},</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Votre compte est activé — Suimini</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f1ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#faf9f6; border:2px solid #1b1b1b; border-radius:0;">
            <tr>
              <td style="background-color:#1b1b1b; padding:24px; font-family:'Bricolage Grotesque', Arial, sans-serif; color:#ffffff; text-transform:uppercase; letter-spacing:2px; font-weight:700; font-size:22px;">SUIMINI</td>
            </tr>
            <tr>
              <td style="padding:32px 28px; color:#1b1b1b; font-family:'Hanken Grotesk', Arial, sans-serif; font-size:15px; line-height:1.6;">
                <h1 style="margin:0 0 16px; font-family:'Bricolage Grotesque', Arial, sans-serif; font-weight:700; font-size:26px; color:#1b1b1b;">Compte activé !</h1>
                ${greeting}
                <p style="margin:0 0 24px;">Votre demande a été approuvée. Vous pouvez maintenant accéder à Suimini et créer votre arbre généalogique.</p>
                <p style="margin:0 0 24px;">
                  <a href="https://suimini.vercel.app" style="background-color:#bf4b2c; color:#ffffff; border:2px solid #1b1b1b; box-shadow:4px 4px 0 #1b1b1b; border-radius:0; padding:14px 28px; font-family:'Bricolage Grotesque', Arial, sans-serif; font-weight:700; font-size:15px; text-decoration:none; display:inline-block;">Accéder à Suimini</a>
                </p>
                <p style="margin:0 0 8px; color:#6b6560; font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
                <p style="margin:0; color:#6b6560; font-size:12px; word-break:break-all;">https://suimini.vercel.app</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px; border-top:1px solid #d8d2c6; color:#6b6560; font-size:12px; font-family:Arial, sans-serif;">
                <p style="margin:0 0 4px;">© 2026 Suimini</p>
                <p style="margin:0;">Suimini — l'arbre généalogique moderne</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
