import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiClient } from '../api/client';

export default function MyRankingScreen({ navigation }) {
  const [ranking, setRanking] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadRanking() {
      try {
        const { data } = await apiClient.get('/allocation/student/my-ranking');
        if (data?.ranking) {
          setRanking(data.ranking);
          setMessage(data.message || '');
          return;
        }
        setRanking(null);
        setMessage(data?.error || 'No ranking found yet');
      } catch {
        setRanking(null);
        setMessage('Unable to load ranking data');
      }
    }

    loadRanking();
  }, []);

  const breakdown = ranking?.breakdown || {
    distance: 0,
    financial: 0,
    priority: 0,
  };

  const percentile = Number(ranking?.percentile || 0);
  const likelyApproved = percentile > 0 && percentile <= 50;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.contentContainer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📊 My Allocation Ranking</Text>
          <Text style={styles.headerSubtitle}>Transparent priority-based dormitory allocation system</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Score</Text>
            <Text style={styles.cardValue}>{ranking ? Number(ranking.score || 0).toFixed(1) : '0'}</Text>
            <Text style={styles.cardSubtext}>Out of 100 points</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Rank</Text>
            <Text style={styles.cardValue}>{ranking?.rank || '-'}</Text>
            <Text style={styles.cardSubtext}>{ranking ? `of ${ranking.totalApplications || 0} students` : 'Loading...'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Percentile</Text>
            <Text style={styles.cardValue}>{ranking ? `${percentile.toFixed(1)}%` : '-'}</Text>
            <Text style={styles.cardSubtext}>{ranking ? (likelyApproved ? '✅ Top 50% - Auto-approve zone' : '⏳ Under manual review') : 'Loading...'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status</Text>
            <Text style={styles.statusValue}>{ranking ? (likelyApproved ? '✅' : '⏳') : '-'}</Text>
            <Text style={styles.cardSubtext}>{ranking ? (likelyApproved ? 'Likely Approved' : 'Under Review') : 'Loading...'}</Text>
          </View>
        </View>

        <View style={[styles.message, likelyApproved ? styles.messageSuccess : styles.messageInfo]}>
          <Text style={styles.messageText}>{message || 'ℹ️ No ranking found yet'}</Text>
        </View>

        <View style={styles.percentileChart}>
          <Text style={styles.sectionTitle}>📈 Score Distribution (All Students)</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>Chart container</Text>
          </View>
        </View>

        <View style={styles.scoreBreakdown}>
          <Text style={styles.sectionTitle}>🎯 Your Score Breakdown (35-35-30 Weighting)</Text>

          <View style={styles.scoreItem}>
            <View style={styles.scoreItemLabelRow}>
              <Text style={styles.scoreItemName}>📍 Distance Score (35%)</Text>
              <Text style={styles.scoreItemScore}>{Number(breakdown.distance || 0).toFixed(1)}</Text>
            </View>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${Math.max(0, Math.min(100, Number(breakdown.distance || 0)))}%` }]} />
            </View>
          </View>

          <View style={styles.scoreItem}>
            <View style={styles.scoreItemLabelRow}>
              <Text style={styles.scoreItemName}>💰 Financial Score (35%)</Text>
              <Text style={styles.scoreItemScore}>{Number(breakdown.financial || 0).toFixed(1)}</Text>
            </View>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${Math.max(0, Math.min(100, Number(breakdown.financial || 0)))}%` }]} />
            </View>
          </View>

          <View style={styles.scoreItem}>
            <View style={styles.scoreItemLabelRow}>
              <Text style={styles.scoreItemName}>⭐ Priority Score (30%)</Text>
              <Text style={styles.scoreItemScore}>{Number(breakdown.priority || 0).toFixed(1)}</Text>
            </View>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${Math.max(0, Math.min(100, Number(breakdown.priority || 0)))}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.explanation}>
          <Text style={styles.sectionTitle}>💡 How Your Score is Calculated</Text>

          <View style={styles.explanationItem}>
            <Text style={styles.explanationItemTitle}>📍 Distance from Campus (35% weight)</Text>
            <Text style={styles.explanationItemText}>Students farther from campus receive higher scores to ensure fair allocation. Distance is measured from your home to campus.</Text>
            <Text style={styles.explanationItemText}>Formula: 0km=10pts → 500+km=100pts</Text>
          </View>

          <View style={styles.explanationItem}>
            <Text style={styles.explanationItemTitle}>💰 Financial Condition (35% weight)</Text>
            <Text style={styles.explanationItemText}>Students experiencing financial difficulty receive higher priority to support equitable access.</Text>
            <Text style={styles.explanationItemText}>Tiers: Critical (100) → High (75) → Moderate (50) → Good (20)</Text>
          </View>

          <View style={styles.explanationItem}>
            <Text style={styles.explanationItemTitle}>⭐ Priority Level (30% weight)</Text>
            <Text style={styles.explanationItemText}>Special circumstances receive recognition: orphans, medical needs, disabilities, etc.</Text>
            <Text style={styles.explanationItemText}>Categories: Special (100) → High (75) → Medium (50) → Low (25)</Text>
          </View>

          <View style={styles.explanationItem}>
            <Text style={styles.explanationItemTitle}>✅ Fair & Transparent Process</Text>
            <Text style={styles.explanationItemText}>All allocations use this ranking system. Top 50% are auto-approved; remaining undergo manual review for special cases. No random selection—your ranking directly affects your chances.</Text>
          </View>
        </View>

        <View style={styles.timeline}>
          <Text style={styles.sectionTitle}>📅 Allocation Timeline</Text>

          <View style={styles.timelineItem}>
            <Text style={styles.timelineItemTitle}>Application Submitted</Text>
            <Text style={styles.timelineItemDesc}>Your application has been received and scored</Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineItemTitle}>Under Review</Text>
            <Text style={styles.timelineItemDesc}>Your ranking is being processed</Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineItemTitle}>Allocation Result</Text>
            <Text style={styles.timelineItemDesc}>Decision will be sent within 2 weeks</Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineItemTitle}>Room Assignment</Text>
            <Text style={styles.timelineItemDesc}>Successful applicants receive room details</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('HomeTab')}>
            <Text style={styles.btnSecondaryText}>← Back to Home</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('Explore')}>
            <Text style={styles.btnPrimaryText}>🏠 Explore Rooms</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#667eea' },
  contentContainer: { padding: 16, paddingBottom: 24 },
  container: { gap: 14 },
  header: { backgroundColor: '#fff', borderRadius: 12, padding: 18 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#333', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  grid: { gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 12, textTransform: 'uppercase', color: '#999', fontWeight: '600', marginBottom: 10 },
  cardValue: { fontSize: 36, fontWeight: '700', color: '#667eea' },
  statusValue: { fontSize: 24, fontWeight: '700', color: '#667eea' },
  cardSubtext: { fontSize: 13, color: '#666', marginTop: 8 },
  message: { borderRadius: 8, padding: 14 },
  messageSuccess: { backgroundColor: '#c8e6c9', borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  messageInfo: { backgroundColor: '#e3f2fd', borderLeftWidth: 4, borderLeftColor: '#2196f3' },
  messageText: { color: '#1565c0', fontWeight: '600' },
  percentileChart: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 16, color: '#333', marginBottom: 12, fontWeight: '700' },
  chartPlaceholder: { height: 120, borderRadius: 8, backgroundColor: '#f2f4ff', alignItems: 'center', justifyContent: 'center' },
  chartPlaceholderText: { color: '#667eea', fontWeight: '600' },
  scoreBreakdown: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  scoreItem: { marginBottom: 14 },
  scoreItemLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  scoreItemName: { color: '#333', fontWeight: '600' },
  scoreItemScore: { color: '#667eea', fontWeight: '700' },
  scoreBar: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  scoreFill: { height: '100%', backgroundColor: '#667eea' },
  explanation: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  explanationItem: { backgroundColor: '#f9f9ff', borderLeftWidth: 4, borderLeftColor: '#667eea', borderRadius: 6, padding: 12, marginBottom: 10 },
  explanationItemTitle: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 5 },
  explanationItemText: { fontSize: 13, color: '#666', lineHeight: 18 },
  timeline: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  timelineItem: { marginBottom: 12, paddingLeft: 8 },
  timelineItemTitle: { color: '#333', fontWeight: '600', marginBottom: 4 },
  timelineItemDesc: { fontSize: 13, color: '#666' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#667eea', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnSecondary: { backgroundColor: '#fff', borderRadius: 6, borderWidth: 2, borderColor: '#667eea', paddingHorizontal: 12, paddingVertical: 10 },
  btnSecondaryText: { color: '#667eea', fontWeight: '700' },
});
