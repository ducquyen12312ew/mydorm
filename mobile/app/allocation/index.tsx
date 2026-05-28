import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchDashboard, DashboardData } from '../../src/api/dashboard';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Timeline, TimelineItem } from '../../src/components/ui/Timeline';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { formatDate, formatDateTime } from '../../src/utils/format';

function buildTimeline(dashboard: DashboardData): TimelineItem[] {
  const { application, assignment } = dashboard;
  const appStatus = application?.status;
  const hasAssignment = assignment?.status === 'assigned';

  const submitted: TimelineItem = application
    ? { key: 'submit', label: 'Nộp đơn', sublabel: 'Đã ghi nhận', state: 'done', timestamp: application.submittedAt, icon: 'document-text-outline' }
    : { key: 'submit', label: 'Nộp đơn', sublabel: 'Chưa có đơn đăng ký', state: 'pending', icon: 'document-text-outline' };

  let review: TimelineItem;
  if (!application) {
    review = { key: 'review', label: 'Xét duyệt', sublabel: 'Chờ nộp đơn', state: 'pending', icon: 'search-outline' };
  } else if (appStatus === 'pending') {
    review = { key: 'review', label: 'Xét duyệt', sublabel: 'Đơn đang chờ xét duyệt', state: 'active', icon: 'hourglass-outline' };
  } else if (appStatus === 'rejected') {
    review = { key: 'review', label: 'Xét duyệt', sublabel: 'Đơn bị từ chối', state: 'error', timestamp: application.updatedAt, icon: 'close-circle-outline' };
  } else {
    review = { key: 'review', label: 'Xét duyệt', sublabel: 'Đơn đã được phê duyệt', state: 'done', timestamp: application.updatedAt, icon: 'checkmark-circle-outline' };
  }

  let queue: TimelineItem;
  if (!application || appStatus === 'pending') {
    queue = { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Chờ phê duyệt đơn', state: 'pending', icon: 'list-outline' };
  } else if (appStatus === 'rejected') {
    queue = { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Không áp dụng', state: 'cancelled', icon: 'remove-circle-outline' };
  } else if (appStatus === 'waitlist') {
    queue = { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Đang trong danh sách chờ', state: 'active', icon: 'time-outline' };
  } else {
    queue = { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Đã qua vòng xét', state: 'done', icon: 'checkmark-circle-outline' };
  }

  const assign: TimelineItem = hasAssignment
    ? { key: 'assign', label: 'Xếp phòng', sublabel: `Phòng ${assignment.roomNumber} · ${assignment.dormitoryName}`, state: 'done', timestamp: assignment.updatedAt, icon: 'home' }
    : { key: 'assign', label: 'Xếp phòng', sublabel: assignment?.status === 'pending' ? 'Đang chờ xếp phòng' : 'Chưa được xếp', state: 'pending', icon: 'home-outline' };

  return [submitted, review, queue, assign];
}

function SkeletonContent() {
  return (
    <View style={{ gap: 20 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 6, paddingTop: 9 }}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="70%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AllocationScreen() {
  const { data: dashboard, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });

  const steps = dashboard ? buildTimeline(dashboard) : [];
  const profile = dashboard?.profile;
  const assignment = dashboard?.assignment;
  const cycle = dashboard?.cycle;

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader title="Tiến trình xếp phòng" showBack />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {/* Score + cycle card */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroScoreLabel}>Điểm ưu tiên</Text>
            <Text style={styles.heroScore}>{isLoading ? '—' : (profile?.priorityScore ?? 0)}</Text>
            <Text style={styles.heroHint}>Điểm cao hơn → ưu tiên xếp phòng tốt hơn</Text>
          </View>
          {cycle && (
            <View style={styles.cycleBox}>
              <Text style={styles.cycleMeta}>ĐỢT HIỆN TẠI</Text>
              <Text style={styles.cycleName} numberOfLines={2}>{cycle.name}</Text>
              <Text style={styles.cycleDate}>Kết thúc {formatDate(cycle.registrationEnd)}</Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch trình xét duyệt</Text>
          {isLoading ? <SkeletonContent /> : <Timeline items={steps} />}
        </View>

        {/* Assigned room highlight */}
        {assignment?.status === 'assigned' && (
          <View style={styles.assignedCard}>
            <View style={styles.assignedIcon}>
              <Ionicons name="home" size={26} color={Colors.textInverse} />
            </View>
            <View style={styles.assignedInfo}>
              <Text style={styles.assignedLabel}>Phòng của bạn</Text>
              <Text style={styles.assignedRoom}>Phòng {assignment.roomNumber}</Text>
              <Text style={styles.assignedDorm}>{assignment.dormitoryName}</Text>
            </View>
            <View style={[styles.assignedPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.textInverse} />
              <Text style={styles.assignedPillText}>Đã xếp</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },

  heroCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  heroLeft: { flex: 1 },
  heroScoreLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },
  heroScore: { fontSize: 44, fontWeight: FontWeight.extrabold, color: Colors.textInverse, lineHeight: 52 },
  heroHint: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', lineHeight: 16, marginTop: 2 },

  cycleBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    justifyContent: 'center',
  },
  cycleMeta: { fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', fontWeight: FontWeight.bold },
  cycleName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse, marginTop: 3, lineHeight: 18 },
  cycleDate: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },

  assignedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  assignedIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  assignedInfo: { flex: 1 },
  assignedLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },
  assignedRoom: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse, marginTop: 2 },
  assignedDorm: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  assignedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  assignedPillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textInverse },
});
