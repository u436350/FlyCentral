import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token:    null,
      role:     null,
      email:    null,
      tenantId: null,
      login: (data) => set({ token: data.access_token, role: data.role, email: data.email, tenantId: data.tenant_id }),
      logout: () => set({ token: null, role: null, email: null, tenantId: null }),
    }),
    { name: 'flycentral-auth' }
  )
)
