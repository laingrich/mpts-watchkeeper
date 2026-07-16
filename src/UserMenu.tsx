import { useEffect, useState } from 'react'

type ClientPrincipal = {
  identityProvider: string
  userId: string
  userDetails: string
  userRoles: string[]
}

type AuthResponse = {
  clientPrincipal: ClientPrincipal | null
}

export default function UserMenu() {
  const [user, setUser] = useState<ClientPrincipal | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch('/.auth/me')

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as AuthResponse
        setUser(data.clientPrincipal)
      } catch {
        // Authentication information is unavailable when using Vite alone
        // during local development.
      }
    }

    void loadUser()
  }, [])

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
          <span className="user-label">SIGNED IN</span>
          <strong>{user.userDetails}</strong>
        </div>
      </div>

      <a className="sign-out-button" href="/.auth/logout">
        Sign out
      </a>
    </div>
  )
}
