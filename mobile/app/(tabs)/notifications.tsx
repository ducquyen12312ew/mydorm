import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotifications, markNotificationRead, Notification } from '../../src/api/notifications';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SkeletonNotifItem } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';
import { formatRelativeTime } from '../../src/utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<string, { name: IoniconsName; color: string }> = {
  info: { name: 'information-circle-outline', color: Colors.info },
  success: { name: 'checkmark-circle-outline', color: Colors.success },
  warning: { name: 'warning-outline', color: Colors.warning },
  error: { name: 'alert-circle-outline', color: Colors.error },
  allocation: { name: 'home-outline', color: Colors.primary },
  registration: { name: 'document-text-outline', color: Colors.info },
  system: { name: 'settings-outline', color: Colors.textMuted },
};

const DEFAULT_ICON: { name: IoniconsName; color: string } = { name: 'notifications-outline', color: Colors.textMuted };

const PRIORITY_ACCENT: Record<string, string> = {
  high: Colors.error,
  medium: Colors.warning,
  normal: Colors.border,
  low: Colors.border,
};

interface NotifItemProps {
  item: Notification;
  onMarkRead: (id: string) => void;
}

const NotifItem = React.memo(function NotifItem({ item, onMarkRead }: NotifItemProps) {
  const { name: iconName, color: iconColor } = TYPE_ICON[item.type] ?? DEFAULT_ICON;
  const accentColor = PRIORITY_ACCENT[item.priority] ?? Colors.border;

  const handlePress = () => {
    if (!item.isRead) {
      haptic.light();
      onMarkRead(item.id);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={item.isRead ? 1 : 0.8}
      style={[styles.item, !item.isRead && styles.itemUnread]}
    >
      {/* Priority accent line */}
      <View style={[styles.accentLine, { backgroundColor: accentColor }]} />

      {/* Icon */}
      <View style={[styles.iconBox, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={2}>
            {item.title}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
        <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(50),
    staleTime: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleMarkRead = useCallback((id: string) => {
    markReadMutation.mutate(id);
  }, [markReadMutation]);

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader
        title="Thông báo"
        subtitle={unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc tất cả'}
      />

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonNotifItem key={i} />)}
        </View>
      ) : !notifications?.length ? (
        <EmptyState
          icon="🔔"
          title="Chưa có thông báo"
          subtitle="Các thông báo từ hệ thống sẽ xuất hiện ở đây"
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <NotifItem item={item} onMarkRead={handleMarkRead} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: Spacing.xs, paddingBottom: 32 },
  skeletonList: { paddingTop: Spacing.sm },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  itemUnread: { backgroundColor: '#fdf8f8' },

  accentLine: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    minHeight: 40,
    flexShrink: 0,
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  content: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: 4 },
  title: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    lineHeight: 19,
  },
  titleUnread: { fontWeight: FontWeight.bold },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 5,
    flexShrink: 0,
  },

  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },

  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 3 + Spacing.sm + 40 + Spacing.sm,
  },
});
