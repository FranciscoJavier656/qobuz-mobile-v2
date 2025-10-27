import axios from 'axios';
import { API_URL } from '../../utils/constants';

class AuthService {
  async login(email: string, password: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw new Error('Error during login: ' + error.message);
    }
  }

  async logout(): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (error) {
      throw new Error('Error during logout: ' + error.message);
    }
  }

  async register(email: string, password: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw new Error('Error during registration: ' + error.message);
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/auth/current-user`);
      return response.data;
    } catch (error) {
      throw new Error('Error fetching current user: ' + error.message);
    }
  }
}

export default new AuthService();