import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchRequestDetail,
  MaintenanceUpdate,
  MAINTENANCE_TYPES,
  MAINTENANCE_PRIORITIES,
} from '../../src/api/maintenance';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Timeline, TimelineItem } from '../../src/components/ui/Timeline';
import { Card } from '../../src/components/ui/Card';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { formatDateTime, formatCurrency } from '../../src/utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

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

function buildStatusTimeline(request: any): TimelineItem[] {
  const status = request.status;

  const ORDER = ['submitted', 'assigned', 'in_progress', 'completed'];
  const currentIdx = ORDER.indexOf(status === 'cancelled' ? 'submitted' : status);

  const STEPS = [
    { key: 'submitted', label: 'Đã gửi yêu cầu', icon: 'document-text-outline', timestamp: request.reportedAt },
    { key: 'assigned', label: 'Đã tiếp nhận', icon: 'person-circle-outline', timestamp: request.assignedAt },
    { key: 'in_progress', label: 'Đang xử lý', icon: 'construct-outline', timestamp: request.startedAt },
    { key: 'completed', label: 'Hoàn thành', icon: 'checkmark-circle-outline', timestamp: request.completedAt },
  ];

  if (status === 'cancelled') {
    return STEPS.map((s, i) => ({
      ...s,
      sublabel: i === 0 ? 'Yêu cầu đã bị hủy' : undefined,
      state: (i === 0 ? 'cancelled' : 'pending') as any,
    }));
  }

  return STEPS.map((s, i) => {
    let state: TimelineItem['state'] = 'pending';
    if (i < currentIdx) state = 'done';
    else if (i === currentIdx) state = 'active';

    const sublabels: Record<string, string> = {
      assigned: request.assignedTo?.name ? `Nhân viên: ${request.assignedTo.name}` : 'Đang chờ phân công',
      in_progress: request.estimatedCost ? `Chi phí dự kiến: ${formatCurrency(request.estimatedCost)}` : undefined as any,
      completed: request.completionNotes || 'Đã hoàn thành xử lý',
    };

    return { ...s, state, sublabel: sublabels[s.key] };
  });
}

function InfoRow({ icon, label, value }: { icon: IoniconsName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={14} color={Colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function SkeletonDetail() {
  return (
    <View style={{ gap: Spacing.md, padding: Spacing.md }}>
      <View style={styles.skeletonHeader}>
        <Skeleton width="60%" height={20} />
        <Skeleton width={80} height={26} radius={13} />
      </View>
      <View style={{ gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={40} height={40} radius={20} />
            <View style={{ flex: 1, gap: 6, paddingTop: 9 }}>
              <Skeleton width="45%" height={13} />
              <Skeleton width="65%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: request, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['maintenance', id],
    queryFn: () => fetchRequestDetail(id!),
    enabled: !!id,
    staleTime: 30000,
  });

  const typeInfo = useMemo(() => MAINTENANCE_TYPES.find(t => t.key === request?.type), [request?.type]);
  const statusInfo = STATUS_CONFIG[request?.status ?? 'submitted'];
  const priorityInfo = PRIORITY_CONFIG[request?.priority ?? 'medium'];
  const timeline = useMemo(
    () => (request ? buildStatusTimeline(request) : []),
    [request?.status, request?.assignedAt, request?.startedAt, request?.completedAt]
  );

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader
        title={isLoading ? 'Chi tiết yêu cầu' : (request?.requestNumber ?? 'Chi tiết yêu cầu')}
        showBack
      />

      {isLoading ? (
        <SkeletonDetail />
      ) : !request ? (
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Không tìm thấy yêu cầu</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        >
          {/* Hero: type + status */}
          <View style={[styles.hero, { backgroundColor: statusInfo.bg }]}>
            <View style={[styles.heroIconBox, { backgroundColor: statusInfo.color }]}>
              <Ionicons name={(typeInfo?.icon ?? 'build-outline') as IoniconsName} size={22} color={Colors.textInverse} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroType, { color: statusInfo.color }]}>{typeInfo?.label ?? request.type}</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{request.title}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '22', borderColor: statusInfo.color + '44' }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          {/* Status timeline */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Tiến trình xử lý</Text>
            <Timeline items={timeline} />
          </Card>

          {/* Description */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả sự cố</Text>
            <Text style={styles.description}>{request.description}</Text>
          </Card>

          {/* Request details */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin yêu cầu</Text>
            <InfoRow icon="location-outline" label="Vị trí" value={`Phòng ${request.roomNumber} · Tầng ${request.floorNumber} · ${request.dormitoryName}`} />
            <InfoRow icon="flag-outline" label="Độ ưu tiên" value={priorityInfo.label} />
            <InfoRow icon="calendar-outline" label="Gửi lúc" value={formatDateTime(request.reportedAt)} />
            {request.assignedTo?.name && (
              <InfoRow icon="person-outline" label="Nhân viên xử lý" value={request.assignedTo.name} />
            )}
            {request.assignedTo?.phone && (
              <InfoRow icon="call-outline" label="SĐT nhân viên" value={request.assignedTo.phone} />
            )}
            {request.estimatedCost != null && (
              <InfoRow icon="cash-outline" label="Chi phí dự kiến" value={formatCurrency(request.estimatedCost)} />
            )}
            {request.actualCost != null && (
              <InfoRow icon="receipt-outline" label="Chi phí thực tế" value={formatCurrency(request.actualCost)} />
            )}
          </Card>

          {/* Completion notes */}
          {request.status === 'completed' && request.completionNotes && (
            <View style={styles.completionBox}>
              <View style={styles.completionHeader}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.completionTitle}>Ghi chú hoàn thành</Text>
              </View>
              <Text style={styles.completionNotes}>{request.completionNotes}</Text>
            </View>
          )}

          {/* Staff updates */}
          {(request.updates?.length ?? 0) > 0 && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Cập nhật từ nhân viên</Text>
              {request.updates!.map((u: MaintenanceUpdate, i: number) => (
                <View key={i} style={[styles.update, i < request.updates!.length - 1 && styles.updateBorder]}>
                  <View style={styles.updateHeader}>
                    <View style={styles.updateAvatar}>
                      <Text style={styles.updateAvatarText}>{u.addedBy?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
                    </View>
                    <View>
                      <Text style={styles.updateName}>{u.addedBy?.name ?? 'Nhân viên'}</Text>
                      <Text style={styles.updateTime}>{formatDateTime(u.addedAt)}</Text>
                    </View>
                  </View>
                  <Text style={styles.updateMessage}>{u.message}</Text>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  notFoundText: { fontSize: FontSize.base, color: Colors.textSecondary },

  skeletonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },

  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroInfo: { flex: 1 },
  heroType: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginTop: 2, lineHeight: 20 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },

  description: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 21 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium, maxWidth: '55%', textAlign: 'right' },

  completionBox: {
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    gap: Spacing.sm,
  },
  completionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.success },
  completionNotes: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },

  update: { paddingVertical: Spacing.sm, gap: Spacing.sm },
  updateBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  updateHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  updateAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse },
  updateName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  updateTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  updateMessage: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 19 },
});
