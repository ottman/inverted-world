export type Topic = {
  id: string;
  label: string;
  code: string;
  signal: string;
  sources: string[];
  color: string;
};

export type Video = {
  id: string;
  title: string;
  date: string;
  topicId: string;
  type: 'episode' | 'short';
  youtubeUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  dossier: string;
  references: Array<{ label: string; url: string }>;
};

export const profile = {
  name: 'Inverted World',
  channel: 'Tales From the Inverted World',
  handle: '@TalesfromtheInvertedWorld',
  youtube: 'https://www.youtube.com/@TalesfromtheInvertedWorld',
  x: 'https://x.com/InvertedTales',
  instagram: 'https://www.instagram.com/invertedtales',
  facebook: 'https://www.facebook.com/invertedtales',
  shane: 'https://x.com/ShaneCashman',
};

export const topics: Topic[] = [
  {
    id: 'skywatch',
    label: 'Skywatch',
    code: 'SKY-221',
    signal: 'UAP records, aerospace anomalies, hearings, retrieval claims.',
    sources: ['AARO', 'NASA UAP study', 'Congress'],
    color: '#e8b45c',
  },
  {
    id: 'black-vault',
    label: 'Black Vault',
    code: 'VAULT-D',
    signal: 'FOIA, declassified programs, intelligence history.',
    sources: ['CIA Reading Room', 'FBI Vault', 'National Security Archive'],
    color: '#e8b45c',
  },
  {
    id: 'power-web',
    label: 'Power Web',
    code: 'WEB-172',
    signal: 'Courts, sealed gaps, institutional networks, missing names.',
    sources: ['CourtListener', 'DOJ', 'Federal dockets'],
    color: '#ef4444',
  },
  {
    id: 'high-strangeness',
    label: 'High Strangeness',
    code: 'STR-08',
    signal: 'Paranormal reports, folklore, cryptids, witness chains.',
    sources: ['Local archives', 'Field reports', 'Historical societies'],
    color: '#f4efe2',
  },
  {
    id: 'machine-state',
    label: 'Machine State',
    code: 'MS-PAL',
    signal: 'AI control systems, surveillance, synthetic influence.',
    sources: ['NIST', 'Congress', 'Executive orders'],
    color: '#7dd3fc',
  },
  {
    id: 'off-world',
    label: 'Off-World Signals',
    code: 'OW-SOL',
    signal: 'NASA anomalies, space weather, lost satellites, instrument data.',
    sources: ['NASA NTRS', 'NOAA SWPC', 'Exoplanet Archive'],
    color: '#7dd3fc',
  },
];

export const videos: Video[] = [
  {
    id: 'N1t2XSzrnfk',
    title: 'TRUMP BRIEFED ON UFO RETRIEVAL PROGRAM',
    date: '2026-05-18',
    topicId: 'skywatch',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=N1t2XSzrnfk',
    embedUrl: 'https://www.youtube.com/embed/N1t2XSzrnfk?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/N1t2XSzrnfk/hqdefault.jpg',
    dossier:
      'Treat retrieval claims as leads, not conclusions. Start with hearing testimony, AARO language, NASA scope limits, and the exact gap between classified assertions and public evidence.',
    references: [
      { label: 'AARO', url: 'https://www.aaro.mil/' },
      { label: 'NASA UAP Study', url: 'https://science.nasa.gov/uap/' },
      { label: 'Congress', url: 'https://www.congress.gov/' },
    ],
  },
  {
    id: 'buV734vffR0',
    title: 'BERMUDA TRIANGLE MYSTERY SOLVED',
    date: '2026-05-18',
    topicId: 'off-world',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=buV734vffR0',
    embedUrl: 'https://www.youtube.com/embed/buV734vffR0?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/buV734vffR0/hqdefault.jpg',
    dossier:
      'The useful research path is less legend and more incident chain: weather, navigation, insurance records, Coast Guard history, archived newspapers, and the claims that survive after mundane causes are exhausted.',
    references: [
      { label: 'NOAA Ocean Service', url: 'https://oceanservice.noaa.gov/' },
      { label: 'US Coast Guard', url: 'https://www.uscg.mil/' },
      { label: 'Archive.org TV', url: 'https://archive.org/details/tv' },
    ],
  },
  {
    id: '8cSaStj158I',
    title: 'COVID COVERUP',
    date: '2026-05-18',
    topicId: 'black-vault',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=8cSaStj158I',
    embedUrl: 'https://www.youtube.com/embed/8cSaStj158I?rel=0',
    thumbnailUrl: 'https://i1.ytimg.com/vi/8cSaStj158I/hqdefault.jpg',
    dossier:
      'Use primary documents first: agency releases, grant records, emails, hearing transcripts, and timeline conflicts. Separate lab-origin debate, policy failures, and censorship claims into distinct evidence lanes.',
    references: [
      { label: 'NIH RePORTER', url: 'https://reporter.nih.gov/' },
      { label: 'Congressional Record', url: 'https://www.congress.gov/congressional-record' },
      { label: 'WHO Publications', url: 'https://www.who.int/publications' },
    ],
  },
  {
    id: 'ApaRfQOuUO4',
    title: 'APOCALYPTIC',
    date: '2026-05-18',
    topicId: 'high-strangeness',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=ApaRfQOuUO4',
    embedUrl: 'https://www.youtube.com/embed/ApaRfQOuUO4?rel=0',
    thumbnailUrl: 'https://i2.ytimg.com/vi/ApaRfQOuUO4/hqdefault.jpg',
    dossier:
      'Apocalyptic narratives need timeline discipline: what was predicted, what happened, what was reinterpreted, and what institutions or incentives amplified the fear.',
    references: [
      { label: 'Library of Congress', url: 'https://www.loc.gov/' },
      { label: 'Internet Archive', url: 'https://archive.org/' },
      { label: 'Google News', url: 'https://news.google.com/' },
    ],
  },
  {
    id: 'oiMLnd_4aHY',
    title: 'THEY WANT YOU TO FEEL INSANE',
    date: '2026-05-15',
    topicId: 'machine-state',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=oiMLnd_4aHY',
    embedUrl: 'https://www.youtube.com/embed/oiMLnd_4aHY?rel=0',
    thumbnailUrl: 'https://i4.ytimg.com/vi/oiMLnd_4aHY/hqdefault.jpg',
    dossier:
      'The serious version is a map of perception management: state messaging, platform incentives, psychiatric language, moderation policy, and the boundary between manipulation and ordinary chaos.',
    references: [
      { label: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
      { label: 'FBI Vault', url: 'https://vault.fbi.gov/' },
      { label: 'GDELT', url: 'https://www.gdeltproject.org/' },
    ],
  },
  {
    id: '3WyKJa_F_Wg',
    title: 'THERES NO TREAM IN POLITICS #shorts',
    date: '2026-05-16',
    topicId: 'power-web',
    type: 'short',
    youtubeUrl: 'https://www.youtube.com/shorts/3WyKJa_F_Wg',
    embedUrl: 'https://www.youtube.com/embed/3WyKJa_F_Wg?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/3WyKJa_F_Wg/hqdefault.jpg',
    dossier:
      'Track this as a political incentive file: identify who benefits, what the public record says, which claims are rhetoric, and where the receipts begin.',
    references: [
      { label: 'Congress', url: 'https://www.congress.gov/' },
      { label: 'Federal Election Commission', url: 'https://www.fec.gov/data/' },
      { label: 'OpenSecrets', url: 'https://www.opensecrets.org/' },
    ],
  },
  {
    id: 'BxI3cT1k45w',
    title: 'FEEDING INTO THE HYSTERIA #shorts',
    date: '2026-05-15',
    topicId: 'machine-state',
    type: 'short',
    youtubeUrl: 'https://www.youtube.com/shorts/BxI3cT1k45w',
    embedUrl: 'https://www.youtube.com/embed/BxI3cT1k45w?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/BxI3cT1k45w/hqdefault.jpg',
    dossier:
      'Treat hysteria as a distribution system. Map the original event, amplification loops, official corrections, and the incentive to keep fear alive.',
    references: [
      { label: 'GDELT', url: 'https://www.gdeltproject.org/' },
      { label: 'Pew Research Center', url: 'https://www.pewresearch.org/' },
      { label: 'NIST AI RMF', url: 'https://www.nist.gov/itl/ai-risk-management-framework' },
    ],
  },
  {
    id: 'f_bplTaaDJQ',
    title: 'Data Centers HERE, Data Centers THERE, Data Centers EVERYWHERE #shorts',
    date: '2026-05-14',
    topicId: 'machine-state',
    type: 'short',
    youtubeUrl: 'https://www.youtube.com/shorts/f_bplTaaDJQ',
    embedUrl: 'https://www.youtube.com/embed/f_bplTaaDJQ?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/f_bplTaaDJQ/hqdefault.jpg',
    dossier:
      'The document path runs through zoning, energy demand, water usage, tax incentives, and national-security language around compute infrastructure.',
    references: [
      { label: 'EIA Electricity Data', url: 'https://www.eia.gov/electricity/' },
      { label: 'DOE Data Centers', url: 'https://www.energy.gov/' },
      { label: 'Local public records', url: 'https://www.searchsystems.net/' },
    ],
  },
  {
    id: 'D2-R8FERWoM',
    title: 'BERMUDA TRIANGLE & FLOATING DATA CENTERS',
    date: '2026-05-14',
    topicId: 'off-world',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=D2-R8FERWoM',
    embedUrl: 'https://www.youtube.com/embed/D2-R8FERWoM?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/D2-R8FERWoM/hqdefault.jpg',
    dossier:
      'This file links folklore geography to modern infrastructure. Separate maritime anomalies from data-center claims, then verify permits, shipping lanes, weather, and ownership.',
    references: [
      { label: 'NOAA Charts', url: 'https://www.nauticalcharts.noaa.gov/' },
      { label: 'Maritime Administration', url: 'https://www.maritime.dot.gov/' },
      { label: 'SEC EDGAR', url: 'https://www.sec.gov/edgar/search/' },
    ],
  },
  {
    id: 'czJEpZvDJ3A',
    title: 'THE ERA OF THE CONSPIRACY THEORIST #shorts',
    date: '2026-05-13',
    topicId: 'high-strangeness',
    type: 'short',
    youtubeUrl: 'https://www.youtube.com/shorts/czJEpZvDJ3A',
    embedUrl: 'https://www.youtube.com/embed/czJEpZvDJ3A?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/czJEpZvDJ3A/hqdefault.jpg',
    dossier:
      'Use this as the manifesto file: when institutions lose trust, the public starts doing its own intelligence work. The standard has to rise, not collapse.',
    references: [
      { label: 'Edelman Trust Barometer', url: 'https://www.edelman.com/trust' },
      { label: 'Gallup Trust', url: 'https://news.gallup.com/' },
      { label: 'Library of Congress', url: 'https://www.loc.gov/' },
    ],
  },
  {
    id: '5v5RPBw7oos',
    title: 'LUNA PLANNING MKULTRA HEARING',
    date: '2026-05-13',
    topicId: 'black-vault',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=5v5RPBw7oos',
    embedUrl: 'https://www.youtube.com/embed/5v5RPBw7oos?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/5v5RPBw7oos/hqdefault.jpg',
    dossier:
      'MKULTRA belongs in the proven-conspiracy baseline. Start from declassified records, then separate historical fact from modern claims riding on the name.',
    references: [
      { label: 'CIA Reading Room', url: 'https://www.cia.gov/readingroom/' },
      { label: 'Church Committee', url: 'https://www.senate.gov/about/powers-procedures/investigations/church-committee.htm' },
      { label: 'National Security Archive', url: 'https://nsarchive.gwu.edu/' },
    ],
  },
  {
    id: 'cLgGJWS6abM',
    title: 'DISTRACTION AFTER DISTRACTION #shorts',
    date: '2026-05-12',
    topicId: 'power-web',
    type: 'short',
    youtubeUrl: 'https://www.youtube.com/shorts/cLgGJWS6abM',
    embedUrl: 'https://www.youtube.com/embed/cLgGJWS6abM?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/cLgGJWS6abM/hqdefault.jpg',
    dossier:
      'The serious angle is agenda setting: compare the attention spike to filings, hearings, market moves, and document releases that happened at the same time.',
    references: [
      { label: 'GDELT', url: 'https://www.gdeltproject.org/' },
      { label: 'CourtListener', url: 'https://www.courtlistener.com/' },
      { label: 'Federal Register', url: 'https://www.federalregister.gov/' },
    ],
  },
  {
    id: 'Jn4SAKfonCQ',
    title: '4-FOOT-BEINGS IN UFO FILES ARE NOT KEVIN HART',
    date: '2026-05-12',
    topicId: 'skywatch',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=Jn4SAKfonCQ',
    embedUrl: 'https://www.youtube.com/embed/Jn4SAKfonCQ?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/Jn4SAKfonCQ/hqdefault.jpg',
    dossier:
      'Entity claims need a strict evidence ladder: original file, provenance, witness chain, redactions, hoax vectors, and whether official language actually says what people claim.',
    references: [
      { label: 'FBI Vault UFO', url: 'https://vault.fbi.gov/UFO' },
      { label: 'AARO', url: 'https://www.aaro.mil/' },
      { label: 'NARA', url: 'https://www.archives.gov/' },
    ],
  },
  {
    id: 'gBH6UjvSXnQ',
    title: 'The Note Epstein Left Behind',
    date: '2026-05-11',
    topicId: 'power-web',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=gBH6UjvSXnQ',
    embedUrl: 'https://www.youtube.com/embed/gBH6UjvSXnQ?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/gBH6UjvSXnQ/hqdefault.jpg',
    dossier:
      'Handle this with court-first discipline. Separate authenticated filings, media claims, victim testimony, sealed gaps, and speculation about motives or protectors.',
    references: [
      { label: 'CourtListener', url: 'https://www.courtlistener.com/' },
      { label: 'DOJ', url: 'https://www.justice.gov/' },
      { label: 'PACER', url: 'https://pacer.uscourts.gov/' },
    ],
  },
  {
    id: 'k27iBDWl0DI',
    title: "BABA VANGA'S 2026 PREDICTIONS",
    date: '2026-05-11',
    topicId: 'high-strangeness',
    type: 'episode',
    youtubeUrl: 'https://www.youtube.com/watch?v=k27iBDWl0DI',
    embedUrl: 'https://www.youtube.com/embed/k27iBDWl0DI?rel=0',
    thumbnailUrl: 'https://i3.ytimg.com/vi/k27iBDWl0DI/hqdefault.jpg',
    dossier:
      'Prediction files need scorekeeping. Identify the earliest attributed source, the exact forecast, later edits, misses, hits, and the media cycle that keeps the prophecy alive.',
    references: [
      { label: 'Internet Archive', url: 'https://archive.org/' },
      { label: 'Library of Congress', url: 'https://www.loc.gov/' },
      { label: 'Google News', url: 'https://news.google.com/' },
    ],
  },
];

export function getTopic(id: string) {
  return topics.find((topic) => topic.id === id) ?? topics[0];
}

export function getVideo(id?: string | string[]) {
  const videoId = Array.isArray(id) ? id[0] : id;
  return videos.find((video) => video.id === videoId) ?? videos[0];
}
