import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { publicRooms } from '../api/client';

const RoomsScreen = ({ navigation }) => {
  const [buildingFilter, setBuildingFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [appliedBuildingFilter, setAppliedBuildingFilter] = useState('');
  const [appliedFloorFilter, setAppliedFloorFilter] = useState('');
  const [appliedTypeFilter, setAppliedTypeFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);

  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['publicRooms'],
    queryFn: () => publicRooms(),
  });

  const dormitories = Array.isArray(roomsData) ? roomsData : [];

  const allRooms = useMemo(() => {
    let rooms = [];
    dormitories.forEach((dorm) => {
      if (Array.isArray(dorm.rooms)) {
        rooms = rooms.concat(
          dorm.rooms.map((room) => ({
            ...room,
            dormName: dorm.name,
            dormId: String(dorm.id || dorm._id || ''),
          }))
        );
      }
    });
    return rooms;
  }, [dormitories]);

  const filteredRooms = useMemo(() => {
    let rooms = [...allRooms];

    if (appliedBuildingFilter) {
      rooms = rooms.filter((r) => String(r.dormId) === String(appliedBuildingFilter));
    }
    if (appliedFloorFilter) {
      const floorInt = parseInt(appliedFloorFilter, 10);
      if (!Number.isNaN(floorInt)) {
        rooms = rooms.filter((r) => r.floor === floorInt);
      }
    }
    if (appliedTypeFilter) {
      rooms = rooms.filter((r) => String(r.roomType) === String(appliedTypeFilter));
    }

    return rooms;
  }, [allRooms, appliedBuildingFilter, appliedFloorFilter, appliedTypeFilter]);

  const roomsToRender = filteredRooms.slice(0, visibleCount);

  const stats = {
    totalRooms: filteredRooms.length,
    withPanoramas: filteredRooms.filter((r) => !!r.imageUrl).length,
    avgCapacity:
      filteredRooms.length > 0
        ? Math.round(
            filteredRooms.reduce((sum, r) => sum + (r.maxCapacity || 0), 0) /
              filteredRooms.length
          )
        : 0,
  };

  const buildingOptions = dormitories.map((dorm) => ({
    label: dorm.name,
    value: String(dorm.id || dorm._id || ''),
  }));

  const floorOptions = [...new Set(allRooms.map((r) => String(r.floor)).filter(Boolean))].sort(
    (a, b) => Number(a) - Number(b)
  );

  const typeOptions = [...new Set(allRooms.map((r) => String(r.roomType)).filter(Boolean))];

  function applyFilters() {
    setAppliedBuildingFilter(buildingFilter);
    setAppliedFloorFilter(floorFilter);
    setAppliedTypeFilter(typeFilter);
    setVisibleCount(12);
  }

  function toOrdinalFloor(value) {
    const n = Number(value);
    if (n === 1) return '1st Floor';
    if (n === 2) return '2nd Floor';
    if (n === 3) return '3rd Floor';
    return `${n}th Floor`;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏠 Explore Dormitory Rooms</Text>
        <Text style={styles.headerSubtitle}>Browse rooms with 360° panoramic views before applying</Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          ℹ️ Explore available rooms with interactive 360-degree views. Understanding room layouts helps with your allocation decision. All rooms shown are available for the upcoming academic year.
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>🏢 Building</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
            <Pressable
              style={[styles.filterOption, buildingFilter === '' && styles.filterOptionActive]}
              onPress={() => setBuildingFilter('')}
            >
              <Text style={[styles.filterOptionText, buildingFilter === '' && styles.filterOptionTextActive]}>
                All buildings
              </Text>
            </Pressable>
            {buildingOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.filterOption, buildingFilter === opt.value && styles.filterOptionActive]}
                onPress={() => setBuildingFilter(opt.value)}
              >
                <Text style={[styles.filterOptionText, buildingFilter === opt.value && styles.filterOptionTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>🔢 Floor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
            <Pressable
              style={[styles.filterOption, floorFilter === '' && styles.filterOptionActive]}
              onPress={() => setFloorFilter('')}
            >
              <Text style={[styles.filterOptionText, floorFilter === '' && styles.filterOptionTextActive]}>
                All floors
              </Text>
            </Pressable>
            {floorOptions.map((floor) => (
              <Pressable
                key={floor}
                style={[styles.filterOption, floorFilter === floor && styles.filterOptionActive]}
                onPress={() => setFloorFilter(floor)}
              >
                <Text style={[styles.filterOptionText, floorFilter === floor && styles.filterOptionTextActive]}>
                  {toOrdinalFloor(floor)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>🛏 Room Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
            <Pressable
              style={[styles.filterOption, typeFilter === '' && styles.filterOptionActive]}
              onPress={() => setTypeFilter('')}
            >
              <Text style={[styles.filterOptionText, typeFilter === '' && styles.filterOptionTextActive]}>
                All types
              </Text>
            </Pressable>
            {typeOptions.map((type) => (
              <Pressable
                key={type}
                style={[styles.filterOption, typeFilter === type && styles.filterOptionActive]}
                onPress={() => setTypeFilter(type)}
              >
                <Text style={[styles.filterOptionText, typeFilter === type && styles.filterOptionTextActive]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable style={styles.searchBtn} onPress={applyFilters}>
          <Text style={styles.searchBtnText}>🔍 Search</Text>
        </Pressable>
      </View>

      {filteredRooms.length > 0 && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{stats.totalRooms}</Text>
            <Text style={styles.statLabel}>Total Rooms</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{stats.withPanoramas}</Text>
            <Text style={styles.statLabel}>With 360 Views</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{stats.avgCapacity}</Text>
            <Text style={styles.statLabel}>Avg Capacity</Text>
          </View>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      )}

      {!isLoading && filteredRooms.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📭</Text>
          <Text style={styles.emptyStateTitle}>No rooms found</Text>
          <Text style={styles.emptyStateText}>No rooms match your search criteria. Try adjusting filters.</Text>
        </View>
      )}

      {!isLoading && roomsToRender.length > 0 && (
        <View style={styles.roomsGrid}>
          {roomsToRender.map((room, idx) => (
            <View key={`${room.roomNumber}-${idx}`} style={styles.roomCardWrapper}>
              <Pressable
                style={styles.roomCard}
                onPress={() =>
                  navigation.navigate('RoomDetail', {
                    dormId: room.dormId,
                    roomNumber: room.roomNumber,
                  })
                }
              >
                <View style={styles.roomImage}>
                  <Text style={styles.roomImageIcon}>🏠</Text>
                  <View style={[styles.roomBadge, !room.imageUrl && styles.roomBadgeNoView]}>
                    <Text style={styles.roomBadgeText}>{room.imageUrl ? '✓ 360°' : 'No view'}</Text>
                  </View>
                </View>

                <View style={styles.roomContent}>
                  <Text style={styles.roomTitle}>{room.dormName}-{room.roomNumber}</Text>
                  <Text style={styles.roomSubtitle}>Room {room.roomNumber} • Floor {room.floor}</Text>

                  <View style={styles.roomSpecs}>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>Type</Text>
                      <Text style={styles.specValue}>{room.roomType}</Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>Capacity</Text>
                      <Text style={styles.specValue}>{room.maxCapacity} students</Text>
                    </View>
                  </View>

                  {Array.isArray(room.amenities) && room.amenities.length > 0 ? (
                    <View style={styles.roomFeatures}>
                      {room.amenities.slice(0, 3).map((amenity, amenityIdx) => (
                        <View key={`${room.roomNumber}-${amenity}-${amenityIdx}`} style={styles.featureTag}>
                          <Text style={styles.featureText}>{amenity}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.roomActions}>
                    <Pressable
                      style={styles.btnView}
                      onPress={() =>
                        navigation.navigate('RoomDetail', {
                          dormId: room.dormId,
                          roomNumber: room.roomNumber,
                        })
                      }
                    >
                      <Text style={styles.btnViewText}>{room.imageUrl ? '👁 View 360°' : '📋 Details'}</Text>
                    </Pressable>
                    <Pressable style={styles.btnFavorite}>
                      <Text style={styles.btnFavoriteText}>❤️</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {!isLoading && visibleCount < filteredRooms.length && (
        <View style={styles.loadMoreWrap}>
          <Pressable style={styles.loadMoreButton} onPress={() => setVisibleCount((v) => v + 12)}>
            <Text style={styles.loadMoreText}>Load more</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666666',
  },
  infoBanner: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 6,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#1565c0',
  },
  controls: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterOptionActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
  },
  filterOptionTextActive: {
    color: '#ffffff',
  },
  searchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    backgroundColor: '#667eea',
    alignSelf: 'flex-end',
  },
  searchBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 11,
    color: '#999999',
    marginTop: 4,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 13,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 40,
    paddingVertical: 60,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
  },
  roomsGrid: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  roomCardWrapper: {
    marginBottom: 16,
  },
  roomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  roomImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  roomImageIcon: {
    fontSize: 40,
  },
  roomBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#4caf50',
  },
  roomBadgeNoView: {
    backgroundColor: '#999999',
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  roomContent: {
    padding: 16,
  },
  roomTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  roomSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
  },
  roomSpecs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  specItem: {
    width: '48%',
  },
  specLabel: {
    fontSize: 10,
    color: '#999999',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
  },
  roomFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  featureTag: {
    backgroundColor: '#f0f2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#667eea',
  },
  roomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnView: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#667eea',
    borderRadius: 6,
    alignItems: 'center',
  },
  btnViewText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnFavorite: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  btnFavoriteText: {
    fontSize: 16,
  },
  loadMoreWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
});

export default RoomsScreen;
