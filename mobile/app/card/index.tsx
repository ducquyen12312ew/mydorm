import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchDashboard } from '../../src/api/dashboard';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';

// Lazy import QRCode — graceful fallback if package not yet installed
let QRCode: React.ComponentType<{ value: string; size: number; color: string; backgroundColor: string }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QRCode = require('react-native-qrcode-svg').default;
} catch (_) {
  QRCode = null;
}

function QRPlaceholder({ size }: { size: number }) {
  return (
    <View style={[styles.qrPlaceholder, { width: size, height: size }]}>
      <Ionicons name="qr-code-outline" size={size * 0.5} color={Colors.border} />
      <Text style={styles.qrPlaceholderText}>QR Code</Text>
    </View>
  );
}

export default function ResidentCardScreen() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });

  const profile = dashboard?.profile;
  const assignment = dashboard?.assignment;

  const qrValue = useMemo(() => {
    if (!profile) return '';
    return JSON.stringify({
      studentId: profile.studentId || '',
      name: profile.name || '',
      room: assignment?.status === 'assigned' ? (assignment.roomNumber || '') : '',
      dorm: assignment?.status === 'assigned' ? (assignment.dormitoryName || '') : '',
      ts: Math.floor(Date.now() / 1000),
    });
  }, [profile, assignment]);

  const handleShare = async () => {
    haptic.light();
    try {
      await Share.share({
        message: profile
          ? `HUST KTX - ${profile.name} (${profile.studentId})${assignment?.status === 'assigned' ? ` - Phòng ${assignment.roomNumber}` : ''}`
          : 'HUST Dormitory Card',
        title: 'Thẻ cư trú KTX HUST',
      });
    } catch (_) {}
  };

  return (
    <SafeLayout edges={['top', 'bottom']}>
      <ScreenHeader title="Thẻ cư trú" showBack right={
        <TouchableOpacity onPress={handleShare} hitSlop={10}>
          <Ionicons name="share-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      } />

      <View style={styles.container}>
        {/* Card */}
        <View style={styles.card}>
          {/* Header stripe */}
          <View style={styles.cardHeader}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>HUST</Text>
            </View>
            <View>
              <Text style={styles.cardTitle}>KÝ TÚC XÁ</Text>
              <Text style={styles.cardSubtitle}>Hanoi University of Science and Technology</Text>
            </View>
          </View>

          {/* QR Code section */}
          <View style={styles.qrSection}>
            {isLoading ? (
              <Skeleton width={180} height={180} radius={Radius.md} />
            ) : QRCode && qrValue ? (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrValue}
                  size={180}
                  color={Colors.text}
                  backgroundColor={Colors.surface}
                />
              </View>
            ) : (
              <QRPlaceholder size={180} />
            )}
          </View>

          {/* Student info */}
          <View style={styles.infoSection}>
            {isLoading ? (
              <View style={{ gap: 10, alignItems: 'center' }}>
                <Skeleton width={180} height={22} />
                <Skeleton width={120} height={16} />
                <Skeleton width={200} height={14} />
              </View>
            ) : (
              <>
                <Text style={styles.studentName}>{profile?.name ?? '—'}</Text>
                <Text style={styles.studentId}>MSSV: {profile?.studentId ?? '—'}</Text>
                {profile?.faculty ? <Text style={styles.studentFaculty}>{profile.faculty}</Text> : null}
              </>
            )}
          </View>

          {/* Room info */}
          <View style={styles.roomSection}>
            {assignment?.status === 'assigned' ? (
              <>
                <View style={styles.roomRow}>
                  <View style={styles.roomItem}>
                    <Text style={styles.roomItemLabel}>PHÒNG</Text>
                    <Text style={styles.roomItemValue}>{assignment.roomNumber ?? '—'}</Text>
                  </View>
                  <View style={styles.roomDivider} />
                  <View style={styles.roomItem}>
                    <Text style={styles.roomItemLabel}>KHU</Text>
                    <Text style={styles.roomItemValue} numberOfLines={2}>{assignment.dormitoryName ?? '—'}</Text>
                  </View>
                </View>
                <View style={[styles.statusPill, { backgroundColor: Colors.successLight }]}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Đang cư trú</Text>
                </View>
              </>
            ) : (
              <View style={[styles.statusPill, { backgroundColor: Colors.warningLight }]}>
                <View style={[styles.statusDot, { backgroundColor: Colors.warning }]} />
                <Text style={[styles.statusText, { color: Colors.warning }]}>Chưa được xếp phòng</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>Xuất trình thẻ khi ra/vào ký túc xá</Text>
          </View>
        </View>

        {/* Hint */}
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
          <Text style={styles.hintText}>
            Mã QR chứa thông tin định danh của bạn. Bảo quản thẻ cẩn thận.
          </Text>
        </View>
      </View>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },

  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.md,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, color: Colors.textInverse },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textInverse },
  cardSubtitle: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  qrSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  qrWrapper: {
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrPlaceholder: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrPlaceholderText: { fontSize: FontSize.xs, color: Colors.textMuted },

  infoSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  studentName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  studentId: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  studentFaculty: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  roomSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  roomRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  roomItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  roomItemLabel: { fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted, fontWeight: FontWeight.bold },
  roomItemValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginTop: 2, textAlign: 'center' },
  roomDivider: { width: 1, backgroundColor: Colors.border, alignSelf: 'stretch' },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.success },

  cardFooter: {
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cardFooterText: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  hintText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 17 },
});
