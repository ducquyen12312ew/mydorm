import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation } from '@tanstack/react-query';
import { submitApplication } from '../api/client';

const ApplicationScreen = ({ navigation }) => {
  // Form state
  const [academicYear, setAcademicYear] = useState('2024-2025');
  const [distance, setDistance] = useState(250);
  const [financialTier, setFinancialTier] = useState('tier2');
  const [priorityLevel, setPriorityLevel] = useState('normal');
  const [priorityReason, setPriorityReason] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [buildingPreferences, setBuildingPreferences] = useState([]);
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [filesUploaded, setFilesUploaded] = useState(0);

  const mutation = useMutation({
    mutationFn: submitApplication,
    onSuccess: () => {
      Alert.alert('Thành công', 'Đơn đăng ký của bạn đã được gửi');
      resetForm();
    },
    onError: (error) => {
      Alert.alert('Lỗi', error.message || 'Không thể gửi đơn đăng ký');
    },
  });

  const resetForm = () => {
    setAcademicYear('2024-2025');
    setDistance(250);
    setFinancialTier('tier2');
    setPriorityLevel('normal');
    setPriorityReason('');
    setSpecialNeeds('');
    setBuildingPreferences([]);
    setFilesUploaded(0);
  };

  const getDistanceDescription = () => {
    if (distance < 100) return 'Rất gần';
    if (distance < 300) return 'Khoảng cách vừa phải';
    if (distance < 600) return 'Khá xa';
    return 'Rất xa';
  };

  const financialTiers = [
    { id: 'tier1', title: 'Hỗ trợ tối đa', desc: 'Thu nhập <100 triệu' },
    { id: 'tier2', title: 'Hỗ trợ trung bình', desc: 'Thu nhập 100-200 triệu' },
    { id: 'tier3', title: 'Hỗ trợ tối thiểu', desc: 'Thu nhập 200-400 triệu' },
    { id: 'tier4', title: 'Không hỗ trợ', desc: 'Thu nhập >400 triệu' },
  ];

  const priorityLevels = [
    { id: 'low', label: 'Thấp', desc: 'Không ưu tiên' },
    { id: 'normal', label: 'Bình thường', desc: 'Ưu tiên bình thường' },
    { id: 'high', label: 'Cao', desc: 'Ưu tiên cao' },
    { id: 'urgent', label: 'Khẩn cấp', desc: 'Ưu tiên khẩn cấp' },
  ];

  const buildingOptions = [
    { id: 'A', name: 'Tòa A' },
    { id: 'B', name: 'Tòa B' },
    { id: 'C', name: 'Tòa C' },
    { id: 'D', name: 'Tòa D' },
  ];

  const calculateScore = () => {
    let score = 0;

    // Financial tier impact
    switch (financialTier) {
      case 'tier1':
        score += 30;
        break;
      case 'tier2':
        score += 20;
        break;
      case 'tier3':
        score += 10;
        break;
      default:
        score += 0;
    }

    // Priority level impact
    switch (priorityLevel) {
      case 'low':
        score += 10;
        break;
      case 'normal':
        score += 20;
        break;
      case 'high':
        score += 35;
        break;
      case 'urgent':
        score += 50;
        break;
      default:
        break;
    }

    // Distance bonus (closer is better)
    if (distance < 100) score += 10;
    else if (distance < 300) score += 5;

    // Special needs
    if (specialNeeds.length > 0) score += 5;

    // Files bonus
    if (filesUploaded > 0) score += 5;

    return score;
  };

  const currentScore = calculateScore();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎓 Đơn đăng ký ký túc xá</Text>
          <Text style={styles.headerSubtitle}>Điền đầy đủ thông tin để tăng cơ hội được chấp nhận</Text>
        </View>
      </LinearGradient>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoBoxText}>
          ℹ️ Điền đầy đủ thông tin sẽ giúp tăng điểm ứng tuyển của bạn. Hệ thống sẽ tính toán điểm
          dựa trên các tiêu chí được cập nhật hàng năm.
        </Text>
      </View>

      {/* Basic Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Thông tin cơ bản</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Năm học</Text>
          <Pressable
            style={styles.select}
            onPress={() => Alert.alert('Năm học', 'Chọn năm học', [
              { text: '2024-2025', onPress: () => setAcademicYear('2024-2025') },
              { text: '2025-2026', onPress: () => setAcademicYear('2025-2026') },
            ])}
          >
            <Text style={styles.selectText}>{academicYear}</Text>
          </Pressable>
        </View>
      </View>

      {/* Distance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Khoảng cách từ nhà đến trường</Text>
        <View style={styles.formGroup}>
          <Text style={styles.label}>
            {distance} km - {getDistanceDescription()}
          </Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>{distance}km</Text>
          </View>
          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                { width: `${(distance / 1000) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0km</Text>
            <Text style={styles.sliderLabel}>1000km</Text>
          </View>
          <Text style={styles.distanceNote}>{getDistanceDescription()} sẽ được cân nhắc trong xét duyệt</Text>
        </View>
      </View>

      {/* Financial Condition */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Tình trạng tài chính</Text>
        <View style={styles.tierCards}>
          {financialTiers.map((tier) => (
            <Pressable
              key={tier.id}
              style={[
                styles.tierCard,
                financialTier === tier.id && styles.tierCardActive,
              ]}
              onPress={() => setFinancialTier(tier.id)}
            >
              <View style={styles.tierCardRadio}>
                {financialTier === tier.id && <View style={styles.tierCardRadioDot} />}
              </View>
              <View style={styles.tierCardContent}>
                <Text style={styles.tierCardTitle}>{tier.title}</Text>
                <Text style={styles.tierCardDesc}>{tier.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Priority Level */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Mức ưu tiên</Text>
        <View style={styles.priorityGrid}>
          {priorityLevels.map((priority) => (
            <Pressable
              key={priority.id}
              style={[
                styles.priorityButton,
                priorityLevel === priority.id && styles.priorityButtonActive,
              ]}
              onPress={() => setPriorityLevel(priority.id)}
            >
              <Text style={[
                styles.priorityButtonLabel,
                priorityLevel === priority.id && styles.priorityButtonLabelActive,
              ]}>
                {priority.label}
              </Text>
              <Text style={[
                styles.priorityButtonDesc,
                priorityLevel === priority.id && styles.priorityButtonDescActive,
              ]}>
                {priority.desc}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Priority Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Lý do ưu tiên (nếu có)</Text>
        <View style={styles.formGroup}>
          <TextInput
            style={styles.textarea}
            placeholder="Giải thích lý do ưu tiên của bạn..."
            placeholderTextColor="#ccc"
            multiline
            numberOfLines={4}
            value={priorityReason}
            onChangeText={setPriorityReason}
          />
        </View>
      </View>

      {/* Special Needs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>♿ Nhu cầu đặc biệt</Text>
        <View style={styles.formGroup}>
          <TextInput
            style={styles.textarea}
            placeholder="Mô tả bất kỳ nhu cầu đặc biệt nào (ví dụ: khuyết tật, dị ứng)..."
            placeholderTextColor="#ccc"
            multiline
            numberOfLines={4}
            value={specialNeeds}
            onChangeText={setSpecialNeeds}
          />
        </View>
      </View>

      {/* Building Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏢 Tòa nhà ưu tiên</Text>
        <View style={styles.formGroup}>
          <View style={styles.preferencesList}>
            {buildingOptions.map((building) => (
              <Pressable
                key={building.id}
                style={[
                  styles.preferenceItem,
                  buildingPreferences.includes(building.id) && styles.preferenceItemSelected,
                ]}
                onPress={() => {
                  if (buildingPreferences.includes(building.id)) {
                    setBuildingPreferences(buildingPreferences.filter(b => b !== building.id));
                  } else {
                    setBuildingPreferences([...buildingPreferences, building.id]);
                  }
                }}
              >
                <View style={[
                  styles.checkbox,
                  buildingPreferences.includes(building.id) && styles.checkboxChecked,
                ]} />
                <Text style={styles.preferenceLabel}>{building.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* File Upload */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📎 Tài liệu hỗ trợ</Text>
        <Pressable
          style={styles.uploadArea}
          onPress={() => setFilesUploaded(filesUploaded + 1)}
        >
          <Text style={styles.uploadIcon}>📁</Text>
          <Text style={styles.uploadTitle}>Nhấn để tải lên tài liệu</Text>
          <Text style={styles.uploadDesc}>Hỗ trợ PDF, ảnh (tối đa 10MB)</Text>
          {filesUploaded > 0 && (
            <Text style={styles.uploadedCount}>{filesUploaded} tệp đã tải lên</Text>
          )}
        </Pressable>
      </View>

      {/* Scoring Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Điểm ứng tuyển</Text>
        <View style={styles.scoreCard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreItemLabel}>Tình trạng tài chính</Text>
            <Text style={styles.scoreItemValue}>
              +{financialTier === 'tier1' ? 30 : financialTier === 'tier2' ? 20 : financialTier === 'tier3' ? 10 : 0}
            </Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreItemLabel}>Mức ưu tiên</Text>
            <Text style={styles.scoreItemValue}>
              +{priorityLevel === 'low' ? 10 : priorityLevel === 'normal' ? 20 : priorityLevel === 'high' ? 35 : 50}
            </Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreItemLabel}>Khoảng cách</Text>
            <Text style={styles.scoreItemValue}>+{distance < 100 ? 10 : distance < 300 ? 5 : 0}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreItemLabel}>Khác</Text>
            <Text style={styles.scoreItemValue}>+{(specialNeeds.length > 0 ? 5 : 0) + (filesUploaded > 0 ? 5 : 0)}</Text>
          </View>
          <View style={[styles.scoreItem, styles.scoreItemTotal]}>
            <Text style={styles.scoreItemLabel}>Tổng cộng</Text>
            <Text style={styles.scoreItemValueTotal}>{currentScore}</Text>
          </View>
        </View>
      </View>

      {/* Form Actions */}
      <View style={styles.formActions}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitButtonGradient}
        >
          <Pressable
            style={styles.submitButton}
            onPress={() => mutation.mutate({
              academicYear,
              distance,
              financialTier,
              priorityLevel,
              priorityReason,
              specialNeeds,
              buildingPreferences,
              filesUploaded,
            })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Gửi đơn đăng ký</Text>
            )}
          </Pressable>
        </LinearGradient>

        <Pressable
          style={styles.resetButton}
          onPress={resetForm}
          disabled={mutation.isPending}
        >
          <Text style={styles.resetButtonText}>Đặt lại</Text>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    paddingTop: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },

  // Info Box
  infoBox: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 6,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#1565c0',
  },

  // Section
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
  },

  // Form Group
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  select: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
  },
  selectText: {
    fontSize: 13,
    color: '#333333',
  },

  // Slider
  sliderContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },
  sliderTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#667eea',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 10,
    color: '#999999',
  },
  distanceNote: {
    fontSize: 11,
    color: '#666666',
    fontStyle: 'italic',
  },

  // Tier Cards
  tierCards: {
    gap: 8,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  tierCardActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f2ff',
  },
  tierCardRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tierCardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#667eea',
  },
  tierCardContent: {
    flex: 1,
  },
  tierCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  tierCardDesc: {
    fontSize: 11,
    color: '#999999',
  },

  // Priority Grid
  priorityGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityButton: {
    flex: 1,
    minWidth: '48%',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  priorityButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f2ff',
  },
  priorityButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  priorityButtonLabelActive: {
    color: '#667eea',
  },
  priorityButtonDesc: {
    fontSize: 10,
    color: '#999999',
  },
  priorityButtonDescActive: {
    color: '#667eea',
  },

  // Textarea
  textarea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#333333',
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: '#f9f9f9',
  },

  // Preferences
  preferencesList: {
    gap: 8,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
  },
  preferenceItemSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f2ff',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  preferenceLabel: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },

  // Upload Area
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#667eea',
    borderRadius: 8,
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#f0f2ff',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  uploadDesc: {
    fontSize: 11,
    color: '#999999',
    marginBottom: 8,
  },
  uploadedCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667eea',
  },

  // Score Card
  scoreCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  scoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scoreItemTotal: {
    borderBottomWidth: 0,
    backgroundColor: '#f0f2ff',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  scoreItemLabel: {
    fontSize: 12,
    color: '#666666',
  },
  scoreItemValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  scoreItemValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },

  // Form Actions
  formActions: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  submitButtonGradient: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
});

export default ApplicationScreen;
