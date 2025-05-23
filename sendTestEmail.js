const axios = require('axios');

const payload = {
  type: "mcp_tool_use",
  name: "send_email",
  id: "test-1",
  input: {
    to: "jackotumbridge@gmail.com", // 🔁 Replace with your email
    subject: "MCP Test Email",
    body: "This is a test sent from Claude via MCP!"
  }
};

axios.post('http://localhost:8000/sse', payload)
  .then(res => {
    console.log('✅ Success:', res.data);
  })
  .catch(err => {
    console.error('❌ Error:', err.response ? err.response.data : err.message);
  });