function getClientPrincipal(request) {
  const encoded = request.headers.get('x-ms-client-principal')

  if (!encoded) {
    return null
  }

  try {
    return JSON.parse(
      Buffer.from(encoded, 'base64').toString('utf8')
    )
  } catch {
    return null
  }
}

function hasAnyRole(principal, allowedRoles) {
  const userRoles = Array.isArray(principal?.userRoles)
    ? principal.userRoles
    : []

  return allowedRoles.some(role => userRoles.includes(role))
}

module.exports = {
  getClientPrincipal,
  hasAnyRole
}
