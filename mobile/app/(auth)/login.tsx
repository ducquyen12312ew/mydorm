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
  Image,
  ImageBackground,
  TextInput as TextInputType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';

const HERO_BG =
  'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773728947/e798a5fcd468c4914b9d4fa0a0d1d20f_vwlgof.jpg';
const HERO_LOGO =
  'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781631059/logoedorm_c33vj5.png';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      router.replace('/(tabs)');
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
    <View style={styles.root}>
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
          {/* ── Hero section ── */}
          <ImageBackground
            source={{ uri: HERO_BG }}
            style={[styles.hero, { paddingTop: insets.top }]}
            imageStyle={{ opacity: 0.7 }}
          >
            <View style={styles.heroOverlay}>
              <Image source={{ uri: HERO_LOGO }} style={styles.heroLogo} resizeMode="contain" />
              <Text style={styles.heroSub}>Hệ thống quản lý ký túc xá</Text>
              <Text style={styles.heroSub2}>Đại học Bách Khoa Hà Nội</Text>
            </View>
          </ImageBackground>

          {/* ── Form card ── */}
          <View style={[styles.formCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
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

            <Text style={styles.footerNote}>eDorm v1.0 · ĐHBK Hà Nội</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  hero: {
    width: '100%',
    height: 240,
    backgroundColor: '#1a1a2e',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heroLogo: {
    width: 180,
    height: 60,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    textAlign: 'center',
  },
  heroSub2: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    textAlign: 'center',
  },

  formCard: {
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 28,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
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
    marginTop: 'auto',
    paddingTop: Spacing.lg,
  },
});
