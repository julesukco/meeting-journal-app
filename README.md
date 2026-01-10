App created with Bolt.new and finished up with Cursor.

## Environment Variables

You can configure the AI API using environment variables. Create a `.env` file in the root directory with the following variables:

```env
# Your AI API key (optional - can also be set in the app settings via Ctrl+,)
# If set here, it will override any value set in the app settings
VITE_AI_API_KEY=your_api_key_here

# AI API endpoint (optional - defaults to /api/ai)
# If set here, it will override any value set in the app settings
VITE_AI_API_ENDPOINT=/api/ai

# AI API target URL for the Vite proxy (used when VITE_AI_API_ENDPOINT is /api/ai)
# This is the actual backend API URL that the proxy forwards requests to
VITE_AI_API_TARGET=http://localhost:3001
```

**Note:** Environment variables take priority over settings configured in the app. If `VITE_AI_API_KEY` is set in your `.env` file, it will be used instead of any API key stored in the app settings.

