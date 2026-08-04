const { BlobServiceClient } = require('@azure/storage-blob')
const {
  normaliseUserPreferences
} = require('../settings/userPreferencesSchema')

let containerPromise

function getConnectionString() {
  const value =
    process.env.WATCHKEEPER_STORAGE_CONNECTION_STRING

  if (!value) {
    throw new Error(
      'WATCHKEEPER_STORAGE_CONNECTION_STRING is not configured'
    )
  }

  return value
}

function getContainerName() {
  return (
    process.env.WATCHKEEPER_USER_PREFERENCES_CONTAINER ||
    'watchkeeper-user-preferences'
  )
}

async function getContainer() {
  if (!containerPromise) {
    const service = BlobServiceClient.fromConnectionString(
      getConnectionString()
    )
    const container = service.getContainerClient(
      getContainerName()
    )

    containerPromise = container
      .createIfNotExists()
      .then(() => container)
  }

  return containerPromise
}

function blobName(userIdentity) {
  const encoded = Buffer.from(
    String(userIdentity),
    'utf8'
  ).toString('base64url')

  return `user-${encoded}.json`
}

async function readUserPreferences(userIdentity) {
  const container = await getContainer()
  const blob = container.getBlockBlobClient(
    blobName(userIdentity)
  )

  if (!(await blob.exists())) {
    return {
      preferences: normaliseUserPreferences(null),
      updatedAt: null
    }
  }

  const buffer = await blob.downloadToBuffer()
  const properties = await blob.getProperties()

  return {
    preferences: normaliseUserPreferences(
      JSON.parse(buffer.toString('utf8'))
    ),
    updatedAt:
      properties.metadata?.updatedat ||
      properties.lastModified?.toISOString() ||
      null
  }
}

async function writeUserPreferences(userIdentity, preferences) {
  const container = await getContainer()
  const blob = container.getBlockBlobClient(
    blobName(userIdentity)
  )
  const updatedAt = new Date().toISOString()
  const normalisedPreferences =
    normaliseUserPreferences(preferences)

  await blob.uploadData(
    Buffer.from(
      JSON.stringify(normalisedPreferences, null, 2),
      'utf8'
    ),
    {
      blobHTTPHeaders: {
        blobContentType: 'application/json; charset=utf-8'
      },
      metadata: {
        updatedat: updatedAt
      }
    }
  )

  return {
    preferences: normalisedPreferences,
    updatedAt
  }
}

module.exports = {
  readUserPreferences,
  writeUserPreferences
}
