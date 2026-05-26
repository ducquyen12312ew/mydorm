import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { logout, publicRooms } from '../api/client';
import DrawerMenu from '../components/DrawerMenu';
import { useAppStore } from '../store/useAppStore';

const BENEFITS = [
  { icon: '📶', label: 'Wifi tốc độ cao' },
  { icon: '🛡️', label: 'An ninh 24/7' },
  { icon: '📚', label: 'Phòng tự học' },
  { icon: '🧺', label: 'Khu giặt sấy' },
  { icon: '📍', label: 'Gần trường' },
  { icon: '🌳', label: 'Không gian xanh' }
];

function computeStats(dormitories) {
  return dormitories.reduce(
    (accumulator, dormitory) => {
      accumulator.dormitories += 1;
      (dormitory.rooms || []).forEach((room) => {
        accumulator.totalRooms += 1;
        accumulator.availableBeds += Number(room.availableBeds || room.capacity || 0);
      });
      return accumulator;
    },
    { dormitories: 0, totalRooms: 0, availableBeds: 0 }
  );
}

function getRoomNumber(room) {
  return room.roomNumber || room.number || room.name || room.code || room.id || '---';
}

function getRoomSummary(room) {
  const parts = [];
  if (room.roomType) parts.push(room.roomType);
  if (room.floor !== undefined && room.floor !== null && room.floor !== '') parts.push(`Tầng ${room.floor}`);
  if (room.availableBeds !== undefined && room.availableBeds !== null) parts.push(`${room.availableBeds} chỗ trống`);
  if (room.capacity !== undefined && room.capacity !== null) parts.push(`Sức chứa ${room.capacity}`);
  return parts.join(' · ');
}

function buildFeaturedRooms(dormitories) {
  return dormitories
    .flatMap((dormitory) =>
      (dormitory.rooms || []).slice(0, 2).map((room) => ({
        dormitory,
        room,
        key: String(room.id || room._id || `${dormitory.id}-${getRoomNumber(room)}`)
      }))
    )
    .slice(0, 5);
}

function SectionCard({ title, subtitle, children, compact = false }) {
  return (
    <View style={[styles.sectionCard, compact && styles.sectionCardCompact]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonMedia} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLineLarge} />
        <View style={styles.skeletonLineSmall} />
      </View>
    </View>
  );
}

function FeaturedRoomCard({ item }) {
  const { dormitory, room } = item;

  return (
    <View style={styles.featureCard}>
      <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureMedia}>
        <Text style={styles.featureEmoji}>🏠</Text>
      </LinearGradient>
      <View style={styles.featureBody}>
        <Text style={styles.featureDorm}>{dormitory.name}</Text>
        <Text style={styles.featureTitle}>Room {getRoomNumber(room)}</Text>
        <Text style={styles.featureMeta}>{getRoomSummary(room)}</Text>
      </View>
    </View>
  );
}

export default function StartupHomeScreen({ navigation }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

  const roomsQuery = useQuery({
    queryKey: ['public-rooms'],
    queryFn: publicRooms
  });

  const dormitories = roomsQuery.data || [];
  const stats = useMemo(() => computeStats(dormitories), [dormitories]);
  const featuredRooms = useMemo(() => buildFeaturedRooms(dormitories), [dormitories]);

  const avatarLabel = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.root}
        refreshControl={<RefreshControl refreshing={roomsQuery.isRefetching} onRefresh={roomsQuery.refetch} tintColor="#667eea" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.headerShell}>
            <Pressable style={styles.headerIconButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel="Open navigation menu">
              <Text style={styles.headerIconText}>☰</Text>
            </Pressable>

            <View style={styles.headerCenter}>
              <View style={styles.headerLogo}>
                <Text style={styles.headerLogoText}>KTX</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>Ký túc xá Đại học Bách Khoa</Text>
                <Text style={styles.headerSubtitle}>Trang chủ sinh viên</Text>
              </View>
            </View>

            <Pressable
              style={styles.headerAvatar}
              onPress={() => {
                if (user) {
                  navigation.navigate('ProfileTab');
                  return;
                }

                navigation.navigate('Login');
              }}
            >
              <Text style={styles.headerAvatarText}>{avatarLabel}</Text>
            </Pressable>
          </View>

          <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroBrand}>KTX HUST</Text>
              <View style={styles.heroIconCircle}>
                <Text style={styles.heroIcon}>🏛️</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Ký túc xá Đại học Bách Khoa</Text>
            <Text style={styles.heroSubtitle}>Không gian sống hiện đại dành cho sinh viên</Text>

            <Pressable
              style={styles.heroCta}
              onPress={() => {
                if (user) {
                  navigation.navigate('ApplyTab');
                  return;
                }

                navigation.navigate('Login');
              }}
            >
              <Text style={styles.heroCtaText}>Đăng ký ngay</Text>
            </Pressable>

            <View style={styles.heroSecondaryRow}>
              <Pressable style={styles.heroSecondaryButton} onPress={() => navigation.navigate('Explore')}>
                <Text style={styles.heroSecondaryButtonText}>Xem phòng 3D</Text>
              </Pressable>
            </View>
          </LinearGradient>

          <SectionCard title="Danh mục ký túc xá" subtitle="Xem nhanh toàn bộ khu ký túc xá và chọn nơi ở phù hợp.">
            <View style={styles.roomGrid}>
              {roomsQuery.isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : featuredRooms.length > 0 ? (
                featuredRooms.map((item) => <FeaturedRoomCard key={item.key} item={item} />)
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Đang tải dữ liệu phòng...</Text>
                </View>
              )}
            </View>
          </SectionCard>

          <SectionCard compact title="Vì sao nên chọn ký túc xá?" subtitle="Không gian sống cân bằng giữa học tập và sinh hoạt, tối ưu di chuyển trong khuôn viên và tạo trải nghiệm an toàn cho sinh viên.">
            <View style={styles.benefitsGrid}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.label} style={styles.benefitItem}>
                  <View style={styles.benefitIconWrap}>
                    <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                  </View>
                  <Text style={styles.benefitText}>{benefit.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.benefitsImageWrap}>
              <Image
                source={{ uri: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773728947/e798a5fcd468c4914b9d4fa0a0d1d20f_vwlgof.jpg' }}
                style={styles.benefitsImage}
                resizeMode="cover"
              />
            </View>
          </SectionCard>

          <SectionCard title="Bản đồ ký túc xá" subtitle="Tra cứu vị trí nhanh với popup chi tiết, cụm marker thông minh và danh sách tòa nhà liên kết trực tiếp với bản đồ.">
            <View style={styles.mapShell}>
              <View style={styles.mapTop}>
                <Text style={styles.mapTopText}>
                  Nhấp vào marker để xem hình ảnh, địa chỉ, thông tin phòng và nút hành động. Bản đồ tự căn khung theo dữ liệu hiện có.
                </Text>
              </View>

              <View style={styles.mapWrapper}>
                <View style={styles.mapSidebar}>
                  {(dormitories.slice(0, 4).length > 0 ? dormitories.slice(0, 4) : [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]).map((dormitory, index) => (
                    <View key={`${dormitory.name || 'dorm'}-${index}`} style={styles.mapSidebarItem}>
                      <View style={styles.mapSidebarDot} />
                      <View style={styles.mapSidebarContent}>
                        <Text style={styles.mapSidebarTitle}>{dormitory.name || `Building ${String.fromCharCode(65 + index)}`}</Text>
                        <Text style={styles.mapSidebarText}>{dormitory.address || 'Đại Cồ Việt, Hai Bà Trưng, Hà Nội'}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.mapCanvas}>
                  <View style={[styles.mapPin, styles.pinOne]}>
                    <Text style={styles.mapPinText}>A</Text>
                  </View>
                  <View style={[styles.mapPin, styles.pinTwo]}>
                    <Text style={styles.mapPinText}>B</Text>
                  </View>
                  <View style={[styles.mapPin, styles.pinThree]}>
                    <Text style={styles.mapPinText}>C</Text>
                  </View>
                  <Text style={styles.mapCanvasText}>Dormitory Map</Text>
                </View>
              </View>
            </View>
          </SectionCard>

          <View style={styles.footer}>
            <View style={styles.footerGrid}>
              <View style={styles.footerCard}>
                <Text style={styles.footerTitle}>Giới thiệu</Text>
                <Text style={styles.footerText}>Ký túc xá Đại học Bách Khoa mang đến không gian sống an toàn, hiện đại và tiện nghi cho sinh viên.</Text>
              </View>
              <View style={styles.footerCard}>
                <Text style={styles.footerTitle}>Đặt chỗ</Text>
                <Text style={styles.footerLink}>Đăng ký phòng trực tuyến</Text>
                <Text style={styles.footerLink}>Theo dõi trạng thái hồ sơ</Text>
              </View>
              <View style={styles.footerCard}>
                <Text style={styles.footerTitle}>Giờ mở cửa</Text>
                <Text style={styles.footerText}>Thứ 2 - Thứ 6: 08:00 - 20:00</Text>
                <Text style={styles.footerText}>Thứ 7 - Chủ nhật: 08:00 - 17:00</Text>
              </View>
              <View style={styles.footerCard}>
                <Text style={styles.footerTitle}>Địa chỉ</Text>
                <Text style={styles.footerText}>Đại Cồ Việt, Hai Bà Trưng, Hà Nội</Text>
                <Text style={styles.footerText}>Email: ktx@hust.edu.vn</Text>
                <Text style={styles.footerText}>Hotline: 1900 6868</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={(routeName) => navigation.navigate(routeName)}
        showLogout={!!user}
        onLogout={async () => {
          try {
            await logout();
          } finally {
            setUser(null);
            navigation.navigate('HomeTab');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7ff'
  },
  root: {
    paddingBottom: 28
  },
  container: {
    padding: 16,
    gap: 14
  },
  headerShell: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff'
  },
  headerIconText: {
    color: '#4f46e5',
    fontSize: 18,
    fontWeight: '800'
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea'
  },
  headerLogoText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800'
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0'
  },
  headerAvatarText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800'
  },
  hero: {
    borderRadius: 26,
    padding: 18,
    gap: 10,
    shadowColor: '#312e81',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 4
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heroBrand: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2
  },
  heroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroIcon: {
    fontSize: 20
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800'
  },
  heroSubtitle: {
    color: '#ede9fe',
    fontSize: 15,
    lineHeight: 22
  },
  heroCta: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  heroCtaText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '800'
  },
  heroSecondaryRow: {
    flexDirection: 'row',
    gap: 10
  },
  heroSecondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  heroSecondaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2
  },
  sectionCardCompact: {
    paddingBottom: 18
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800'
  },
  sectionSub: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 20
  },
  roomGrid: {
    gap: 12
  },
  skeletonCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  skeletonMedia: {
    height: 160,
    backgroundColor: '#dbe4ff'
  },
  skeletonBody: {
    padding: 14,
    gap: 8
  },
  skeletonLineLarge: {
    height: 16,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    width: '62%'
  },
  skeletonLineSmall: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#edf2f7',
    width: '82%'
  },
  featureCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  featureMedia: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center'
  },
  featureEmoji: {
    fontSize: 60,
    color: '#ffffff'
  },
  featureBody: {
    padding: 14
  },
  featureDorm: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  featureTitle: {
    marginTop: 6,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800'
  },
  featureMeta: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    lineHeight: 19
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 18
  },
  emptyText: {
    color: '#64748b',
    fontWeight: '700'
  },
  benefitsGrid: {
    gap: 10
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  benefitIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff'
  },
  benefitIcon: {
    fontSize: 17
  },
  benefitText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  benefitsImageWrap: {
    marginTop: 6,
    borderRadius: 18,
    overflow: 'hidden'
  },
  benefitsImage: {
    width: '100%',
    height: 210,
    backgroundColor: '#dbeafe'
  },
  mapShell: {
    gap: 12
  },
  mapTop: {
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    padding: 14
  },
  mapTopText: {
    color: '#4338ca',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600'
  },
  mapWrapper: {
    gap: 12
  },
  mapSidebar: {
    gap: 10
  },
  mapSidebarItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  mapSidebarDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: 5,
    backgroundColor: '#667eea'
  },
  mapSidebarContent: {
    flex: 1,
    gap: 2
  },
  mapSidebarTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800'
  },
  mapSidebarText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17
  },
  mapCanvas: {
    minHeight: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  mapCanvasText: {
    color: '#4338ca',
    fontSize: 16,
    fontWeight: '800',
    opacity: 0.85
  },
  mapPin: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 2
  },
  pinOne: {
    top: '22%',
    left: '18%'
  },
  pinTwo: {
    top: '48%',
    left: '57%'
  },
  pinThree: {
    top: '66%',
    left: '28%'
  },
  mapPinText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '800'
  },
  footer: {
    borderRadius: 22,
    backgroundColor: '#0f172a',
    padding: 16
  },
  footerGrid: {
    gap: 12
  },
  footerCard: {
    gap: 8
  },
  footerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  footerText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19
  },
  footerLink: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700'
  }
});
