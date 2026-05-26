import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Navbar = ({ currentPage = 'home', userName = 'Người dùng' }) => {
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = [
    { label: 'TRANG CHỦ', page: 'home', route: 'Home' },
    { label: 'DANH SÁCH', page: 'map', route: 'Rooms' },
    { label: 'ĐĂNG KÝ PHÒNG', page: 'register', route: 'Application' },
    { label: 'TRẠNG THÁI PHÒNG', page: 'room-status', route: 'RoomStatus' },
    { label: 'BẢO TRÌ', page: 'maintenance', route: 'Maintenance' },
  ];

  const handleNavPress = (route) => {
    navigation.navigate(route);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    setProfileOpen(false);
    navigation.navigate('Login');
  };

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContent}>
        {/* Logo */}
        <View style={styles.headerLogo}>
          <Text style={styles.logoText}>🏠</Text>
        </View>

        {/* Menu Toggle (Mobile) */}
        <Pressable
          style={styles.menuToggle}
          onPress={() => setMenuOpen(!menuOpen)}
        >
          <View style={styles.hamburger} />
          <View style={styles.hamburger} />
          <View style={styles.hamburger} />
        </Pressable>

        {/* Nav Container */}
        <View style={[styles.navContainer, menuOpen && styles.navContainerActive]}>
          {/* Nav Links */}
          <ScrollView style={styles.navLinks} horizontal>
            {navItems.map((item) => (
              <Pressable
                key={item.page}
                style={[
                  styles.navLink,
                  currentPage === item.page && styles.navLinkActive,
                ]}
                onPress={() => handleNavPress(item.route)}
              >
                <Text
                  style={[
                    styles.navLinkText,
                    currentPage === item.page && styles.navLinkTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* User Profile Dropdown */}
          <View style={styles.userProfile}>
            <Pressable
              style={styles.avatarContainer}
              onPress={() => setProfileOpen(!profileOpen)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
            </Pressable>

            {profileOpen && (
              <View style={styles.dropdownMenu}>
                <Pressable
                  style={styles.dropdownItem}
                  onPress={() => {
                    navigation.navigate('Profile');
                    setProfileOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>👤 Hồ sơ</Text>
                </Pressable>
                <View style={styles.dropdownDivider} />
                <Pressable
                  style={styles.dropdownItem}
                  onPress={handleLogout}
                >
                  <Text style={[styles.dropdownItemText, styles.logoutText]}>🚪 Đăng xuất</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Overlay for mobile menu */}
      {menuOpen && (
        <Pressable
          style={styles.overlay}
          onPress={() => setMenuOpen(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  headerLogo: {
    fontSize: 24,
    fontWeight: '700',
  },
  logoText: {
    fontSize: 28,
  },
  menuToggle: {
    padding: 8,
    display: 'none', // Hidden on larger screens, would be shown on mobile
  },
  hamburger: {
    width: 24,
    height: 2,
    backgroundColor: '#2c3e50',
    marginVertical: 4,
    borderRadius: 1,
  },
  navContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  navContainerActive: {
    flexDirection: 'column',
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingBottom: 16,
  },
  navLinks: {
    flexDirection: 'row',
    gap: 8,
  },
  navLink: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  navLinkActive: {
    backgroundColor: '#d63031',
  },
  navLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
  },
  navLinkTextActive: {
    color: '#ffffff',
  },
  userProfile: {
    position: 'relative',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  userName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2c3e50',
    maxWidth: 80,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 160,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: '500',
  },
  logoutText: {
    color: '#d63031',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default Navbar;
