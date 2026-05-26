import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/student-app',
  withCredentials: true
});

export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout');
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function fetchDashboard() {
  const { data } = await api.get('/dashboard');
  return data.dashboard;
}

export async function fetchRooms() {
  const { data } = await api.get('/rooms/explore', {
    params: { onlyAvailable: 'true' }
  });
  return data.dormitories;
}

export async function fetchNotifications() {
  const { data } = await api.get('/notifications', { params: { limit: 25 } });
  return data.notifications;
}

export async function markNotificationRead(id) {
  const { data } = await api.post(`/notifications/${id}/read`);
  return data;
}

export async function scorePreview(payload) {
  const { data } = await api.post('/applications/score-preview', payload);
  return data.score;
}

export async function fetchFavorites() {
  const { data } = await api.get('/favorites');
  return data.favorites || [];
}

export async function saveFavorite(roomId) {
  const { data } = await api.post('/favorites', { roomId });
  return data;
}

export async function removeFavorite(roomId) {
  const { data } = await api.delete(`/favorites/${roomId}`);
  return data;
}

export async function fetchRegistrationWindow() {
  const { data } = await api.get('/registration/availability');
  return data;
}

export default api;
