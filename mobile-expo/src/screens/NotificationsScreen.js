import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { markRead, notifications } from '../api/client';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState('');
  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: notifications,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000)
  });
  const readMutation = useMutation({
    mutationFn: markRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (current = []) =>
        current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onSuccess: () => {
      setSuccessMessage('Đã đánh dấu đã đọc');
      setTimeout(() => setSuccessMessage(''), 1800);
    }
  });

  const renderSwipeAction = (id) => (
    <Pressable
      onPress={() => readMutation.mutate(id)}
      style={styles.swipeAction}
    >
      <Text style={styles.swipeActionText}>Đánh dấu đã đọc</Text>
    </Pressable>
  );

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} tintColor="#1f9d8b" />}
    >
      {successMessage ? (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {list.isLoading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Đang tải thông báo...</Text>
        </View>
      ) : (list.data || []).length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
          <Text style={styles.emptyMessage}>Bạn sẽ thấy cập nhật tại đây khi hệ thống phát sinh sự kiện mới.</Text>
        </View>
      ) : (
        (list.data || []).map((item) => (
          <Swipeable
            key={item.id}
            renderRightActions={() => renderSwipeAction(item.id)}
            overshootRight={false}
          >
            <Pressable style={styles.card} onPress={() => readMutation.mutate(item.id)}>
              <View style={styles.row}>
                <View style={styles.dot(item.isRead)} />
                <View style={styles.col}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
                </View>
              </View>
            </Pressable>
          </Swipeable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 10, backgroundColor: '#f4f7ff', paddingBottom: 30 },
  card: { borderRadius: 16, backgroundColor: '#fff', padding: 14 },
  emptyCard: { borderRadius: 18, backgroundColor: '#fff', padding: 18, alignItems: 'center' },
  emptyTitle: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  emptyMessage: { marginTop: 6, color: '#64748b', textAlign: 'center' },
  successCard: { borderRadius: 16, backgroundColor: '#dcfce7', padding: 12, alignItems: 'center' },
  successText: { color: '#166534', fontWeight: '700' },
  swipeAction: { justifyContent: 'center', alignItems: 'center', width: 120, marginVertical: 4, borderRadius: 12, backgroundColor: '#1f9d8b' },
  swipeActionText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  title: { color: '#0f172a', fontWeight: '700' },
  message: { color: '#475569', marginTop: 4 },
  time: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
  dot: (read) => ({ marginTop: 6, width: 10, height: 10, borderRadius: 999, backgroundColor: read ? '#cbd5e1' : '#ff7f50' })
});
