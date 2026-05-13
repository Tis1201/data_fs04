export interface WelcomeEmailTemplateData {
  userName: string;
  userEmail: string;
  tempPassword: string;
  loginUrl: string;
  accountName?: string;
  supportEmail?: string;
  companyName?: string;
}

export function generateWelcomeEmail(data: WelcomeEmailTemplateData) {
  const { userName, userEmail, tempPassword, loginUrl, accountName, supportEmail, companyName = 'Your Company' } = data;
  
  const subject = `Welcome to ${accountName || companyName} - Your Account Details`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6c757d; }
        .password-box { 
          background: #f8f9fa; 
          border: 2px solid #28a745; 
          padding: 15px; 
          border-radius: 6px; 
          text-align: center; 
          margin: 20px 0;
          font-family: monospace;
          font-size: 18px;
          font-weight: bold;
          color: #28a745;
        }
        .info-box { 
          background: #e7f3ff; 
          border: 1px solid #b3d9ff; 
          padding: 15px; 
          border-radius: 6px; 
          margin: 20px 0;
        }
        .button { 
          display: inline-block; 
          background: #28a745; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover { background: #218838; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #28a745;">Welcome to ${accountName || companyName}!</h1>
        </div>
        
        <div class="content">
          <p>Hello ${userName},</p>
          
          <p>Welcome to ${accountName || companyName}! Your account has been created successfully.</p>
          
          <div class="info-box">
            <strong>Account Details:</strong>
            <ul>
              <li><strong>Email:</strong> ${userEmail}</li>
              <li><strong>Account:</strong> ${accountName || companyName}</li>
              <li><strong>Status:</strong> Active</li>
            </ul>
          </div>
          
          <p>Here is your temporary password to access your account:</p>
          
          <div class="password-box">
            ${tempPassword}
          </div>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Login to Your Account</a>
          </div>
          
          <div class="info-box">
            <strong>Important Security Notes:</strong>
            <ul>
              <li>This is a temporary password that should be changed immediately after your first login</li>
              <li>For security reasons, please change your password as soon as possible</li>
              <li>Keep your login credentials secure and don't share them with others</li>
            </ul>
          </div>
          
          <p>You can log in using your email address and the temporary password above.</p>
          
          ${supportEmail ? `<p>If you have any questions or need assistance, please contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>` : ''}
          
          <p>We're excited to have you on board!</p>
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
    
    Welcome to ${accountName || companyName}! Your account has been created successfully.
    
    Account Details:
    - Email: ${userEmail}
    - Account: ${accountName || companyName}
    - Status: Active
    
    Here is your temporary password to access your account:
    
    ${tempPassword}
    
    You can log in at: ${loginUrl}
    
    IMPORTANT SECURITY NOTES:
    - This is a temporary password that should be changed immediately after your first login
    - For security reasons, please change your password as soon as possible
    - Keep your login credentials secure and don't share them with others
    
    ${supportEmail ? `If you have any questions or need assistance, please contact us at ${supportEmail}.` : ''}
    
    We're excited to have you on board!
    
    This is an automated message from ${companyName}.
  `;
  
  return { subject, html, text };
} 