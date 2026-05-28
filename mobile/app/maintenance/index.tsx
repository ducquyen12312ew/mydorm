import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchMyRequests,
  MaintenanceRequest,
  MAINTENANCE_TYPES,
} from '../../src/api/maintenance';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';
import { formatRelativeTime } from '../../src/utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'submitted', label: 'Đã gửi' },
  { key: 'in_progress', label: 'Đang xử lý' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Đã gửi', color: Colors.info, bg: Colors.infoLight },
  assigned: { label: 'Đã tiếp nhận', color: Colors.warning, bg: Colors.warningLight },
  in_progress: { label: 'Đang xử lý', color: Colors.primary, bg: Colors.primaryLight },
  completed: { label: 'Hoàn thành', color: Colors.success, bg: Colors.successLight },
  cancelled: { label: 'Đã hủy', color: Colors.textMuted, bg: Colors.surfaceAlt },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Thấp', color: Colors.textMuted },
  medium: { label: 'Trung bình', color: Colors.warning },
  high: { label: 'Cao', color: Colors.error },
  urgent: { label: 'Khẩn cấp', color: Colors.primary },
};

function typeLabel(type: string): string {
  return MAINTENANCE_TYPES.find((t) => t.key === type)?.label ?? type;
}

function typeIcon(type: string): IoniconsName {
  return (MAINTENANCE_TYPES.find((t) => t.key === type)?.icon ?? 'build-outline') as IoniconsName;
}

function RequestCard({ item, onPress }: { item: MaintenanceRequest; onPress: () => void }) {
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.submitted;
  const priority = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.typeRow}>
          <View style={styles.typeIconBox}>
            <Ionicons name={typeIcon(item.type)} size={16} color={Colors.primary} />
          </View>
          <Text style={styles.typeText}>{typeLabel(item.type)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

      {/* Location */}
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.locationText} numberOfLines={1}>
          Phòng {item.roomNumber} · Tầng {item.floorNumber} · {item.dormitoryName}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.priorityRow}>
          <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
          <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
        </View>
        <Text style={styles.dateText}>{formatRelativeTime(item.reportedAt)}</Text>
      </View>

      {/* Request number + chevron */}
      <View style={styles.cardMeta}>
        <Text style={styles.requestNumber}>{item.requestNumber}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={[styles.cardTop, { marginBottom: 10 }]}>
        <Skeleton width={100} height={14} radius={4} />
        <Skeleton width={70} height={22} radius={11} />
      </View>
      <Skeleton height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={13} style={{ marginBottom: 10 }} />
      <View style={styles.cardFooter}>
        <Skeleton width={60} height={12} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

export default function MaintenanceIndexScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: requests, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['maintenance', { status: statusFilter }],
    queryFn: () => fetchMyRequests(statusFilter || undefined),
    staleTime: 30000,
  });

  const newButton = (
    <TouchableOpacity
      onPress={() => { haptic.light(); router.push('/maintenance/new'); }}
      style={styles.newBtn}
      hitSlop={8}
    >
      <Ionicons name="add" size={24} color={Colors.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader title="Yêu cầu bảo trì" showBack right={newButton} />

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterChips}
      >
        {STATUS_FILTERS.map(({ key, label }) => {
          const active = statusFilter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { haptic.selection(); setStatusFilter(key); }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : !requests?.length ? (
        <EmptyState
          iconName="construct-outline"
          title="Chưa có yêu cầu nào"
          subtitle="Nhấn dấu + để gửi yêu cầu bảo trì mới"
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <RequestCard
              item={item}
              onPress={() => { haptic.light(); router.push({ pathname: '/maintenance/[id]', params: { id: item._id } }); }}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { haptic.medium(); router.push('/maintenance/new'); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={Colors.textInverse} />
      </TouchableOpacity>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  newBtn: { padding: 4 },

  filterScroll: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChips: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textInverse, fontWeight: FontWeight.semibold },

  list: { padding: Spacing.md, paddingBottom: 100 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, lineHeight: 20 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  dateText: { fontSize: FontSize.xs, color: Colors.textMuted },

  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  requestNumber: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
});
