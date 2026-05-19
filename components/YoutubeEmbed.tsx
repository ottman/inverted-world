import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/constants/theme';
import type { Video } from '@/data/inverted-world';

export function YoutubeEmbed({ video }: { video: Video }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.embed}>
        {React.createElement('iframe', {
          src: video.embedUrl,
          title: video.title,
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowFullScreen: true,
          style: { border: 0, width: '100%', height: '100%', display: 'block' },
        })}
      </View>
    );
  }

  return (
    <Pressable onPress={() => Linking.openURL(video.youtubeUrl)} style={styles.embed}>
      <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.play}>
        <Text style={styles.playText}>play on youtube</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  embed: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Brand.black,
    overflow: 'hidden',
  },
  play: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  playText: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
