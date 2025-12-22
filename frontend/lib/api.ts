/**
 * API клиент с автоматической подстановкой JWT токена
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// Создаем экземпляр axios с базовой конфигурацией
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Interceptor для добавления JWT токена к каждому запросу
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Получаем токен из localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * Interceptor для обработки ошибок аутентификации
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Если токен истек или невалиден (401), перенаправляем на логин
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        // Не перенаправляем, если ошибка произошла при попытке входа
        // (чтобы пользователь мог увидеть сообщение об ошибке)
        const requestUrl = error.config?.url || ''
        const isLoginRequest = requestUrl.includes('/auth/login')
        
        if (!isLoginRequest) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// ============ Типы данных ============

export interface User {
  id: string
  email: string
  role: 'guest' | 'user' | 'admin'
  telegram_id?: string
  created_at: string
  is_active: boolean
  profile?: UserProfile
}

export interface UserProfile {
  user_id: string
  full_name?: string
  gender?: 'male' | 'female' | 'other'
  birth_date?: string
  height?: number
  target_weight?: number
  target_calories?: number
  target_proteins?: number
  target_fats?: number
  target_carbs?: number
  target_chest?: number
  target_waist?: number
  target_hips?: number
  target_biceps?: number
  target_thigh?: number
  activity_level?: string
  current_program_id?: string
  avatar_url?: string
}

export interface Token {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface Program {
  id: string
  author_id: string
  title: string
  description: string | null
  is_public: boolean
  difficulty: string | null
  target_muscle_groups?: string | null
  image_url?: string | null
  duration_weeks: number | null
  created_at: string
  updated_at: string
  author?: {
    id: string
    profile?: {
      full_name?: string
    }
  }
}

export interface ProgramDetail {
  id: string
  exercise_id: string
  day_number: number
  sets: number
  reps: number
  rest_time: number | null
  order: number
  notes: string | null
}

export interface ProgramWithDetails extends Program {
  details: ProgramDetail[]
}

export interface ProgramWithStatus extends Program {
  status: 'started' | 'saved' | 'completed'
  is_active: boolean
  start_date: string | null
  last_interaction_at: string | null
}

export interface Exercise {
  id: string
  name: string
  muscle_groups: string[]
  video_urls?: string[]
  description?: string
}

export interface BodyMetric {
  id: string
  user_id: string
  date: string
  weight?: number
  chest?: number
  waist?: number
  hips?: number
  biceps?: number
  thigh?: number
  photo_url?: string
  notes?: string
}

export interface FoodProduct {
  id: string
  name: string
  calories: number
  proteins: number
  fats: number
  carbs: number
  brand?: string
  category?: string
  barcode?: string
  source?: string
  description?: string
}

export interface NutritionLog {
  id: string
  user_id: string
  product_id: string
  weight_g: number
  eaten_at: string
  meal_type?: string
  notes?: string
  calories?: number
  proteins?: number
  fats?: number
  carbs?: number
  product_name?: string
}

export interface Article {
  id: string
  title: string
  content?: string | null
  html_file_name?: string | null
  html_file_url?: string | null
  author_id?: string
  tags?: string[]
  views_count: number
  cover_image_url?: string
  excerpt?: string
  created_at: string
  updated_at: string
  is_published: boolean
}

export interface WorkoutLog {
  id: string
  program_id: string
  day_number: number
  completed_at: string
  duration_minutes?: number
  notes?: string
}

// ============ API функции ============

// Расписание и трекинг
export const scheduleAPI = {
  startProgram: (programId: string) => api.post(`/schedule/start/${programId}`),

  getActiveProgram: () => api.get<ProgramWithDetails | null>('/schedule/active'),

  getScheduleStatus: () => api.get<{
    current_week: number;
    current_day_of_week: number;
    is_completed_today: boolean;
    start_date: string;
    completed_workouts?: number;
  } | null>('/schedule/status'),

  logWorkout: (data: {
    program_id: string;
    day_number: number;
    duration_minutes?: number;
    notes?: string;
    completed_at?: string;
  }) => api.post<WorkoutLog>('/schedule/log', data),

  getHistory: (params?: { skip?: number; limit?: number; program_id?: string }) =>
    api.get<WorkoutLog[]>('/schedule/history', { params }),
}

// Аутентификация
export const authAPI = {
  register: (email: string, password: string, full_name?: string) =>
    api.post<User>('/auth/register', { email, password, full_name }),

  login: (email: string, password: string) =>
    api.post<Token>('/auth/login/json', { email, password }),
}

// Пользователи
export const usersAPI = {
  getMe: () => api.get<User>('/users/me'),
  updateProfile: (data: Partial<UserProfile>) => api.put<UserProfile>('/users/me/profile', data),
  listUsers: () => api.get<User[]>('/users/'),
  blockUser: (userId: string) => api.patch(`/users/${userId}/block`),
  unblockUser: (userId: string) => api.patch(`/users/${userId}/unblock`),
  getDailyAdvice: () => api.get<{ advice: string; date: string }>('/users/me/daily-advice'),
}

// Программы тренировок
export const programsAPI = {
  list: (params?: { skip?: number; limit?: number; difficulty?: string; public_only?: boolean; muscle_group?: string }) =>
    api.get<Program[]>('/programs/', { params }),

  get: (id: string) => api.get<ProgramWithDetails>(`/programs/${id}`),

  create: (data: Partial<Program>) => api.post<Program>('/programs/', data),

  update: (id: string, data: Partial<Program>) => api.put<Program>(`/programs/${id}`, data),

  delete: (id: string) => api.delete(`/programs/${id}`),

  getMy: () => api.get<Program[]>('/programs/my/programs'),
}

// Упражнения
export const exercisesAPI = {
  list: (params?: { skip?: number; limit?: number; muscle_group?: string }) =>
    api.get<Exercise[]>('/exercises/', { params }),

  get: (id: string) => api.get<Exercise>(`/exercises/${id}`),

  create: (data: Partial<Exercise>) => api.post<Exercise>('/exercises/', data),

  update: (id: string, data: Partial<Exercise>) => api.put<Exercise>(`/exercises/${id}`, data),

  delete: (id: string) => api.delete(`/exercises/${id}`),
}

// Метрики тела
export const metricsAPI = {
  list: (params?: { from_date?: string; to_date?: string }) =>
    api.get<BodyMetric[]>('/metrics/', { params }),

  latest: () => api.get<BodyMetric>('/metrics/latest'),

  create: (data: Partial<BodyMetric>) => api.post<BodyMetric>('/metrics/', data),

  update: (id: string, data: Partial<BodyMetric>) => api.put<BodyMetric>(`/metrics/${id}`, data),

  delete: (id: string) => api.delete(`/metrics/${id}`),
}

// Питание
export const nutritionAPI = {
  // Продукты
  listProducts: (params?: { search?: string; category?: string }) =>
    api.get<FoodProduct[]>('/nutrition/products', { params }),

  createProduct: (data: Partial<FoodProduct>) => api.post<FoodProduct>('/nutrition/products', data),

  createProductFromRecognition: (data: Partial<FoodProduct>) => 
    api.post<FoodProduct>('/nutrition/products/from-recognition', data),

  // Штрихкоды
  lookupBarcode: (barcode: string) =>
    api.post<FoodProduct>('/nutrition/lookup-barcode', { barcode }),

  scanBarcodeFromImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ barcode: string; type: string }>('/nutrition/scan-barcode-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  recognizeProductFromImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{
      name: string
      description?: string
      estimated_calories_per_100g?: number | null
      estimated_proteins_per_100g?: number | null
      estimated_fats_per_100g?: number | null
      estimated_carbs_per_100g?: number | null
      brand?: string | null
      category?: string | null
      confidence?: string
    }>('/nutrition/recognize-product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  createLogFromBarcode: (data: {
    barcode: string;
    weight_g: number;
    meal_type?: string;
    notes?: string;
  }) => api.post<NutritionLog>('/nutrition/logs/from-barcode', data),

  // Дневник питания
  listLogs: (params?: { from_date?: string; to_date?: string; meal_type?: string }) =>
    api.get<NutritionLog[]>('/nutrition/logs', { params }),

  createLog: (data: Partial<NutritionLog>) => api.post<NutritionLog>('/nutrition/logs', data),

  updateLog: (id: string, data: Partial<NutritionLog>) => api.put<NutritionLog>(`/nutrition/logs/${id}`, data),

  deleteLog: (id: string) => api.delete(`/nutrition/logs/${id}`),

  // Статистика
  getDailySummary: (date?: string) =>
    api.get('/nutrition/summary/daily', { params: { target_date: date } }),

  // Гидратация
  logWater: (amount_ml: number) =>
    api.post('/nutrition/hydration/log', { amount_ml }),

  getTodayHydration: () =>
    api.get<{
      total_ml: number
      recommended_ml: number
      percentage: number
    }>('/nutrition/hydration/today'),
}

// Статьи
export const articlesAPI = {
  list: (params?: { search?: string; tag?: string; published_only?: boolean }) =>
    api.get<Article[]>('/articles/', { params }),

  get: (id: string) => api.get<Article>(`/articles/${id}`),

  create: (data: Partial<Article>) => api.post<Article>('/articles/', data),

  update: (id: string, data: Partial<Article>) => api.put<Article>(`/articles/${id}`, data),

  delete: (id: string) => api.delete(`/articles/${id}`),
}

// Пользовательские программы
export const userProgramsAPI = {
  list: (status?: string) => api.get<ProgramWithStatus[]>('/my/', { params: { status } }),
  toggleSave: (programId: string) => api.post<{ message: string, is_saved: boolean, previous_status?: string }>(`/my/save/${programId}`),
}

// Загрузка файлов
export const uploadAPI = {
  uploadFile: (file: File, folder?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (folder) {
      formData.append('folder', folder)
    }
    return api.post<{ url: string }>('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

// Аналитика
export const analyticsAPI = {
  getTDEE: () =>
    api.get<{
      bmr: number
      tdee: number
      weight_kg: number
      height_cm: number
      age: number
      activity_level: string
    }>('/analytics/tdee'),
}

export default api

