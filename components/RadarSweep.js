import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';

export default function RadarSweep({ capsules = [] }) {
  const { theme } = useTheme();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.92,
          duration: 1800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [spinAnim, pulseAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const unlockedCount = capsules.filter((c) => c.isUnlocked).length;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.radarWrapper,
          { backgroundColor: theme.radarBg, borderColor: theme.border },
        ]}
      >
        <Animated.View
          style={[
            styles.outerRing,
            {
              borderColor: theme.radarRing,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <View style={[styles.midRing, { borderColor: theme.radarRing }]} />
        <View
          style={[
            styles.innerRing,
            { borderColor: theme.accent, backgroundColor: theme.accentSoft },
          ]}
        >
          <Text style={[styles.zoneLabel, { color: theme.accent }]}>30m ZONE</Text>
        </View>

        <View style={[styles.verticalAxis, { backgroundColor: theme.border }]} />
        <View style={[styles.horizontalAxis, { backgroundColor: theme.border }]} />

        <Animated.View
          style={[
            styles.sweepBeam,
            {
              borderTopColor: theme.radarSweep,
              transform: [{ rotate: spin }],
            },
          ]}
        />

        <View style={[styles.centerBlip, { backgroundColor: theme.primary }]}>
          <Ionicons name="radio" size={13} color={theme.primaryText} />
        </View>

        {capsules.slice(0, 8).map((cap, idx) => {
          const maxDist = 300;
          const normalizedDist = Math.min(cap.distanceMeters || 40, maxDist) / maxDist;
          const radius = 25 + normalizedDist * 80;
          const angle = (idx * (360 / Math.max(capsules.length, 1)) * Math.PI) / 180;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);

          return (
            <View
              key={cap._id || idx}
              style={[
                styles.capsuleBlip,
                {
                  transform: [{ translateX: x }, { translateY: y }],
                  backgroundColor: cap.isUnlocked ? theme.accent : theme.danger,
                },
              ]}
            />
          );
        })}
      </View>

      <View
        style={[
          styles.statusBar,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            {unlockedCount} Unlocked
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: theme.danger }]} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            {capsules.length - unlockedCount} Locked Signals
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  radarWrapper: {
    width: 232,
    height: 232,
    borderRadius: 116,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  outerRing: {
    position: 'absolute',
    width: 212,
    height: 212,
    borderRadius: 106,
    borderWidth: 1,
  },
  midRing: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  zoneLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verticalAxis: {
    position: 'absolute',
    width: 1,
    height: '100%',
    opacity: 0.45,
  },
  horizontalAxis: {
    position: 'absolute',
    height: 1,
    width: '100%',
    opacity: 0.45,
  },
  sweepBeam: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderWidth: 116,
    opacity: 0.25,
  },
  centerBlip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  capsuleBlip: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 5,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 12,
    marginHorizontal: 12,
  },
});
