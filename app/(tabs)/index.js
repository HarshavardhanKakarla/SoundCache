import React, { useState, useEffect, useCallback } from 'react';
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

import { COLORS, CATEGORIES, UNLOCK_RADIUS_METERS } from '../../utils/constants';
import { fetchNearbyCapsules, seedCapsulesApi } from '../../utils/api';
import RadarSweep from '../../components/RadarSweep';
import CapsuleCard from '../../components/CapsuleCard';
import CapsulePlayerModal from '../../components/CapsulePlayerModal';

export default function RadarScreen() {
  const [location, setLocation] = useState({
    latitude: 17.3850,
    longitude: 78.4867,
  });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCapsule, setActiveCapsule] = useState(null);
  const [gpsSimOpen, setGpsSimOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Locating audio frequencies...');

  // Request location on mount
  useEffect(() => {
    initLocation();
  }, []);

  async function initLocation() {
    try {
      setStatusMsg('Acquiring GPS fix...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(newCoords);
        setStatusMsg('GPS Locked');
        loadCapsules(newCoords.latitude, newCoords.longitude);
      } else {
        setStatusMsg('GPS Permission skipped; using simulation coordinates');
        loadCapsules(location.latitude, location.longitude);
      }
    } catch (err) {
      console.warn('Location initialization notice:', err?.message);
      setStatusMsg('Using demo location');
      loadCapsules(location.latitude, location.longitude);
    }
  }

  const loadCapsules = useCallback(
    async (lat = location.latitude, lng = location.longitude) => {
      try {
        setLoading(true);
        const data = await fetchNearbyCapsules(lat, lng);
        setCapsules(data);
      } catch (err) {
        console.warn('Error loading capsules:', err?.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [location]
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCapsules();
  };

  // Seed sample capsules around current point
  async function handleSeedCapsules() {
    try {
      setLoading(true);
      await seedCapsulesApi(location.latitude, location.longitude);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
      loadCapsules(location.latitude, location.longitude);
      Alert.alert(
        'Capsules Seeded',
        'Generated 5 spatial audio capsules around your current GPS coordinates!'
      );
    } catch (err) {
      Alert.alert('Seeding Note', 'Backend is using built-in capsules.');
    } finally {
      setLoading(false);
    }
  }

  // GPS Simulator: move coordinates slightly towards the nearest locked capsule
  function simulateWalkCloser(targetCapsule) {
    if (!targetCapsule) {
      // Just step slightly north-east
      const newLat = location.latitude + 0.0001;
      const newLng = location.longitude + 0.0001;
      setLocation({ latitude: newLat, longitude: newLng });
      loadCapsules(newLat, newLng);
      return;
    }

    // Move directly onto target capsule's coordinates to unlock it!
    const targetLat = targetCapsule.latitude;
    const targetLng = targetCapsule.longitude;

    setLocation({ latitude: targetLat, longitude: targetLng });
    loadCapsules(targetLat, targetLng);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    Alert.alert(
      'Simulated Step Taken',
      `Walked to [${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}]. Capsule is now within the 30m unlock boundary!`
    );
  }

  function handleSelectCapsule(capsule) {
    if (capsule.isUnlocked) {
      setActiveCapsule(capsule);
    } else {
      Alert.alert(
        'Signal Locked 🔒',
        `You are ${capsule.distanceMeters}m away from "${capsule.title}".\n\nSoundCache capsules are geo-locked and only unlock within ${UNLOCK_RADIUS_METERS} meters.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Simulate Walking Here',
            onPress: () => simulateWalkCloser(capsule),
          },
        ]
      );
    }
  }

  // Filter capsules by category
  const filteredCapsules = capsules.filter((c) => {
    if (selectedCategory === 'All') return true;
    return c.category === selectedCategory;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <Ionicons name="radio" size={20} color={COLORS.primary} />
              <Text style={styles.brandTitle}>SoundCache</Text>
            </View>
            <Text style={styles.statusSubtext}>{statusMsg}</Text>
          </View>

          {/* GPS Simulator Toggle Button */}
          <TouchableOpacity
            style={[
              styles.simToggleBtn,
              gpsSimOpen && { backgroundColor: COLORS.primary },
            ]}
            onPress={() => setGpsSimOpen(!gpsSimOpen)}
          >
            <Ionicons
              name="navigate"
              size={16}
              color={gpsSimOpen ? '#090D16' : COLORS.primary}
            />
            <Text
              style={[
                styles.simToggleText,
                gpsSimOpen && { color: '#090D16', fontWeight: '800' },
              ]}
            >
              GPS Tool
            </Text>
          </TouchableOpacity>
        </View>

        {/* GPS Simulation Panel */}
        {gpsSimOpen && (
          <View style={styles.simPanel}>
            <View style={styles.simHeader}>
              <Ionicons name="hardware-chip-outline" size={15} color={COLORS.primary} />
              <Text style={styles.simTitle}>Dev GPS Simulator & Seeder</Text>
            </View>
            <Text style={styles.simCoords}>
              Lat: {location.latitude.toFixed(5)} | Lng: {location.longitude.toFixed(5)}
            </Text>
            <View style={styles.simActionsRow}>
              <TouchableOpacity
                style={styles.simActionBtn}
                onPress={() => simulateWalkCloser(null)}
              >
                <Ionicons name="walk" size={14} color={COLORS.text} />
                <Text style={styles.simActionText}>+15m Walk</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simActionBtn, { backgroundColor: '#00F2FE20' }]}
                onPress={handleSeedCapsules}
              >
                <Ionicons name="sparkles" size={14} color={COLORS.primary} />
                <Text style={[styles.simActionText, { color: COLORS.primary }]}>
                  Seed Near Me
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Radar Visualizer */}
        <RadarSweep capsules={filteredCapsules} userLocation={location} />

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
                  isSelected && styles.categoryPillSelected,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? '#090D16' : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextSelected,
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
            <Text style={styles.feedTitle}>Discovered Frequencies</Text>
            <Text style={styles.feedCount}>{filteredCapsules.length} found</Text>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={{ marginVertical: 32 }}
            />
          ) : filteredCapsules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="radio-outline" size={48} color={COLORS.textDim} />
              <Text style={styles.emptyTitle}>No Signals Detected</Text>
              <Text style={styles.emptySubtitle}>
                There are no audio capsules in this sector. Tap "Seed Near Me" or drop the first one!
              </Text>
              <TouchableOpacity
                style={styles.emptySeedBtn}
                onPress={handleSeedCapsules}
              >
                <Text style={styles.emptySeedBtnText}>Populate Demo Capsules</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredCapsules.map((cap) => (
              <CapsuleCard
                key={cap._id}
                capsule={cap}
                onSelect={handleSelectCapsule}
                onWalkCloser={simulateWalkCloser}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Audio Player Modal for Unlocked Capsule */}
      <CapsulePlayerModal
        visible={!!activeCapsule}
        capsule={activeCapsule}
        onClose={() => setActiveCapsule(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statusSubtext: {
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 2,
  },
  simToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  simToggleText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  simPanel: {
    backgroundColor: '#0c1424',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  simTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  simCoords: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  simActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  simActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  simActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
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
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  categoryPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryPillText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  categoryPillTextSelected: {
    color: '#090D16',
    fontWeight: '700',
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
    color: COLORS.text,
  },
  feedCount: {
    fontSize: 12,
    color: COLORS.textDim,
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
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptySeedBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptySeedBtnText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
});

