import nodemailer from 'nodemailer';

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

function buildVerificationEmail(code: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tasqa 認証コード</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7ff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,0.08);">

          <!-- ヘッダー -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px 28px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:2px;line-height:1;">Tasqa</p>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:0.5px;">タスク・予定管理アプリ</p>
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e1b4b;">メールアドレスの確認</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.7;">
                以下の認証コードを入力してアカウント登録を完了してください。<br>
                このコードは <strong style="color:#4f46e5;">10分間</strong> 有効です。
              </p>

              <!-- コードボックス -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:24px 0;">
                    <div style="display:inline-block;background:#f5f3ff;border:2px solid #e0e7ff;border-radius:12px;padding:20px 40px;">
                      <p style="margin:0;font-size:11px;font-weight:600;color:#6366f1;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">認証コード</p>
                      <p style="margin:0;font-size:42px;font-weight:800;color:#1e1b4b;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;line-height:1.7;">
                このメールに心当たりがない場合は、無視してください。<br>
                アカウントが作成されることはありません。
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© 2025 Tasqa. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(to: string, code: string): Promise<{ ok: boolean; fallback: boolean; error?: string }> {
  const transporter = getTransporter();

  if (!transporter) {
    // Gmail未設定 → フォールバック
    return { ok: true, fallback: true };
  }

  try {
    await transporter.sendMail({
      from: `"Tasqa" <${process.env.GMAIL_USER}>`,
      to,
      subject: `【Tasqa】認証コード: ${code}`,
      html: buildVerificationEmail(code),
    });
    return { ok: true, fallback: false };
  } catch (err: any) {
    console.error('Nodemailer error:', err?.message ?? err);
    return { ok: false, fallback: true, error: err?.message ?? String(err) };
  }
}
