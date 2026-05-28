import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput as TextInputType,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  createMaintenanceRequest,
  MAINTENANCE_TYPES,
  MAINTENANCE_PRIORITIES,
} from '../../src/api/maintenance';
import { SafeLayout } from '../../src/components/SafeLayout';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { Spacing, Radius, Shadow } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { haptic } from '../../src/utils/haptics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const PRIORITY_COLORS: Record<string, string> = {
  low: Colors.textMuted,
  medium: Colors.warning,
  high: Colors.error,
  urgent: Colors.primary,
};

export default function NewMaintenanceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const [titleError, setTitleError] = useState('');
  const [descError, setDescError] = useState('');
  const [typeError, setTypeError] = useState('');

  const descRef = useRef<TextInputType>(null);

  const mutation = useMutation({
    mutationFn: createMaintenanceRequest,
    onSuccess: () => {
      haptic.success();
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      Alert.alert(
        'Đã gửi yêu cầu',
        'Yêu cầu bảo trì của bạn đã được ghi nhận. Chúng tôi sẽ liên hệ sớm nhất có thể.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (err: any) => {
      haptic.error();
      const msg = err?.response?.data?.error || 'Không thể gửi yêu cầu. Vui lòng thử lại.';
      Alert.alert('Lỗi', msg);
    },
  });

  const validate = (): boolean => {
    let valid = true;

    if (!selectedType) {
      setTypeError('Vui lòng chọn loại sự cố');
      valid = false;
    } else {
      setTypeError('');
    }

    const trimTitle = title.trim();
    if (trimTitle.length < 5) {
      setTitleError('Tiêu đề phải ít nhất 5 ký tự');
      valid = false;
    } else if (trimTitle.length > 200) {
      setTitleError('Tiêu đề không được vượt quá 200 ký tự');
      valid = false;
    } else {
      setTitleError('');
    }

    const trimDesc = description.trim();
    if (trimDesc.length < 10) {
      setDescError('Mô tả phải ít nhất 10 ký tự');
      valid = false;
    } else if (trimDesc.length > 2000) {
      setDescError('Mô tả không được vượt quá 2000 ký tự');
      valid = false;
    } else {
      setDescError('');
    }

    return valid;
  };

  const handleSubmit = () => {
    if (!validate()) {
      haptic.warning();
      return;
    }
    haptic.medium();
    mutation.mutate({ type: selectedType, title: title.trim(), description: description.trim(), priority });
  };

  return (
    <SafeLayout edges={['top', 'bottom']}>
      <ScreenHeader title="Yêu cầu mới" showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Loại sự cố <Text style={styles.required}>*</Text>
            </Text>
            {typeError ? <Text style={styles.fieldError}>{typeError}</Text> : null}
            <View style={styles.typeGrid}>
              {MAINTENANCE_TYPES.map(({ key, label, icon }) => {
                const active = selectedType === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeBtn, active && styles.typeBtnActive]}
                    onPress={() => {
                      haptic.selection();
                      setSelectedType(key);
                      if (typeError) setTypeError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={icon as IoniconsName}
                      size={20}
                      color={active ? Colors.textInverse : Colors.primary}
                    />
                    <Text style={[styles.typeBtnLabel, active && styles.typeBtnLabelActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Tiêu đề <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.inputBox, titleError ? styles.inputError : {}]}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={(t) => { setTitle(t); if (titleError) setTitleError(''); }}
                placeholder="Mô tả ngắn về vấn đề (5-200 ký tự)"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => descRef.current?.focus()}
                maxLength={200}
              />
            </View>
            {titleError ? <Text style={styles.fieldError}>{titleError}</Text> : (
              <Text style={styles.charCount}>{title.trim().length}/200</Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Mô tả chi tiết <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.inputBox, styles.textAreaBox, descError ? styles.inputError : {}]}>
              <TextInput
                ref={descRef}
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={(t) => { setDescription(t); if (descError) setDescError(''); }}
                placeholder="Mô tả chi tiết vấn đề, bao gồm vị trí cụ thể, mức độ nghiêm trọng... (10-2000 ký tự)"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                returnKeyType="default"
                maxLength={2000}
              />
            </View>
            {descError ? <Text style={styles.fieldError}>{descError}</Text> : (
              <Text style={styles.charCount}>{description.trim().length}/2000</Text>
            )}
          </View>

          {/* Priority */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Độ ưu tiên</Text>
            <View style={styles.priorityRow}>
              {MAINTENANCE_PRIORITIES.map(({ key, label }) => {
                const active = priority === key;
                const color = PRIORITY_COLORS[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.priorityChip,
                      active && { backgroundColor: color, borderColor: color },
                    ]}
                    onPress={() => { haptic.selection(); setPriority(key as typeof priority); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: active ? Colors.textInverse : color }]} />
                    <Text style={[styles.priorityLabel, active && styles.priorityLabelActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Info note */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
            <Text style={styles.infoText}>
              Yêu cầu sẽ được gửi tới ban quản lý KTX và xử lý theo thứ tự ưu tiên.
            </Text>
          </View>

          <Button
            label="Gửi yêu cầu"
            onPress={handleSubmit}
            loading={mutation.isPending}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },

  section: { gap: 8 },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  required: { color: Colors.error },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeBtn: {
    width: '18%',
    minWidth: 60,
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 6,
    ...Shadow.sm,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', lineHeight: 13 },
  typeBtnLabelActive: { color: Colors.textInverse, fontWeight: FontWeight.semibold },

  inputBox: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  textAreaBox: { paddingVertical: Spacing.sm },
  inputError: { borderColor: Colors.error },
  input: {
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
  },
  textArea: { height: 120, paddingVertical: Spacing.sm },

  fieldError: { fontSize: FontSize.xs, color: Colors.error, marginTop: 2 },
  charCount: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },

  priorityRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  priorityLabelActive: { color: Colors.textInverse, fontWeight: FontWeight.semibold },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.infoLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.info, lineHeight: 18 },

  submitBtn: { marginTop: Spacing.xs },
});
