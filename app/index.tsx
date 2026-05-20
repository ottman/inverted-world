import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { Link, Stack, router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { YoutubeEmbed } from '@/components/YoutubeEmbed';
import { Brand } from '@/constants/theme';
import { topics, videos } from '@/data/inverted-world';

const starters = [
  'What is the strongest public record for UAP retrieval claims?',
  'Map the Epstein document gaps without laundering speculation.',
  'Build a counterread on the COVID coverup narrative.',
];

export default function HomeScreen() {
  const [query, setQuery] = React.useState('');
  const latest = videos[0];

  const openResearch = (value?: string) => {
    const text = (value ?? query).trim();
    router.push({ pathname: '/research', params: text ? { q: text } : undefined });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Inverted World' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Image
              source={require('../assets/images/inverted-world-banner-logo.png')}
              style={styles.banner}
              contentFit="contain"
            />
            <Text style={styles.kicker}>document-first anomaly desk</Text>
            <Text style={styles.title}>Research the impossible without surrendering your brain.</Text>
            <Text style={styles.subtitle}>
              Ask anything. The desk pushes toward primary records, counterreads, missing files, and
              publishable angles.
            </Text>

            <View style={styles.askBox}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ask about UFOs, power networks, psyops, cryptids, AI control..."
                placeholderTextColor={Brand.faint}
                style={styles.input}
                onSubmitEditing={() => openResearch()}
                returnKeyType="send"
              />
              <Pressable onPress={() => openResearch()} style={styles.sendButton}>
                <MaterialIcons name="arrow-forward" size={18} color={Brand.black} />
              </Pressable>
            </View>

            <View style={styles.starters}>
              {starters.map((starter) => (
                <Pressable key={starter} onPress={() => openResearch(starter)} style={styles.starter}>
                  <Text style={styles.starterText}>{starter}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.videoPanel}>
            <YoutubeEmbed video={latest} />
            <View style={styles.videoMeta}>
              <Text style={styles.eyebrow}>latest file</Text>
              <Text style={styles.videoTitle}>{latest.title}</Text>
              <Link
                href={{ pathname: '/archive/[videoId]', params: { videoId: latest.id } }}
                asChild
              >
                <Pressable style={styles.inlineButton}>
                  <Text style={styles.inlineButtonText}>open dossier</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>signal lanes</Text>
          <Link href="/archive" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkButtonText}>deep archive</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.topicGrid}>
          {topics.map((topic) => (
            <Pressable
              key={topic.id}
              onPress={() => openResearch(`Open a source map for ${topic.label}: ${topic.signal}`)}
              style={styles.topic}
            >
              <View style={[styles.topicRule, { backgroundColor: topic.color }]} />
              <Text style={styles.topicCode}>{topic.code}</Text>
              <Text style={styles.topicLabel}>{topic.label}</Text>
              <Text style={styles.topicSignal}>{topic.signal}</Text>
            </Pressable>
          ))}
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
    gap: 26,
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 22,
  },
  heroCopy: {
    flex: 1.1,
    minWidth: 300,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.34)',
    padding: 18,
    minHeight: 420,
    justifyContent: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 460,
    height: 78,
    marginBottom: 22,
  },
  kicker: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 42,
    lineHeight: 48,
    maxWidth: 760,
  },
  subtitle: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 720,
    marginTop: 16,
  },
  askBox: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.54)',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minHeight: 56,
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 13,
  },
  sendButton: {
    width: 54,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.gold,
  },
  starters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  starter: {
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
  },
  starterText: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 10,
    lineHeight: 15,
  },
  videoPanel: {
    flex: 0.9,
    minWidth: 300,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.34)',
    overflow: 'hidden',
  },
  videoMeta: {
    padding: 14,
    gap: 8,
  },
  eyebrow: {
    color: Brand.faint,
    fontFamily: Brand.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  videoTitle: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 17,
    lineHeight: 23,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Brand.lineStrong,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  inlineButtonText: {
    color: Brand.gold,
    fontFamily: Brand.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 18,
    textTransform: 'uppercase',
  },
  linkButton: {
    borderWidth: 1,
    borderColor: Brand.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  topic: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 260,
    minHeight: 156,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: 'rgba(5,5,5,0.32)',
    padding: 14,
  },
  topicRule: {
    width: 30,
    height: 2,
    marginBottom: 14,
  },
  topicCode: {
    color: Brand.faint,
    fontFamily: Brand.mono,
    fontSize: 10,
  },
  topicLabel: {
    color: Brand.text,
    fontFamily: Brand.mono,
    fontSize: 18,
    marginTop: 8,
  },
  topicSignal: {
    color: Brand.muted,
    fontFamily: Brand.mono,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
