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

import { COLORS, CATEGORIES, UNLOCK_RADIUS_METERS } from '../../utils/constants';
import { fetchNearbyCapsules } from '../../utils/api';
import RadarSweep from '../../components/RadarSweep';
import CapsuleCard from '../../components/CapsuleCard';
import CapsulePlayerModal from '../../components/CapsulePlayerModal';

export default function RadarScreen() {
  const [location, setLocation] = useState(null);
  const [gpsError, setGpsError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCapsule, setActiveCapsule] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Acquiring GPS signal...');

  useEffect(() => {
    initLocation();
  }, []);

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

  const loadCapsules = useCallback(
    async (lat, lng) => {
      const targetLat = lat ?? location?.latitude;
      const targetLng = lng ?? location?.longitude;
      if (targetLat == null || targetLng == null) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchNearbyCapsules(targetLat, targetLng);
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
        `You are ${capsule.distanceMeters}m away from "${capsule.title}".\n\nSoundCache capsules are geo-locked and unlock automatically once you walk within ${UNLOCK_RADIUS_METERS} meters.`
      );
    }
  }

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

          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color={COLORS.primary} />
            <Text style={styles.refreshBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>

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

          {gpsError ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color={COLORS.danger} />
              <Text style={styles.emptyTitle}>Location Access Needed</Text>
              <Text style={styles.emptySubtitle}>
                SoundCache uses your GPS location to discover and unlock nearby audio capsules.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={initLocation}>
                <Text style={styles.retryBtnText}>Enable Location</Text>
              </TouchableOpacity>
            </View>
          ) : loading && !refreshing ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={{ marginVertical: 32 }}
            />
          ) : filteredCapsules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="radio-outline" size={48} color={COLORS.textDim} />
              <Text style={styles.emptyTitle}>No Signals Nearby</Text>
              <Text style={styles.emptySubtitle}>
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

      {/* Audio Player Modal for Unlocked Capsule */}
      <CapsulePlayerModal
        visible={!!activeCapsule}
        capsule={activeCapsule}
        onClose={() => {
          setActiveCapsule(null);
          loadCapsules();
        }}
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
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  refreshBtnText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
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
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
});
