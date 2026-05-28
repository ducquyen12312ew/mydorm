import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchMyViolations,
  Violation,
  VIOLATION_TYPE_LABELS,
} from '../../src/api/violations';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { formatRelativeTime } from '../../src/utils/format';

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Nhẹ', color: Colors.textMuted, bg: Colors.surfaceAlt },
  medium: { label: 'Trung bình', color: Colors.warning, bg: Colors.warningLight },
  high: { label: 'Nghiêm trọng', color: Colors.error, bg: Colors.errorLight },
  critical: { label: 'Rất nghiêm trọng', color: Colors.primary, bg: Colors.primaryLight },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xử lý', color: Colors.warning },
  investigating: { label: 'Đang điều tra', color: Colors.info },
  resolved: { label: 'Đã xử lý', color: Colors.success },
  dismissed: { label: 'Đã bác bỏ', color: Colors.textMuted },
};

const RESOLUTION_LABELS: Record<string, string> = {
  warning: 'Cảnh cáo',
  fine: 'Phạt tiền',
  suspension: 'Đình chỉ',
  expulsion: 'Buộc thôi học',
  dismissed: 'Bác bỏ',
};

const ViolationCard = React.memo(function ViolationCard({ item }: { item: Violation }) {
  const severity = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.medium;
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const typeLabel = VIOLATION_TYPE_LABELS[item.type] ?? item.type;

  return (
    <View style={styles.card}>
      {/* Severity stripe */}
      <View style={[styles.severityStripe, { backgroundColor: severity.color }]} />

      <View style={styles.cardBody}>
        {/* Header */}
        <View style={styles.cardTop}>
          <View style={[styles.severityBadge, { backgroundColor: severity.bg }]}>
            <Text style={[styles.severityText, { color: severity.color }]}>{severity.label}</Text>
          </View>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>

        {/* Type + date */}
        <View style={styles.metaRow}>
          <View style={styles.typeRow}>
            <Ionicons name="warning-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.typeText}>{typeLabel}</Text>
          </View>
          <Text style={styles.dateText}>{formatRelativeTime(item.reportedAt)}</Text>
        </View>

        {/* Description */}
        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>

        {/* Location */}
        {(item.dormitoryName || item.roomNumber) && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.locationText}>
              {[item.roomNumber && `Phòng ${item.roomNumber}`, item.dormitoryName].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}

        {/* Resolution */}
        {item.status === 'resolved' && item.resolution?.action && (
          <View style={styles.resolutionBox}>
            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
            <Text style={styles.resolutionText}>
              Kết quả: {RESOLUTION_LABELS[item.resolution.action] ?? item.resolution.action}
              {item.resolution.fineAmount ? ` · ${item.resolution.fineAmount.toLocaleString('vi-VN')} VNĐ` : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

function SkeletonCard() {
  return (
    <View style={[styles.card, { flexDirection: 'row' }]}>
      <View style={[styles.severityStripe, { backgroundColor: Colors.skeleton }]} />
      <View style={{ flex: 1, padding: Spacing.sm, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width={70} height={22} radius={11} />
          <Skeleton width={80} height={13} />
        </View>
        <Skeleton height={14} />
        <Skeleton width="70%" height={13} />
      </View>
    </View>
  );
}

export default function ViolationsScreen() {
  const { data: violations, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['violations'],
    queryFn: fetchMyViolations,
    staleTime: 60000,
  });

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader title="Vi phạm" showBack />

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : !violations?.length ? (
        <EmptyState
          iconName="shield-checkmark-outline"
          title="Không có vi phạm"
          subtitle="Bạn không có vi phạm nào được ghi nhận"
        />
      ) : (
        <FlatList
          data={violations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => <ViolationCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.md, paddingBottom: 32 },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  severityStripe: { width: 4, flexShrink: 0 },
  cardBody: { flex: 1, padding: Spacing.sm, gap: 6 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  severityText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  dateText: { fontSize: FontSize.xs, color: Colors.textMuted },

  description: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 19 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: FontSize.xs, color: Colors.textMuted },

  resolutionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.sm,
    padding: 6,
    marginTop: 2,
  },
  resolutionText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.medium, flex: 1 },
});
