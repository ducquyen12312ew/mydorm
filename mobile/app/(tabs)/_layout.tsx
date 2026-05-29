import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../../src/api/notifications';
import { Colors } from '../../src/constants/colors';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { useStudentSocket } from '../../src/realtime/useSocketEvents';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  activeName,
  label,
  focused,
}: {
  name: IoniconsName;
  activeName: IoniconsName;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? activeName : name}
        size={24}
        color={focused ? Colors.tabActive : Colors.tabInactive}
      />
      {/* No label text — icons are self-explanatory with the active color indicator */}
    </View>
  );
}

function NotifTabIcon({ focused }: { focused: boolean }) {
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(30),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const unreadCount = notifications?.filter((n: { isRead: boolean }) => !n.isRead).length ?? 0;

  return (
    <View style={styles.tabItem}>
      <View>
        <Ionicons
          name={focused ? 'notifications' : 'notifications-outline'}
          size={24}
          color={focused ? Colors.tabActive : Colors.tabInactive}
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore();
  useStudentSocket(isAuthenticated);

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Tổng quan',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="home-outline"
              activeName="home"
              label="Tổng quan"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          tabBarLabel: 'Phòng ở',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="business-outline"
              activeName="business"
              label="Phòng ở"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarLabel: 'Thông báo',
          tabBarIcon: ({ focused }) => <NotifTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Hồ sơ',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="person-outline"
              activeName="person"
              label="Hồ sơ"
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});
