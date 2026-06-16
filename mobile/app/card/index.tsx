import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchDashboard } from '../../src/api/dashboard';
import { generateQRToken } from '../../src/api/qr';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';

// Lazy-load QRCode — graceful fallback when react-native-qrcode-svg not yet installed
let QRCode: React.ComponentType<{ value: string; size: number; color: string; backgroundColor: string }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QRCode = require('react-native-qrcode-svg').default;
} catch (_) {
  QRCode = null;
}

const QR_SIZE = 200;

function QRPlaceholder() {
  return (
    <View style={[styles.qrWrapper, { alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="qr-code-outline" size={QR_SIZE * 0.45} color={Colors.border} />
      <Text style={styles.qrInstallHint}>Cài react-native-qrcode-svg</Text>
    </View>
  );
}

export default function ResidentCardScreen() {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30000,
  });

  // Backend-signed QR token: 24-hour validity, rotates on every mount
  const { data: qrData, isLoading: qrLoading, error: qrError, refetch: refreshQR } = useQuery({
    queryKey: ['qr-token'],
    queryFn: generateQRToken,
    staleTime: 20 * 60 * 1000,   // refresh automatically after 20min
    gcTime: 25 * 60 * 1000,
    retry: 2,
    enabled: !dashLoading,
  });

  const profile = dashboard?.profile;
  const assignment = dashboard?.assignment;

  const expiryDisplay = useMemo(() => {
    if (!qrData?.expiresAt) return '';
    return new Date(qrData.expiresAt).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }, [qrData?.expiresAt]);

  const handleShare = async () => {
    haptic.light();
    await Share.share({
      message: profile
        ? `HUST KTX — ${profile.name} (${profile.studentId})${assignment?.status === 'assigned' ? ` — Phòng ${assignment.roomNumber}` : ''}`
        : 'HUST Dormitory Card',
      title: 'Thẻ cư trú KTX HUST',
    });
  };

  const isLoading = dashLoading || qrLoading;

  return (
    <SafeLayout edges={['top', 'bottom']}>
      <ScreenHeader
        title="Thẻ cư trú"
        showBack
        right={
          <TouchableOpacity onPress={handleShare} hitSlop={10}>
            <Ionicons name="share-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        <View style={styles.card}>
          {/* Header stripe */}
          <View style={styles.cardHeader}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>HUST</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.cardTitle}>KÝ TÚC XÁ</Text>
              <Text style={styles.cardSubtitle}>Hanoi University of Science and Technology</Text>
            </View>
          </View>

          {/* QR section */}
          <View style={styles.qrSection}>
            {isLoading ? (
              <View style={[styles.qrWrapper, styles.qrLoading]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.qrLoadingText}>Đang tạo thẻ...</Text>
              </View>
            ) : qrError ? (
              <TouchableOpacity style={[styles.qrWrapper, styles.qrError]} onPress={() => refreshQR()}>
                <Ionicons name="refresh-circle-outline" size={40} color={Colors.error} />
                <Text style={styles.qrErrorText}>Lỗi tải thẻ{'\n'}Nhấn để thử lại</Text>
              </TouchableOpacity>
            ) : QRCode && qrData?.token ? (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrData.token}
                  size={QR_SIZE}
                  color={Colors.text}
                  backgroundColor={Colors.surface}
                />
              </View>
            ) : (
              <QRPlaceholder />
            )}
          </View>

          {/* Student info */}
          <View style={styles.infoSection}>
            {isLoading ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={[styles.skeletonLine, { width: 180, height: 20 }]} />
                <View style={[styles.skeletonLine, { width: 120, height: 14 }]} />
                <View style={[styles.skeletonLine, { width: 200, height: 12 }]} />
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
            {expiryDisplay ? (
              <Text style={styles.cardFooterExpiry}>
                <Ionicons name="shield-checkmark-outline" size={10} color={Colors.success} /> Hết hạn: {expiryDisplay}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.success} />
          <Text style={styles.securityText}>
            Thẻ được ký bởi máy chủ · Có hiệu lực 24 giờ · Tự động làm mới
          </Text>
        </View>

        {/* Refresh button */}
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { haptic.light(); refreshQR(); }}
          hitSlop={8}
        >
          <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
          <Text style={styles.refreshText}>Làm mới thẻ</Text>
        </TouchableOpacity>
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
  headerText: { flex: 1 },
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
    width: QR_SIZE + Spacing.sm * 2 + 2,
    height: QR_SIZE + Spacing.sm * 2 + 2,
  },
  qrLoading: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrLoadingText: { fontSize: FontSize.xs, color: Colors.textMuted },
  qrError: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrErrorText: { fontSize: FontSize.xs, color: Colors.error, textAlign: 'center' },
  qrInstallHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },

  skeletonLine: { backgroundColor: Colors.skeleton, borderRadius: Radius.sm },

  infoSection: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  studentName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  studentId: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  studentFaculty: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  roomSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm, alignItems: 'center' },
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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.success },

  cardFooter: {
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 3,
  },
  cardFooterText: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  cardFooterExpiry: { fontSize: 9, color: Colors.success },

  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: Spacing.md, paddingHorizontal: Spacing.sm,
  },
  securityText: { flex: 1, fontSize: 11, color: Colors.success, lineHeight: 16 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: Spacing.sm, paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary + '40',
    backgroundColor: Colors.primaryLight,
  },
  refreshText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
});
