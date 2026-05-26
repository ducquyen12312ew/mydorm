import { Pressable, StyleSheet, Text, View } from 'react-native';
import FloatingActionButton from './FloatingActionButton';

function TabItem({ label, isActive, onPress }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

export default function BottomNavigation({ state, descriptors, navigation, isAuthenticated }) {
  const showFab = !isAuthenticated;

  const onFabPress = () => {
    navigation.navigate('ApplyTab');
  };

  const guestRoutes = showFab
    ? [
        state.routes[0],
        state.routes[1],
        { key: 'fab-spacer' },
        state.routes[3],
        state.routes[4]
      ]
    : state.routes;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {guestRoutes.map((route, index) => {
          if (!route?.name) {
            return <View key="fab-spacer" style={styles.fabSpacer} />;
          }

          const realIndex = state.routes.findIndex((item) => item.key === route.key);
          const descriptor = descriptors[route.key] || {};
          const options = descriptor.options || {};
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const isFocused = state.index === realIndex;

          return (
            <TabItem
              key={route.key}
              label={label}
              isActive={isFocused}
              onPress={() => navigation.navigate(route.name)}
            />
          );
        })}
      </View>

      {showFab ? <FloatingActionButton onPress={onFabPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  bar: {
    minHeight: 70,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 10
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700'
  },
  tabLabelActive: {
    color: '#667eea'
  },
  fabSpacer: {
    width: 66
  }
});
