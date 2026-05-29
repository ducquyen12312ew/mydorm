import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchRooms, addFavorite, removeFavorite, fetchFavorites, Dormitory, Room } from '../../src/api/rooms';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Badge } from '../../src/components/ui/Badge';
import { SkeletonRoomCard } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';
import { formatCurrency } from '../../src/utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ROOM_TYPES: { key: string; label: string }[] = [
  { key: '', label: 'Tất cả' },
  { key: 'single', label: 'Đơn' },
  { key: 'double', label: 'Đôi' },
  { key: 'triple', label: 'Ba người' },
  { key: 'quad', label: 'Bốn người' },
];

// Occupancy color by percentage
function occupancyColor(pct: number): string {
  if (pct >= 90) return Colors.error;
  if (pct >= 60) return Colors.warning;
  return Colors.success;
}

function OccupancyBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const color = occupancyColor(pct);
  return (
    <View style={bar.wrapper}>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[bar.label, { color }]}>{current}/{max}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, width: 30, textAlign: 'right' },
});

const RoomTypeIcon: Record<string, IoniconsName> = {
  single: 'person',
  double: 'people',
  triple: 'people',
  quad: 'people',
};

const ROOM_TYPE_VI: Record<string, string> = {
  single: 'Phòng đơn',
  double: 'Phòng đôi',
  triple: 'Phòng 3 người',
  quad: 'Phòng 4 người',
};

interface RoomCardProps {
  room: Room;
  dormId: string;
  isFavorite: boolean;
  onToggleFav: (roomId: string, isFav: boolean) => void;
}

const RoomCard = React.memo(function RoomCard({ room, dormId, isFavorite, onToggleFav }: RoomCardProps) {
  const router = useRouter();
  const availPct = room.maxCapacity > 0 ? (room.currentOccupants / room.maxCapacity) : 0;
  const statusColor = room.isAvailable ? Colors.success : Colors.error;

  const handlePress = () => {
    haptic.light();
    router.push({ pathname: '/room/[id]', params: { id: room.id, dormId } });
  };

  const handleFav = () => {
    haptic.selection();
    onToggleFav(room.id, isFavorite);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.roomCard}>
      {/* Availability accent stripe */}
      <View style={[styles.roomAccent, { backgroundColor: statusColor }]} />

      <View style={styles.roomBody}>
        {/* Header row */}
        <View style={styles.roomHeader}>
          <View style={styles.roomNumberBadge}>
            <Text style={styles.roomNumber}>P.{room.roomNumber}</Text>
          </View>
          <View style={styles.roomMeta}>
            <View style={styles.roomMetaRow}>
              <Ionicons name={RoomTypeIcon[room.roomType] ?? 'person'} size={12} color={Colors.textMuted} />
              <Text style={styles.roomType}>{ROOM_TYPE_VI[room.roomType] ?? room.roomType}</Text>
            </View>
            <View style={styles.roomMetaRow}>
              <Ionicons name="layers-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.roomFloor}>Tầng {room.floor}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleFav} hitSlop={10} style={styles.favBtn}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? Colors.error : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Occupancy bar */}
        <OccupancyBar current={room.currentOccupants} max={room.maxCapacity} />

        {/* Footer row */}
        <View style={styles.roomFooter}>
          <View style={[styles.availPill, { backgroundColor: room.isAvailable ? Colors.successLight : Colors.surfaceAlt }]}>
            <View style={[styles.availDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.availText, { color: statusColor }]}>
              {room.isAvailable ? `${room.availableBeds} chỗ trống` : 'Hết chỗ'}
            </Text>
          </View>
          <Text style={styles.roomPrice}>{formatCurrency(room.pricePerMonth)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const DormitoryGroup = React.memo(function DormitoryGroup({
  dorm,
  favoriteIds,
  onToggleFav,
}: {
  dorm: Dormitory;
  favoriteIds: Set<string>;
  onToggleFav: (roomId: string, isFav: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const availableCount = dorm.rooms.filter((r) => r.isAvailable).length;

  const handleToggle = () => {
    haptic.light();
    setCollapsed((v) => !v);
  };

  return (
    <View style={styles.dormGroup}>
      <TouchableOpacity style={styles.dormHeader} onPress={handleToggle} activeOpacity={0.85}>
        <View style={styles.dormIconBox}>
          <Ionicons name="business" size={18} color={Colors.primary} />
        </View>
        <View style={styles.dormInfo}>
          <Text style={styles.dormName} numberOfLines={1}>{dorm.name}</Text>
          <Text style={styles.dormAddress} numberOfLines={1}>{dorm.address}</Text>
        </View>
        <View style={styles.dormRight}>
          <View style={[styles.availCountBadge, { backgroundColor: availableCount > 0 ? Colors.successLight : Colors.surfaceAlt }]}>
            <Text style={[styles.availCountText, { color: availableCount > 0 ? Colors.success : Colors.textMuted }]}>
              {availableCount} trống
            </Text>
          </View>
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={Colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.roomList}>
          {dorm.rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              dormId={String(dorm.id)}
              isFavorite={favoriteIds.has(room.id)}
              onToggleFav={onToggleFav}
            />
          ))}
        </View>
      )}
    </View>
  );
}, (prev, next) =>
  prev.dorm === next.dorm &&
  prev.favoriteIds === next.favoriteIds &&
  prev.onToggleFav === next.onToggleFav
);

export default function RoomsScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roomType, setRoomType] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const { data: dormitories, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['rooms', { roomType, onlyAvailable }],
    queryFn: () => fetchRooms({ roomType: roomType || undefined, onlyAvailable }),
    staleTime: 30000,
  });

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    staleTime: 60000,
  });

  const favoriteIds = useMemo(
    () => new Set<string>((favorites ?? []).map((f: any) => String(f.id))),
    [favorites]
  );

  const addFavMutation = useMutation({
    mutationFn: addFavorite,
    onMutate: () => haptic.light(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const removeFavMutation = useMutation({
    mutationFn: removeFavorite,
    onMutate: () => haptic.light(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const handleToggleFav = useCallback((roomId: string, isFav: boolean) => {
    if (isFav) removeFavMutation.mutate(roomId);
    else addFavMutation.mutate(roomId);
  }, [addFavMutation, removeFavMutation]);

  const filtered = useMemo(() => {
    const searchLow = search.toLowerCase();
    return (dormitories ?? [])
      .map((dorm: Dormitory) => ({
        ...dorm,
        rooms: dorm.rooms.filter((r: Room) =>
          searchLow ? r.roomNumber.toLowerCase().includes(searchLow) : true
        ),
      }))
      .filter((dorm: Dormitory) => dorm.rooms.length > 0);
  }, [dormitories, search]);

  const totalRooms = filtered.reduce((sum: number, d: Dormitory) => sum + d.rooms.length, 0);

  return (
    <SafeLayout edges={['top']}>
      <ScreenHeader title="Phòng ở" subtitle={isLoading ? undefined : `${totalRooms} phòng`} />

      {/* Search + available filter */}
      <View style={styles.filterRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm số phòng..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.availToggle, onlyAvailable && styles.availToggleActive]}
          onPress={() => { haptic.selection(); setOnlyAvailable((v) => !v); }}
        >
          <Ionicons
            name={onlyAvailable ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={15}
            color={onlyAvailable ? Colors.textInverse : Colors.textSecondary}
          />
          <Text style={[styles.availToggleText, onlyAvailable && styles.availToggleTextActive]}>
            Còn chỗ
          </Text>
        </TouchableOpacity>
      </View>

      {/* Room type filter chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeScroll}
        contentContainerStyle={styles.typeChips}
      >
        {ROOM_TYPES.map(({ key, label }) => {
          const active = roomType === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => { haptic.selection(); setRoomType(key); }}
            >
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.skeletonList} showsVerticalScrollIndicator={false}>
          {[1, 2, 3, 4].map((i) => <SkeletonRoomCard key={i} />)}
        </ScrollView>
      ) : filtered.length === 0 ? (
        <EmptyState
          iconName="business-outline"
          title="Không tìm thấy phòng"
          subtitle="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <DormitoryGroup
              dorm={item}
              favoriteIds={favoriteIds}
              onToggleFav={handleToggleFav}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        />
      )}
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    height: 38,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: 2 },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.text, paddingVertical: 0 },

  availToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  availToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  availToggleText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  availToggleTextActive: { color: Colors.textInverse, fontWeight: FontWeight.semibold },

  typeScroll: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeChips: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, flexDirection: 'row' },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  typeChipTextActive: { color: Colors.textInverse, fontWeight: FontWeight.semibold },

  list: { padding: Spacing.md, paddingBottom: 32 },
  skeletonList: { padding: Spacing.md, gap: Spacing.md },

  dormGroup: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  dormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  dormIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dormInfo: { flex: 1, minWidth: 0 },
  dormName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  dormAddress: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  dormRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  availCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  availCountText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  roomList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },

  roomCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  roomAccent: { width: 4, flexShrink: 0 },
  roomBody: { flex: 1, padding: Spacing.sm, gap: 8 },

  roomHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  roomNumberBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  roomNumber: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  roomMeta: { flex: 1, gap: 2 },
  roomMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomType: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  roomFloor: { fontSize: FontSize.xs, color: Colors.textSecondary },
  favBtn: { padding: 4 },

  roomFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  roomPrice: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
});
