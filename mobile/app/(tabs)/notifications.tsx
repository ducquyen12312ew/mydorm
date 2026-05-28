import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, Notification } from '../../src/api/notifications';
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

// Icon by visual type (what DB stores)
const TYPE_ICON: Record<string, { name: IoniconsName; color: string }> = {
  info: { name: 'information-circle-outline', color: Colors.info },
  success: { name: 'checkmark-circle-outline', color: Colors.success },
  warning: { name: 'warning-outline', color: Colors.warning },
  error: { name: 'alert-circle-outline', color: Colors.error },
};

// Override icon by semantic category (when present)
const CATEGORY_ICON: Record<string, { name: IoniconsName; color: string }> = {
  allocation: { name: 'home-outline', color: Colors.primary },
  registration: { name: 'document-text-outline', color: Colors.info },
  maintenance: { name: 'construct-outline', color: Colors.warning },
  violation: { name: 'warning-outline', color: Colors.error },
  payment: { name: 'cash-outline', color: Colors.success },
  system: { name: 'settings-outline', color: Colors.textMuted },
  announcement: { name: 'megaphone-outline', color: Colors.info },
};

const DEFAULT_ICON: { name: IoniconsName; color: string } = { name: 'notifications-outline', color: Colors.textMuted };

const PRIORITY_ACCENT: Record<string, string> = {
  high: Colors.error,
  medium: Colors.warning,
  normal: Colors.border,
  low: Colors.border,
};

const CATEGORY_DEEP_LINK: Record<string, string> = {
  allocation: '/allocation',
  registration: '/allocation',
  maintenance: '/maintenance',
};

interface NotifItemProps {
  item: Notification;
  onMarkRead: (id: string) => void;
  onNavigate: (route: string) => void;
}

const NotifItem = React.memo(function NotifItem({ item, onMarkRead, onNavigate }: NotifItemProps) {
  // Use category icon when available, otherwise fall back to visual type icon
  const { name: iconName, color: iconColor } =
    (item.category && CATEGORY_ICON[item.category]) ||
    TYPE_ICON[item.type] ||
    DEFAULT_ICON;
  const accentColor = PRIORITY_ACCENT[item.priority] ?? Colors.border;
  const deepLink = item.category ? CATEGORY_DEEP_LINK[item.category] : undefined;

  const handlePress = () => {
    haptic.light();
    if (!item.isRead) onMarkRead(item.id);
    if (deepLink) onNavigate(deepLink);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.82}
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
        <View style={styles.notifFooter}>
          <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
          {deepLink && (
            <View style={styles.deepLinkHint}>
              <Text style={styles.deepLinkText}>Xem chi tiết</Text>
              <Ionicons name="chevron-forward" size={10} color={Colors.primary} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const CATEGORIES = [
  { key: '', label: 'Tất cả' },
  { key: 'allocation', label: 'Xếp phòng' },
  { key: 'registration', label: 'Đăng ký' },
  { key: 'maintenance', label: 'Bảo trì' },
  { key: 'system', label: 'Hệ thống' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(100),
    staleTime: 30000,
  });

  const filtered = useMemo(() => {
    if (!notifications) return [];
    if (!category) return notifications;
    return notifications.filter((n: Notification) => n.category === category);
  }, [notifications, category]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => haptic.light(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleMarkRead = useCallback((id: string) => {
    markReadMutation.mutate(id);
  }, [markReadMutation]);

  const unreadCount = useMemo(
    () => (notifications ?? []).filter((n: { isRead: boolean }) => !n.isRead).length,
    [notifications]
  );

  const markAllButton = useMemo(() => unreadCount > 0 ? (
    <TouchableOpacity
      onPress={() => markAllMutation.mutate()}
      disabled={markAllMutation.isPending}
      hitSlop={10}
    >
      <Ionicons
        name="checkmark-done-outline"
        size={22}
        color={markAllMutation.isPending ? Colors.textMuted : Colors.primary}
      />
    </TouchableOpacity>
  ) : null, [unreadCount, markAllMutation.isPending]);

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader
        title="Thông báo"
        subtitle={unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc tất cả'}
        right={markAllButton}
      />

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catChips}
      >
        {CATEGORIES.map(({ key, label }) => {
          const active = category === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => { haptic.selection(); setCategory(key); }}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonNotifItem key={i} />)}
        </View>
      ) : !filtered.length ? (
        <EmptyState
          iconName="notifications-off-outline"
          title={category ? 'Không có thông báo' : 'Chưa có thông báo'}
          subtitle={category ? `Không có thông báo loại "${CATEGORIES.find(c => c.key === category)?.label}"` : 'Các thông báo từ hệ thống sẽ xuất hiện ở đây'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <NotifItem
              item={item}
              onMarkRead={handleMarkRead}
              onNavigate={(route) => router.push(route as any)}
            />
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

  catScroll: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catChips: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, flexDirection: 'row' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  catChipTextActive: { color: Colors.textInverse, fontWeight: FontWeight.semibold },

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
  notifFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  deepLinkHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  deepLinkText: { fontSize: 10, color: Colors.primary, fontWeight: FontWeight.semibold },

  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 3 + Spacing.sm + 40 + Spacing.sm,
  },
});
