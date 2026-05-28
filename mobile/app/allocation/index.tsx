import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchDashboard, DashboardData } from '../../src/api/dashboard';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { formatDateTime, formatDate } from '../../src/utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type StepState = 'done' | 'active' | 'error' | 'pending';

interface TimelineStep {
  key: string;
  label: string;
  sublabel?: string;
  state: StepState;
  timestamp?: string;
  icon: IoniconsName;
}

const STATE_COLOR: Record<StepState, string> = {
  done: Colors.success,
  active: Colors.primary,
  error: Colors.error,
  pending: Colors.border,
};

const STATE_BG: Record<StepState, string> = {
  done: Colors.successLight,
  active: Colors.primaryLight,
  error: Colors.errorLight,
  pending: Colors.surfaceAlt,
};

function buildTimeline(dashboard: DashboardData): TimelineStep[] {
  const { application, assignment, cycle } = dashboard;
  const appStatus = application?.status;
  const hasAssignment = assignment?.status === 'assigned';

  function step1(): TimelineStep {
    if (!application) return { key: 'submit', label: 'Nộp đơn', sublabel: 'Chưa có đơn đăng ký', state: 'pending', icon: 'document-text-outline' };
    return {
      key: 'submit',
      label: 'Nộp đơn',
      sublabel: 'Đã ghi nhận hệ thống',
      state: 'done',
      timestamp: application.submittedAt,
      icon: 'document-text-outline',
    };
  }

  function step2(): TimelineStep {
    if (!application) return { key: 'review', label: 'Xét duyệt', sublabel: 'Chờ nộp đơn', state: 'pending', icon: 'search-outline' };
    if (appStatus === 'pending') return { key: 'review', label: 'Xét duyệt', sublabel: 'Đơn đang chờ xét duyệt', state: 'active', icon: 'hourglass-outline' };
    if (appStatus === 'rejected') return { key: 'review', label: 'Xét duyệt', sublabel: 'Đơn bị từ chối', state: 'error', timestamp: application.updatedAt, icon: 'close-circle-outline' };
    return { key: 'review', label: 'Xét duyệt', sublabel: 'Đơn đã được phê duyệt', state: 'done', timestamp: application.updatedAt, icon: 'checkmark-circle-outline' };
  }

  function step3(): TimelineStep {
    if (!application || appStatus === 'pending') return { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Chờ phê duyệt đơn', state: 'pending', icon: 'list-outline' };
    if (appStatus === 'rejected') return { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Không vào hàng chờ', state: 'error', icon: 'close-circle-outline' };
    if (appStatus === 'waitlist') return { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Bạn đang trong danh sách chờ', state: 'active', icon: 'time-outline' };
    if (hasAssignment || appStatus === 'assigned' || appStatus === 'approved') {
      return { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Đã qua vòng xét hàng chờ', state: 'done', icon: 'checkmark-circle-outline' };
    }
    return { key: 'queue', label: 'Hàng chờ xếp phòng', sublabel: 'Đang xét duyệt', state: 'active', icon: 'hourglass-outline' };
  }

  function step4(): TimelineStep {
    if (!hasAssignment) {
      return { key: 'assign', label: 'Xếp phòng', sublabel: assignment?.status === 'pending' ? 'Đang chờ xếp phòng' : 'Chưa được xếp phòng', state: 'pending', icon: 'home-outline' };
    }
    return {
      key: 'assign',
      label: 'Xếp phòng',
      sublabel: `Phòng ${assignment.roomNumber} · ${assignment.dormitoryName}`,
      state: 'done',
      timestamp: assignment.updatedAt,
      icon: 'home',
    };
  }

  return [step1(), step2(), step3(), step4()];
}

function TimelineNode({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const color = STATE_COLOR[step.state];
  const bg = STATE_BG[step.state];

  return (
    <View style={styles.stepRow}>
      {/* Left column: icon + connector */}
      <View style={styles.stepLeft}>
        <View style={[styles.stepCircle, { backgroundColor: bg, borderColor: color }]}>
          <Ionicons
            name={step.icon}
            size={18}
            color={color}
          />
        </View>
        {!isLast && <View style={[styles.connector, { backgroundColor: step.state === 'done' ? Colors.success : Colors.border }]} />}
      </View>

      {/* Right column: content */}
      <View style={[styles.stepContent, !isLast && { paddingBottom: Spacing.lg }]}>
        <View style={styles.stepHeader}>
          <Text style={[styles.stepLabel, step.state === 'active' && styles.stepLabelActive]}>
            {step.label}
          </Text>
          {step.state === 'active' && (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Hiện tại</Text>
            </View>
          )}
          {step.state === 'error' && (
            <View style={[styles.activePill, { backgroundColor: Colors.errorLight }]}>
              <Text style={[styles.activePillText, { color: Colors.error }]}>Từ chối</Text>
            </View>
          )}
        </View>
        <Text style={[styles.stepSub, step.state === 'active' && { color: Colors.primary }]}>
          {step.sublabel}
        </Text>
        {step.timestamp && (
          <Text style={styles.stepTime}>{formatDateTime(step.timestamp)}</Text>
        )}
      </View>
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={styles.skeletonPad}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepLeft}>
            <Skeleton width={44} height={44} radius={22} />
            {i < 4 && <Skeleton width={2} height={48} style={{ marginTop: 4 }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: Spacing.lg, gap: 6 }}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="70%" height={13} />
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

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader title="Tiến trình xếp phòng" showBack />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
      >
        {/* Summary card */}
        {dashboard && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle}>Điểm ưu tiên</Text>
              <Text style={styles.summaryScore}>{dashboard.profile.priorityScore ?? 0}</Text>
              <Text style={styles.summaryHint}>Điểm cao hơn → xếp phòng ưu tiên hơn</Text>
            </View>
            {dashboard.cycle && (
              <View style={styles.summaryRight}>
                <Text style={styles.cycleLabel}>Đợt hiện tại</Text>
                <Text style={styles.cycleName} numberOfLines={2}>{dashboard.cycle.name}</Text>
                <Text style={styles.cycleDate}>
                  Kết thúc: {formatDate(dashboard.cycle.registrationEnd)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Lịch trình xét duyệt</Text>
          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <View style={styles.timeline}>
              {steps.map((step, i) => (
                <TimelineNode key={step.key} step={step} isLast={i === steps.length - 1} />
              ))}
            </View>
          )}
        </View>

        {/* Room info if assigned */}
        {dashboard?.assignment.status === 'assigned' && (
          <View style={styles.assignedCard}>
            <View style={styles.assignedIcon}>
              <Ionicons name="home" size={28} color={Colors.textInverse} />
            </View>
            <View style={styles.assignedInfo}>
              <Text style={styles.assignedTitle}>Phòng của bạn</Text>
              <Text style={styles.assignedRoom}>
                Phòng {dashboard.assignment.roomNumber}
              </Text>
              <Text style={styles.assignedDorm}>{dashboard.assignment.dormitoryName}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },
  skeletonPad: { padding: Spacing.md },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  summaryLeft: { flex: 1 },
  summaryTitle: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FontWeight.medium },
  summaryScore: { fontSize: 40, fontWeight: FontWeight.extrabold, color: Colors.textInverse, lineHeight: 48 },
  summaryHint: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', lineHeight: 16, marginTop: 2 },
  summaryRight: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    justifyContent: 'center',
  },
  cycleLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)' },
  cycleName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textInverse, marginTop: 2, lineHeight: 18 },
  cycleDate: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  timelineTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  timeline: {},

  stepRow: { flexDirection: 'row', gap: Spacing.sm },
  stepLeft: { alignItems: 'center', width: 44 },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  connector: { width: 2, flex: 1, minHeight: 20, marginVertical: 4 },
  stepContent: { flex: 1, paddingTop: 10 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  stepLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  stepLabelActive: { color: Colors.primary },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  activePillText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.primary },
  stepSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  stepTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 },

  assignedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  assignedIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  assignedInfo: { flex: 1 },
  assignedTitle: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  assignedRoom: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.success, marginTop: 2 },
  assignedDorm: { fontSize: FontSize.sm, color: Colors.success, opacity: 0.8, marginTop: 1 },
});
