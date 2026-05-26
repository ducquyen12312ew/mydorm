import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Navbar from './Navbar';
import { publicRooms } from '../api/client';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['publicRooms'],
    queryFn: () => publicRooms(),
  });

  const benefits = [
    { icon: '📡', label: 'Wifi tốc độ cao' },
    { icon: '🔒', label: 'An ninh 24/7' },
    { icon: '📚', label: 'Phòng tự học' },
    { icon: '🧺', label: 'Khu giặt sấy' },
    { icon: '📍', label: 'Gần trường' },
    { icon: '🌳', label: 'Không gian xanh' },
  ];

  const dormitories = roomsData?.dormitories || [];
  const cardWidth = width - 40;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Navbar currentPage="home" userName="Sinh viên" />

      {/* HERO SECTION */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Ký túc xá Đại học Bách Khoa</Text>
          <Text style={styles.heroSubtitle}>Không gian sống hiện đại dành cho sinh viên</Text>
        </View>

        {/* 3D Viewer Button */}
        <View style={styles.heroInteractiveZone}>
          <Pressable
            style={styles.hero3dBtn}
            onPress={() => navigation.navigate('RoomViewer')}
          >
            <Text style={styles.hero3dBtnText}>Xem phòng 3D</Text>
          </Pressable>
        </View>

        {/* Hero Background Gradient */}
        <View style={styles.heroImageLayer} />
      </View>

      {/* ROOMS SECTION */}
      <View style={styles.roomsSection}>
        <View style={styles.container2}>
          <Text style={styles.sectionTitle}>Danh mục ký túc xá</Text>
          <Text style={styles.sectionSubtitle}>Xem nhanh toàn bộ khu ký túc xá và chọn nơi ở phù hợp.</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          ) : (
            <View style={styles.dormSliderContainer}>
              <FlatList
                data={dormitories.slice(0, 3)}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardWidth + 20}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.roomCard}
                    onPress={() => navigation.navigate('RoomDetail', { dormId: item.id })}
                  >
                    <View style={styles.roomImage}>
                      <Text style={styles.roomImageIcon}>🏢</Text>
                    </View>
                    <View style={styles.roomContent}>
                      <Text style={styles.roomTitle}>{item.name}</Text>
                      <Text style={styles.roomSubtitle}>{item.address}</Text>
                      <View style={styles.roomSpecs}>
                        <View style={styles.specItem}>
                          <Text style={styles.specLabel}>Phòng</Text>
                          <Text style={styles.specValue}>{item.totalRooms}</Text>
                        </View>
                        <View style={styles.specItem}>
                          <Text style={styles.specLabel}>Giá</Text>
                          <Text style={styles.specValue}>{item.category}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      </View>

      {/* BENEFITS SECTION */}
      <View style={styles.benefitsSection}>
        <View style={styles.container2}>
          <View style={styles.benefitsLayout}>
            <View style={styles.benefitsTextContainer}>
              <Text style={styles.benefitsLabel}>TIỆN ÍCH KÝ TÚC XÁ</Text>
              <Text style={styles.benefitsTitle}>Vì sao nên chọn ký túc xá?</Text>
              <Text style={styles.benefitsDesc}>
                Không gian sống cân bằng giữa học tập và sinh hoạt, tối ưu di chuyển trong khuôn viên
                và tạo trải nghiệm an toàn cho sinh viên.
              </Text>

              {/* Benefits Grid */}
              <View style={styles.benefitsGrid}>
                {benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                    <Text style={styles.benefitText}>{benefit.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Benefits Image Placeholder */}
            <View style={styles.benefitsImageWrap}>
              <View style={styles.benefitsImage} />
            </View>
          </View>
        </View>
      </View>

      {/* MAP SECTION */}
      <View style={styles.mapSection}>
        <View style={styles.container2}>
          <Text style={styles.sectionTitle}>Bản đồ ký túc xá</Text>
          <Text style={styles.sectionSubtitle}>
            Tra cứu vị trí nhanh với popup chi tiết và bản đồ tương tác.
          </Text>

          <View style={styles.mapShell}>
            <View style={styles.mapTop}>
              <Text style={styles.mapTopText}>
                Nhấp vào marker để xem thông tin phòng và vị trí đặc chính xác.
              </Text>
            </View>
            <View style={styles.mapWrapper}>
              <View style={styles.mapPlaceholder} />
            </View>
          </View>
        </View>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.container2}>
          <View style={styles.footerGrid}>
            <View style={styles.footerItem}>
              <Text style={styles.footerTitle}>Giới thiệu</Text>
              <Text style={styles.footerText}>
                Ký túc xá Đại học Bách Khoa mang đến không gian sống an toàn, hiện đại và tiện nghi cho sinh viên.
              </Text>
            </View>

            <View style={styles.footerItem}>
              <Text style={styles.footerTitle}>Đặt chỗ</Text>
              <Pressable onPress={() => navigation.navigate('Application')}>
                <Text style={styles.footerLink}>Đăng ký phòng trực tuyến</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('RoomStatus')}>
                <Text style={styles.footerLink}>Theo dõi trạng thái hồ sơ</Text>
              </Pressable>
            </View>

            <View style={styles.footerItem}>
              <Text style={styles.footerTitle}>Giờ mở cửa</Text>
              <Text style={styles.footerText}>Thứ 2 - Thứ 6: 08:00 - 20:00</Text>
              <Text style={styles.footerText}>Thứ 7 - Chủ nhật: 08:00 - 17:00</Text>
            </View>

            <View style={styles.footerItem}>
              <Text style={styles.footerTitle}>Địa chỉ</Text>
              <Text style={styles.footerText}>Đại Cồ Việt, Hai Bà Trưng, Hà Nội</Text>
              <Text style={styles.footerText}>Email: ktx@hust.edu.vn</Text>
              <Text style={styles.footerText}>Hotline: 1900 6868</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container2: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  
  // Hero Section
  heroSection: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    backgroundColor: '#f5f7fa',
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  heroInteractiveZone: {
    alignItems: 'center',
  },
  hero3dBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#667eea',
    borderRadius: 8,
    marginVertical: 16,
  },
  hero3dBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  heroImageLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    zIndex: -1,
  },

  // Rooms Section
  roomsSection: {
    paddingVertical: 30,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 20,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dormSliderContainer: {
    marginHorizontal: -16,
  },
  roomCard: {
    marginHorizontal: 8,
    marginBottom: 16,
    width: width - 40,
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
    backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomImageIcon: {
    fontSize: 48,
  },
  roomContent: {
    padding: 16,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  roomSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
  },
  roomSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specItem: {
    flex: 1,
  },
  specLabel: {
    fontSize: 11,
    color: '#999999',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
  },

  // Benefits Section
  benefitsSection: {
    paddingVertical: 30,
    backgroundColor: '#f5f7fa',
  },
  benefitsLayout: {
    flexDirection: 'column',
  },
  benefitsTextContainer: {
    marginBottom: 24,
  },
  benefitsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  benefitsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },
  benefitsDesc: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 20,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  benefitItem: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  benefitIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'center',
  },
  benefitsImageWrap: {
    marginTop: 20,
  },
  benefitsImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
  },

  // Map Section
  mapSection: {
    paddingVertical: 30,
    backgroundColor: '#ffffff',
  },
  mapShell: {
    marginTop: 16,
  },
  mapTop: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  mapTopText: {
    fontSize: 12,
    color: '#666666',
  },
  mapWrapper: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    height: 300,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
  },

  // Footer
  footer: {
    backgroundColor: '#2c3e50',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  footerGrid: {
    gap: 20,
  },
  footerItem: {
    marginBottom: 12,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#b0bec5',
    marginBottom: 4,
  },
  footerLink: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
    marginBottom: 4,
  },
});

export default HomeScreen;
