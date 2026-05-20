import * as Linking from 'expo-linking';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { YoutubeEmbed } from '@/components/YoutubeEmbed';
import { Brand } from '@/constants/theme';
import { getTopic, getVideo, videos } from '@/data/inverted-world';

export function generateStaticParams() {
  return videos.map((video) => ({ videoId: video.id }));
}

export default function VideoDossierScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const video = getVideo(videoId);
  const topic = getTopic(video.topicId);

  return (
    <>
      <Stack.Screen options={{ title: `${video.title} / Inverted World` }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backRow}>
          <Link href="/archive" asChild>
            <Pressable style={styles.backButton}>
              <Text style={styles.backText}>archive</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.hero}>
          <View style={styles.videoWrap}>
            <YoutubeEmbed video={video} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>
              {topic.label} / {video.date}
            </Text>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.subtitle}>{video.dossier}</Text>
            <Pressable onPress={() => Linking.openURL(video.youtubeUrl)} style={styles.youtubeButton}>
              <Text style={styles.youtubeText}>watch on youtube</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.article}>
            <Text style={styles.sectionTitle}>research brief</Text>
            <Text style={styles.body}>
              This file belongs in the {topic.label} lane. The useful question is not whether the
              story feels true. The useful question is which public records would force a serious
              person to update.
            </Text>
            <Text style={styles.body}>
              Start with the original claim, timestamp it against official releases, then separate
              testimony, agency language, media amplification, and missing records. The strongest
              version of the story survives only after mundane explanations and institutional
              incentives are accounted for.
            </Text>
            <Text style={styles.body}>
              The Inverted World desk should turn this episode into a source graph, a counterread,
              a short, a longform article, and a document pull list.
            </Text>
          </View>

          <View style={styles.sources}>
            <Text style={styles.sectionTitle}>source trail</Text>
            {video.references.map((reference) => (
              <Pressable
                key={reference.url}
                onPress={() => Linking.openURL(reference.url)}
                style={styles.source}
              >
                <Text style={styles.sourceText}>{reference.label}</Text>
              </Pressable>
            ))}
          </View>
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
    gap: 16,
  },
  backRow: {
    flexDirection: 'row',
  },
  backButton: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backText: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  hero: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.34)',
    overflow: 'hidden',
  },
  videoWrap: {
    width: '100%',
  },
  heroCopy: {
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
    fontSize: 31,
    lineHeight: 38,
    marginTop: 10,
  },
  subtitle: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 880,
  },
  youtubeButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  youtubeText: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  article: {
    flex: 2,
    minWidth: 280,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.32)',
    padding: 18,
  },
  sources: {
    flex: 1,
    minWidth: 240,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.32)',
    padding: 18,
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 14,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  body: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 13,
  },
  source: {
    borderWidth: 1,
    borderColor: Brand.line,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  sourceText: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
