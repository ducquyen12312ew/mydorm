import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const DISTANCE_RANGES = [
  { value: 0, label: 'On campus (0 km)' },
  { value: 10, label: 'Very close (< 10 km)' },
  { value: 50, label: 'Close (10-50 km)' },
  { value: 100, label: 'Moderate (50-100 km)' },
  { value: 300, label: 'Far (100-300 km)' },
  { value: 500, label: 'Very far (300-500 km)' },
  { value: 1000, label: 'Extremely far (500+ km)' }
];

const FINANCIAL_TIERS = [
  { value: '1', label: 'Critical financial difficulty', description: 'Cannot afford basic needs' },
  { value: '2', label: 'High financial difficulty', description: 'Limited resources, needs support' },
  { value: '3', label: 'Moderate financial situation', description: 'Manageable but tight budget' },
  { value: '4', label: 'Good financial situation', description: 'Comfortable, no financial stress' }
];

const PRIORITY_LEVELS = [
  { value: 'LOW', label: 'Low', description: 'Standard application' },
  { value: 'MEDIUM', label: 'Medium', description: 'Some priority factors' },
  { value: 'HIGH', label: 'High', description: 'Significant priority factors' },
  { value: 'SPECIAL', label: 'Special', description: 'Exceptional circumstances' }
];

const BUILDINGS = [
  { value: 'A', label: 'Building A - Main Campus' },
  { value: 'B', label: 'Building B - South Wing' },
  { value: 'C', label: 'Building C - North Campus' },
  { value: 'D', label: 'Building D - East Complex' }
];

function getAcademicYear() {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
}

function calculateDistanceScore(distance) {
  const parsedDistance = parseInt(distance, 10);
  if (parsedDistance <= 0) return 10;
  if (parsedDistance <= 50) return Math.round(10 + (parsedDistance / 50) * 20);
  if (parsedDistance <= 100) return Math.round(30 + ((parsedDistance - 50) / 50) * 20);
  if (parsedDistance <= 300) return Math.round(50 + ((parsedDistance - 100) / 200) * 20);
  if (parsedDistance <= 500) return Math.round(70 + ((parsedDistance - 300) / 200) * 15);
  return 100;
}

function calculateFinancialScore(tier) {
  const scores = { '1': 100, '2': 75, '3': 50, '4': 20 };
  return scores[tier] || 0;
}

function calculatePriorityScore(level) {
  const scores = { SPECIAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25 };
  return scores[level] || 0;
}

function getDistanceRangeLabel(distance) {
  const parsedDistance = parseInt(distance, 10);
  const range = DISTANCE_RANGES.find((item) => item.value >= parsedDistance) || DISTANCE_RANGES[DISTANCE_RANGES.length - 1];
  return range.label;
}

function createUploadedFileDescriptor(file) {
  return {
    uri: file.uri,
    name: file.name || 'Untitled file',
    size: file.size || 0,
    mimeType: file.mimeType || file.type || 'application/octet-stream'
  };
}

function formatFileSize(size) {
  return `${(Number(size || 0) / (1024 * 1024)).toFixed(2)} MB`;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function OptionCard({ selected, title, description, onPress, children, accent }) {
  return (
    <Pressable style={[styles.optionCard, selected && styles.optionCardSelected, accent && styles.optionCardAccent]} onPress={onPress}>
      {children || (
        <>
          <Text style={[styles.optionCardTitle, selected && styles.optionCardTitleSelected]}>{title}</Text>
          <Text style={[styles.optionCardDescription, selected && styles.optionCardDescriptionSelected]}>{description}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function ApplyScreen() {
  const [form, setForm] = useState({
    academicYear: getAcademicYear(),
    distance: 250,
    financialCondition: '',
    priorityLevel: '',
    priorityReason: '',
    specialNeeds: '',
    preferredBuildings: []
  });
  const [attachments, setAttachments] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  const preview = useMemo(() => {
    if (!form.financialCondition || !form.priorityLevel) {
      return null;
    }

    const distanceScore = calculateDistanceScore(form.distance);
    const financialScore = calculateFinancialScore(form.financialCondition);
    const priorityScore = calculatePriorityScore(form.priorityLevel);
    const totalScore = Math.round(distanceScore * 0.35 + financialScore * 0.35 + priorityScore * 0.3);

    return { distanceScore, financialScore, priorityScore, totalScore };
  }, [form.distance, form.financialCondition, form.priorityLevel]);

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const files = (result.assets || []).map(createUploadedFileDescriptor);
      setAttachments((current) => [...current, ...files]);
    } catch (error) {
      Alert.alert('Upload failed', error.message);
    }
  }

  function removeFile(index) {
    setAttachments((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function toggleBuilding(value) {
    setForm((current) => {
      const selected = current.preferredBuildings.includes(value);
      return {
        ...current,
        preferredBuildings: selected ? current.preferredBuildings.filter((item) => item !== value) : [...current.preferredBuildings, value]
      };
    });
  }

  function resetForm() {
    setForm({
      academicYear: getAcademicYear(),
      distance: 250,
      financialCondition: '',
      priorityLevel: '',
      priorityReason: '',
      specialNeeds: '',
      preferredBuildings: []
    });
    setAttachments([]);
    setSuccessMessage('');
    setErrorMessage('');
  }

  async function handleSubmit() {
    if (!form.distance || !form.financialCondition || !form.priorityLevel) {
      setErrorMessage('❌ Missing required fields');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const totalScore = preview?.totalScore || 0;
      setSuccessMessage(`✅ Application submitted successfully! Your score: ${totalScore.toFixed(1)}`);
      setAttachments([]);
      setForm((current) => ({
        ...current,
        priorityReason: '',
        specialNeeds: '',
        preferredBuildings: []
      }));
    } catch (error) {
      setErrorMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Enhanced Dormitory Application</Text>
            <Text style={styles.headerSubtitle}>Priority-Based Ranking System - Fair & Transparent Allocation</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                ℹ️ This application uses a transparent ranking system based on distance, financial condition, and priority level. Your ranking will determine
                allocation fairness. All information is used for fair distribution only.
              </Text>
            </View>

            {successMessage ? (
              <View style={styles.successMessage}>
                <Text style={styles.successMessageText}>{successMessage}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorMessage}>
                <Text style={styles.errorMessageText}>{errorMessage}</Text>
              </View>
            ) : null}

            <SectionTitle>📋 Basic Information</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Academic Year *</Text>
              <Pressable style={styles.selectField} onPress={() => setYearPickerOpen(true)}>
                <Text style={styles.selectFieldValue}>{form.academicYear}</Text>
                <Text style={styles.selectFieldChevron}>⌄</Text>
              </Pressable>
              <Text style={styles.helperText}>Choose the academic year for your application</Text>
            </View>

            <SectionTitle>📍 Distance from Campus</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Home Distance from Campus (km) *</Text>
              <Text style={styles.helperText}>This affects your ranking score (35% weight)</Text>

              <View style={styles.sliderContainer}>
                <Slider
                  minimumValue={0}
                  maximumValue={1000}
                  value={form.distance}
                  minimumTrackTintColor="#667eea"
                  maximumTrackTintColor="#e0e0e0"
                  thumbTintColor="#667eea"
                  onValueChange={(distance) => setForm((current) => ({ ...current, distance: Math.round(distance) }))}
                />
              </View>

              <View style={styles.distanceDisplay}>
                <Text style={styles.distanceDisplayText}>
                  {form.distance} km - <Text style={styles.distanceDisplayEmphasis}>{getDistanceRangeLabel(form.distance)}</Text>
                </Text>
              </View>
            </View>

            <SectionTitle>💰 Financial Condition</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Financial Situation *</Text>
              <Text style={styles.helperText}>Select your financial condition (35% weight in ranking)</Text>

              <View style={styles.tierGrid}>
                {FINANCIAL_TIERS.map((tier) => (
                  <OptionCard
                    key={tier.value}
                    selected={form.financialCondition === tier.value}
                    title={tier.label}
                    description={tier.description}
                    onPress={() => setForm((current) => ({ ...current, financialCondition: tier.value }))}
                  />
                ))}
              </View>
            </View>

            <SectionTitle>⭐ Priority Level</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Priority Category *</Text>
              <Text style={styles.helperText}>Choose category that applies to you (30% weight)</Text>

              <View style={styles.priorityGrid}>
                {PRIORITY_LEVELS.map((level) => (
                  <OptionCard
                    key={level.value}
                    selected={form.priorityLevel === level.value}
                    title={level.label}
                    description={level.description}
                    accent={form.priorityLevel === level.value}
                    onPress={() => setForm((current) => ({ ...current, priorityLevel: level.value }))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Why do you need priority? *</Text>
              <TextInput
                style={styles.textArea}
                value={form.priorityReason}
                placeholder="Explain your circumstances (orphan, financial hardship, medical, etc.)..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                onChangeText={(priorityReason) => setForm((current) => ({ ...current, priorityReason }))}
              />
              <Text style={styles.helperText}>This helps us understand your situation better</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Special Needs (if any)</Text>
              <TextInput
                style={styles.textArea}
                value={form.specialNeeds}
                placeholder="Wheelchair access, medical equipment, service animal, etc..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
                onChangeText={(specialNeeds) => setForm((current) => ({ ...current, specialNeeds }))}
              />
              <Text style={styles.helperText}>Tell us about any accommodations you need</Text>
            </View>

            <SectionTitle>🏢 Building Preferences</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Preferred Buildings</Text>
              <View style={styles.buildingGrid}>
                {BUILDINGS.map((building) => {
                  const selected = form.preferredBuildings.includes(building.value);
                  return (
                    <Pressable
                      key={building.value}
                      style={[styles.buildingChip, selected && styles.buildingChipActive]}
                      onPress={() => toggleBuilding(building.value)}
                    >
                      <Text style={[styles.buildingChipText, selected && styles.buildingChipTextActive]}>{building.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperText}>Hold Ctrl/Cmd to select multiple buildings (optional)</Text>
            </View>

            <SectionTitle>📄 Supporting Documents</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Upload supporting documents *</Text>
              <Text style={styles.helperText}>PDF, Word, Excel, Images, Videos (up to 50MB per file)</Text>

              <Pressable style={styles.uploadArea} onPress={pickFiles}>
                <Text style={styles.uploadIcon}>📁</Text>
                <Text style={styles.uploadTitle}>Drag & drop files here</Text>
                <Text style={styles.uploadSubtitle}>or click to browse</Text>
              </Pressable>

              {attachments.length > 0 ? (
                <View style={styles.fileList}>
                  {attachments.map((file, index) => (
                    <View key={`${file.uri || file.name}-${index}`} style={styles.fileItem}>
                      <Text style={styles.fileItemName}>📎 {file.name}</Text>
                      <Text style={styles.fileItemSize}>{formatFileSize(file.size)}</Text>
                      <Pressable style={styles.removeButton} onPress={() => removeFile(index)}>
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {preview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>Score Preview</Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Distance Score:</Text>
                  <Text style={styles.scoreValue}>{preview.distanceScore}</Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Financial Score:</Text>
                  <Text style={styles.scoreValue}>{preview.financialScore}</Text>
                </View>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Priority Score:</Text>
                  <Text style={styles.scoreValue}>{preview.priorityScore}</Text>
                </View>
                <View style={styles.scoreTotalRow}>
                  <Text style={styles.scoreTotalLabel}>Total Score:</Text>
                  <Text style={styles.scoreTotalValue}>{preview.totalScore}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.formActions}>
              <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.submitButtonText}>📤 Submit Application</Text>
              </Pressable>
              <Pressable style={styles.resetButton} onPress={resetForm}>
                <Text style={styles.resetButtonText}>🔄 Clear Form</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <Text style={styles.loadingSpinner}>⏳</Text>
                <Text style={styles.loadingText}>Processing your application...</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <Modal visible={yearPickerOpen} transparent animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setYearPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Academic Year</Text>
            <OptionCard selected title={form.academicYear} description="Choose the academic year for your application" onPress={() => setYearPickerOpen(false)} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7ff'
  },
  root: {
    paddingBottom: 28
  },
  container: {
    padding: 16
  },
  header: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800'
  },
  headerSubtitle: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19
  },
  formSection: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2
  },
  infoBox: {
    borderRadius: 12,
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    padding: 14
  },
  infoBoxText: {
    color: '#1565c0',
    fontSize: 13,
    lineHeight: 19
  },
  successMessage: {
    borderRadius: 12,
    backgroundColor: '#4caf50',
    padding: 14
  },
  successMessageText: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700'
  },
  errorMessage: {
    borderRadius: 12,
    backgroundColor: '#f44336',
    padding: 14
  },
  errorMessageText: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700'
  },
  sectionTitle: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '700',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#667eea'
  },
  formGroup: {
    gap: 8
  },
  label: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600'
  },
  helperText: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18
  },
  selectField: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectFieldValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  selectFieldChevron: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '800'
  },
  sliderContainer: {
    marginTop: 2
  },
  distanceDisplay: {
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    padding: 12,
    alignItems: 'center'
  },
  distanceDisplayText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '700'
  },
  distanceDisplayEmphasis: {
    color: '#667eea',
    fontWeight: '800'
  },
  tierGrid: {
    gap: 12
  },
  priorityGrid: {
    gap: 10
  },
  optionCard: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 14,
    gap: 5
  },
  optionCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f2ff'
  },
  optionCardAccent: {
    backgroundColor: '#667eea'
  },
  optionCardTitle: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '700'
  },
  optionCardTitleSelected: {
    color: '#0f172a'
  },
  optionCardDescription: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18
  },
  optionCardDescriptionSelected: {
    color: '#475569'
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a'
  },
  buildingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  buildingChip: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  buildingChipActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f2ff'
  },
  buildingChipText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '600'
  },
  buildingChipTextActive: {
    color: '#4f46e5'
  },
  uploadArea: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#667eea',
    backgroundColor: '#f9f9ff',
    padding: 22,
    alignItems: 'center',
    gap: 4
  },
  uploadIcon: {
    fontSize: 30
  },
  uploadTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800'
  },
  uploadSubtitle: {
    color: '#999999',
    fontSize: 12
  },
  fileList: {
    gap: 8,
    maxHeight: 320
  },
  fileItem: {
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  fileItemName: {
    flex: 1,
    color: '#333333',
    fontSize: 13,
    fontWeight: '600'
  },
  fileItemSize: {
    color: '#999999',
    fontSize: 12
  },
  removeButton: {
    borderRadius: 8,
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  previewBox: {
    borderRadius: 12,
    backgroundColor: '#f0f2ff',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    padding: 16,
    gap: 10
  },
  previewTitle: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '700'
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  scoreLabel: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '600'
  },
  scoreValue: {
    color: '#667eea',
    fontSize: 13,
    fontWeight: '700'
  },
  scoreTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  scoreTotalLabel: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '700'
  },
  scoreTotalValue: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '800'
  },
  formActions: {
    marginTop: 2,
    gap: 12,
    alignItems: 'stretch'
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: '#667eea',
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 2
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  resetButton: {
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    paddingVertical: 14,
    alignItems: 'center'
  },
  resetButtonText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '800'
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6
  },
  loadingSpinner: {
    fontSize: 28
  },
  loadingText: {
    color: '#666666',
    fontSize: 13
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    padding: 16
  },
  modalSheet: {
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800'
  }
});
