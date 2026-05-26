import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFavorites, removeFavorite } from '../api/client';
import { useAppStore } from '../store/useAppStore';

export default function FavoritesScreen({ navigation }) {
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: !!user
  });

  const removeMutation = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });

  if (!user) {
    return (
      <View style={styles.authRoot}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>Đăng nhập để sử dụng Đã lưu</Text>
          <Text style={styles.authText}>Bạn cần đăng nhập để đồng bộ phòng đã lưu giữa trang web và ứng dụng.</Text>
          <Pressable style={styles.authButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.authButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const favorites = favoritesQuery.data || [];

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Đã lưu</Text>
        <Text style={styles.sub}>Danh sách phòng yêu thích được đồng bộ với tài khoản của bạn.</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Chưa có phòng đã lưu</Text>
          <Text style={styles.emptySub}>Vào Khám phá phòng và lưu các phòng bạn quan tâm.</Text>
        </View>
      ) : (
        favorites.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.dorm}>{item.dormName}</Text>
            <Text style={styles.room}>Phòng {item.roomNumber}</Text>
            <Text style={styles.meta}>
              {item.roomType} · Tầng {item.floor} · {item.availableBeds} chỗ trống
            </Text>
            <Pressable style={styles.unsaveButton} onPress={() => removeMutation.mutate(item.id)}>
              <Text style={styles.unsaveText}>Bỏ lưu</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 10, backgroundColor: '#f4f7ff', paddingBottom: 120 },
  authRoot: { flex: 1, justifyContent: 'center', backgroundColor: '#f4f7ff', padding: 16 },
  authCard: { borderRadius: 18, backgroundColor: '#fff', padding: 16, gap: 10 },
  authTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  authText: { color: '#475569' },
  authButton: { borderRadius: 12, backgroundColor: '#667eea', paddingVertical: 12, alignItems: 'center' },
  authButtonText: { color: '#fff', fontWeight: '800' },
  headerCard: { borderRadius: 18, backgroundColor: '#fff', padding: 16 },
  title: { color: '#0f172a', fontSize: 24, fontWeight: '800' },
  sub: { marginTop: 6, color: '#64748b' },
  emptyCard: { borderRadius: 18, backgroundColor: '#fff', padding: 16 },
  emptyTitle: { color: '#0f172a', fontWeight: '700' },
  emptySub: { marginTop: 4, color: '#64748b' },
  card: { borderRadius: 18, backgroundColor: '#fff', padding: 16 },
  dorm: { color: '#64748b', textTransform: 'uppercase', fontSize: 12, fontWeight: '700' },
  room: { marginTop: 4, color: '#0f172a', fontSize: 21, fontWeight: '800' },
  meta: { marginTop: 4, color: '#475569' },
  unsaveButton: { marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 7 },
  unsaveText: { color: '#991b1b', fontWeight: '700' }
});
