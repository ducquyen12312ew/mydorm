import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocketBaseUrl } from '../config';

export async function createRealtimeSocket() {
  const accessToken = await AsyncStorage.getItem('mobile_access_token');
  return io(getSocketBaseUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: {
      token: accessToken ? `Bearer ${accessToken}` : ''
    }
  });
}
