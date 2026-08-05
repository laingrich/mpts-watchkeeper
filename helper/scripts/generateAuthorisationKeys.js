const crypto = require('node:crypto')

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')

console.log(JSON.stringify({
  WATCHKEEPER_HELPER_SIGNING_PRIVATE_KEY: privateKey
    .export({ format: 'der', type: 'pkcs8' })
    .toString('base64'),
  authorisationPublicKey: publicKey
    .export({ format: 'der', type: 'spki' })
    .toString('base64')
}, null, 2))
