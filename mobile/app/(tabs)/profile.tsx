import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
  Clipboard,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { fetchProfile } from '../../src/api/dashboard';
import { fetchRegistrationAvailability, applyForRoom } from '../../src/api/registration';
import { fetchRoommates } from '../../src/api/violations';
import { SafeLayout } from '../../src/components/SafeLayout';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function ProfileRow({ label, value, icon }: { label: string; value: string; icon?: IoniconsName }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon ? <Ionicons name={icon} size={14} color={Colors.textMuted} style={styles.rowIcon} /> : null}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger = false,
  description,
}: {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  description?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuItem} activeOpacity={0.75}>
      <View style={[styles.menuIconBox, { backgroundColor: danger ? Colors.errorLight : Colors.primaryLight }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {description ? <Text style={styles.menuDesc}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [applyLoading, setApplyLoading] = useState(false);

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    staleTime: 60000,
  });

  const { data: availability } = useQuery({
    queryKey: ['registration', 'availability'],
    queryFn: fetchRegistrationAvailability,
    staleTime: 60000,
  });

  const { data: roommatesData } = useQuery({
    queryKey: ['roommates'],
    queryFn: fetchRoommates,
    staleTime: 120000,
    enabled: !!profile?.roomNumber,
  });

  const handleLogout = () => {
    haptic.warning();
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          haptic.medium();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleApply = () => {
    haptic.medium();
    Alert.alert(
      'Đăng ký phòng',
      'Hệ thống sẽ tự động xếp phòng phù hợp nhất còn trống cho bạn. Xác nhận tiếp tục?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng ký',
          onPress: async () => {
            setApplyLoading(true);
            try {
              const result = await applyForRoom();
              if (result.success) {
                haptic.success();
                Alert.alert('Đăng ký thành công 🎉', result.message || 'Phòng đã được xếp cho bạn');
                refetch();
              } else {
                haptic.error();
                Alert.alert('Không thể đăng ký', result.message || 'Vui lòng thử lại sau');
              }
            } catch (err: any) {
              haptic.error();
              Alert.alert('Lỗi', err?.response?.data?.error || 'Đã xảy ra lỗi');
            } finally {
              setApplyLoading(false);
            }
          },
        },
      ]
    );
  };

  const displayProfile = profile ?? {
    name: user?.name ?? '',
    studentId: user?.studentId ?? '',
    email: '',
    phone: '',
    gender: '',
    faculty: '',
    academicYear: '',
    priorityScore: 0,
  };

  const genderLabel = displayProfile.gender === 'male' ? 'Nam' : displayProfile.gender === 'female' ? 'Nữ' : displayProfile.gender;

  return (
    <SafeLayout edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
        }
      >
        {/* Profile hero */}
        <View style={styles.hero}>
          <View style={styles.heroAvatar}>
            {isLoading ? (
              <Skeleton width={72} height={72} radius={36} />
            ) : (
              <Text style={styles.heroAvatarText}>
                {displayProfile.name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>

          {isLoading ? (
            <View style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Skeleton width={160} height={20} />
              <Skeleton width={100} height={14} />
            </View>
          ) : (
            <>
              <Text style={styles.heroName}>{displayProfile.name}</Text>
              <Text style={styles.heroId}>MSSV: {displayProfile.studentId || '—'}</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBadge}>
                  <Ionicons name="star" size={14} color={Colors.warning} />
                  <Text style={styles.scoreValue}>{displayProfile.priorityScore ?? 0}</Text>
                  <Text style={styles.scoreLabel}>điểm ưu tiên</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Registration open */}
        {availability?.openForRegistration && (
          <View style={styles.registrationCard}>
            <View style={styles.registrationCardHeader}>
              <Ionicons name="home" size={20} color={Colors.primary} />
              <Text style={styles.registrationTitle}>Mở đăng ký phòng</Text>
            </View>
            <Text style={styles.registrationDesc}>
              Hiện có đợt đăng ký đang mở. Hệ thống sẽ xếp phòng tự động cho bạn.
            </Text>
            <Button
              label={applyLoading ? 'Đang xử lý...' : 'Đăng ký phòng ngay'}
              onPress={handleApply}
              loading={applyLoading}
              fullWidth
              size="md"
              style={styles.applyBtn}
            />
          </View>
        )}

        {/* Personal info */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
          </View>
          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Skeleton width="30%" height={13} />
                  <Skeleton width="45%" height={13} />
                </View>
              ))}
            </View>
          ) : (
            <>
              <ProfileRow label="Họ và tên" value={displayProfile.name} icon="person-outline" />
              <ProfileRow label="Email" value={displayProfile.email} icon="mail-outline" />
              <ProfileRow label="Số điện thoại" value={displayProfile.phone} icon="call-outline" />
              <ProfileRow label="Giới tính" value={genderLabel} icon="people-outline" />
            </>
          )}
        </Card>

        {/* Academic info */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="school-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Thông tin học tập</Text>
          </View>
          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Skeleton width="30%" height={13} />
                  <Skeleton width="45%" height={13} />
                </View>
              ))}
            </View>
          ) : (
            <>
              <ProfileRow label="Khoa / Viện" value={displayProfile.faculty} icon="business-outline" />
              <ProfileRow
                label="Năm học"
                value={displayProfile.academicYear ? `Năm ${displayProfile.academicYear}` : '—'}
                icon="calendar-outline"
              />
              <ProfileRow label="MSSV" value={displayProfile.studentId} icon="card-outline" />
            </>
          )}
        </Card>

        {/* Roommates */}
        {(roommatesData?.roommates?.length ?? 0) > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people-outline" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Bạn cùng phòng</Text>
            </View>
            {roommatesData!.roommates.map((rm, i) => (
              <View
                key={rm.studentId || i}
                style={[styles.row, i === roommatesData!.roommates.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.roommateAvatar}>
                  <Text style={styles.roommateAvatarText}>
                    {rm.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roommateName}>{rm.name}</Text>
                  {rm.studentId ? (
                    <Text style={styles.roommateId}>MSSV: {rm.studentId}</Text>
                  ) : null}
                </View>
                {rm.phone ? (
                  <View style={styles.roommateActions}>
                    <TouchableOpacity
                      style={styles.roommateActionBtn}
                      onPress={() => { haptic.light(); Linking.openURL(`tel:${rm.phone}`); }}
                      hitSlop={8}
                    >
                      <Ionicons name="call-outline" size={16} color={Colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.roommateActionBtn}
                      onPress={() => { haptic.selection(); Clipboard.setString(rm.phone!); Alert.alert('Đã sao chép', rm.phone!); }}
                      hitSlop={8}
                    >
                      <Ionicons name="copy-outline" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        )}

        {/* Actions */}
        <Card style={styles.section} padding={false}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Tùy chọn</Text>
          </View>
          <MenuItem
            icon="heart-outline"
            label="Phòng yêu thích"
            description="Xem các phòng đã lưu"
            onPress={() => { haptic.light(); router.push('/(tabs)/rooms'); }}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="construct-outline"
            label="Yêu cầu bảo trì"
            description="Báo cáo sự cố phòng ở"
            onPress={() => { haptic.light(); router.push('/maintenance'); }}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="warning-outline"
            label="Vi phạm"
            description="Xem lịch sử vi phạm của bạn"
            onPress={() => { haptic.light(); router.push('/violations'); }}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="log-out-outline"
            label="Đăng xuất"
            danger
            onPress={handleLogout}
          />
        </Card>
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },

  hero: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadow.sm,
  },
  heroAvatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textInverse },
  heroName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  heroId: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  scoreRow: { flexDirection: 'row' },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  scoreValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.warning },
  scoreLabel: { fontSize: FontSize.xs, color: Colors.warning },

  registrationCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    gap: Spacing.sm,
  },
  registrationCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  registrationTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  registrationDesc: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 18 },
  applyBtn: { marginTop: 2 },

  section: { gap: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { marginRight: 8 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  rowValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium, maxWidth: '55%', textAlign: 'right' },

  roommateAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  roommateAvatarText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textInverse },
  roommateName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  roommateId: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  roommatePhone: { fontSize: FontSize.xs, color: Colors.textMuted },
  roommateActions: { flexDirection: 'row', gap: 4 },
  roommateActionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  menuLabelDanger: { color: Colors.error },
  menuDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
});
