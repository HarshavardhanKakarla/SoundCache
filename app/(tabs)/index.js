import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { CATEGORIES, UNLOCK_RADIUS_METERS } from '../../utils/constants';
import { useTheme } from '../../utils/theme';
import { fetchNearbyCapsules } from '../../utils/api';
import RadarSweep from '../../components/RadarSweep';
import CapsuleCard from '../../components/CapsuleCard';
import CapsulePlayerModal from '../../components/CapsulePlayerModal';

export default function RadarScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const [location, setLocation] = useState(null);
  const [gpsError, setGpsError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCapsule, setActiveCapsule] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Acquiring GPS signal...');
  const [hapticGuideOn, setHapticGuideOn] = useState(true);

  const watchSubRef = useRef(null);
  const hapticTimerRef = useRef(null);
  const prevUnlockedIdsRef = useRef(new Set());

  useEffect(() => {
    initLocation();
    return () => {
      if (watchSubRef.current) watchSubRef.current.remove();
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
    };
  }, []);

  const loadCapsules = useCallback(
    async (lat, lng, silent = false) => {
      const targetLat = lat ?? location?.latitude;
      const targetLng = lng ?? location?.longitude;
      if (targetLat == null || targetLng == null) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (!silent) setLoading(true);
        const data = await fetchNearbyCapsules(targetLat, targetLng);

        // Celebratory haptic if a newly unlocked capsule entered the 30m ring
        const newlyUnlocked = data.some(
          (c) => c.isUnlocked && !prevUnlockedIdsRef.current.has(c._id)
        );
        if (newlyUnlocked && prevUnlockedIdsRef.current.size > 0 && hapticGuideOn) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {}
        }
        prevUnlockedIdsRef.current = new Set(
          data.filter((c) => c.isUnlocked).map((c) => c._id)
        );

        setCapsules(data);
      } catch (err) {
        console.warn('Error loading capsules:', err?.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location, hapticGuideOn]
  );

  async function initLocation() {
    try {
      setLoading(true);
      setGpsError(false);
      setStatusMsg('Acquiring GPS signal...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(newCoords);
        setStatusMsg('GPS Locked • Scanning 5km');
        await loadCapsules(newCoords.latitude, newCoords.longitude);

        // Live watch for Hot-Cold proximity haptics
        if (watchSubRef.current) watchSubRef.current.remove();
        watchSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 3000,
          },
          (updatedLoc) => {
            const coords = {
              latitude: updatedLoc.coords.latitude,
              longitude: updatedLoc.coords.longitude,
            };
            setLocation(coords);
            loadCapsules(coords.latitude, coords.longitude, true);
          }
        );
      } else {
        setGpsError(true);
        setStatusMsg('Location permission required');
        setLoading(false);
      }
    } catch (err) {
      setGpsError(true);
      setStatusMsg('Unable to acquire GPS fix');
      setLoading(false);
    }
  }

  // Hot-Cold Proximity Haptics: vibrate faster as user approaches 30m unlock ring
  const nearestLocked = capsules.find((c) => !c.isUnlocked);

  useEffect(() => {
    if (hapticTimerRef.current) {
      clearTimeout(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }

    if (!hapticGuideOn || !nearestLocked || activeCapsule) return;

    const dist = nearestLocked.distanceMeters;
    if (dist > 150 || dist <= UNLOCK_RADIUS_METERS) return;

    let intervalMs = 2400;
    let style = Haptics.ImpactFeedbackStyle.Light;

    if (dist <= 45) {
      intervalMs = 550;
      style = Haptics.ImpactFeedbackStyle.Heavy;
    } else if (dist <= 80) {
      intervalMs = 1200;
      style = Haptics.ImpactFeedbackStyle.Medium;
    }

    let cancelled = false;
    const schedulePulse = () => {
      if (cancelled) return;
      hapticTimerRef.current = setTimeout(() => {
        try {
          Haptics.impactAsync(style);
        } catch (e) {}
        schedulePulse();
      }, intervalMs);
    };

    schedulePulse();

    return () => {
      cancelled = true;
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
    };
  }, [hapticGuideOn, nearestLocked?.distanceMeters, activeCapsule]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(newCoords);
        await loadCapsules(newCoords.latitude, newCoords.longitude);
      } else {
        await initLocation();
      }
    } catch (e) {
      await loadCapsules();
    } finally {
      setRefreshing(false);
    }
  };

  function handleSelectCapsule(capsule) {
    if (capsule.isUnlocked) {
      setActiveCapsule(capsule);
    } else {
      Alert.alert(
        'Signal Locked',
        `You are ${capsule.distanceMeters}m away from "${capsule.title}".\n\nSoundCache capsules unlock automatically once you walk within ${UNLOCK_RADIUS_METERS} meters.`
      );
    }
  }

  const filteredCapsules = capsules.filter((c) => {
    if (selectedCategory === 'All') return true;
    return c.category === selectedCategory;
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <Ionicons name="radio" size={20} color={theme.primary} />
              <Text style={[styles.brandTitle, { color: theme.text }]}>SoundCache</Text>
            </View>
            <Text style={[styles.statusSubtext, { color: theme.accent }]}>
              {statusMsg}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: hapticGuideOn ? theme.primarySoft : theme.surface,
                  borderColor: hapticGuideOn ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setHapticGuideOn((prev) => !prev)}
            >
              <Ionicons
                name="pulse"
                size={16}
                color={hapticGuideOn ? theme.primary : theme.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconActionBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={toggleTheme}
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={16}
                color={theme.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.refreshBtn,
                { backgroundColor: theme.primarySoft, borderColor: theme.primary },
              ]}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={15} color={theme.primary} />
              <Text style={[styles.refreshBtnText, { color: theme.primary }]}>Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Proximity Haptic Guide Banner */}
        {hapticGuideOn && nearestLocked && nearestLocked.distanceMeters <= 150 && (
          <View
            style={[
              styles.hapticBanner,
              { backgroundColor: theme.primarySoft, borderColor: theme.primary },
            ]}
          >
            <Ionicons name="pulse" size={14} color={theme.primary} />
            <Text style={[styles.hapticBannerText, { color: theme.text }]}>
              Haptic Guide: Nearest locked signal is{' '}
              <Text style={{ fontWeight: '800', color: theme.primary }}>
                {nearestLocked.distanceMeters}m
              </Text>{' '}
              away (pulses faster as you approach 30m)
            </Text>
          </View>
        )}

        {/* Radar Visualizer */}
        <RadarSweep capsules={filteredCapsules} />

        {/* Categories Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? theme.primaryText : theme.textMuted}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: isSelected ? theme.primaryText : theme.textMuted },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Capsule Feed List */}
        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <Text style={[styles.feedTitle, { color: theme.text }]}>
              Discovered Frequencies
            </Text>
            <Text style={[styles.feedCount, { color: theme.textDim }]}>
              {filteredCapsules.length} found
            </Text>
          </View>

          {gpsError ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color={theme.danger} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Location Access Needed
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                SoundCache uses your GPS location to discover and unlock nearby audio capsules.
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                onPress={initLocation}
              >
                <Text style={[styles.retryBtnText, { color: theme.primaryText }]}>
                  Enable Location
                </Text>
              </TouchableOpacity>
            </View>
          ) : loading && !refreshing ? (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={{ marginVertical: 32 }}
            />
          ) : filteredCapsules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="radio-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No Signals Nearby
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                No audio capsules have been dropped in this area yet. Be the first to leave one in the Drop Studio!
              </Text>
            </View>
          ) : (
            filteredCapsules.map((cap) => (
              <CapsuleCard
                key={cap._id}
                capsule={cap}
                onSelect={handleSelectCapsule}
              />
            ))
          )}
        </View>
      </ScrollView>

      <CapsulePlayerModal
        visible={!!activeCapsule}
        capsule={activeCapsule}
        onClose={() => {
          setActiveCapsule(null);
          loadCapsules(undefined, undefined, true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statusSubtext: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hapticBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  hapticBannerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  categoryScroll: {
    paddingVertical: 12,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedSection: {
    marginTop: 8,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  feedCount: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
