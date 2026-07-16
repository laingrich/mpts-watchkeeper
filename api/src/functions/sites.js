const { app } = require('@azure/functions')
const sites = require('../data/sites.json')

app.http('sites', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sites',

  handler: async () => ({
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      sites,
      count: sites.length
    })
  })
})
