import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient, me } from '../api/client';
import { useQuery } from '@tanstack/react-query';

export default function SupportScreen() {
  const [statusFilter, setStatusFilter] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [formData, setFormData] = useState({
    type: '',
    priority: 'medium',
    title: '',
    description: '',
    comment: '',
  });

  const { data } = useQuery({ queryKey: ['me'], queryFn: me });
  const user = data?.user || {};

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      try {
        const { data: res } = await apiClient.get('/student/maintenance-requests', {
          params: statusFilter ? { status: statusFilter } : undefined,
        });
        setRequests(Array.isArray(res?.requests) ? res.requests : []);
      } catch {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    }

    loadRequests();
  }, [statusFilter]);

  const statusLabel = useMemo(
    () => ({
      submitted: 'Yêu cầu mới',
      assigned: 'Đã phân công',
      in_progress: 'Đang xử lý',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
    }),
    []
  );

  const typeLabel = useMemo(
    () => ({
      electrical: 'Điện',
      plumbing: 'Nước',
      hvac: 'Điều hòa',
      furniture: 'Nội thất',
      door_lock: 'Cửa/Khóa',
      window: 'Cửa sổ',
      internet: 'Mạng',
      cleaning: 'Vệ sinh',
      pest_control: 'Diệt côn trùng',
      other: 'Khác',
    }),
    []
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroSection}>
        <Text style={styles.heroBadge}>Bảo trì phòng ở</Text>
        <Text style={styles.heroTitle}>Gửi yêu cầu sửa chữa trong giao diện sáng sủa hơn, đồng bộ với toàn bộ phần sinh viên</Text>
        <Text style={styles.heroSubtitle}>Khu bảo trì được kéo về cùng tông với trang chủ để bớt cảm giác như một màn hình quản trị tách rời. Bạn có thể xem danh sách yêu cầu, tạo mới và theo dõi tiến độ trong cùng nhịp bố cục.</Text>
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaTitle}>Tạo yêu cầu</Text>
            <Text style={styles.heroMetaText}>Mô tả sự cố rõ ràng để bộ phận kỹ thuật xử lý nhanh hơn.</Text>
          </View>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaTitle}>Theo dõi tiến độ</Text>
            <Text style={styles.heroMetaText}>Trạng thái, mức độ ưu tiên và lịch sử cập nhật được giữ ở ngay một nơi.</Text>
          </View>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaTitle}>Đánh giá sau xử lý</Text>
            <Text style={styles.heroMetaText}>Hoàn tất rồi thì để lại phản hồi để cải thiện chất lượng dịch vụ.</Text>
          </View>
        </View>
      </View>

      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageHeaderTitle}>Yêu cầu Bảo trì</Text>
          <Text style={styles.pageHeaderSubtitle}>Quản lý các yêu cầu sửa chữa và bảo trì phòng ở</Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => setCreateOpen(true)}>
          <Text style={styles.primaryBtnText}>Tạo yêu cầu mới</Text>
        </Pressable>
      </View>

      {!user?.dormitoryId || !user?.roomNumber ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>Bạn chưa được phân phòng. Vui lòng đăng ký phòng trước khi tạo yêu cầu bảo trì.</Text>
        </View>
      ) : null}

      <View style={styles.filterWrap}>
        <Text style={styles.filterLabel}>Tất cả trạng thái</Text>
        <View style={styles.filterRow}>
          {['', 'submitted', 'assigned', 'in_progress', 'completed', 'cancelled'].map((v) => (
            <Pressable
              key={v || 'all'}
              style={[styles.filterChip, statusFilter === v && styles.filterChipActive]}
              onPress={() => setStatusFilter(v)}
            >
              <Text style={[styles.filterChipText, statusFilter === v && styles.filterChipTextActive]}>
                {v ? statusLabel[v] : 'Tất cả trạng thái'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.requestsList}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Chưa có yêu cầu bảo trì</Text>
            <Text style={styles.emptySub}>Khi bạn gặp sự cố về phòng ở, hãy tạo yêu cầu bảo trì để được hỗ trợ nhanh chóng.</Text>
          </View>
        ) : (
          requests.map((r, idx) => (
            <View key={`${r._id || idx}`} style={styles.requestCard}>
              <View style={styles.requestTop}>
                <View style={styles.requestTopLeft}>
                  <Text style={styles.requestTitle}>{r.title}</Text>
                  <Text style={styles.requestSmall}>Mã: {r.requestNumber || '-'}</Text>
                  <Text style={styles.requestSmall}>Loại: {typeLabel[r.type] || r.type || '-'}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{statusLabel[r.status] || r.status}</Text>
                </View>
              </View>
              <Text style={styles.requestDesc}>{r.description || ''}</Text>
              <View style={styles.requestBottom}>
                <Text style={styles.requestDate}>{r.reportedAt ? new Date(r.reportedAt).toLocaleDateString('vi-VN') : '-'}</Text>
                {r.status === 'completed' && !r.feedbackRating ? (
                  <Pressable style={styles.feedbackBtn} onPress={() => setFeedbackOpen(true)}>
                    <Text style={styles.feedbackBtnText}>Đánh giá</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.accentGrid}>
        <View style={styles.accentCard}>
          <Text style={styles.accentTitle}>Cập nhật rõ ràng</Text>
          <Text style={styles.accentText}>Mỗi trạng thái đều được hiển thị nổi bật hơn để bạn không phải dò trong danh sách dài.</Text>
        </View>
        <View style={styles.accentCard}>
          <Text style={styles.accentTitle}>Gắn với phòng ở</Text>
          <Text style={styles.accentText}>Phần bảo trì được đặt cùng ngôn ngữ với các trang đăng ký và trạng thái phòng để luồng sinh viên liền mạch hơn.</Text>
        </View>
        <View style={styles.accentCard}>
          <Text style={styles.accentTitle}>Phản hồi thuận tiện</Text>
          <Text style={styles.accentText}>Góp ý sau sửa chữa có vị trí rõ hơn, giảm cảm giác trang chỉ là danh sách tác vụ.</Text>
        </View>
      </View>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tạo yêu cầu bảo trì</Text>
            <TextInput style={styles.input} placeholder="Loại sự cố" value={formData.type} onChangeText={(v) => setFormData((p) => ({ ...p, type: v }))} />
            <TextInput style={styles.input} placeholder="Độ ưu tiên" value={formData.priority} onChangeText={(v) => setFormData((p) => ({ ...p, priority: v }))} />
            <TextInput style={styles.input} placeholder="Tiêu đề ngắn gọn" value={formData.title} onChangeText={(v) => setFormData((p) => ({ ...p, title: v }))} />
            <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Mô tả chi tiết" value={formData.description} onChangeText={(v) => setFormData((p) => ({ ...p, description: v }))} />
            <View style={styles.modalButtons}>
              <Pressable style={styles.secondaryBtn} onPress={() => setCreateOpen(false)}>
                <Text style={styles.secondaryBtnText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={async () => {
                  try {
                    await apiClient.post('/student/maintenance-requests', formData);
                    setCreateOpen(false);
                    setFormData({ type: '', priority: 'medium', title: '', description: '', comment: '' });
                    setStatusFilter((v) => `${v}`);
                  } catch {}
                }}
              >
                <Text style={styles.primaryBtnText}>Gửi yêu cầu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={feedbackOpen} transparent animationType="fade" onRequestClose={() => setFeedbackOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đánh giá dịch vụ</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setFeedbackRating(n)}>
                  <Text style={[styles.star, feedbackRating >= n && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Nhận xét (tùy chọn)" value={formData.comment} onChangeText={(v) => setFormData((p) => ({ ...p, comment: v }))} />
            <View style={styles.modalButtons}>
              <Pressable style={styles.secondaryBtn} onPress={() => setFeedbackOpen(false)}>
                <Text style={styles.secondaryBtnText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => setFeedbackOpen(false)}>
                <Text style={styles.primaryBtnText}>Gửi đánh giá</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f7f8' },
  contentContainer: { padding: 16, paddingBottom: 28 },
  heroSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  heroBadge: { color: '#111827', fontWeight: '700', marginBottom: 8 },
  heroTitle: { color: '#111827', fontWeight: '800', fontSize: 20, marginBottom: 8 },
  heroSubtitle: { color: '#4b5563', lineHeight: 20, marginBottom: 12 },
  heroMeta: { gap: 10 },
  heroMetaCard: { backgroundColor: '#f6f7f8', borderRadius: 10, padding: 12 },
  heroMetaTitle: { fontWeight: '700', color: '#111827', marginBottom: 4 },
  heroMetaText: { color: '#4b5563', fontSize: 12, lineHeight: 18 },
  pageHeader: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  pageHeaderTitle: { fontWeight: '800', fontSize: 22, color: '#111827' },
  pageHeaderSubtitle: { color: '#6b7280', marginTop: 4 },
  primaryBtn: { backgroundColor: '#667eea', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  warningBox: { backgroundColor: '#fff3cd', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#ffc107', padding: 12, marginBottom: 12 },
  warningText: { color: '#664d03' },
  filterWrap: { marginBottom: 12 },
  filterLabel: { fontWeight: '600', color: '#111827', marginBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#667eea', borderColor: '#667eea' },
  filterChipText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  requestsList: { marginBottom: 14 },
  loadingWrap: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 30 },
  emptyState: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyTitle: { color: '#111827', fontWeight: '700', fontSize: 18, marginBottom: 6 },
  emptySub: { color: '#6b7280', textAlign: 'center' },
  requestCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ededf0', borderLeftWidth: 4, borderLeftColor: '#e74c3c' },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  requestTopLeft: { flex: 1 },
  requestTitle: { color: '#111827', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  requestSmall: { color: '#6b7280', fontSize: 12 },
  statusBadge: { backgroundColor: '#f6f7f8', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#e6e7ea' },
  statusText: { color: '#1f2937', fontWeight: '700', fontSize: 12 },
  requestDesc: { color: '#6b7280', marginBottom: 10 },
  requestBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestDate: { color: '#9ca3af', fontSize: 12 },
  feedbackBtn: { borderWidth: 1, borderColor: '#667eea', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  feedbackBtnText: { color: '#667eea', fontWeight: '700', fontSize: 12 },
  accentGrid: { gap: 10 },
  accentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  accentTitle: { color: '#111827', fontWeight: '700', marginBottom: 4 },
  accentText: { color: '#4b5563', fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontWeight: '800', color: '#111827', fontSize: 18, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 10, backgroundColor: '#fff' },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  secondaryBtn: { backgroundColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryBtnText: { color: '#374151', fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  star: { fontSize: 28, color: '#ddd' },
  starActive: { color: '#e74c3c' },
});
