import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ApplicationScreen from '../screens/ApplicationScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import LoginScreen from '../screens/LoginScreen';
import MyRankingScreen from '../screens/MyRankingScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import Room360ViewerScreen from '../screens/Room360ViewerScreen';
import RoomsScreen from '../screens/RoomsScreen';
import StartupHomeScreen from '../screens/StartupHomeScreen';
import SupportScreen from '../screens/SupportScreen';
import BottomNavigation from '../components/BottomNavigation';
import { useAppStore } from '../store/useAppStore';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AuthRequired({ title, text, navigation }) {
  return (
    <View style={styles.authRoot}>
      <View style={styles.authCard}>
        <Text style={styles.authTitle}>{title}</Text>
        <Text style={styles.authText}>{text}</Text>
        <Pressable style={styles.authButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.authButtonText}>Đăng nhập</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProtectedProfileScreen({ navigation }) {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return <AuthRequired navigation={navigation} title="Hồ sơ" text="Hồ sơ yêu cầu đăng nhập" />;
  }

  return <ProfileScreen />;
}

function ProtectedApplicationScreen({ navigation }) {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return <AuthRequired navigation={navigation} title="Đăng ký KTX" text="Vui lòng đăng nhập để nộp đơn đăng ký." />;
  }

  return <ApplicationScreen />;
}

function ProtectedDashboardScreen({ navigation }) {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return <AuthRequired navigation={navigation} title="Đơn của tôi" text="Trang này chỉ dành cho sinh viên đã đăng nhập." />;
  }

  return <DashboardScreen />;
}

function ProtectedSupportScreen({ navigation }) {
  const user = useAppStore((s) => s.user);

  if (!user) {
    return <AuthRequired navigation={navigation} title="Hỗ trợ" text="Vui lòng đăng nhập để gửi yêu cầu hỗ trợ." />;
  }

  return <SupportScreen />;
}

function PoliciesScreen() {
  return (
    <View style={styles.staticRoot}>
      <View style={styles.staticCard}>
        <Text style={styles.staticTitle}>Chính sách</Text>
        <Text style={styles.staticText}>Nội dung chính sách được đồng bộ từ hệ thống web và backend hiện có.</Text>
      </View>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View style={styles.staticRoot}>
      <View style={styles.staticCard}>
        <Text style={styles.staticTitle}>Cài đặt</Text>
        <Text style={styles.staticText}>Quản lý thông báo, tài khoản và tùy chọn ứng dụng.</Text>
      </View>
    </View>
  );
}

function MainTabs() {
  const user = useAppStore((s) => s.user);
  const isAuthenticated = !!user;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }
      }}
      tabBar={(props) => <BottomNavigation {...props} isAuthenticated={isAuthenticated} />}
    >
      {isAuthenticated ? (
        <>
          <Tab.Screen name="HomeTab" component={StartupHomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
          <Tab.Screen name="SupportTab" component={SupportScreen} options={{ tabBarLabel: 'Hỗ trợ' }} />
          <Tab.Screen name="NotificationsTab" component={NotificationsScreen} options={{ tabBarLabel: 'Thông báo' }} />
          <Tab.Screen name="ProfileTab" component={ProtectedProfileScreen} options={{ tabBarLabel: 'Hồ sơ' }} />
        </>
      ) : (
        <>
          <Tab.Screen name="HomeTab" component={StartupHomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
          <Tab.Screen name="ExploreTab" component={RoomsScreen} options={{ tabBarLabel: 'Khám phá' }} />
          <Tab.Screen name="ApplyTab" component={ProtectedApplicationScreen} options={{ tabBarLabel: 'Đăng ký' }} />
          <Tab.Screen name="FavoritesTab" component={FavoritesScreen} options={{ tabBarLabel: 'Đã lưu' }} />
          <Tab.Screen name="ProfileTab" component={ProtectedProfileScreen} options={{ tabBarLabel: 'Hồ sơ' }} />
        </>
      )}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        headerShown: false
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Dashboard" component={ProtectedDashboardScreen} />
      <Stack.Screen name="Explore" component={RoomsScreen} />
      <Stack.Screen name="Ranking" component={MyRankingScreen} />
      <Stack.Screen name="Room360Viewer" component={Room360ViewerScreen} />
      <Stack.Screen name="Support" component={ProtectedSupportScreen} />
      <Stack.Screen name="Policies" component={PoliciesScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  authRoot: {
    flex: 1,
    backgroundColor: '#f4f7ff',
    justifyContent: 'center',
    padding: 16
  },
  authCard: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10
  },
  authTitle: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '800'
  },
  authText: {
    color: '#475569'
  },
  authButton: {
    marginTop: 4,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 12
  },
  authButtonText: {
    color: '#fff',
    fontWeight: '800'
  },
  staticRoot: {
    flex: 1,
    backgroundColor: '#f4f7ff',
    padding: 16
  },
  staticCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 16
  },
  staticTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800'
  },
  staticText: {
    marginTop: 8,
    color: '#475569'
  }
});
