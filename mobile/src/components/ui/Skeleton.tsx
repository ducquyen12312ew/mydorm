import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius, Spacing } from '../../constants/spacing';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

function Row({ gap = Spacing.sm, style, children }: { gap?: number; style?: ViewStyle; children?: React.ReactNode }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SkeletonDashboard() {
  return (
    <View style={sk.container}>
      {/* Header card */}
      <View style={sk.card}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 8, flex: 1 }}>
            <Skeleton width={80} height={12} />
            <Skeleton width={160} height={22} />
            <Skeleton width={100} height={11} />
          </View>
          <Skeleton width={52} height={52} radius={26} />
        </Row>
      </View>

      {/* Status card */}
      <View style={sk.card}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Skeleton width={100} height={15} />
          <Skeleton width={60} height={22} radius={11} />
        </Row>
        <Skeleton height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="50%" height={12} />
      </View>

      {/* Info card */}
      <View style={sk.card}>
        <Skeleton width={120} height={15} style={{ marginBottom: 12 }} />
        {[1, 2, 3].map((i) => (
          <Row key={i} style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Skeleton width="35%" height={12} />
            <Skeleton width="40%" height={12} />
          </Row>
        ))}
      </View>

      {/* Second info card */}
      <View style={sk.card}>
        <Skeleton width={140} height={15} style={{ marginBottom: 12 }} />
        {[1, 2].map((i) => (
          <Row key={i} style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="45%" height={12} />
          </Row>
        ))}
      </View>
    </View>
  );
}

export function SkeletonRoomCard() {
  return (
    <View style={sk.roomCard}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Row gap={8}>
          <Skeleton width={50} height={22} radius={6} />
          <View>
            <Skeleton width={80} height={13} style={{ marginBottom: 4 }} />
            <Skeleton width={50} height={11} />
          </View>
        </Row>
        <Skeleton width={24} height={24} radius={12} />
      </Row>
      <Skeleton height={6} radius={3} style={{ marginBottom: 12 }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Skeleton width={55} height={22} radius={11} />
        <Skeleton width={90} height={13} />
      </Row>
    </View>
  );
}

export function SkeletonNotifItem() {
  return (
    <View style={sk.notifItem}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="80%" height={14} />
        <Skeleton height={12} />
        <Skeleton width="60%" height={12} />
        <Skeleton width={60} height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: Colors.skeleton },
});

const sk = StyleSheet.create({
  container: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roomCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'flex-start',
  },
});
