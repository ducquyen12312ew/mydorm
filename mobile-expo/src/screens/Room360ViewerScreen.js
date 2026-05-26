import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function Room360ViewerScreen({ navigation, route }) {
  const roomView = route?.params?.roomView || {
    building: 'Building A - Main Campus',
    roomNumber: '101',
    floor: 1,
    type: 'Single',
    capacity: 4,
    facilities: ['WiFi', 'Desk', 'Wardrobe'],
    panoramas: [
      { name: 'Main View', hotspots: [{}, {}] },
      { name: 'Window Side', hotspots: [{}] },
    ],
  };

  const [activePanorama, setActivePanorama] = useState(0);

  const views = useMemo(() => {
    return Array.isArray(roomView?.panoramas) ? roomView.panoramas : [];
  }, [roomView]);

  return (
    <View style={styles.root}>
      <View style={styles.viewerContainer}>
        <View style={styles.viewer}>
          <Text style={styles.viewerPlaceholder}>Viewer container</Text>
        </View>

        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>← Back</Text>
        </Pressable>

        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>🏠 Room 360° Viewer</Text>
            <Text style={styles.sidebarSubtitle}>Explore bedrooms interactively</Text>
          </View>

          <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarContent}>
            <View style={styles.roomInfo}>
              <View style={styles.roomInfoItem}>
                <Text style={styles.roomInfoLabel}>Building</Text>
                <Text style={styles.roomInfoValue}>{roomView.building}</Text>
              </View>
              <View style={styles.roomInfoItem}>
                <Text style={styles.roomInfoLabel}>Room Number</Text>
                <Text style={styles.roomInfoValue}>{roomView.roomNumber}</Text>
              </View>
              <View style={styles.roomInfoItem}>
                <Text style={styles.roomInfoLabel}>Floor</Text>
                <Text style={styles.roomInfoValue}>{roomView.floor}F</Text>
              </View>
              <View style={styles.roomInfoItem}>
                <Text style={styles.roomInfoLabel}>Type</Text>
                <Text style={styles.roomInfoValue}>{roomView.type}</Text>
              </View>
              <View style={styles.roomInfoItem}>
                <Text style={styles.roomInfoLabel}>Capacity</Text>
                <Text style={styles.roomInfoValue}>{roomView.capacity} students</Text>
              </View>
            </View>

            {Array.isArray(roomView.facilities) && roomView.facilities.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>✨ Facilities</Text>
                <View style={styles.facilitiesList}>
                  {roomView.facilities.map((facility, idx) => (
                    <View key={`${facility}-${idx}`} style={styles.facilityBadge}>
                      <Text style={styles.facilityText}>{facility}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.infoWrap}>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>Use your mouse or touch to explore the room. Click points of interest for more information.</Text>
              </View>
            </View>

            {views.length > 1 ? (
              <>
                <Text style={styles.sectionTitle}>📸 Views</Text>
                <View style={styles.panoramaSelector}>
                  {views.map((view, idx) => (
                    <Pressable
                      key={`${view.name || 'View'}-${idx}`}
                      style={[styles.panoramaItem, activePanorama === idx && styles.panoramaItemActive]}
                      onPress={() => setActivePanorama(idx)}
                    >
                      <Text style={styles.panoramaItemName}>{view.name || `View ${idx + 1}`}</Text>
                      <Text style={styles.panoramaItemHotspots}>{Array.isArray(view.hotspots) ? view.hotspots.length : 0} points of interest</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.controlsInfo}>
              <Text style={styles.controlsTitle}>🎮 Controls</Text>
              <View style={styles.controlItem}>
                <Text style={styles.controlKey}>🖱 Drag</Text>
                <Text style={styles.controlText}>or use trackpad to rotate</Text>
              </View>
              <View style={styles.controlItem}>
                <Text style={styles.controlKey}>+/-</Text>
                <Text style={styles.controlText}>or scroll wheel to zoom</Text>
              </View>
              <View style={styles.controlItem}>
                <Text style={styles.controlKey}>⬆ Arrow</Text>
                <Text style={styles.controlText}>up for autorotate</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  viewerContainer: { flex: 1 },
  viewer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  viewerPlaceholder: { color: '#fff', fontWeight: '600' },
  closeBtn: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, zIndex: 10 },
  closeBtnText: { color: '#111827', fontWeight: '700' },
  sidebar: { height: '48%', backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  sidebarHeader: { padding: 16, backgroundColor: '#667eea' },
  sidebarTitle: { color: '#fff', fontSize: 18, marginBottom: 4, fontWeight: '700' },
  sidebarSubtitle: { color: '#fff', opacity: 0.9, fontSize: 12 },
  sidebarScroll: { flex: 1 },
  sidebarContent: { paddingBottom: 16 },
  roomInfo: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  roomInfoItem: { marginBottom: 10 },
  roomInfoLabel: { color: '#999', fontSize: 12, marginBottom: 3, fontWeight: '500' },
  roomInfoValue: { color: '#333', fontWeight: '600' },
  sectionTitle: { paddingHorizontal: 16, paddingVertical: 10, fontWeight: '600', color: '#333', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  facilitiesList: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facilityBadge: { backgroundColor: '#f0f2ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  facilityText: { color: '#667eea', fontSize: 12, fontWeight: '500' },
  infoWrap: { paddingHorizontal: 16, paddingTop: 10 },
  infoBox: { backgroundColor: '#e3f2fd', borderLeftWidth: 3, borderLeftColor: '#2196f3', borderRadius: 3, padding: 10 },
  infoText: { color: '#1565c0', fontSize: 12 },
  panoramaSelector: { paddingHorizontal: 16, paddingVertical: 12 },
  panoramaItem: { backgroundColor: '#f5f5f5', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  panoramaItemActive: { backgroundColor: '#e8e8ff', borderLeftColor: '#667eea' },
  panoramaItemName: { color: '#333', fontWeight: '500', marginBottom: 3, fontSize: 13 },
  panoramaItemHotspots: { color: '#999', fontSize: 12 },
  controlsInfo: { borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: '#f9f9ff', padding: 16 },
  controlsTitle: { color: '#333', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  controlItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  controlKey: { backgroundColor: '#e0e0e0', color: '#333', borderRadius: 3, fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, marginRight: 5 },
  controlText: { color: '#666', fontSize: 12 },
});
