import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { fetchRooms, addFavorite, removeFavorite, fetchFavorites, Room } from '../../src/api/rooms';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';
import { formatCurrency } from '../../src/utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function StatBox({ icon, value, label, color }: { icon: IoniconsName; value: string; label: string; color?: string }) {
  return (
    <View style={stat.box}>
      <Ionicons name={icon} size={20} color={color ?? Colors.primary} />
      <Text style={[stat.value, color ? { color } : {}]}>{value}</Text>
      <Text style={stat.label}>{label}</Text>
    </View>
  );
}

const stat = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 3 },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});

function DetailRow({ icon, label, value }: { icon: IoniconsName; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={15} color={Colors.textMuted} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

function OccupancySection({ room }: { room: Room }) {
  const pct = room.maxCapacity > 0 ? (room.currentOccupants / room.maxCapacity) * 100 : 0;
  const barColor =
    pct >= 90 ? Colors.error : pct >= 60 ? Colors.warning : Colors.success;

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Tình trạng phòng</Text>
      <View style={styles.occupancyTrack}>
        <View style={[styles.occupancyFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.occupancyLabels}>
        <Text style={[styles.occupancyPct, { color: barColor }]}>{Math.round(pct)}% đã có người</Text>
        <Text style={styles.occupancyDetail}>
          {room.currentOccupants} / {room.maxCapacity} chỗ
        </Text>
      </View>
      <View style={styles.statRow}>
        <StatBox
          icon="people-outline"
          value={String(room.currentOccupants)}
          label="Đang ở"
          color={Colors.textSecondary}
        />
        <View style={styles.statDivider} />
        <StatBox
          icon="bed-outline"
          value={String(room.availableBeds)}
          label="Còn trống"
          color={room.isAvailable ? Colors.success : Colors.error}
        />
        <View style={styles.statDivider} />
        <StatBox
          icon="resize-outline"
          value={String(room.maxCapacity)}
          label="Sức chứa"
          color={Colors.primary}
        />
      </View>
    </Card>
  );
}

export default function RoomDetailScreen() {
  const { id, dormId } = useLocalSearchParams<{ id: string; dormId: string }>();
  const queryClient = useQueryClient();

  const { data: dormitories, isLoading } = useQuery({
    queryKey: ['rooms', {}],
    queryFn: () => fetchRooms(),
    staleTime: 30000,
  });

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    staleTime: 60000,
  });

  const addFavMutation = useMutation({
    mutationFn: addFavorite,
    onMutate: () => haptic.selection(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const removeFavMutation = useMutation({
    mutationFn: removeFavorite,
    onMutate: () => haptic.selection(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const dorm = dormitories?.find((d) => String(d.id) === dormId);
  const room: Room | undefined = dorm?.rooms.find((r) => r.id === id);
  const isFavorite = (favorites ?? []).some((f: any) => String(f.id) === id);

  const handleToggleFav = () => {
    if (isFavorite) removeFavMutation.mutate(id!);
    else addFavMutation.mutate(id!);
  };

  const favButton = (
    <TouchableOpacity onPress={handleToggleFav} hitSlop={10} style={styles.favHeaderBtn}>
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={24}
        color={isFavorite ? Colors.error : Colors.textSecondary}
      />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeLayout edges={['top', 'bottom']}>
        <ScreenHeader title="Chi tiết phòng" showBack right={favButton} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.section, { gap: 12 }]}>
            <Skeleton height={80} radius={Radius.md} />
            <Skeleton height={16} />
            <Skeleton height={14} width="60%" />
          </View>
          <View style={[styles.section, { gap: 12 }]}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width="35%" height={13} />
                <Skeleton width="40%" height={13} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeLayout>
    );
  }

  if (!room) {
    return (
      <SafeLayout edges={['top', 'bottom']}>
        <ScreenHeader title="Chi tiết phòng" showBack />
        <View style={styles.notFound}>
          <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Không tìm thấy phòng này</Text>
        </View>
      </SafeLayout>
    );
  }

  const roomTypeLabel = (room.roomType ?? '').charAt(0).toUpperCase() + (room.roomType ?? '').slice(1);

  return (
    <SafeLayout edges={['top', 'bottom']}>
      <ScreenHeader
        title={`Phòng ${room.roomNumber}`}
        subtitle={dorm?.name}
        showBack
        right={favButton}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero status banner */}
        <View style={[
          styles.heroBanner,
          { backgroundColor: room.isAvailable ? Colors.successLight : Colors.surfaceAlt },
        ]}>
          <View style={[styles.heroIconBox, { backgroundColor: room.isAvailable ? Colors.success : Colors.textMuted }]}>
            <Ionicons name="home" size={24} color={Colors.textInverse} />
          </View>
          <View style={styles.heroInfo}>
            <Text style={[styles.heroStatus, { color: room.isAvailable ? Colors.success : Colors.textMuted }]}>
              {room.isAvailable ? 'Còn chỗ trống' : 'Hết chỗ'}
            </Text>
            <Text style={styles.heroSub}>
              Tầng {room.floor} · {roomTypeLabel}
            </Text>
          </View>
          <Badge
            status={room.isAvailable ? 'active' : 'inactive'}
            label={room.isAvailable ? `${room.availableBeds} chỗ` : 'Full'}
          />
        </View>

        {/* Price prominent */}
        <Card style={styles.priceCard} shadow={false}>
          <Text style={styles.priceLabel}>Giá thuê phòng</Text>
          <Text style={styles.priceValue}>{formatCurrency(room.pricePerMonth)}</Text>
          <Text style={styles.pricePer}>/người/tháng</Text>
        </Card>

        {/* Occupancy section */}
        <OccupancySection room={room} />

        {/* Room details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin phòng</Text>
          <DetailRow icon="grid-outline" label="Số phòng" value={room.roomNumber} />
          <DetailRow icon="people-outline" label="Loại phòng" value={roomTypeLabel} />
          <DetailRow icon="layers-outline" label="Tầng" value={String(room.floor)} />
          <DetailRow icon="resize-outline" label="Sức chứa" value={`${room.maxCapacity} người`} />
        </Card>

        {/* Dorm details */}
        {dorm && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Khu ký túc xá</Text>
            <DetailRow icon="business-outline" label="Tên khu" value={dorm.name} />
            <DetailRow icon="location-outline" label="Địa chỉ" value={dorm.address} />
            {dorm.category ? <DetailRow icon="information-circle-outline" label="Loại" value={dorm.category} /> : null}
          </Card>
        )}

        {/* Amenities */}
        {room.amenities?.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Tiện nghi</Text>
            <View style={styles.amenitiesGrid}>
              {room.amenities.map((item, i) => (
                <View key={i} style={styles.amenityChip}>
                  <Ionicons name="checkmark-outline" size={13} color={Colors.primary} />
                  <Text style={styles.amenityText}>{item}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveFavBtn, isFavorite && styles.saveFavBtnActive]}
          onPress={handleToggleFav}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? Colors.error : Colors.textSecondary}
          />
          <Text style={[styles.saveFavText, isFavorite && styles.saveFavTextActive]}>
            {isFavorite ? 'Đã lưu yêu thích' : 'Lưu vào yêu thích'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  notFoundText: { fontSize: FontSize.base, color: Colors.textSecondary },

  favHeaderBtn: { padding: 4 },

  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroInfo: { flex: 1 },
  heroStatus: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  priceCard: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary + '30',
    gap: 2,
  },
  priceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  priceValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  pricePer: { fontSize: FontSize.xs, color: Colors.textMuted },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },

  occupancyTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  occupancyFill: { height: '100%', borderRadius: 4 },
  occupancyLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  occupancyPct: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  occupancyDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  statDivider: { width: 1, backgroundColor: Colors.border },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  detailValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium, textAlign: 'right', maxWidth: '55%' },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  amenityText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  saveFavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  saveFavBtnActive: { backgroundColor: Colors.errorLight, borderColor: Colors.error + '40' },
  saveFavText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  saveFavTextActive: { color: Colors.error },
});
