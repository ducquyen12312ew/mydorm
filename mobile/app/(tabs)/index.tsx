import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchDashboard, DashboardData } from '../../src/api/dashboard';
import { fetchRegistrationAvailability } from '../../src/api/registration';
import { useAuthStore } from '../../src/store/authStore';
import { emitRefresh } from '../../src/realtime/socket';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { SkeletonDashboard } from '../../src/components/ui/Skeleton';
import { SafeLayout } from '../../src/components/SafeLayout';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';
import { formatDate, formatDateTime, statusLabel } from '../../src/utils/format';

function SectionRow({ label, value, icon }: { label: string; value: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionRowLeft}>
        {icon && <Ionicons name={icon} size={14} color={Colors.textMuted} style={styles.rowIcon} />}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

function QuickStatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.quickStat, { borderTopColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.quickStatValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

function DashboardContent({ dashboard, onRefresh, refreshing, availability }: {
  dashboard: DashboardData;
  onRefresh: () => void;
  refreshing: boolean;
  availability: any;
}) {
  const router = useRouter();
  const { profile, application, assignment, cycle, notifications: notifStats } = dashboard;

  const academicYearLabel = profile.academicYear ? `Năm ${profile.academicYear}` : '—';

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileLeft}>
          <Text style={styles.greeting}>Xin chào 👋</Text>
          <Text style={styles.profileName} numberOfLines={2}>{profile.name}</Text>
          <Text style={styles.profileMeta}>MSSV: {profile.studentId || '—'} · {academicYearLabel}</Text>
        </View>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{profile.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
      </View>

      {/* Quick stats row */}
      <View style={styles.quickStatsRow}>
        <QuickStatCard
          icon="school-outline"
          label="Điểm ưu tiên"
          value={String(profile.priorityScore ?? 0)}
          color={Colors.info}
        />
        <QuickStatCard
          icon="home-outline"
          label="Phòng"
          value={assignment.status === 'assigned' ? (assignment.roomNumber ?? '—') : 'Chưa xếp'}
          color={assignment.status === 'assigned' ? Colors.success : Colors.warning}
        />
        <QuickStatCard
          icon="notifications-outline"
          label="Thông báo"
          value={notifStats.unreadCount > 0 ? `${notifStats.unreadCount} mới` : 'Đã đọc'}
          color={notifStats.unreadCount > 0 ? Colors.primary : Colors.textMuted}
        />
      </View>

      {/* Registration open banner */}
      {availability?.openForRegistration && (
        <TouchableOpacity
          style={styles.registrationBanner}
          onPress={() => { haptic.light(); router.push('/(tabs)/rooms'); }}
          activeOpacity={0.85}
        >
          <View style={styles.bannerIconBox}>
            <Ionicons name="document-text" size={22} color={Colors.textInverse} />
          </View>
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTitle}>Đang mở đăng ký phòng</Text>
            <Text style={styles.bannerSub}>Hạn nộp: {formatDate(availability.window?.endDate)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.success} />
        </TouchableOpacity>
      )}

      {/* Room assignment */}
      <Card style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardIconBox, { backgroundColor: assignment.status === 'assigned' ? Colors.successLight : Colors.warningLight }]}>
            <Ionicons
              name={assignment.status === 'assigned' ? 'home' : 'home-outline'}
              size={18}
              color={assignment.status === 'assigned' ? Colors.success : Colors.warning}
            />
          </View>
          <Text style={styles.cardTitle}>Phòng ở</Text>
          <Badge status={assignment.status === 'assigned' ? 'approved' : 'pending'} label={assignment.status === 'assigned' ? 'Đã xếp' : 'Chờ xếp'} />
        </View>
        {assignment.status === 'assigned' ? (
          <>
            <SectionRow label="Số phòng" value={assignment.roomNumber ?? '—'} icon="grid-outline" />
            <SectionRow label="Khu ký túc xá" value={assignment.dormitoryName ?? '—'} icon="business-outline" />
            <SectionRow label="Cập nhật lúc" value={formatDateTime(assignment.updatedAt)} icon="time-outline" />
          </>
        ) : (
          <View style={styles.emptyInfo}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.emptyInfoText}>Chưa có phòng được xếp cho bạn</Text>
          </View>
        )}
      </Card>

      {/* Application status */}
      <Card style={styles.infoCard}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardIconBox, { backgroundColor: Colors.infoLight }]}>
            <Ionicons name="document-text-outline" size={18} color={Colors.info} />
          </View>
          <Text style={styles.cardTitle}>Đơn đăng ký</Text>
          {application && <Badge status={application.status} />}
        </View>
        {application ? (
          <>
            <SectionRow label="Trạng thái" value={statusLabel(application.status)} icon="flag-outline" />
            <SectionRow label="Điểm ưu tiên" value={String(application.priorityScore ?? 0)} icon="star-outline" />
            <SectionRow label="Nộp lúc" value={formatDateTime(application.submittedAt)} icon="calendar-outline" />
          </>
        ) : (
          <View style={styles.emptyInfo}>
            <Ionicons name="document-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.emptyInfoText}>Chưa có đơn đăng ký nào</Text>
          </View>
        )}
      </Card>

      {/* Cycle info */}
      {cycle && (
        <Card style={styles.infoCard}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIconBox, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Đợt xét duyệt</Text>
            <Badge status="active" label={cycle.status} />
          </View>
          <SectionRow label="Tên đợt" value={cycle.name} icon="bookmark-outline" />
          <SectionRow label="Bắt đầu" value={formatDate(cycle.registrationStart)} icon="play-outline" />
          <SectionRow label="Kết thúc" value={formatDate(cycle.registrationEnd)} icon="stop-outline" />
        </Card>
      )}

      {/* Notifications shortcut */}
      {notifStats.unreadCount > 0 && (
        <TouchableOpacity
          onPress={() => { haptic.light(); router.push('/(tabs)/notifications'); }}
          activeOpacity={0.85}
        >
          <View style={styles.notifShortcut}>
            <View style={styles.notifDot} />
            <Text style={styles.notifShortcutText}>
              {notifStats.unreadCount} thông báo chưa đọc
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });

  const { data: availability } = useQuery({
    queryKey: ['registration', 'availability'],
    queryFn: fetchRegistrationAvailability,
    staleTime: 60000,
  });

  const handleRefresh = useCallback(() => {
    refetch();
    emitRefresh();
  }, [refetch]);

  if (isLoading) {
    return (
      <SafeLayout edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerBarTitle}>Tổng quan</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonDashboard />
        </ScrollView>
      </SafeLayout>
    );
  }

  if (isError || !dashboard) {
    return (
      <SafeLayout edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerBarTitle}>Tổng quan</Text>
        </View>
        <View style={styles.errorScreen}>
          <Ionicons name="wifi-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
          <Text style={styles.errorSub}>Kiểm tra kết nối và thử lại</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { haptic.light(); refetch(); }}>
            <Ionicons name="refresh-outline" size={16} color={Colors.textInverse} />
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerBarTitle}>Tổng quan</Text>
        <TouchableOpacity onPress={() => { haptic.light(); handleRefresh(); }} hitSlop={10}>
          <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <DashboardContent
        dashboard={dashboard}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        availability={availability}
      />
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBarTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },

  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  profileLeft: { flex: 1, gap: 3 },
  greeting: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },
  profileName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse, lineHeight: 26 },
  profileMeta: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  avatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textInverse },

  quickStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickStat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  quickStatValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, textAlign: 'center' },
  quickStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  registrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success },
  bannerSub: { fontSize: FontSize.xs, color: Colors.success, opacity: 0.8, marginTop: 1 },

  infoCard: { gap: Spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { marginRight: 6 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  rowValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium, maxWidth: '55%', textAlign: 'right' },

  emptyInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  emptyInfoText: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },

  notifShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  notifShortcutText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  errorScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  errorTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  errorSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  retryText: { color: Colors.textInverse, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
});
