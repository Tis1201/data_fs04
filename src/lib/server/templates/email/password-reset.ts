export interface PasswordResetTemplateData {
  userName: string;
  userEmail: string;
  tempPassword: string;
  loginUrl: string;
  supportEmail?: string;
  companyName?: string;
}

export function generatePasswordResetEmail(data: PasswordResetTemplateData) {
  const { userName, userEmail, tempPassword, loginUrl, supportEmail, companyName = 'Your Company' } = data;
  
  const subject = `Password Reset - Your New Temporary Password`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6c757d; }
        .password-box { 
          background: #f8f9fa; 
          border: 2px solid #007bff; 
          padding: 15px; 
          border-radius: 6px; 
          text-align: center; 
          margin: 20px 0;
          font-family: monospace;
          font-size: 18px;
          font-weight: bold;
          color: #007bff;
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          padding: 15px; 
          border-radius: 6px; 
          margin: 20px 0;
        }
        .button { 
          display: inline-block; 
          background: #007bff; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover { background: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #007bff;">Password Reset</h1>
        </div>
        
        <div class="content">
          <p>Hello ${userName},</p>
          
          <p>Your password has been reset by an administrator. Here is your new temporary password:</p>
          
          <div class="password-box">
            ${tempPassword}
          </div>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Login Now</a>
          </div>
          
          <div class="warning">
            <strong>Important:</strong> 
            <ul>
              <li>This is a temporary password that should be changed immediately after login</li>
              <li>For security reasons, please change your password as soon as possible</li>
              <li>If you did not request this password reset, please contact support immediately</li>
            </ul>
          </div>
          
          <p>You can log in using your email address and the temporary password above.</p>
          
          ${supportEmail ? `<p>If you have any questions, please contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>` : ''}
        </div>
        
        <div class="footer">
          <p>This is an automated message from ${companyName}. Please don't reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Hello ${userName},
    
    Your password has been reset by an administrator. Here is your new temporary password:
    
    ${tempPassword}
    
    You can log in at: ${loginUrl}
    
    IMPORTANT:
    - This is a temporary password that should be changed immediately after login
    - For security reasons, please change your password as soon as possible
    - If you did not request this password reset, please contact support immediately
    
    ${supportEmail ? `If you have any questions, please contact us at ${supportEmail}.` : ''}
    
    This is an automated message from ${companyName}.
  `;
  
  return { subject, html, text };
} 