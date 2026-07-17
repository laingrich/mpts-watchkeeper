const { BlobServiceClient } = require('@azure/storage-blob')

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
    process.env.WATCHKEEPER_DEVICE_CONFIG_CONTAINER ||
    'watchkeeper-device-config'
  )
}

async function getContainer() {
  if (!containerPromise) {
    const service =
      BlobServiceClient.fromConnectionString(
        getConnectionString()
      )

    const container =
      service.getContainerClient(getContainerName())

    containerPromise = container
      .createIfNotExists()
      .then(() => container)
  }

  return containerPromise
}

function blobName(clientId) {
  const encoded = Buffer.from(
    String(clientId),
    'utf8'
  ).toString('base64url')

  return `client-${encoded}.json`
}

async function readConfig(clientId) {
  const container = await getContainer()
  const blob = container.getBlockBlobClient(
    blobName(clientId)
  )

  if (!(await blob.exists())) {
    return null
  }

  const buffer = await blob.downloadToBuffer()
  const properties = await blob.getProperties()

  return {
    config: JSON.parse(buffer.toString('utf8')),
    etag: properties.etag || null,
    updatedAt:
      properties.metadata?.updatedat ||
      properties.lastModified?.toISOString() ||
      null,
    updatedBy:
      properties.metadata?.updatedby ||
      null
  }
}

async function writeConfig(
  clientId,
  config,
  updatedBy,
  expectedEtag
) {
  const container = await getContainer()
  const blob = container.getBlockBlobClient(
    blobName(clientId)
  )

  const updatedAt = new Date().toISOString()
  const body = Buffer.from(
    JSON.stringify(config, null, 2),
    'utf8'
  )

  const options = {
    blobHTTPHeaders: {
      blobContentType:
        'application/json; charset=utf-8'
    },
    metadata: {
      updatedat: metadataValue(updatedAt),
      updatedby: metadataValue(updatedBy)
    }
  }

  if (expectedEtag) {
    options.conditions = {
      ifMatch: expectedEtag
    }
  }

  await blob.uploadData(body, options)

  const properties = await blob.getProperties()

  return {
    config,
    etag: properties.etag || null,
    updatedAt,
    updatedBy
  }
}

function metadataValue(value) {
  return String(value || 'unknown')
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 250)
}

module.exports = {
  readConfig,
  writeConfig
}
