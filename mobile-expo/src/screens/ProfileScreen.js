import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient, me } from '../api/client';

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('info');
  const [applications, setApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: me });
  const user = data?.user || {};

  useEffect(() => {
    async function loadApplications() {
      setLoadingApplications(true);
      try {
        const { data: res } = await apiClient.get('/mobile/applications');
        const list = Array.isArray(res?.applications) ? res.applications : [];
        setApplications(list);
      } catch (_) {
        setApplications([]);
      } finally {
        setLoadingApplications(false);
      }
    }

    loadApplications();
  }, []);

  const avatarText = useMemo(() => {
    const name = user?.name || 'U';
    return String(name).charAt(0).toUpperCase();
  }, [user]);

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Thông báo', 'Mật khẩu mới không khớp!');
      return;
    }

    try {
      await apiClient.post('/mobile/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Thành công', 'Đổi mật khẩu thành công!');
    } catch {
      Alert.alert('Lỗi', 'Đổi mật khẩu thất bại!');
    }
  }

  async function handleToggle2FA(nextValue) {
    setTwoFactorEnabled(nextValue);
    try {
      if (nextValue) {
        await apiClient.post('/2fa/quick-enable');
      } else {
        await apiClient.post('/2fa/disable');
      }
    } catch {
      setTwoFactorEnabled(!nextValue);
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại!');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroSection}>
        <Text style={styles.heroBadge}>Hồ sơ sinh viên</Text>
        <Text style={styles.heroTitle}>Hồ sơ sinh viên</Text>
        <Text style={styles.heroSubtitle}>
          Trang hồ sơ được đưa về cùng ngôn ngữ thị giác với trang chủ: mở đầu gọn, nhấn các khối thông tin quan trọng và làm rõ những mục cần cập nhật thường xuyên.
        </Text>
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaTitle}>Thông tin cá nhân</Text>
            <Text style={styles.heroMetaText}>Cập nhật email, số điện thoại và các thông tin học tập đang dùng cho hồ sơ ký túc xá.</Text>
          </View>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaTitle}>Thông tin cư trú</Text>
            <Text style={styles.heroMetaText}>Theo dõi ký túc xá, phòng ở và các thay đổi liên quan ngay trong cùng một trang.</Text>
          </View>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaTitle}>Lịch sử gần đây</Text>
            <Text style={styles.heroMetaText}>Kiểm tra nhanh các hồ sơ đã nộp và các cập nhật mới nhất.</Text>
          </View>
        </View>
      </View>

      <View style={styles.mainContent}>
        <Text style={styles.pageTitle}>Hồ sơ sinh viên</Text>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#e61a1a" />
            <Text style={styles.loadingText}>Đang tải thông tin...</Text>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatarLarge}>
                  <Text style={styles.avatarText}>{avatarText}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{user?.name || 'Tên sinh viên'}</Text>
                  <Text style={styles.profileStudentId}>Mã sinh viên: {user?.studentId || '-'}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{user?.email || '-'}</Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Số điện thoại</Text>
                    <Text style={styles.infoValue}>{user?.phone || '-'}</Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Ngành</Text>
                    <Text style={styles.infoValue}>{user?.major || '-'}</Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Khóa</Text>
                    <Text style={styles.infoValue}>{user?.cohort || '-'}</Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Lớp</Text>
                    <Text style={styles.infoValue}>{user?.class || '-'}</Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Phòng hiện tại</Text>
                    <Text style={styles.infoValue}>{user?.roomNumber || 'Chưa có phòng'}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.tabs}>
                <Pressable style={[styles.tab, activeTab === 'info' && styles.activeTab]} onPress={() => setActiveTab('info')}>
                  <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Thông tin</Text>
                </Pressable>
                <Pressable style={[styles.tab, activeTab === 'applications' && styles.activeTab]} onPress={() => setActiveTab('applications')}>
                  <Text style={[styles.tabText, activeTab === 'applications' && styles.activeTabText]}>Lịch sử đăng ký</Text>
                </Pressable>
                <Pressable style={[styles.tab, activeTab === 'settings' && styles.activeTab]} onPress={() => setActiveTab('settings')}>
                  <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Cài đặt</Text>
                </Pressable>
              </View>

              {activeTab === 'info' && (
                <View style={styles.tabContent}>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>Thông tin cá nhân</Text>
                    <Text style={styles.alertText}>Vui lòng liên hệ phòng quản lý KTX để cập nhật thông tin cá nhân.</Text>
                  </View>

                  <View style={styles.studentDetailsBlock}>
                    <Text style={styles.detailLine}>Họ tên: {user?.name || '-'}</Text>
                    <Text style={styles.detailLine}>Mã sinh viên: {user?.studentId || '-'}</Text>
                    <Text style={styles.detailLine}>Email: {user?.email || '-'}</Text>
                    <Text style={styles.detailLine}>Số điện thoại: {user?.phone || '-'}</Text>
                  </View>
                </View>
              )}

              {activeTab === 'applications' && (
                <View style={styles.tabContent}>
                  {loadingApplications ? (
                    <View style={styles.loadingApplicationsWrap}>
                      <ActivityIndicator size="small" color="#e61a1a" />
                    </View>
                  ) : applications.length > 0 ? (
                    applications.map((app, idx) => (
                      <View key={`${app._id || app.id || idx}`} style={styles.applicationCard}>
                        <View style={styles.applicationHeader}>
                          <Text style={styles.applicationTitle}>{app.dormitoryName || 'Ký túc xá'}</Text>
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>
                              {app.status === 'approved' ? 'Đã duyệt' : app.status === 'rejected' ? 'Từ chối' : 'Đang chờ'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.detailText}>Phòng: {app.roomNumber || '-'}</Text>
                        <Text style={styles.detailText}>Ngày đăng ký: {app.createdAt ? new Date(app.createdAt).toLocaleDateString('vi-VN') : '-'}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>Chưa có đơn đăng ký</Text>
                      <Text style={styles.emptySub}>Bạn chưa đăng ký phòng nào</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'settings' && (
                <View style={styles.tabContent}>
                  <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>
                  <View style={styles.alertWarning}>
                    <Text style={styles.alertTitle}>Lưu ý bảo mật</Text>
                    <Text style={styles.alertText}>Vui lòng đảm bảo mật khẩu mới đủ mạnh và không chia sẻ với người khác.</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Mật khẩu hiện tại</Text>
                    <TextInput style={styles.formControl} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Mật khẩu mới</Text>
                    <TextInput style={styles.formControl} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Xác nhận mật khẩu mới</Text>
                    <TextInput style={styles.formControl} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
                  </View>
                  <View style={styles.btnGroup}>
                    <Pressable style={styles.btnPrimary} onPress={handleChangePassword}>
                      <Text style={styles.btnPrimaryText}>Đổi mật khẩu</Text>
                    </Pressable>
                  </View>

                  <View style={styles.separator} />

                  <Text style={styles.sectionTitle}>Xác thực hai lớp (2FA)</Text>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>Bảo vệ tài khoản của bạn</Text>
                    <Text style={styles.alertText}>Xác thực hai lớp giúp bảo vệ tài khoản khỏi truy cập trái phép.</Text>
                  </View>

                  <View style={styles.switchRow}>
                    <Switch value={twoFactorEnabled} onValueChange={handleToggle2FA} />
                    <Text style={styles.switchLabel}>Bật xác thực hai lớp</Text>
                  </View>

                  {twoFactorEnabled && (
                    <View style={styles.btnGroup}>
                      <Pressable style={styles.btnSecondary} onPress={() => Alert.alert('Mã dự phòng', 'Tính năng mã dự phòng đang được đồng bộ.')}>
                        <Text style={styles.btnSecondaryText}>Xem mã dự phòng</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.accentGrid}>
              <View style={styles.accentCard}>
                <Text style={styles.accentTitle}>Hồ sơ gọn hơn</Text>
                <Text style={styles.accentText}>Các khối nội dung được neo trong bối cảnh rõ ràng thay vì bắt đầu đột ngột như trước.</Text>
              </View>
              <View style={styles.accentCard}>
                <Text style={styles.accentTitle}>Dễ kiểm tra thông tin</Text>
                <Text style={styles.accentText}>Những dữ liệu cần cho đăng ký và bảo trì được gom vào cùng trải nghiệm thống nhất.</Text>
              </View>
              <View style={styles.accentCard}>
                <Text style={styles.accentTitle}>Theo dõi nhanh hơn</Text>
                <Text style={styles.accentText}>Các phần lịch sử và trạng thái nổi bật hơn, giảm cảm giác trang bị trống ở đầu màn hình.</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f3ef' },
  contentContainer: { paddingBottom: 28 },
  heroSection: { margin: 16, borderRadius: 14, backgroundColor: '#ffffff', padding: 16 },
  heroBadge: { color: '#e61a1a', fontWeight: '700', marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#e61a1a', marginBottom: 8 },
  heroSubtitle: { color: '#4b5563', lineHeight: 20, marginBottom: 12 },
  heroMeta: { gap: 10 },
  heroMetaCard: { backgroundColor: '#f6f7f8', borderRadius: 10, padding: 12 },
  heroMetaTitle: { color: '#111827', fontWeight: '700', marginBottom: 4 },
  heroMetaText: { color: '#4b5563', fontSize: 12, lineHeight: 18 },
  mainContent: { paddingHorizontal: 16 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: '#e61a1a', marginBottom: 16 },
  loading: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { color: '#475569' },
  profileCard: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  profileAvatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffe6e6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#e61a1a', fontSize: 28, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 24, fontWeight: '700', color: '#111827' },
  profileStudentId: { color: '#6b7280', marginTop: 4 },
  infoGrid: { marginTop: 14, gap: 10 },
  infoItem: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12 },
  infoContent: { gap: 2 },
  infoLabel: { color: '#6b7280', fontWeight: '600', fontSize: 12 },
  infoValue: { color: '#111827', fontWeight: '700', fontSize: 16 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginBottom: 12 },
  tab: { paddingVertical: 10, paddingHorizontal: 12 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#e61a1a' },
  tabText: { color: '#6b7280', fontWeight: '600' },
  activeTabText: { color: '#e61a1a' },
  tabContent: { paddingTop: 8 },
  studentDetailsBlock: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#ececec', padding: 12 },
  detailLine: { color: '#374151', marginBottom: 6 },
  alertInfo: { backgroundColor: '#cfe2ff', borderLeftWidth: 4, borderLeftColor: '#0d6efd', borderRadius: 10, padding: 12, marginBottom: 12 },
  alertWarning: { backgroundColor: '#fff3cd', borderLeftWidth: 4, borderLeftColor: '#ffc107', borderRadius: 10, padding: 12, marginBottom: 12 },
  alertTitle: { color: '#111827', fontWeight: '700', marginBottom: 4 },
  alertText: { color: '#374151' },
  loadingApplicationsWrap: { paddingVertical: 12 },
  applicationCard: { borderLeftWidth: 4, borderLeftColor: '#e61a1a', borderRadius: 10, backgroundColor: '#fff', padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ececec' },
  applicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  applicationTitle: { color: '#111827', fontWeight: '700', fontSize: 16 },
  statusBadge: { backgroundColor: '#fff3cd', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#664d03', fontWeight: '700', fontSize: 12 },
  detailText: { color: '#4b5563', fontSize: 13, marginBottom: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { color: '#4b5563', fontWeight: '700', fontSize: 16 },
  emptySub: { color: '#9ca3af', marginTop: 4 },
  sectionTitle: { color: '#111827', fontWeight: '700', fontSize: 20, marginBottom: 10 },
  formGroup: { marginBottom: 12 },
  formLabel: { color: '#111827', fontWeight: '600', marginBottom: 6 },
  formControl: { borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  btnGroup: { marginTop: 6, flexDirection: 'row' },
  btnPrimary: { backgroundColor: '#e61a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnSecondary: { backgroundColor: '#6c757d', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  btnSecondaryText: { color: '#fff', fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  switchLabel: { color: '#111827', fontWeight: '600' },
  accentGrid: { gap: 10, marginBottom: 14 },
  accentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  accentTitle: { color: '#111827', fontWeight: '700', marginBottom: 4 },
  accentText: { color: '#4b5563', fontSize: 12, lineHeight: 18 },
});
