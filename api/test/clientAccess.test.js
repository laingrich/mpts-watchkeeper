const test = require('node:test')
const assert = require('node:assert/strict')
const {
  canAccessClient,
  filterAccessibleClients
} = require('../src/auth/clientAccess')

const operator = {
  userId: 'operator-id',
  userDetails: 'homeowner@example.test',
  userRoles: ['authenticated', 'watchkeeper_operator']
}
const access = JSON.stringify({
  'operator-id': ['saltmarsh-id']
})

test('operators can access only explicitly assigned clients', () => {
  assert.equal(canAccessClient(operator, 'saltmarsh-id', access), true)
  assert.equal(canAccessClient(operator, 'another-client', access), false)
  assert.deepEqual(filterAccessibleClients(operator, [
    { id: 'saltmarsh-id' },
    { id: 'another-client' }
  ], access), [{ id: 'saltmarsh-id' }])
})

test('missing or malformed operator mappings deny client access', () => {
  assert.equal(canAccessClient(operator, 'saltmarsh-id', ''), false)
  assert.equal(canAccessClient(operator, 'saltmarsh-id', '{bad'), false)
})

test('administrators and engineers retain managed-client access', () => {
  for (const role of ['watchkeeper_admin', 'watchkeeper_engineer']) {
    assert.equal(canAccessClient({ userRoles: [role] }, 'any-client', ''), true)
  }
})
