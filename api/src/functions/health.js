const { app } = require('@azure/functions')

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',

  handler: async () => {
    return {
      status: 200,
      jsonBody: {
        status: 'ok',
        service: 'watchkeeper-api',
        timestamp: new Date().toISOString()
      }
    }
  }
})
