import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: false,
      toggleDark: () => {
        const next = !get().isDark
        set({ isDark: next })
        document.documentElement.classList.toggle('dark', next)
      },
      initTheme: () => {
        const isDark = get().isDark
        document.documentElement.classList.toggle('dark', isDark)
      },
    }),
    { name: 'flycentral-theme' }
  )
)
