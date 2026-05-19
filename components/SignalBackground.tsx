import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Brand } from '@/constants/theme';

export function SignalBackground() {
  const { width, height } = useWindowDimensions();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 16000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -90] });
  const rows = Math.max(16, Math.ceil(height / 52));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#030303', '#090704', '#050505', '#071014']}
        locations={[0, 0.38, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}>
        {Array.from({ length: rows }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.line,
              {
                top: index * 58,
                width: width * 1.3,
                left: -width * 0.14,
                borderColor:
                  index % 5 === 0
                    ? 'rgba(125,211,252,0.24)'
                    : index % 3 === 0
                      ? 'rgba(232,180,92,0.30)'
                      : 'rgba(244,239,226,0.12)',
                transform: [{ rotate: `${index % 2 === 0 ? -4 : 5}deg` }],
              },
            ]}
          />
        ))}
      </Animated.View>
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    height: 1,
    borderTopWidth: 1,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.14)',
    borderColor: Brand.line,
  },
});
