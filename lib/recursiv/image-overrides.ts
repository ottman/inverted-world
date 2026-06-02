import { aiThumbnailImage, type RightsClearedImage } from "@/lib/openverse"

// Hand-curated, per-story image overrides — the highest-accuracy layer. Keyword scoring (Openverse)
// gets the picture in the right ballpark, but a vision audit of the tale set found many images that
// were trusted by keyword overlap yet plainly wrong (plant-cell microscopy for a Bigfoot-tracks
// story, a meme cat for the Wow! signal, rubber ducks for a haunted-rectory story). For each, we pin
// a precise on-topic SCENE generated from the story so the picture actually depicts the subject.
// Applied with top priority by the re-image job, so corrections land without touching selection logic.
// Two shapes per uri:
//   { imageUrl }  — a specific rights-cleared photo URL (with optional license/attribution)
//   { aiPrompt }  — a precise scene to generate (on-topic, photorealistic)
type ImageOverride =
  | { imageUrl: string; license?: string; attribution?: string; sourceUrl?: string }
  | { aiPrompt: string }

const OVERRIDES: Record<string, ImageOverride> = {
  // Mothman — the actual reported scene (winged red-eyed figure by the Point Pleasant TNT-area igloos)
  // beats a generic cryptid drawing / movie poster. Hand-tuned and visually verified.
  "tale-mothman-point-pleasant": {
    aiPrompt:
      "A tall winged humanoid figure with glowing red eyes standing in fog near abandoned WWII concrete munition igloos in a wooded West Virginia clearing at dusk, eerie, ominous",
  },
  // ── Vision-audit corrections (86 tales: 42 mismatch + 44 weak) ──────────────────────────────────
  "tale-amelia-earhart-disappearance": { aiPrompt: "Amelia Earhart in flight jacket standing beside her silver Lockheed Electra 10E on a 1937 airfield at dusk, propellers and tail markings visible, vintage documentary photo, no text" },
  "tale-atencion-numbers-station-court": { aiPrompt: "Photoreal vintage shortwave radio receiver glowing in a dark room at night, dial lit, headphones on a table, lone Cuban numbers-station transmitter tower outside, eerie clandestine mood, no text" },
  "tale-aware-parnia-cardiac-arrest-study": { aiPrompt: "Hospital ICU resuscitation room from a high ceiling angle, a patient on a gurney with crash cart and monitors below, a hidden picture target shelf near the ceiling, cold clinical light, eerie mood, photorealistic" },
  "tale-aware-study-cardiac-arrest": { aiPrompt: "A high hidden shelf in a hospital resuscitation room holding a face-up picture card visible only from above, crash cart and monitors below, cold clinical lighting, mysterious mood, photorealistic" },
  "tale-beast-of-bray-road-dogman": { aiPrompt: "A hulking upright canine creature with glowing eyes and matted fur crouched at the edge of a dark rural Wisconsin cornfield road at night, car headlights catching its silhouette, foggy, photorealistic" },
  "tale-belgian-wave-1989-f16-radar": { aiPrompt: "A Belgian F-16 fighter cockpit at night over rural countryside, green radar scope glowing with a bright unidentified blip, pilot scanning a dark winter sky, 1989, tense" },
  "tale-bell-witch": { aiPrompt: "19th-century rural Tennessee log cabin at night, a frightened family by candlelight as an unseen ghostly presence menaces them, shadowy Bell Witch haunting, eerie atmospheric" },
  "tale-belmez-faces-spain-1971": { aiPrompt: "Worn cement kitchen floor in a humble rural Spanish village house, faint ghostly human face staining the concrete, dim daylight, eerie unsettling mood, documentary realism" },
  "tale-bennington-triangle-vermont": { aiPrompt: "A dense fog-shrouded Vermont mountain forest in late autumn, bare trees and a faint disappearing trail on Glastenbury Mountain, cold grey mist, ominous and lonely mood, photorealistic" },
  "tale-bohemian-grove-cremation-of-care": { aiPrompt: "Towering moss-covered stone owl idol looming over a torch-lit nighttime ritual clearing in a giant redwood grove, robed figures gathered around a burning effigy on a pyre, eerie smoke, cinematic" },
  "tale-borley-rectory": { aiPrompt: "Large grim Victorian red-brick English rectory at twilight, gabled roofline, overgrown grounds, fog, dark windows, melancholy haunted atmosphere, photorealistic" },
  "tale-bostrom-simulation-argument": { aiPrompt: "Photoreal close-up of a human face dissolving into glowing green digital wireframe and pixel grid, half flesh half simulation code, dark void background, eerie blue light, no text" },
  "tale-bridgewater-triangle-massachusetts": { aiPrompt: "Misty New England cedar swamp at dusk in Massachusetts, dark still water, gnarled bare trees, fog drifting low, ominous foreboding mood, photorealistic" },
  "tale-brown-mountain-lights-nc": { aiPrompt: "Glowing orbs of pale light hovering over a forested Appalachian ridgeline at night, North Carolina, long-exposure photo, dark blue sky, mysterious eerie mood" },
  "tale-chris-costner-sizemore-three-faces": { aiPrompt: "1950s black-and-white clinical scene, a woman seated under bright lamp during a filmed hypnosis session, doctor with notepad nearby, vintage psychiatry office, tense quiet mood, photorealistic" },
  "tale-cia-acoustic-kitty-spy-cat": { aiPrompt: "Photoreal 1960s gray tabby cat wearing a tiny surgical microphone harness on a CIA lab table, Cold War instruments, dim clinical light, eerie covert mood, no text" },
  "tale-cia-gateway-process-monroe-hemisync": { aiPrompt: "A person wearing headphones reclining in a dark sensory chamber, glowing concentric sound waves and a faint cosmic starfield emanating around their head, surreal out-of-body mood, photorealistic" },
  "tale-cicada-3301": { aiPrompt: "A glowing cicada emblem overlaid on cascading green cryptographic code and a dark hooded figure at a terminal, mysterious recruitment puzzle, cinematic, photorealistic" },
  "tale-cointelpro-fbi-surveillance": { aiPrompt: "1960s black-and-white photo: an anonymous typed threatening letter and FBI surveillance file on a desk beside a reel-to-reel wiretap recorder, dim office, ominous covert mood" },
  "tale-columbus-poltergeist-tina-resch-1984": { aiPrompt: "A 1980s suburban living room, a beige rotary telephone caught in mid-flight across the room toward a startled teenage girl on a sofa, motion blur on the handset cord, grainy realism, photorealistic" },
  "tale-doggerland-north-sea-atlantis": { aiPrompt: "Prehistoric grassy lowland plain with marshes and scattered Mesolithic settlers, cold grey North Sea waters slowly flooding inland across the land, low overcast sky, somber documentary realism" },
  "tale-dyatlov-pass-incident": { aiPrompt: "Photorealistic night scene of a torn collapsed canvas tent half-buried in snow on a barren windswept Ural mountain slope, faint footprints leading into freezing darkness, eerie moonlight, no text" },
  "tale-enfield-poltergeist": { aiPrompt: "A dim 1970s London council house bedroom, a young girl in bed mid-air above tangled sheets, curtains billowing, a dropped slipper frozen in motion, eerie shadows, photorealistic" },
  "tale-ewen-cameron-psychic-driving-subproject-68": { aiPrompt: "1950s psychiatric ward, lone patient in a hospital bed wearing headphones playing looping tapes, dim institutional lighting, clinical green walls, sterile unsettling mood, photorealistic" },
  "tale-fbi-bigfoot-hair-file": { aiPrompt: "Close-up of a coarse hair sample on a glass slide under a laboratory microscope, beside a stamped FBI evidence folder on a steel desk, clinical fluorescent lighting, photorealistic, no text" },
  "tale-frb-20200120e-impossible-magnetar": { aiPrompt: "Ancient dense globular star cluster of old red and gold stars in deep space, a brilliant blue-white flash of a fast radio burst erupting from its core, faint magnetar at center, dark cosmic background, photoreal astrophotography" },
  "tale-gobekli-tepe-temple-before-farming": { aiPrompt: "Gobekli Tepe excavation in Turkey, massive T-shaped carved limestone megalith pillars with relief animals, ancient stone circle, golden dusk light, archaeological site" },
  "tale-gulf-of-tonkin-incident": { aiPrompt: "US Navy destroyer USS Maddox at night in the Gulf of Tonkin, choppy dark water, radar glow, tense sailors at battle stations, 1964, grainy documentary realism" },
  "tale-ingo-swann-jupiter-rings-stargate": { aiPrompt: "Planet Jupiter with its faint thin dust ring backlit by the sun, swirling banded cloud bands, deep black space, photoreal spacecraft-style astronomy image." },
  "tale-iron-pillar-delhi-rustproof": { aiPrompt: "Photorealistic close-up of the ancient rustproof Iron Pillar of Delhi, a tall dark weathered iron column with inscriptions, standing in the Qutub complex courtyard, soft overcast daylight, no text" },
  "tale-jack-parsons-babalon-working-jpl": { aiPrompt: "1940s desert rocket test site at night, a man in a suit lighting candles and chalking occult symbols beside an early experimental rocket engine on a launch stand, eerie firelit mood, photorealistic" },
  "tale-james-gates-error-correcting-codes": { aiPrompt: "A glowing adinkra graph of connected dots and lines made of binary error-correcting code, hovering over a chalkboard of supersymmetry equations, blue scientific lighting, photorealistic, no text" },
  "tale-john-titor-2036-time-traveler": { aiPrompt: "Dim early-2000s bedroom lit by a glowing CRT monitor showing a green internet forum, a vintage IBM 5100 computer on the desk, hooded figure typing in shadow, retro grainy mood, photoreal" },
  "tale-lars-mittank-airport-cctv": { aiPrompt: "Grainy airport CCTV still: a lone young male backpacker rushing through a sliding glass terminal exit toward a dim forest treeline at dusk, anxious, surveillance timestamp aesthetic, photorealistic" },
  "tale-lgm-1-pulsar-discovery": { aiPrompt: "Photoreal vintage 1967 radio telescope antenna array field at dusk, chart-recorder paper strip showing rhythmic pulse spikes in foreground, Cambridge England, scientific mood, no text" },
  "tale-loch-ness-monster-surgeons-photo": { aiPrompt: "Grainy vintage black-and-white photo of a long-necked creature head rising from misty dark Loch Ness water, ripples spreading, eerie 1930s monochrome, no text" },
  "tale-lost-london-after-midnight": { aiPrompt: "Photoreal 1927 silent-film vampire in tall beaver top hat, hollow eyes and jagged sharp teeth, black cape, dramatic high-contrast monochrome studio portrait, decaying film-vault smoke, no text or watermark" },
  "tale-mandela-effect-origin-mandela-death": { aiPrompt: "Photorealistic split-memory portrait of an elderly Nelson Mandela-like statesman in prison uniform behind bars, one half fading like a ghostly false memory, somber documentary lighting, no text" },
  "tale-mary-celeste-ghost-ship": { aiPrompt: "A weathered 19th-century brigantine sailing ship adrift on a calm gray Atlantic, sails partly set, deck empty and abandoned, overcast misty sky, eerie lonely mood, photorealistic" },
  "tale-mcmoneagle-legion-of-merit-psychic-spy": { aiPrompt: "A lone Army intelligence officer in a dim 1980s room, eyes closed in deep concentration, sketching coordinates on paper under a single lamp, classified folders nearby, tense mood" },
  "tale-media-fbi-burglary-exposed-cointelpro": { aiPrompt: "Dimly lit 1971 FBI field office at night, an open filing cabinet rifled through, scattered classified COINTELPRO documents on the floor, flashlight beam, tense break-in mood, photoreal" },
  "tale-men-who-stare-at-goats": { aiPrompt: "A lone soldier in fatigues standing in a bare military room intensely staring at a single goat in a pen, fluorescent light, eerie unsettling psychological experiment mood" },
  "tale-mh370-malaysia-airlines": { aiPrompt: "A Boeing 777 airliner in Malaysia Airlines livery flying alone over a vast dark night ocean, faint satellite signal arcs in the sky above, moonlit clouds, lonely cinematic realism, no text" },
  "tale-mk-naomi-army-bioweapons": { aiPrompt: "1950s naval ship off the San Francisco coast emitting a faint aerosol plume drifting toward a fog-shrouded Golden Gate skyline, eerie cold morning light, documentary photorealistic" },
  "tale-mkultra-cia-mind-control": { aiPrompt: "1950s black-and-white photo: a subject strapped in a clinical chair under bright lights with electrodes, government doctors observing, declassified CIA mind-control experiment, cold sinister mood" },
  "tale-mkultra-frank-olson": { aiPrompt: "1950s New York hotel exterior at night, a broken 10th-floor window, somber yellow streetlight, lonely sidewalk below, ominous noir mood, photorealistic period scene" },
  "tale-mkultra-subproject-68-ewen-cameron": { aiPrompt: "Dim 1950s psychiatric ward room, an empty hospital bed with restraints and an old EEG machine with tangled electrodes and headphones, cold institutional light, peeling green walls, unsettling clinical realism" },
  "tale-nimitz-tic-tac-2004": { aiPrompt: "Photoreal grainy cockpit FLIR thermal display showing a white tic-tac-shaped UFO over the ocean, Navy fighter HUD targeting box, 2004 declassified footage look, eerie, no text" },
  "tale-operation-lac-army-sprayed-chemicals-us-cities": { aiPrompt: "Photorealistic 1950s military aircraft dispersing a faint glowing chemical powder plume across the twilight sky above a sprawling American city skyline, eerie atmospheric haze, no text" },
  "tale-operation-mind-control-occult-jack-parsons": { aiPrompt: "Vintage 1940s portrait of a dark-haired rocket scientist beside a smoking test rocket in the California desert at dusk, occult ritual symbols faintly glowing, eerie cinematic mood" },
  "tale-operation-mockingbird-cia-media": { aiPrompt: "A shadowy 1960s newsroom of typewriters and journalists, one silhouetted CIA figure handing a folder across desks, smoke and venetian-blind light, secretive paranoid mood" },
  "tale-operation-northwoods": { aiPrompt: "Declassified 1962 Pentagon Operation Northwoods document, typed Joint Chiefs of Staff memo stamped TOP SECRET, on a wooden desk beside a US military cap, dramatic side light" },
  "tale-operation-paperclip-nazi-scientists": { aiPrompt: "Photoreal 1940s black-and-white scene of German rocket scientists in suits inspecting a towering V-2 rocket in a US military hangar, stern faces, archival documentary mood, no text" },
  "tale-operation-sea-spray-san-francisco-bioweapon-test": { aiPrompt: "1950 US Navy ship off San Francisco coast releasing a fine bacterial mist that drifts as fog toward the Golden Gate Bridge and city skyline, gray overcast ocean, ominous mood, photorealistic" },
  "tale-pat-price-semipalatinsk-psychic-spy": { aiPrompt: "Pencil sketch of a giant gantry crane over a Cold War Soviet test site, laid on a desk beside a closed-eyes psychic, dim secret-program room, tense classified mood, photorealistic" },
  "tale-patterson-gimlin-bigfoot-film": { aiPrompt: "Grainy 1967-style 16mm film still of a tall hairy ape-like figure striding across a dry creek bed turning to look back, forested California wilderness, faded vintage color, motion blur, no text" },
  "tale-patterson-vs-bluff-creek-tracks": { aiPrompt: "A plaster cast of a giant Bigfoot footprint pressed into soft creek-bank mud, fine dermal skin ridges visible across the sole, overcast forest light, documentary realism." },
  "tale-pear-lab-mind-over-machines": { aiPrompt: "A 1990s university physics lab, an electronic random-number generator box with blinking lights on a desk, a focused researcher staring intently at it, dim fluorescent light, serious mood, photorealistic" },
  "tale-philadelphia-experiment-uss-eldridge": { aiPrompt: "A WWII-era US Navy destroyer escort moored at the Philadelphia Naval Yard in 1943, gray hull, foggy harbor at dusk, vintage black-and-white documentary photo realism." },
  "tale-project-blue-book-ufo": { aiPrompt: "1950s US Air Force officers in uniform examining a wall of UFO sighting reports and blurry photographs in a fluorescent-lit government office, stacks of case files marked unexplained, cold-war documentary realism" },
  "tale-project-mockingbird-cia-media": { aiPrompt: "A 1970s newsroom with a journalist at a typewriter receiving a plain envelope of cash from a shadowed man in a suit, dim film noir lighting, Cold War espionage mood, photorealistic" },
  "tale-project-shad-112-navy-sailors-nerve-agent-tests": { aiPrompt: "1960s US Navy destroyer at open sea releasing a fine chemical spray from deck nozzles, sailors in protective masks on deck, grey overcast ocean, ominous tense mood, photorealistic" },
  "tale-project-sunshine-body-snatching": { aiPrompt: "sterile 1950s laboratory bench with small labeled glass jars holding bone samples, scientist hands in gloves with a Geiger counter and clipboard, cold clinical fluorescent light, unsettling photorealistic" },
  "tale-roanoke-lost-colony": { aiPrompt: "weathered wooden palisade fence of an abandoned 1580s colonial fort on a misty Outer Banks island, the word CROATOAN carved into a gnarled oak tree, overgrown and deserted, somber photorealistic" },
  "tale-roswell-1947-records": { aiPrompt: "Faded 1947 newspaper front page on a wooden desk under a desk lamp, headline reading of a recovered flying disc, with rancher's hat and torn metallic debris fragments nearby, dim 1940s office, documentary realism" },
  "tale-rudolph-fentz-documented-hoax": { aiPrompt: "A bewildered man in worn 1870s Victorian frock coat and top hat standing dazed in a busy 1950s Manhattan street at night under neon and headlights, photorealistic, cinematic, no text" },
  "tale-sauchie-poltergeist-virginia-campbell-1960": { aiPrompt: "Dim 1960s Scottish stone cottage bedroom, an 11-year-old girl in nightgown sitting tense on a bed as the heavy wooden headboard knocks and a teapot lid rattles, anxious minister and doctor watching, cold grey light" },
  "tale-stargate-psychic-spies": { aiPrompt: "A person in a dim Cold War government room, eyes closed, sketching on paper at a desk under a single lamp, declassified file folders stacked nearby, tense secretive mood, no text" },
  "tale-stargate-remote-viewing-cia": { aiPrompt: "Dim 1970s government office, a person seated at a desk with eyes closed sketching on paper under a single lamp, stacks of stamped CIA files nearby, tense secretive mood, photorealistic" },
  "tale-sugar-industry-paid-harvard-blame-fat": { aiPrompt: "Stacked white sugar cubes casting a long shadow over a 1960s Harvard medical research document and a check, somber lighting on a dark wood desk, investigative mood, no text" },
  "tale-tabbys-star-dimming": { aiPrompt: "A lone bright star partly eclipsed by a vast dark ring of orbiting debris and fragmented megastructure panels, deep space, dramatic starlight glow, photorealistic" },
  "tale-taos-hum-new-mexico": { aiPrompt: "Quiet high-desert New Mexico landscape near Taos at dusk, sagebrush plain and distant mesas, lone person standing listening, faint unsettling stillness, photorealistic" },
  "tale-tehran-1976-f4-weapons-malfunction": { aiPrompt: "Two F-4 Phantom fighter jets banking at night over Tehran toward a brilliant pulsing object, cockpit instruments and weapons panels dark and dead, 1976, tense" },
  "tale-the-conjuring-perron-farmhouse": { aiPrompt: "Old white colonial farmhouse in rural Rhode Island at dusk, bare trees, fog, dim glowing window, eerie haunted New England atmosphere, photorealistic" },
  "tale-the-entity-doris-bither-ucla-1974": { aiPrompt: "A 1970s suburban bedroom at night, parapsychology researchers in lab coats setting up cameras and instruments around a frightened seated woman, eerie shadows, tense investigative mood, photorealistic" },
  "tale-the-plutonium-files-cold-war-radiation-experiments": { aiPrompt: "1940s black-and-white documentary photo: a doctor in a sterile hospital lab injecting an unknowing patient, classified Cold War government radiation experiment, ominous clinical mood" },
  "tale-tobacco-documents-nicotine-manipulation-cover-up": { aiPrompt: "1994 congressional hearing photo: seven tobacco-company executives in dark suits standing with raised right hands taking an oath before microphones, wood-paneled Senate chamber, tense" },
  "tale-tunguska-event-1908": { aiPrompt: "Vast Siberian taiga forest with millions of pine trees snapped and flattened radially in the same direction across the horizon, gray overcast sky, aftermath of an airburst, desolate, photorealistic" },
  "tale-tuskegee-syphilis-study": { aiPrompt: "1940s rural Alabama, a Black sharecropper man having blood drawn by a white government doctor in a clinic, somber documentary photograph, faded sepia tones" },
  "tale-uvb-76-the-buzzer": { aiPrompt: "Lonely rusted Soviet-era shortwave radio antenna mast and decaying concrete transmitter bunker in a desolate Russian forest at dusk, fog, cold blue light, no text" },
  "tale-visual-mandela-effect-berenstain-pikachu": { aiPrompt: "Photorealistic lab scene of test subjects in a dim psychology study room staring at flashcards of subtly altered logos, brainwave electrodes, clinical lighting, confused expressions, no text" },
  "tale-vopson-infodynamics-simulation": { aiPrompt: "A modern physicist at a whiteboard covered in equations, glowing blue strands of binary data and a compressing wireframe universe overlaid on the room, contemplative mood, photorealistic" },
  "tale-voynich-manuscript": { aiPrompt: "Open medieval Voynich Manuscript page with unknown looping script and ink drawings of strange plants, aged vellum, soft archive lighting on a dark table, close-up, no modern text" },
  "tale-vrillon-southern-television-intrusion": { aiPrompt: "A 1977 wood-paneled British living room, vintage CRT television glowing with a distorted news broadcast and static interference, dim evening light, eerie unsettling mood, photorealistic" },
  "tale-wow-signal-1977": { aiPrompt: "Faded 1977 dot-matrix printout reading 6EQUJ5 circled in red pen, beside the Big Ear radio telescope under a starry night sky, archival documentary mood, no extra text" },
  "tale-zana-abkhazia-genome": { aiPrompt: "Faded sepia 19th-century portrait of a powerfully built dark-skinned African-descended woman with strong features and wild hair, standing in a misty rural Abkhazian mountain village, somber dignified mood, weathered photograph" },
}

// The curated image for a story, or null if none is pinned. Returns a `trusted` image so callers can
// treat it as the final answer.
export function imageOverrideFor(uri: string): RightsClearedImage | null {
  const override = OVERRIDES[uri]
  if (!override) return null
  if ("imageUrl" in override && override.imageUrl) {
    return {
      url: override.imageUrl,
      license: override.license || "curated",
      attribution: override.attribution,
      sourceUrl: override.sourceUrl,
      relevance: 100,
      trusted: true,
    }
  }
  if ("aiPrompt" in override && override.aiPrompt) {
    return aiThumbnailImage(override.aiPrompt)
  }
  return null
}

export function hasImageOverride(uri: string): boolean {
  return Boolean(OVERRIDES[uri])
}
