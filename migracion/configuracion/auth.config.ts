import axios from 'axios';

/**
 * Configuración de Autenticación para API V3
 * 
 * Este archivo maneja la autenticación con la API V3
 * y proporciona el token Bearer necesario para las operaciones.
 */

export const AUTH_CONFIG = {
  apiBaseUrl: 'http://localhost:3050/api/v1',
  credentials: {
    email: 'lisan@gmail.com',
    password: '12345678',
    rememberMe: true,
  },
};

/**
 * Clase para manejar la autenticación con la API V3
 */
export class AuthManager {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  /**
   * Obtiene un token de acceso válido
   * Si ya existe un token válido, lo retorna. Si no, solicita uno nuevo.
   */
  async getAccessToken(): Promise<string> {
    // Si ya tenemos un token válido, retornarlo
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Si no, solicitar uno nuevo
    return this.login();
  }

  /**
   * Realiza el login y obtiene un nuevo token
   */
  async login(): Promise<string> {
    try {
      const response = await axios.post(
        `${AUTH_CONFIG.apiBaseUrl}/auth/login`,
        AUTH_CONFIG.credentials,
      );

      this.accessToken = response.data.access_token;
      
      // Asumir que el token es válido por 24 horas (ajustar según la configuración real)
      this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      console.log('✅ Token de autenticación obtenido exitosamente');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
      throw new Error('No se pudo obtener el token de autenticación');
    }
  }

  /**
   * Obtiene los headers de autorización para requests HTTP
   */
  async getAuthHeaders(): Promise<{ Authorization: string }> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Crea una instancia de axios con los headers de autenticación
   */
  async getAuthenticatedAxios() {
    const headers = await this.getAuthHeaders();
    return axios.create({
      baseURL: AUTH_CONFIG.apiBaseUrl,
      headers,
    });
  }
}

/**
 * Instancia singleton del gestor de autenticación
 */
export const authManager = new AuthManager();
