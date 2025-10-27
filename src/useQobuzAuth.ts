import { useState, useEffect } from 'react';
import { AuthService } from '../services/auth/AuthService';

const useQobuzAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const authService = new AuthService();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [authService]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const loggedInUser = await authService.login(email, password);
      setUser(loggedInUser);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, error, login, logout };
};

export default useQobuzAuth;