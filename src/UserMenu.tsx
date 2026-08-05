import { useEffect, useRef, useState } from 'react'

export type ClientPrincipal = {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
}

type AuthResponse = {
  clientPrincipal: ClientPrincipal | null
}

type UserMenuProps = {
  onUserLoaded?: (user: ClientPrincipal | null) => void
}

function getRoleLabel(user: ClientPrincipal) {
  if (user.userRoles.includes('watchkeeper_admin')) {
    return 'Administrator'
  }

  if (user.userRoles.includes('watchkeeper_engineer')) {
    return 'Engineer'
  }

  if (user.userRoles.includes('watchkeeper_operator')) {
    return 'Operator'
  }

  return 'Signed in'
}

export default function UserMenu({
  onUserLoaded,
}: UserMenuProps) {
  const [user, setUser] = useState<ClientPrincipal | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch('/.auth/me')

        if (!response.ok) {
          onUserLoaded?.(null)
          return
        }

        const data = (await response.json()) as AuthResponse

        setUser(data.clientPrincipal)
        onUserLoaded?.(data.clientPrincipal)
      } catch {
        setUser(null)
        onUserLoaded?.(null)
      }
    }

    void loadUser()
  }, [onUserLoaded])

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeWhenClickingOutside)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeWhenClickingOutside,
      )
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  if (!user) {
    return null
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${user.userDetails}`}
        onClick={() => setIsOpen(current => !current)}
      >
        <span className="user-avatar">
          {user.userDetails.charAt(0).toUpperCase()}
        </span>

        <span className="user-identity-copy">
          <span className="user-label">
            {getRoleLabel(user).toUpperCase()}
          </span>

          <strong>{user.userDetails}</strong>
        </span>

        <span className="user-menu-chevron" aria-hidden="true">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="user-menu-popover" role="menu">
          <div className="user-menu-account">
            <span className="user-label">
              {getRoleLabel(user).toUpperCase()}
            </span>
            <strong>{user.userDetails}</strong>
          </div>

          <a
            className="sign-out-button"
            href="/logout"
            role="menuitem"
          >
            Sign out
          </a>
        </div>
      )}
    </div>
  )
}
