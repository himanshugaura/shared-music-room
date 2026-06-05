export const verificationEmailTemplate = (
  verificationUrl: string
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Email</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f4f5;
  font-family:Arial,sans-serif;
">

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="padding:40px 0;"
  >
    <tr>
      <td align="center">

        <table
          width="600"
          cellpadding="0"
          cellspacing="0"
          style="
            background:#ffffff;
            border-radius:12px;
            padding:40px;
          "
        >

          <tr>
            <td align="center">
              <h1 style="
                margin:0;
                color:#111827;
                font-size:30px;
              ">
                Verify Your Email
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding-top:24px;">
              <p style="
                color:#4b5563;
                font-size:16px;
                line-height:1.7;
                margin:0;
              ">
                Thanks for signing up.
                Please verify your email address
                by clicking the button below.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:36px 0;">
              <a
                href="${verificationUrl}"
                style="
                  background:#111827;
                  color:#ffffff;
                  text-decoration:none;
                  padding:14px 32px;
                  border-radius:8px;
                  font-size:16px;
                  font-weight:600;
                  display:inline-block;
                "
              >
                Verify Email
              </a>
            </td>
          </tr>

          <tr>
            <td>
              <p style="
                color:#6b7280;
                font-size:14px;
                line-height:1.7;
              ">
                This verification link will expire in
                <strong>24 hours</strong>.
              </p>

              <p style="
                color:#6b7280;
                font-size:14px;
                line-height:1.7;
              ">
                If the button doesn't work,
                copy and paste the following URL into your browser:
              </p>

              <p style="
                word-break:break-all;
                color:#2563eb;
                font-size:13px;
              ">
                ${verificationUrl}
              </p>
            </td>
          </tr>

          <tr>
            <td style="
              padding-top:30px;
              border-top:1px solid #e5e7eb;
            ">
              <p style="
                margin:0;
                text-align:center;
                color:#9ca3af;
                font-size:12px;
              ">
                If you didn't create this account,
                you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;