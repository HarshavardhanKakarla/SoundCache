import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

export default function RadarSweep({ capsules = [], userLocation }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Continuous rotating radar sweep
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Concentric pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 1600,
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
      <View style={styles.radarWrapper}>
        {/* Outer Ring */}
        <Animated.View
          style={[
            styles.outerRing,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        {/* Mid Ring */}
        <View style={styles.midRing} />
        {/* Inner Ring (30m Unlock Zone) */}
        <View style={styles.innerRing}>
          <Text style={styles.zoneLabel}>30m ZONE</Text>
        </View>

        {/* Crosshairs */}
        <View style={styles.verticalAxis} />
        <View style={styles.horizontalAxis} />

        {/* Rotating Radar Beam */}
        <Animated.View
          style={[
            styles.sweepBeam,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        />

        {/* Center User Blip */}
        <View style={styles.centerBlip}>
          <Ionicons name="radio" size={14} color="#090D16" />
        </View>

        {/* Nearby Capsule Blips placed relative on radar */}
        {capsules.slice(0, 8).map((cap, idx) => {
          // Compute a pseudo-polar placement on radar based on distance
          const maxDist = 300; // max scale
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
                  backgroundColor: cap.isUnlocked ? COLORS.accent : COLORS.danger,
                  shadowColor: cap.isUnlocked ? COLORS.accent : COLORS.danger,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Signal Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: COLORS.accent }]} />
          <Text style={styles.statusText}>{unlockedCount} Unlocked</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.statusText}>
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
    marginVertical: 12,
  },
  radarWrapper: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#0c1220',
    borderWidth: 2,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  outerRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)',
  },
  midRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.15)',
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(0, 245, 160, 0.05)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  zoneLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  verticalAxis: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  horizontalAxis: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sweepBeam: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderTopColor: 'rgba(0, 242, 254, 0.65)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderWidth: 120,
    opacity: 0.35,
  },
  centerBlip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  capsuleBlip: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 5,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
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
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 12,
  },
});

