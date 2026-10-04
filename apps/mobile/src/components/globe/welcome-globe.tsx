import { chooseSceneMode, HERO_VIEW, projectToView } from '@oathly/core/globe';
import * as Device from 'expo-device';
import { useIsFocused } from 'expo-router';
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/components/ui';

import type { GlobeMarker } from './globe-scene';

// three.js and React Three Fiber are only loaded if the 3D globe is shown.
const GlobeScene = lazy(() => import('./globe-scene'));

const poster = require('@/assets/globe/poster.webp') as number;
/** The globe's radius as a share of half the poster's width (see the asset script). */
const POSTER_RADIUS = 0.8;

/** The static globe: the pre-rendered poster with the countries placed over it. */
function PosterGlobe({ markers, color }: { markers: GlobeMarker[]; color: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={poster}
        style={styles.fill}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      {markers.map((marker) => {
        const [x, y, z] = projectToView(marker, HERO_VIEW);
        if (z <= 0.2) return null;
        return (
          <View
            key={marker.code}
            style={[
              styles.marker,
              {
                backgroundColor: color,
                left: `${50 + x * POSTER_RADIUS * 50}%`,
                top: `${50 - y * POSTER_RADIUS * 50}%`,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Shows the poster if the 3D globe cannot start: it is decoration, never a reason to fail. */
class KeepPoster extends Component<
  { poster: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.poster : this.props.children;
  }
}

/**
 * The welcome screen's globe: every exam country glowing on a slowly turning
 * Earth. Phones that should not run it (reduced motion, little memory) keep
 * the still poster, as does any phone where WebGL fails to start.
 */
export function WelcomeGlobe({ markers }: { markers: GlobeMarker[] }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const colors = {
    ocean: theme.palette.navy[900],
    land: theme.palette.navy[400],
    halo: theme.palette.navy[400],
    marker: theme.palette.gold[400],
  };
  const mode = chooseSceneMode({
    prefersReducedMotion: reduceMotion,
    memoryGb: Device.totalMemory ? Device.totalMemory / 2 ** 30 : undefined,
    webgl2: true,
  });
  const still = <PosterGlobe markers={markers} color={colors.marker} />;

  return (
    <View
      style={styles.square}
      // Decoration: the countries are listed in words once you sign in.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="welcome-globe"
    >
      {mode === 'poster' ? (
        still
      ) : (
        <KeepPoster poster={still}>
          <Suspense fallback={still}>
            <GlobeScene markers={markers} colors={colors} spinning={focused} />
          </Suspense>
        </KeepPoster>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  square: { width: '100%', aspectRatio: 1 },
  fill: { width: '100%', height: '100%' },
  marker: {
    position: 'absolute',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: 4,
  },
});
