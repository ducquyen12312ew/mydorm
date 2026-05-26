import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput as TextInputType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  const passwordRef = useRef<TextInputType>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      haptic.warning();
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password);
      haptic.success();
      router.replace('/(tabs)/');
    } catch (err: any) {
      haptic.error();
      const raw = err?.response?.data?.error || err?.message || '';
      const msg =
        raw === 'Invalid mobile credentials'
          ? 'Tên đăng nhập hoặc mật khẩu không đúng'
          : raw === 'Too many mobile login attempts. Please try again later.'
          ? 'Quá nhiều lần thử. Vui lòng đợi vài phút.'
          : raw || 'Đăng nhập thất bại. Thử lại sau.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo block */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>KTX</Text>
            </View>
            <Text style={styles.appName}>Ký Túc Xá HUST</Text>
            <Text style={styles.tagline}>Cổng thông tin sinh viên</Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Đăng nhập</Text>
            <Text style={styles.formSubtitle}>
              Dùng tài khoản do Phòng Quản lý KTX cấp
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Username field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tên đăng nhập</Text>
              <View style={[styles.inputWrapper, focusedField === 'username' && styles.inputFocused]}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={focusedField === 'username' ? Colors.primary : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(t) => { setUsername(t); if (error) setError(''); }}
                  placeholder="Nhập tên đăng nhập"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mật khẩu</Text>
              <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={focusedField === 'password' ? Colors.primary : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => { haptic.selection(); setShowPassword((v) => !v); }}
                  style={styles.eyeBtn}
                  hitSlop={10}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              label="Đăng nhập"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.loginBtn}
              hapticFeedback={false}
            />
          </View>

          <Text style={styles.footerNote}>
            HUST Dormitory Management System v1.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },

  logoSection: { alignItems: 'center', marginBottom: Spacing.xl },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Shadow.md,
  },
  logoText: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textInverse, letterSpacing: 1 },
  appName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary },

  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.md,
    marginBottom: Spacing.md,
  },
  formTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  formSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 18 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1, lineHeight: 18 },

  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    minHeight: 50,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '40' },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
  },
  passwordInput: { paddingRight: 8 },
  eyeBtn: { padding: 4 },

  loginBtn: { marginTop: Spacing.xs },

  footerNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
