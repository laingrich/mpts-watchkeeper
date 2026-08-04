function applyOptionalHelperFallback() {
  const networkNote = document.querySelector<HTMLElement>(
    '.launcher-network-note',
  )

  if (
    networkNote?.textContent?.includes(
      'local Watchkeeper helper is not running',
    )
  ) {
    networkNote.textContent =
      'Automatic device checks are unavailable on this device. Device links remain available for direct onsite or VPN access.'
  }

  document
    .querySelectorAll<HTMLElement>('.launcher-card')
    .forEach(card => {
      const status = card.querySelector<HTMLElement>(
        '.launcher-device-reachability.unknown',
      )

      if (!status) return

      const fallbackLabel = 'Device status unavailable'
      const fallbackTitle =
        'Automatic device status is unavailable on this device'

      if (status.textContent?.trim() !== fallbackLabel) {
        status.lastChild?.remove()
        status.append(fallbackLabel)
      }

      if (status.title !== fallbackTitle) {
        status.title = fallbackTitle
      }

      const disabledButton = card.querySelector<HTMLButtonElement>(
        'button.launcher-open-device-disabled',
      )
      const linkText = card.querySelector<HTMLElement>(
        '.launcher-card-copy > span:not(.launcher-device-reachability)',
      )?.textContent?.trim()

      if (!disabledButton || !linkText || !/^https?:\/\//i.test(linkText)) {
        return
      }

      const link = document.createElement('a')
      link.href = linkText
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.title =
        'Open this device directly. Device status is unavailable in this browser.'
      link.textContent = 'Open device'
      disabledButton.replaceWith(link)
    })
}

const observer = new MutationObserver(() => {
  applyOptionalHelperFallback()
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
})

applyOptionalHelperFallback()
