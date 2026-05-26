import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login, me } from '../api/client';
import { useAppStore } from '../store/useAppStore';

export default function LoginScreen() {
  const navigation = useNavigation();
  const setUser = useAppStore((s) => s.setUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      const profile = await me();
      setUser(profile.user);
      navigation.replace('MainTabs');
    }
  });

  return (
    <LinearGradient colors={['#0f172a', '#1f9d8b']} style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.brand}>DormFlow Sinh viên</Text>
        <Text style={styles.title}>Đăng nhập</Text>

        <TextInput value={username} onChangeText={setUsername} style={styles.input} placeholder="Tên đăng nhập" />
        <TextInput value={password} onChangeText={setPassword} style={styles.input} placeholder="Mật khẩu" secureTextEntry />

        {loginMutation.error ? <Text style={styles.error}>Thông tin đăng nhập không hợp lệ.</Text> : null}

        <Pressable style={styles.button} onPress={() => loginMutation.mutate({ username, password, remember: true })}>
          <Text style={styles.buttonText}>{loginMutation.isPending ? 'Đang xử lý...' : 'Tiếp tục'}</Text>
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.backText}>Quay về Trang chủ</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, borderRadius: 24, backgroundColor: '#fff', padding: 20, gap: 12 },
  brand: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  button: { borderRadius: 14, backgroundColor: '#667eea', paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 12 },
  backButton: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: '#64748b', fontWeight: '600' }
});
