// Binary "Real or Hoax?" items. REAL = documented / declassified / proven in court or by
// government record. HOAX = debunked, retracted, or admitted fabrication. Every item points to a
// stable reference (mostly Wikipedia) that documents the verdict. ~half real, ~half hoax.
export type RealOrHoaxItem = {
  claim: string
  verdict: "real" | "hoax"
  blurb: string
  source: string
}

export const realOrHoaxItems: RealOrHoaxItem[] = [
  // ---------- REAL ----------
  {
    claim: "The U.S. Joint Chiefs drew up a plan to stage terror attacks on Americans and blame Cuba.",
    verdict: "real",
    blurb:
      "Operation Northwoods (1962) proposed faking attacks on U.S. citizens to justify war with Cuba. The Joint Chiefs signed it; President Kennedy rejected it. The memo was declassified in 1997.",
    source: "https://en.wikipedia.org/wiki/Operation_Northwoods",
  },
  {
    claim: "The CIA dosed unwitting Americans with LSD to research mind control.",
    verdict: "real",
    blurb:
      "Project MKUltra (1950s–60s) drugged citizens, often without consent. Confirmed by 1977 Senate hearings; most files were destroyed in 1973 but surviving records were declassified.",
    source: "https://en.wikipedia.org/wiki/MKUltra",
  },
  {
    claim: "U.S. doctors let syphilis go untreated in hundreds of Black men for 40 years to study it.",
    verdict: "real",
    blurb:
      "The Tuskegee Study (1932–1972) withheld penicillin even after it became standard care. President Clinton issued a formal federal apology in 1997.",
    source: "https://en.wikipedia.org/wiki/Tuskegee_Syphilis_Study",
  },
  {
    claim: "The FBI mailed Martin Luther King Jr. an anonymous letter urging him to kill himself.",
    verdict: "real",
    blurb:
      "Under COINTELPRO the FBI sent King a 'suicide package' with surveillance tapes. The program's abuses were confirmed by the Senate's Church Committee in 1975.",
    source: "https://en.wikipedia.org/wiki/COINTELPRO",
  },
  {
    claim: "The CIA cultivated journalists to shape U.S. news coverage during the Cold War.",
    verdict: "real",
    blurb:
      "Operation Mockingbird involved the CIA's relationships with reporters and outlets to influence coverage, documented by the 1975 Church Committee.",
    source: "https://en.wikipedia.org/wiki/Operation_Mockingbird",
  },
  {
    claim: "The U.S. secretly brought roughly 1,600 Nazi scientists into the country after WWII.",
    verdict: "real",
    blurb:
      "Operation Paperclip recruited German scientists and sanitized their records to put them to work on rockets and other programs. The files are declassified.",
    source: "https://en.wikipedia.org/wiki/Operation_Paperclip",
  },
  {
    claim: "In 1950 the U.S. Navy secretly sprayed bacteria over San Francisco.",
    verdict: "real",
    blurb:
      "Operation Sea-Spray released Serratia marcescens over the Bay Area to test how a biological attack might spread. It later surfaced in congressional hearings.",
    source: "https://en.wikipedia.org/wiki/Operation_Sea-Spray",
  },
  {
    claim: "The U.S. military ran secret chemical and biological tests on its own sailors.",
    verdict: "real",
    blurb:
      "Project SHAD (1962–1973) exposed service members to chemical and biological agents to test shipboard defenses. The Pentagon later acknowledged the tests.",
    source: "https://en.wikipedia.org/wiki/Project_SHAD",
  },
  {
    claim: "A 1964 Gulf of Tonkin attack used to escalate Vietnam never actually happened.",
    verdict: "real",
    blurb:
      "An NSA historian's study, declassified in 2005, concluded the August 4, 1964 attack did not occur as reported — yet it justified the war's escalation.",
    source: "https://en.wikipedia.org/wiki/Gulf_of_Tonkin_incident",
  },
  {
    claim: "Seven tobacco CEOs swore under oath to Congress that nicotine isn't addictive.",
    verdict: "real",
    blurb:
      "In 1994 the CEOs testified nicotine wasn't addictive; internal 'tobacco papers' later proved the firms knew it was and a federal court found a decades-long fraud.",
    source: "https://en.wikipedia.org/wiki/Tobacco_Master_Settlement_Agreement",
  },
  {
    claim: "The sugar industry paid Harvard scientists to blame fat, not sugar, for heart disease.",
    verdict: "real",
    blurb:
      "The Sugar Research Foundation funded 1960s research that downplayed sugar's role. The payments were exposed in a 2016 analysis of the industry's own documents.",
    source: "https://en.wikipedia.org/wiki/Sugar_Research_Foundation",
  },
  {
    claim: "The U.S. government injected hospital patients with plutonium without their consent.",
    verdict: "real",
    blurb:
      "Cold War human radiation experiments injected unsuspecting patients with plutonium and uranium. A 1990s federal advisory committee confirmed and documented them.",
    source: "https://en.wikipedia.org/wiki/Human_radiation_experiments",
  },
  {
    claim: "The U.S. Army sprayed clouds of chemicals over American cities to study fallout patterns.",
    verdict: "real",
    blurb:
      "Operation LAC (1957–1958) dispersed zinc cadmium sulfide over large areas of the U.S. and Canada to model how particles would spread. It was later acknowledged.",
    source: "https://en.wikipedia.org/wiki/Operation_LAC",
  },
  {
    claim: "A secret Masonic lodge plotted to subvert the Italian government in the 1980s.",
    verdict: "real",
    blurb:
      "The P2 lodge, led by Licio Gelli, embedded members across Italy's elite. Its 1981 exposure brought down a government and a parliamentary inquiry declared it subversive.",
    source: "https://en.wikipedia.org/wiki/Propaganda_Due",
  },
  {
    claim: "NATO ran secret 'stay-behind' armies across Western Europe during the Cold War.",
    verdict: "real",
    blurb:
      "Operation Gladio maintained clandestine anti-communist paramilitary networks. Italy's prime minister officially confirmed the program's existence in 1990.",
    source: "https://en.wikipedia.org/wiki/Operation_Gladio",
  },
  {
    claim: "The NSA secretly copied millions of telegrams sent in and out of the U.S. for decades.",
    verdict: "real",
    blurb:
      "Project SHAMROCK (1945–1975) collected telegrams with the cooperation of cable companies. It was exposed by the Church Committee in 1975.",
    source: "https://en.wikipedia.org/wiki/Project_SHAMROCK",
  },
  {
    claim: "Reagan officials secretly sold arms to Iran and funneled the cash to Nicaraguan rebels.",
    verdict: "real",
    blurb:
      "The Iran-Contra affair bypassed an embargo and a congressional ban, leading to convictions and televised hearings in the late 1980s.",
    source: "https://en.wikipedia.org/wiki/Iran%E2%80%93Contra_affair",
  },
  {
    claim: "Leaded gasoline was sold as safe for decades while makers knew lead was poisoning people.",
    verdict: "real",
    blurb:
      "Tetraethyl lead producers downplayed known toxicity even after workers died during its development. It took decades of public-health pressure to ban leaded gas.",
    source: "https://en.wikipedia.org/wiki/Tetraethyllead",
  },
  {
    claim: "U.S. researchers deliberately infected Guatemalans with syphilis without consent.",
    verdict: "real",
    blurb:
      "1940s U.S.-funded experiments intentionally infected Guatemalan prisoners, soldiers, and patients. President Obama formally apologized in 2010 after the research was uncovered.",
    source: "https://en.wikipedia.org/wiki/Syphilis_experiments_in_Guatemala",
  },
  {
    claim: "Scientology operatives infiltrated dozens of U.S. federal agencies to steal records.",
    verdict: "real",
    blurb:
      "Operation Snow White was the largest infiltration of the U.S. government in history. Eleven senior Scientologists were convicted in 1979–1980.",
    source: "https://en.wikipedia.org/wiki/Operation_Snow_White",
  },
  {
    claim: "A retired Marine general testified that financiers asked him to lead a coup against FDR.",
    verdict: "real",
    blurb:
      "In the 1933 'Business Plot,' General Smedley Butler told a congressional committee he was approached to lead a fascist coup. A House committee confirmed parts of his account.",
    source: "https://en.wikipedia.org/wiki/Business_Plot",
  },
  {
    claim: "DuPont knowingly contaminated drinking water for years with a toxic Teflon chemical.",
    verdict: "real",
    blurb:
      "Internal documents showed DuPont knew PFOA (C8) was harmful and polluting water near its plants. Litigation produced settlements and a major disease-linkage study.",
    source: "https://en.wikipedia.org/wiki/C8_Science_Panel",
  },
  {
    claim: "The NSA collected bulk phone and internet data on Americans, revealed by a 2013 leak.",
    verdict: "real",
    blurb:
      "Documents leaked by Edward Snowden exposed PRISM and bulk metadata collection from major U.S. tech and telecom companies.",
    source: "https://en.wikipedia.org/wiki/PRISM",
  },
  {
    claim: "Purdue Pharma pleaded guilty to misleading the public about OxyContin's addiction risk.",
    verdict: "real",
    blurb:
      "Purdue, owned by the Sackler family, marketed OxyContin as low-risk while knowing its addictive potential, pleading guilty to federal charges in 2007 and again in 2020.",
    source: "https://en.wikipedia.org/wiki/Purdue_Pharma",
  },
  {
    claim: "A secret CIA report on its own illegal activities was nicknamed the 'Family Jewels.'",
    verdict: "real",
    blurb:
      "The internal report compiled assassination plots, domestic spying, and other illegal operations. It was declassified and released in 2007.",
    source: "https://en.wikipedia.org/wiki/Family_Jewels_(Central_Intelligence_Agency)",
  },
  {
    claim: "Volkswagen built software to cheat diesel emissions tests on millions of cars.",
    verdict: "real",
    blurb:
      "The 2015 'Dieselgate' scandal revealed VW used 'defeat devices' to pass lab tests while polluting far more on the road. The company pleaded guilty and paid billions.",
    source: "https://en.wikipedia.org/wiki/Volkswagen_emissions_scandal",
  },
  {
    claim: "The U.S. government infected people with hepatitis and other diseases at Willowbrook.",
    verdict: "real",
    blurb:
      "At the Willowbrook State School (1950s–70s), researchers deliberately infected disabled children with hepatitis to study the disease. The studies are widely documented.",
    source: "https://en.wikipedia.org/wiki/Willowbrook_State_School",
  },
  {
    claim: "An Enron-scale accounting fraud hid billions in debt before the company collapsed.",
    verdict: "real",
    blurb:
      "Enron used off-the-books partnerships to conceal debt and inflate profits. Its 2001 collapse led to criminal convictions and destroyed its auditor, Arthur Andersen.",
    source: "https://en.wikipedia.org/wiki/Enron_scandal",
  },
  {
    claim: "Bernie Madoff ran the largest Ponzi scheme in history, costing investors tens of billions.",
    verdict: "real",
    blurb:
      "Madoff's investment firm paid fake returns from new investors' money for decades. He pleaded guilty in 2009; losses ran to roughly $65 billion on paper.",
    source: "https://en.wikipedia.org/wiki/Madoff_investment_scandal",
  },
  {
    claim: "Britain secretly tested nerve agent on its own servicemen, and one died.",
    verdict: "real",
    blurb:
      "At Porton Down in 1953, airman Ronald Maddison died after being exposed to sarin in a secret test. A 2004 inquest ruled it unlawful killing.",
    source: "https://en.wikipedia.org/wiki/Ronald_Maddison",
  },

  // ---------- HOAX ----------
  {
    claim: "A 'missing link' fossil with a human skull and ape jaw was found in England in 1912.",
    verdict: "hoax",
    blurb:
      "Piltdown Man was a forgery: a medieval human skull paired with an orangutan jaw, stained to look ancient. It was exposed as a fake in 1953.",
    source: "https://en.wikipedia.org/wiki/Piltdown_Man",
  },
  {
    claim: "Two English girls photographed real fairies in their garden in 1917.",
    verdict: "hoax",
    blurb:
      "The Cottingley Fairies were paper cut-outs copied from a children's book. The cousins admitted the hoax decades later, in the 1980s.",
    source: "https://en.wikipedia.org/wiki/Cottingley_Fairies",
  },
  {
    claim: "The famous 'Surgeon's Photo' of the Loch Ness Monster shows a real creature.",
    verdict: "hoax",
    blurb:
      "The 1934 photo was staged using a toy submarine fitted with a sculpted head. A participant confessed the hoax in 1994.",
    source: "https://en.wikipedia.org/wiki/Surgeon%27s_Photograph",
  },
  {
    claim: "A 10-foot petrified giant man was unearthed on a New York farm in 1869.",
    verdict: "hoax",
    blurb:
      "The Cardiff Giant was a block of carved gypsum buried by a hoaxer to fool the public. It was quickly exposed but still drew paying crowds.",
    source: "https://en.wikipedia.org/wiki/Cardiff_Giant",
  },
  {
    claim: "P.T. Barnum displayed a genuine mummified mermaid.",
    verdict: "hoax",
    blurb:
      "The 'Feejee Mermaid' was a monkey's torso stitched to a fish tail. It was a deliberate sideshow fabrication.",
    source: "https://en.wikipedia.org/wiki/Fiji_mermaid",
  },
  {
    claim: "A man named Rudolph Fentz vanished in 1876 and reappeared in 1950s New York.",
    verdict: "hoax",
    blurb:
      "The 'time traveler' story was traced to a 1951 science-fiction short story by Jack Finney that was later mistaken for a real police report.",
    source: "https://en.wikipedia.org/wiki/Rudolph_Fentz",
  },
  {
    claim: "Hitler's secret personal diaries were discovered and published in 1983.",
    verdict: "hoax",
    blurb:
      "The 'Hitler Diaries' were forged by Konrad Kujau and sold to Stern magazine. Forensic tests showed the paper and ink were modern.",
    source: "https://en.wikipedia.org/wiki/Hitler_Diaries",
  },
  {
    claim: "In 2009 a 6-year-old boy floated away in a homemade helium balloon over Colorado.",
    verdict: "hoax",
    blurb:
      "The 'Balloon Boy' incident was staged by the family for publicity; the child was hiding at home the whole time. The parents pleaded guilty.",
    source: "https://en.wikipedia.org/wiki/Balloon_boy_hoax",
  },
  {
    claim: "1995 footage shows a real autopsy of an alien recovered from Roswell.",
    verdict: "hoax",
    blurb:
      "The 'Alien Autopsy' film was admitted to be a staged reconstruction using a fabricated dummy, confirmed by its producer years later.",
    source: "https://en.wikipedia.org/wiki/Alien_Autopsy_(1995_film)",
  },
  {
    claim: "Giant ancient pyramids built by a lost civilization were found buried under a Bosnian hill.",
    verdict: "hoax",
    blurb:
      "The 'Bosnian Pyramids' are natural hills (flatirons); geologists and archaeologists reject the pyramid claims as pseudoarchaeology.",
    source: "https://en.wikipedia.org/wiki/Bosnian_pyramid_claims",
  },
  {
    claim: "A 2023 paper proved an Indonesian site is a 25,000-year-old human-built pyramid.",
    verdict: "hoax",
    blurb:
      "The Gunung Padang 'oldest pyramid' claim was retracted in 2024 after experts said the dated soil was natural, not evidence of construction.",
    source: "https://en.wikipedia.org/wiki/Gunung_Padang",
  },
  {
    claim: "Crop circles are messages left by extraterrestrial craft.",
    verdict: "hoax",
    blurb:
      "Many famous circles were made by hoaxers Doug Bower and Dave Chorley, who demonstrated their plank-and-rope method publicly in 1991.",
    source: "https://en.wikipedia.org/wiki/Crop_circle",
  },
  {
    claim: "A wave of mass child-abuse 'satanic ritual' crimes swept day-care centers in the 1980s.",
    verdict: "hoax",
    blurb:
      "The 'Satanic Panic' produced sensational allegations that investigations found no physical evidence for; the most famous case ended without convictions.",
    source: "https://en.wikipedia.org/wiki/Satanic_panic",
  },
  {
    claim: "A 'War of the Worlds' alien invasion really began in New Jersey in 1938.",
    verdict: "hoax",
    blurb:
      "It was a radio drama by Orson Welles. While reports of mass panic were themselves exaggerated, there was no actual invasion.",
    source: "https://en.wikipedia.org/wiki/The_War_of_the_Worlds_(1938_radio_drama)",
  },
  {
    claim: "George Adamski photographed and rode in flying saucers piloted by friendly Venusians.",
    verdict: "hoax",
    blurb:
      "Adamski's 1950s 'contactee' photos and tales were widely debunked; his famous 'scout ship' resembles a chicken brooder or lamp parts.",
    source: "https://en.wikipedia.org/wiki/George_Adamski",
  },
  {
    claim: "A genuine 'Bigfoot' body was recovered and stored in a freezer in Georgia in 2008.",
    verdict: "hoax",
    blurb:
      "The 2008 'Bigfoot body' was a rubber gorilla costume packed in ice. The hoaxers admitted the fabrication after a press conference.",
    source: "https://en.wikipedia.org/wiki/2008_Georgia_Bigfoot_hoax",
  },
  {
    claim: "A 1764 beast that killed scores of people in France was a supernatural monster.",
    verdict: "hoax",
    blurb:
      "The 'Beast of Gévaudan' attacks were real, but the 'supernatural' framing isn't — the killings are generally attributed to wolves or wolf-dogs, not a paranormal creature.",
    source: "https://en.wikipedia.org/wiki/Beast_of_G%C3%A9vaudan",
  },
  {
    claim: "Scientists in 1726 confirmed a woman in England gave birth to live rabbits.",
    verdict: "hoax",
    blurb:
      "Mary Toft fooled prominent doctors before confessing she had inserted animal parts. It became a notorious medical hoax.",
    source: "https://en.wikipedia.org/wiki/Mary_Toft",
  },
  {
    claim: "An ancient runestone proves Vikings explored Minnesota in the 1300s.",
    verdict: "hoax",
    blurb:
      "The Kensington Runestone is widely regarded by scholars as a 19th-century forgery, based on its language and inscription style.",
    source: "https://en.wikipedia.org/wiki/Kensington_Runestone",
  },
  {
    claim: "A Japanese fishing boat caught a real plesiosaur carcass in 1977.",
    verdict: "hoax",
    blurb:
      "The 'Zuiyo-maru carcass' was almost certainly a decomposed basking shark, whose rotting body mimics a plesiosaur shape. Tissue analysis pointed to shark.",
    source: "https://en.wikipedia.org/wiki/Zuiyo-maru_carcass",
  },
  {
    claim: "The Amityville house was genuinely haunted by demonic forces in the 1970s.",
    verdict: "hoax",
    blurb:
      "The 'Amityville Horror' was later described as largely invented; a lawyer said the story was concocted 'over many bottles of wine.'",
    source: "https://en.wikipedia.org/wiki/The_Amityville_Horror",
  },
  {
    claim: "A 19th-century scientist proved the Moon was inhabited by bat-winged humanoids.",
    verdict: "hoax",
    blurb:
      "The 1835 'Great Moon Hoax' was a series of fabricated New York Sun articles describing lunar life supposedly seen through a telescope.",
    source: "https://en.wikipedia.org/wiki/Great_Moon_Hoax",
  },
  {
    claim: "A patient's autopsy revealed a tiny living humanoid — the 'Atacama alien' was extraterrestrial.",
    verdict: "hoax",
    blurb:
      "The Atacama skeleton ('Ata') is a human fetus with skeletal mutations, confirmed by DNA analysis — not an alien.",
    source: "https://en.wikipedia.org/wiki/Atacama_skeleton",
  },
  {
    claim: "A 'perpetual motion' machine that runs forever with no energy input was built and sold.",
    verdict: "hoax",
    blurb:
      "Every claimed perpetual-motion device, like John Keely's 19th-century machine, has been a fraud or error — such machines violate the laws of thermodynamics.",
    source: "https://en.wikipedia.org/wiki/Perpetual_motion",
  },
  {
    claim: "A real leprechaun was filmed hiding in a tree in Mobile, Alabama in 2006.",
    verdict: "hoax",
    blurb:
      "The viral 'Crichton Leprechaun' news segment was a local-folklore sensation, not evidence of an actual creature.",
    source: "https://en.wikipedia.org/wiki/Crichton_Leprechaun",
  },
  {
    claim: "A medieval book written in an unknown language was deciphered to reveal alien secrets.",
    verdict: "hoax",
    blurb:
      "The Voynich Manuscript is genuinely old and undeciphered, but recurring 'solved' claims of alien or secret meanings have all failed peer scrutiny.",
    source: "https://en.wikipedia.org/wiki/Voynich_manuscript",
  },
  {
    claim: "A surgeon proved homeopathic pills cure disease through 'water memory.'",
    verdict: "hoax",
    blurb:
      "Homeopathy's claimed mechanism has no scientific basis; large reviews find its remedies work no better than placebo.",
    source: "https://en.wikipedia.org/wiki/Homeopathy",
  },
  {
    claim: "A boy psychic bent metal spoons with his mind under controlled tests.",
    verdict: "hoax",
    blurb:
      "Famous spoon-bending demonstrations have been replicated by magicians using ordinary sleight of hand; controlled tests have never confirmed psychic metal-bending.",
    source: "https://en.wikipedia.org/wiki/Spoon_bending",
  },
  {
    claim: "Slender Man is a real entity documented in centuries-old folklore.",
    verdict: "hoax",
    blurb:
      "Slender Man was invented in a 2009 Something Awful forum contest by Eric Knudsen. It is entirely a modern fictional creation.",
    source: "https://en.wikipedia.org/wiki/Slender_Man",
  },
  {
    claim: "A photograph captured a real 'thunderbird' — a giant prehistoric bird — pinned to a barn.",
    verdict: "hoax",
    blurb:
      "The endlessly described 'missing thunderbird photo' has never been produced; it is a well-known false memory and folklore loop with no actual image.",
    source: "https://en.wikipedia.org/wiki/Thunderbird_photograph",
  },
]
