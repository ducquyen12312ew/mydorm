import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function FloatingActionButton({ onPress }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center'
  },
  button: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6
  },
  plus: {
    color: '#f8fafc',
    fontSize: 30,
    lineHeight: 30,
    marginTop: -2,
    fontWeight: '700'
  }
});
