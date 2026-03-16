/**
 * Zustand store для управления состоянием аутентификации
 */
import { create } from 'zustand'
import { authAPI, usersAPI, User } from '@/lib/api'

async function saveTokensAndFetchUser(
  access_token: string,
  refresh_token: string,
  set: (state: Partial<AuthState>) => void
) {
  localStorage.setItem('access_token', access_token)
  localStorage.setItem('refresh_token', refresh_token)
  const userResponse = await usersAPI.getMe()
  set({ user: userResponse.data, isAuthenticated: true, isLoading: false })
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (email: string, password: string) => Promise<void>
  googleLogin: (credential: string) => Promise<void>
  register: (email: string, password: string, fullName?: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
  refreshUser: () => Promise<void>
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password)
      const { access_token, refresh_token } = response.data
      await saveTokensAndFetchUser(access_token, refresh_token, set)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  googleLogin: async (credential: string) => {
    try {
      const response = await authAPI.googleLogin(credential)
      const { access_token, refresh_token } = response.data
      await saveTokensAndFetchUser(access_token, refresh_token, set)
    } catch (error) {
      console.error('Google login error:', error)
      throw error
    }
  },

  register: async (email: string, password: string, fullName?: string) => {
    try {
      const response = await authAPI.register(email, password, fullName)

      // После регистрации автоматически логинимся
      await useAuthStore.getState().login(email, password)
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  },

  logout: () => {
    // Удаляем токены
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')

    set({
      user: null,
      isAuthenticated: false
    })
  },

  fetchUser: async () => {
    try {
      const token = localStorage.getItem('access_token')

      if (!token) {
        set({ isLoading: false, isAuthenticated: false })
        return
      }

      const response = await usersAPI.getMe()
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false
      })
    } catch (error) {
      console.error('Fetch user error:', error)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      })
    }
  },

  refreshUser: async () => {
    await get().fetchUser()
  },

  updateUser: (user: User) => {
    set({ user })
  },
}))

