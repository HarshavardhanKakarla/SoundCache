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

import { useTheme } from '../../utils/theme';
import { fetchNearbyCapsules } from '../../utils/api';
import CapsulePlayerModal from '../../components/CapsulePlayerModal';

export default function VaultScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadVault();
            }}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Frequency Vault
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
              Unlocked sound capsules within your 30m proximity zone.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={toggleTheme}
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={16}
              color={theme.primary}
            />
            <Text style={[styles.themeToggleText, { color: theme.text }]}>
              {isDark ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="radio" size={18} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {capsules.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Nearby</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="lock-open" size={18} color={theme.accent} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {unlockedCapsules.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Unlocked</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="headset" size={18} color={theme.warning} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {totalListens}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Listens</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Unlocked Archive
        </Text>

        {loading && !refreshing ? (
          <ActivityIndicator
            size="large"
            color={theme.primary}
            style={{ marginVertical: 32 }}
          />
        ) : unlockedCapsules.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="archive-outline" size={44} color={theme.textDim} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Unlocked Capsules
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
              Walk within 30 meters of a SoundCache pin on the Radar or drop your own voice note to hear it here.
            </Text>
          </View>
        ) : (
          <View style={styles.listSection}>
            {unlockedCapsules.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={[
                  styles.vaultCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => setActiveCapsule(item)}
              >
                <View style={styles.vaultCardLeft}>
                  <View
                    style={[styles.playIconCircle, { backgroundColor: theme.accent }]}
                  >
                    <Ionicons name="play" size={16} color={theme.primaryText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.vaultTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.vaultMeta, { color: theme.textMuted }]}>
                      {item.category} • {item.duration}s • {item.author}
                    </Text>
                  </View>
                </View>

                <View style={styles.vaultCardRight}>
                  <Text style={[styles.distanceTag, { color: theme.accent }]}>
                    {item.distanceMeters}m
                  </Text>
                  <View style={styles.likesRow}>
                    <Ionicons name="heart" size={12} color={theme.danger} />
                    <Text style={[styles.likesCount, { color: theme.textMuted }]}>
                      {item.likes || 0}
                    </Text>
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
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
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
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  vaultTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  vaultMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  vaultCardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  distanceTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  likesCount: {
    fontSize: 11,
  },
});
