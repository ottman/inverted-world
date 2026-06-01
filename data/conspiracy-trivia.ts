// Trivia about PROVEN, documented conspiracies — declassified files, Senate/Church Committee
// reports, court rulings, sworn testimony, FOIA releases. Not speculation. proofUrl points to a
// stable reference that documents the primary evidence.
export type TriviaQuestion = {
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  conspiracy: string
  proofUrl: string
}

export const conspiracyTrivia: TriviaQuestion[] = [
  {
    question: "Operation Northwoods was a 1962 plan, signed by the U.S. Joint Chiefs of Staff, to do what?",
    options: [
      "Stage terror attacks on Americans and blame Cuba to justify war",
      "Secretly fund anti-communist films in Hollywood",
      "Wiretap every U.S. senator",
      "Fake a moon landing",
    ],
    correctIndex: 0,
    explanation:
      "The declassified memorandum proposed staging attacks on U.S. citizens and soldiers as a pretext to invade Cuba. President Kennedy rejected it. Released in full by the National Security Archive in 2001.",
    conspiracy: "Operation Northwoods",
    proofUrl: "https://en.wikipedia.org/wiki/Operation_Northwoods",
  },
  {
    question: "MKUltra was a CIA program that experimented on people primarily using what?",
    options: ["Hypnosis only", "LSD and other drugs, often without consent", "Sleep deprivation alone", "Subliminal radio"],
    correctIndex: 1,
    explanation:
      "From the 1950s–60s the CIA dosed citizens with LSD and other drugs to research mind control. It was confirmed by the 1977 Senate hearings; most files were destroyed in 1973 but surviving records were declassified.",
    conspiracy: "MKUltra",
    proofUrl: "https://en.wikipedia.org/wiki/MKUltra",
  },
  {
    question: "In the FBI's COINTELPRO program, the Bureau anonymously mailed Martin Luther King Jr. a package urging him to do what?",
    options: ["Leave the country", "Turn himself in", "Take his own life", "Stop marching"],
    correctIndex: 2,
    explanation:
      "The 'suicide letter,' paired with surveillance tapes, was sent by the FBI. Its existence was confirmed by the Senate's Church Committee, and the unredacted letter was later found in FBI files.",
    conspiracy: "COINTELPRO",
    proofUrl: "https://en.wikipedia.org/wiki/COINTELPRO",
  },
  {
    question: "The Tuskegee Syphilis Study withheld treatment from Black men for how long to observe the disease?",
    options: ["About 5 years", "About 10 years", "About 40 years", "About 2 years"],
    correctIndex: 2,
    explanation:
      "From 1932 to 1972 the U.S. Public Health Service let syphilis go untreated in hundreds of Black men even after penicillin became standard. President Clinton issued a formal apology in 1997.",
    conspiracy: "Tuskegee Syphilis Study",
    proofUrl: "https://en.wikipedia.org/wiki/Tuskegee_Syphilis_Study",
  },
  {
    question: "Declassified NSA documents confirmed that the second Gulf of Tonkin attack, used to escalate the Vietnam War, was what?",
    options: ["A massive Soviet ambush", "An attack that never actually happened", "Friendly fire on a U.S. base", "A Chinese submarine"],
    correctIndex: 1,
    explanation:
      "An NSA historian's study, declassified in 2005, concluded the August 4, 1964 attack did not occur as reported — yet it was used to justify the war's escalation.",
    conspiracy: "Gulf of Tonkin",
    proofUrl: "https://en.wikipedia.org/wiki/Gulf_of_Tonkin_incident",
  },
  {
    question: "Operation Paperclip secretly brought roughly 1,600 of which group into the United States after WWII?",
    options: ["Soviet defectors", "Nazi scientists and engineers", "British codebreakers", "Japanese admirals"],
    correctIndex: 1,
    explanation:
      "U.S. intelligence recruited German scientists — some with Nazi pasts — and sanitized their records to bring them to work on rockets and other programs. The records are declassified.",
    conspiracy: "Operation Paperclip",
    proofUrl: "https://en.wikipedia.org/wiki/Operation_Paperclip",
  },
  {
    question: "In 1950's Operation Sea-Spray, the U.S. Navy secretly sprayed what over San Francisco?",
    options: ["Tear gas", "Bacteria, to test biological-weapon spread", "Fluoride", "Radioactive dust"],
    correctIndex: 1,
    explanation:
      "The Navy released Serratia marcescens bacteria over the Bay Area to study how a bioweapon attack might disperse. It later surfaced in congressional hearings.",
    conspiracy: "Operation Sea-Spray",
    proofUrl: "https://en.wikipedia.org/wiki/Operation_Sea-Spray",
  },
  {
    question: "The 2013 Snowden leaks revealed the NSA's PRISM program collected data directly from which companies?",
    options: ["Only foreign telecoms", "Major U.S. tech companies like Google and Facebook", "Banks only", "No real companies"],
    correctIndex: 1,
    explanation:
      "Documents leaked by Edward Snowden showed the NSA accessed user data from major U.S. internet companies and collected bulk phone metadata on Americans.",
    conspiracy: "NSA Mass Surveillance (PRISM)",
    proofUrl: "https://en.wikipedia.org/wiki/PRISM",
  },
  {
    question: "In 1994, seven tobacco company CEOs testified under oath before Congress that nicotine was what?",
    options: ["Highly addictive", "Not addictive", "A vitamin", "Only addictive in teens"],
    correctIndex: 1,
    explanation:
      "The CEOs swore nicotine wasn't addictive; internal 'tobacco papers' later proved the companies knew it was and engineered cigarettes to deliver it. A federal court found a decades-long fraud.",
    conspiracy: "Big Tobacco Cover-Up",
    proofUrl: "https://en.wikipedia.org/wiki/Tobacco_Master_Settlement_Agreement",
  },
  {
    question: "Internal documents revealed the sugar industry secretly paid Harvard scientists in the 1960s to shift blame for heart disease onto what?",
    options: ["Salt", "Dietary fat", "Exercise", "Genetics"],
    correctIndex: 1,
    explanation:
      "The Sugar Research Foundation funded research that downplayed sugar's role in heart disease and pointed at fat instead. The payments were exposed in a 2016 analysis of the industry's own papers.",
    conspiracy: "Sugar Industry Funding",
    proofUrl: "https://en.wikipedia.org/wiki/Sugar_Research_Foundation",
  },
  {
    question: "Operation Mockingbird was a CIA effort to do what?",
    options: [
      "Train homing pigeons as spies",
      "Influence the news media and journalists",
      "Jam Soviet radio",
      "Catalog UFO sightings",
    ],
    correctIndex: 1,
    explanation:
      "The CIA cultivated relationships with journalists and news organizations to shape coverage during the Cold War; the activity was documented by the 1975 Church Committee.",
    conspiracy: "Operation Mockingbird",
    proofUrl: "https://en.wikipedia.org/wiki/Operation_Mockingbird",
  },
  {
    question: "The Iran-Contra affair involved the Reagan administration secretly selling arms to Iran to fund what?",
    options: ["A border wall", "Contra rebels in Nicaragua", "NASA", "The CIA's pension fund"],
    correctIndex: 1,
    explanation:
      "Officials secretly sold weapons to Iran (under an embargo) and diverted proceeds to Nicaraguan Contras, bypassing a congressional ban. It led to convictions and televised hearings.",
    conspiracy: "Iran-Contra Affair",
    proofUrl: "https://en.wikipedia.org/wiki/Iran%E2%80%93Contra_affair",
  },
  {
    question: "Operation Gladio was a NATO-era network of secret 'stay-behind' armies in which region?",
    options: ["South America", "Western Europe", "Southeast Asia", "The Arctic"],
    correctIndex: 1,
    explanation:
      "Clandestine anti-communist paramilitary networks operated across Western Europe during the Cold War. Italy's government officially confirmed Gladio's existence in 1990.",
    conspiracy: "Operation Gladio",
    proofUrl: "https://en.wikipedia.org/wiki/Operation_Gladio",
  },
  {
    question: "The 'Plutonium Files' exposed that the U.S. government secretly injected unsuspecting hospital patients with what during the Cold War?",
    options: ["Saline", "Plutonium and other radioactive materials", "Penicillin", "Caffeine"],
    correctIndex: 1,
    explanation:
      "Government-funded researchers injected patients with plutonium and uranium without consent to study radiation. A 1990s federal advisory committee confirmed and documented the experiments.",
    conspiracy: "Human Radiation Experiments",
    proofUrl: "https://en.wikipedia.org/wiki/Human_radiation_experiments",
  },
  {
    question: "Purdue Pharma pleaded guilty to misleading the public about the addiction risk of which drug?",
    options: ["Aspirin", "OxyContin", "Insulin", "Penicillin"],
    correctIndex: 1,
    explanation:
      "Purdue, owned by the Sackler family, marketed OxyContin as low-risk while knowing its addictive potential. The company pleaded guilty to federal charges (2007 and again 2020).",
    conspiracy: "OxyContin / Purdue Pharma",
    proofUrl: "https://en.wikipedia.org/wiki/Purdue_Pharma",
  },
  {
    question: "Project SHAMROCK was a decades-long secret program in which the NSA collected what?",
    options: [
      "Copies of telegrams sent in and out of the U.S.",
      "Library borrowing records",
      "Church attendance logs",
      "Airline meals",
    ],
    correctIndex: 0,
    explanation:
      "From 1945 to 1975 the NSA and predecessors collected millions of telegrams with the cooperation of telegraph companies. It was exposed by the Church Committee.",
    conspiracy: "Project SHAMROCK",
    proofUrl: "https://en.wikipedia.org/wiki/Project_SHAMROCK",
  },
  {
    question: "The CIA's 'Family Jewels' documents, released in 2007, catalogued the agency's past what?",
    options: ["Budget surpluses", "Illegal and improper activities", "Real estate", "Recruitment ads"],
    correctIndex: 1,
    explanation:
      "The internal report compiled assassination plots, domestic spying, and other illegal operations. It was declassified and released in 2007.",
    conspiracy: "CIA Family Jewels",
    proofUrl: "https://en.wikipedia.org/wiki/Family_Jewels_(Central_Intelligence_Agency)",
  },
  {
    question: "The Church Committee was a 1975 U.S. Senate investigation into abuses by which agencies?",
    options: ["The Postal Service", "Intelligence agencies (CIA, FBI, NSA)", "The IRS only", "State DMVs"],
    correctIndex: 1,
    explanation:
      "Chaired by Senator Frank Church, it uncovered assassination plots, COINTELPRO, mass surveillance, and more — leading to major intelligence reforms.",
    conspiracy: "Church Committee",
    proofUrl: "https://en.wikipedia.org/wiki/Church_Committee",
  },
  {
    question: "The Watergate scandal began with a break-in at the Democratic National Committee headquarters and ended with what?",
    options: ["A Supreme Court tie", "President Nixon's resignation", "A constitutional amendment", "No consequences"],
    correctIndex: 1,
    explanation:
      "The cover-up of the 1972 break-in, tied to Nixon's re-election committee, led to his 1974 resignation — the only U.S. president to resign.",
    conspiracy: "Watergate",
    proofUrl: "https://en.wikipedia.org/wiki/Watergate_scandal",
  },
  {
    question: "DuPont was found to have knowingly contaminated water supplies for decades with which chemical used to make Teflon?",
    options: ["Chlorine", "PFOA (C8)", "Fluoride", "Ammonia"],
    correctIndex: 1,
    explanation:
      "Internal documents showed DuPont knew PFOA was toxic and polluting drinking water near its plants. Litigation produced settlements and a major scientific study linking it to disease.",
    conspiracy: "DuPont / PFOA",
    proofUrl: "https://en.wikipedia.org/wiki/C8_Science_Panel",
  },
  {
    question: "In the 1933 'Business Plot,' a retired Marine general testified that wealthy interests asked him to do what?",
    options: [
      "Lead a coup against President Roosevelt",
      "Buy the New York Times",
      "Smuggle gold to Europe",
      "Start a new political party legally",
    ],
    correctIndex: 0,
    explanation:
      "General Smedley Butler told a congressional committee he was approached to lead a fascist coup. A House committee confirmed parts of his account, though no one was prosecuted.",
    conspiracy: "The Business Plot",
    proofUrl: "https://en.wikipedia.org/wiki/Business_Plot",
  },
  {
    question: "Operation Snow White was the largest-ever infiltration of the U.S. government by whom?",
    options: ["A foreign nation", "The Church of Scientology", "A labor union", "A bank"],
    correctIndex: 1,
    explanation:
      "Scientology operatives infiltrated dozens of federal agencies to steal and purge records about the church. Eleven senior members were convicted in 1979–80.",
    conspiracy: "Operation Snow White",
    proofUrl: "https://en.wikipedia.org/wiki/Operation_Snow_White",
  },
  {
    question: "Leaded gasoline was promoted as safe for decades despite the industry knowing it caused what?",
    options: ["Better mileage", "Lead poisoning and neurological harm", "Engine fires", "Nothing harmful"],
    correctIndex: 1,
    explanation:
      "Tetraethyl lead makers downplayed known toxicity even after workers died during its development. It took decades of public-health pressure to ban leaded gas.",
    conspiracy: "Leaded Gasoline",
    proofUrl: "https://en.wikipedia.org/wiki/Tetraethyllead",
  },
  {
    question: "In the 1940s, U.S. researchers deliberately infected people in which country with syphilis and gonorrhea without consent?",
    options: ["Canada", "Guatemala", "Norway", "Japan"],
    correctIndex: 1,
    explanation:
      "U.S. government-funded experiments intentionally infected Guatemalan prisoners, soldiers, and patients. President Obama formally apologized in 2010 after the research was uncovered.",
    conspiracy: "Guatemala Syphilis Experiments",
    proofUrl: "https://en.wikipedia.org/wiki/Syphilis_experiments_in_Guatemala",
  },
]
