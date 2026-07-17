import { useEffect, useState } from 'react'

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

  return 'Signed in'
}

export default function UserMenu({
  onUserLoaded,
}: UserMenuProps) {
  const [user, setUser] = useState<ClientPrincipal | null>(null)

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

  if (!user) {
    return null
  }

  return (
    <div className="user-menu">
      <div className="user-identity">
        <span className="user-avatar">
          {user.userDetails.charAt(0).toUpperCase()}
        </span>

        <div>
          <span className="user-label">
            {getRoleLabel(user).toUpperCase()}
          </span>

          <strong>{user.userDetails}</strong>
        </div>
      </div>

      <a className="sign-out-button" href="/.auth/logout?post_logout_redirect_uri=%2Fsigned-out.html">
        Sign out
      </a>
    </div>
  )
}
