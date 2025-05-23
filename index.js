require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');

let openBrowser; // Will be loaded dynamically later

const app = express();
app.use(cors());
app.use(express.json());

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const CREDENTIALS = {
  installed: {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
  }
};

const oAuth2Client = new google.auth.OAuth2(
  CREDENTIALS.installed.client_id,
  CREDENTIALS.installed.client_secret,
  CREDENTIALS.installed.redirect_uris[0]
);

const TOKEN_PATH = 'token.json';

function authorizeGmail() {
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    return;
  }

  try {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });

    console.log('Authorize this app by visiting this URL:\n', authUrl);
    openBrowser(authUrl); // now dynamically loaded and working
  } catch (err) {
    console.error('Failed to launch browser:', err.message);
  }
}

app.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send('✅ Gmail connected. You can close this window.');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.status(500).send('❌ Failed to authenticate.');
  }
});

app.post('/sse', async (req, res) => {
  const event = req.body;

  if (event.type === 'mcp_tool_use' && event.name === 'send_email') {
    const { to, subject, body } = event.input;

    try {
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage }
      });

      return res.json({
        type: 'mcp_tool_result',
        tool_use_id: event.id,
        is_error: false,
        content: [{ type: 'text', text: `✅ Email sent to ${to}` }]
      });
    } catch (err) {
      console.error('Gmail error:', err.message);
      return res.json({
        type: 'mcp_tool_result',
        tool_use_id: event.id,
        is_error: true,
        content: [{ type: 'text', text: `❌ Failed to send email: ${err.message}` }]
      });
    }
  }

  return res.json({
    type: 'mcp_tool_result',
    tool_use_id: event.id,
    is_error: true,
    content: [{ type: 'text', text: 'Unknown tool or invalid request.' }]
  });
});

// Dynamically load the open module and start server
(async () => {
  const openModule = await import('open');
  openBrowser = openModule.default;

  const PORT = 8000;
  app.listen(PORT, () => {
    console.log(`✅ MCP Gmail server running at http://localhost:${PORT}`);
    authorizeGmail();
  });
})();
EOF < /dev/null