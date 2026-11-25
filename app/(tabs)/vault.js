import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { COLORS } from '../../utils/constants';
import { fetchNearbyCapsules } from '../../utils/api';
import CapsulePlayerModal from '../../components/CapsulePlayerModal';

export default function VaultScreen() {
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCapsule, setActiveCapsule] = useState(null);

  const loadVault = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearby = await fetchNearbyCapsules(loc.coords.latitude, loc.coords.longitude);
      setCapsules(nearby);
    } catch (err) {
      console.warn('Vault fetch error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const unlockedCapsules = capsules.filter((c) => c.isUnlocked);
  const totalListens = capsules.reduce((sum, c) => sum + (c.listens || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadVault();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Frequency Vault</Text>
          <Text style={styles.headerSubtitle}>
            Unlocked sound capsules within your 30m proximity zone.
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="radio" size={18} color={COLORS.primary} />
            <Text style={styles.statValue}>{capsules.length}</Text>
            <Text style={styles.statLabel}>Nearby</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="lock-open" size={18} color={COLORS.accent} />
            <Text style={styles.statValue}>{unlockedCapsules.length}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="headset" size={18} color="#F472B6" />
            <Text style={styles.statValue}>{totalListens}</Text>
            <Text style={styles.statLabel}>Listens</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Unlocked Archive</Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 32 }} />
        ) : unlockedCapsules.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="archive-outline" size={44} color={COLORS.textDim} />
            <Text style={styles.emptyTitle}>No Unlocked Capsules</Text>
            <Text style={styles.emptyDesc}>
              Walk within 30 meters of a SoundCache pin on the Radar or drop your own voice note to hear it here.
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            {unlockedCapsules.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={styles.vaultCard}
                onPress={() => setActiveCapsule(item)}
              >
                <View style={styles.vaultCardLeft}>
                  <View style={styles.playIconCircle}>
                    <Ionicons name="play" size={16} color="#090D16" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vaultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.vaultMeta}>
                      {item.category} • {item.duration}s • {item.author}
                    </Text>
                  </View>
                </View>

                <View style={styles.vaultCardRight}>
                  <Text style={styles.distanceTag}>{item.distanceMeters}m</Text>
                  <View style={styles.likesRow}>
                    <Ionicons name="heart" size={12} color={COLORS.danger} />
                    <Text style={styles.likesCount}>{item.likes || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <CapsulePlayerModal
        visible={!!activeCapsule}
        capsule={activeCapsule}
        onClose={() => {
          setActiveCapsule(null);
          loadVault();
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
    marginVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  listSection: {
    gap: 10,
  },
  vaultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  vaultCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  playIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  vaultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  vaultMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  vaultCardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  distanceTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  likesCount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
