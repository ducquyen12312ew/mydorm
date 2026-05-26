import { useQuery } from '@tanstack/react-query';
import { dashboard } from '../api/client';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';

function Stat({ label, value, color }) {
  return (
    <View style={[styles.stat, { backgroundColor: color }]}> 
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const offline = useAppStore((s) => s.offline);
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: dashboard });

  if (isLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#1f9d8b" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.root, { justifyContent: 'center' }]}>
        <View style={styles.card}>
          <Text style={styles.heading}>Không tải được bảng điều khiển</Text>
          <Text style={styles.sub}>Không thể tải dữ liệu mới nhất. Vui lòng thử lại sau.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      {offline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Mất kết nối thời gian thực. Đang hiển thị dữ liệu đã đồng bộ gần nhất.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.heading}>Bảng điều khiển sinh viên</Text>
        <Text style={styles.sub}>Dữ liệu thời gian thực được đồng bộ với trang web.</Text>
      </View>

      <View style={styles.row}>
        <Stat label="Đơn" value={data?.application?.status || 'chưa có'} color="#ff7f50" />
        <Stat label="Ưu tiên" value={data?.profile?.priorityScore || 0} color="#1f9d8b" />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Phòng được phân</Text>
        <Text style={styles.value}>{data?.assignment?.roomNumber ? `Phòng ${data.assignment.roomNumber}` : 'Chưa được phân'}</Text>
        <Text style={styles.sub}>{data?.assignment?.dormitoryName || 'Đang chờ cập nhật phân phòng'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12, paddingBottom: 30, backgroundColor: '#f4f7ff' },
  offlineBanner: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fde68a' },
  offlineText: { color: '#92400e', fontWeight: '600', fontSize: 12 },
  card: { borderRadius: 18, backgroundColor: '#fff', padding: 16, shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 12, elevation: 2 },
  heading: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub: { marginTop: 4, color: '#64748b' },
  row: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 18, padding: 14 },
  statLabel: { color: '#fff', fontSize: 12, textTransform: 'uppercase', fontWeight: '700' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 6 },
  label: { color: '#64748b', fontWeight: '600', fontSize: 12, textTransform: 'uppercase' },
  value: { marginTop: 6, fontSize: 22, fontWeight: '700', color: '#0f172a' }
});
