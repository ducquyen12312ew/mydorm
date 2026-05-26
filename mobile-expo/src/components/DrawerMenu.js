import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const MENU_ITEMS = [
  { label: 'Khám phá phòng', routeName: 'Explore' },
  { label: 'Đơn của tôi', routeName: 'Dashboard' },
  { label: 'Chính sách', routeName: 'Policies' },
  { label: 'Hỗ trợ', routeName: 'Support' },
  { label: 'Cài đặt', routeName: 'Settings' }
];

export default function DrawerMenu({ visible, onClose, onNavigate, showLogout, onLogout }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.drawer}>
          <Text style={styles.title}>Danh mục</Text>

          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.routeName}
              style={styles.item}
              onPress={() => {
                onNavigate(item.routeName);
                onClose();
              }}
            >
              <Text style={styles.itemText}>{item.label}</Text>
            </Pressable>
          ))}

          {showLogout ? (
            <Pressable
              style={[styles.item, styles.logoutItem]}
              onPress={() => {
                onLogout();
                onClose();
              }}
            >
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row'
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)'
  },
  drawer: {
    width: 290,
    backgroundColor: '#ffffff',
    paddingTop: 48,
    paddingHorizontal: 18,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8
  },
  item: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc'
  },
  itemText: {
    color: '#1e293b',
    fontWeight: '700'
  },
  logoutItem: {
    marginTop: 10,
    backgroundColor: '#fee2e2'
  },
  logoutText: {
    color: '#991b1b',
    fontWeight: '800'
  }
});
