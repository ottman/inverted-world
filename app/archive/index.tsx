import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/constants/theme';
import { getTopic, topics, videos } from '@/data/inverted-world';

export default function ArchiveScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Inverted World Archive' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>deep archive</Text>
          <Text style={styles.title}>Every episode becomes a dossier.</Text>
          <Text style={styles.subtitle}>
            Source trails, counterreads, and AI research briefs live on indexable episode pages.
          </Text>
        </View>

        <View style={styles.topicRow}>
          {topics.map((topic) => (
            <View key={topic.id} style={styles.topic}>
              <Text style={styles.topicCode}>{topic.code}</Text>
              <Text style={styles.topicLabel}>{topic.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {videos.map((video) => {
            const topic = getTopic(video.topicId);
            return (
              <Link
                key={video.id}
                href={{ pathname: '/archive/[videoId]', params: { videoId: video.id } }}
                asChild
              >
                <Pressable style={styles.card}>
                  <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardMeta}>
                      {topic.label} / {video.date}
                    </Text>
                    <Text style={styles.cardTitle}>{video.title}</Text>
                    <Text style={styles.cardCopy} numberOfLines={3}>
                      {video.dossier}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: 22,
    paddingBottom: 56,
    gap: 18,
  },
  header: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.34)',
    padding: 18,
  },
  kicker: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 32,
    lineHeight: 38,
    marginTop: 10,
  },
  subtitle: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 720,
  },
  topicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topic: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topicCode: {
    color: Brand.faint,
    fontFamily: Brand.mono,
    fontSize: 9,
  },
  topicLabel: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 11,
    marginTop: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    flexGrow: 1,
    flexBasis: 310,
    minWidth: 260,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.36)',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  cardBody: {
    padding: 14,
    gap: 8,
  },
  cardMeta: {
    color: Brand.faint,
    fontFamily: Brand.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 17,
    lineHeight: 23,
  },
  cardCopy: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 12,
    lineHeight: 18,
  },
});
