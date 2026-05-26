import { api } from './client';

export interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  maxCapacity: number;
  currentOccupants: number;
  availableBeds: number;
  pricePerMonth: number;
  amenities: string[];
  imageUrl: string;
  isAvailable: boolean;
}

export interface Dormitory {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
  category: string;
  totalRooms: number;
  rooms: Room[];
}

export interface RoomFilters {
  dormitoryId?: string;
  onlyAvailable?: boolean;
  roomType?: string;
}

export async function fetchRooms(filters: RoomFilters = {}): Promise<Dormitory[]> {
  const params: Record<string, string> = {};
  if (filters.dormitoryId) params.dormitoryId = filters.dormitoryId;
  if (filters.onlyAvailable) params.onlyAvailable = 'true';
  if (filters.roomType) params.roomType = filters.roomType;

  const { data } = await api.get<{ success: boolean; dormitories: Dormitory[] }>(
    '/mobile/rooms/explore',
    { params }
  );
  return data.dormitories;
}

export async function fetchFavorites() {
  const { data } = await api.get<{ success: boolean; favorites: any[] }>('/mobile/favorites');
  return data.favorites;
}

export async function addFavorite(roomId: string): Promise<void> {
  await api.post('/mobile/favorites', { roomId });
}

export async function removeFavorite(roomId: string): Promise<void> {
  await api.delete(`/mobile/favorites/${roomId}`);
}
