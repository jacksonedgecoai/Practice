const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const open = require('open');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const CREDENTIALS = {
  installed: {
    client_id: "YOUR_NEW_CLIENT_ID_HERE",
    client_secret: "YOUR_NEW_CLIENT_SECRET_HERE",
    redirect_uris: ["http://localhost:8000/oauth2callback"]
  }
};

const oAuth2Client = new google.auth.OAuth2(
  CREDENTIALS.installed.client_id,
  CREDENTIALS.installed.client_secret,
  CREDENTIALS.installed.redirect_uris[0]
);

const TOKEN_PATH = 'token.json';

// Start OAuth process if needed
function authorizeGmail() {
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    return;
  }

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('Authorize this app by visiting this URL:\n', authUrl);
  open(authUrl);
}

// Handle Google OAuth2 callback
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  res.send('✅ Gmail connected. You can close this window.');
});

// MCP endpoint for Claude
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

// Run the server
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`✅ MCP Gmail server running at http://localhost:${PORT}`);
  authorizeGmail(); // Trigger OAuth
});