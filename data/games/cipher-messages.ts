// Short factual statements (or apt quotes) tied to real, well-documented historical ciphers and
// cryptographic mysteries. Each message is UPPERCASE letters + spaces/punctuation, 40-110 chars.
// `attribution` names the cipher/case; `source` is a stable Wikipedia reference.
export type CipherMessage = {
  text: string
  attribution: string
  source: string
}

export const cipherMessages: CipherMessage[] = [
  {
    text: "THE ZODIAC KILLER MAILED A CRYPTOGRAM AND THREE CIVILIANS CRACKED IT IN A SINGLE WEEK.",
    attribution: "Zodiac Killer — Z408 cipher (solved 1969)",
    source: "https://en.wikipedia.org/wiki/Zodiac_Killer",
  },
  {
    text: "I LIKE KILLING PEOPLE BECAUSE IT IS SO MUCH FUN.",
    attribution: "Zodiac Z408 — decoded opening line",
    source: "https://en.wikipedia.org/wiki/Zodiac_Killer",
  },
  {
    text: "THE SECOND ZODIAC CIPHER RESISTED CODEBREAKERS FOR FIFTY ONE YEARS BEFORE A TEAM SOLVED IT.",
    attribution: "Zodiac Killer — Z340 cipher (solved 2020)",
    source: "https://en.wikipedia.org/wiki/Zodiac_Killer",
  },
  {
    text: "KRYPTOS STANDS AT CIA HEADQUARTERS, AND ITS FOURTH PASSAGE REMAINS UNSOLVED.",
    attribution: "Kryptos — passage K4 at CIA (unsolved)",
    source: "https://en.wikipedia.org/wiki/Kryptos",
  },
  {
    text: "BETWEEN SUBTLE SHADING AND THE ABSENCE OF LIGHT LIES THE NUANCE OF IQLUSION.",
    attribution: "Kryptos — decrypted passage K1 (deliberate misspelling)",
    source: "https://en.wikipedia.org/wiki/Kryptos",
  },
  {
    text: "THE BEALE CIPHERS CLAIM TO POINT AT BURIED GOLD AND SILVER IN VIRGINIA, STILL UNFOUND.",
    attribution: "Beale ciphers — buried treasure (largely unsolved)",
    source: "https://en.wikipedia.org/wiki/Beale_ciphers",
  },
  {
    text: "THE SOLVED BEALE PAPER USED THE DECLARATION OF INDEPENDENCE AS ITS SECRET KEY.",
    attribution: "Beale ciphers — book cipher keyed to a famous text",
    source: "https://en.wikipedia.org/wiki/Beale_ciphers",
  },
  {
    text: "THE VOYNICH MANUSCRIPT IS WRITTEN IN AN UNKNOWN SCRIPT NO ONE HAS EVER READ.",
    attribution: "Voynich Manuscript (undeciphered)",
    source: "https://en.wikipedia.org/wiki/Voynich_manuscript",
  },
  {
    text: "THE COMPOSER EDWARD ELGAR SENT A FRIEND THE DORABELLA CIPHER, AND IT WAS NEVER DECODED.",
    attribution: "Dorabella Cipher — Edward Elgar (unsolved)",
    source: "https://en.wikipedia.org/wiki/Dorabella_Cipher",
  },
  {
    text: "THE GROUP CALLED CICADA POSTED PUZZLES ONLINE TO RECRUIT THE BRIGHT, THEN VANISHED.",
    attribution: "Cicada 3301 — internet puzzle hunt",
    source: "https://en.wikipedia.org/wiki/Cicada_3301",
  },
  {
    text: "THE SOMERTON MAN WAS FOUND DEAD WITH A SCRAP READING TAMAM SHUD IN HIS POCKET.",
    attribution: "Somerton Man — Tamam Shud case",
    source: "https://en.wikipedia.org/wiki/Tamam_Shud_case",
  },
  {
    text: "THE PHAISTOS DISC BEARS STAMPED SYMBOLS FROM CRETE THAT REMAIN UNDECIPHERED.",
    attribution: "Phaistos Disc — ancient Minoan inscription",
    source: "https://en.wikipedia.org/wiki/Phaistos_Disc",
  },
]
