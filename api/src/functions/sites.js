const { app } = require('@azure/functions')
const sites = require('../data/sites.json')
const { getClientPrincipal } = require('../auth/clientPrincipal')
const { canEditEngineeringData } = require('../auth/clientAccess')

app.http('sites', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sites',

  handler: async request => {
    const principal = getClientPrincipal(request)
    if (!principal) {
      return { status: 401, jsonBody: { error: 'Authentication required' } }
    }
    if (!canEditEngineeringData(principal)) {
      return { status: 403, jsonBody: { error: 'Engineering access is required' } }
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        sites,
        count: sites.length
      })
    }
  }
})
