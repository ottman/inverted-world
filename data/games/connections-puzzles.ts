// Daily 16-tile grouping puzzles (NYT-Connections style) for Inverted World.
// Each puzzle has exactly 4 groups; each group has exactly 4 real, well-documented
// entities drawn from a tight category. difficulty: 0 = easiest (gold) .. 3 = trickiest (red).
// Every member is a genuine, on-brand entity (cryptid, UFO case, declassified program,
// cipher, ancient mystery, haunting, numbers station, vanishing, secret society, or
// remote-viewing figure) — kept short to fit a tile. Puzzles often share a tempting
// overlap (e.g. "Stargate" the program vs. remote viewers; "Nessie" vs. lake mysteries).

export type ConnectionsGroup = {
  label: string
  items: [string, string, string, string]
  difficulty: 0 | 1 | 2 | 3
}

export type ConnectionsPuzzle = {
  groups: [ConnectionsGroup, ConnectionsGroup, ConnectionsGroup, ConnectionsGroup]
}

export const connectionsPuzzles: ConnectionsPuzzle[] = [
  {
    groups: [
      {
        label: "Cryptids",
        items: ["Mothman", "Bigfoot", "Nessie", "Yeti"],
        difficulty: 0,
      },
      {
        label: "UFO cases",
        items: ["Roswell", "Rendlesham", "Phoenix Lights", "Tic-Tac"],
        difficulty: 1,
      },
      {
        label: "Declassified CIA/FBI programs",
        items: ["MKULTRA", "COINTELPRO", "Mockingbird", "Paperclip"],
        difficulty: 2,
      },
      {
        label: "Unsolved ciphers",
        items: ["Zodiac", "Kryptos", "Voynich", "Beale"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Famous hauntings",
        items: ["Enfield", "Borley", "Amityville", "Bell Witch"],
        difficulty: 0,
      },
      {
        label: "Lost or vanished",
        items: ["MH370", "Mary Celeste", "Roanoke", "Flight 19"],
        difficulty: 1,
      },
      {
        label: "Ancient mysteries",
        items: ["Antikythera", "Gobekli Tepe", "Nazca", "Puma Punku"],
        difficulty: 2,
      },
      {
        label: "Numbers stations",
        items: ["UVB-76", "Atencion", "Lincolnshire", "Swedish Rhapsody"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Secret societies",
        items: ["Illuminati", "Freemasons", "Skull & Bones", "Templars"],
        difficulty: 0,
      },
      {
        label: "Cryptids",
        items: ["Chupacabra", "Jersey Devil", "Thylacine", "Flatwoods"],
        difficulty: 1,
      },
      {
        label: "Remote-viewing figures",
        items: ["Ingo Swann", "Pat Price", "McMoneagle", "Uri Geller"],
        difficulty: 2,
      },
      {
        label: "Cold War psy programs",
        items: ["Stargate", "Northwoods", "Sea-Spray", "Blue Book"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "UFO cases",
        items: ["Belgian Wave", "Cash-Landrum", "Nimitz", "Rendlesham"],
        difficulty: 0,
      },
      {
        label: "Ancient mysteries",
        items: ["Baghdad Battery", "Nan Madol", "Antikythera", "Gobekli Tepe"],
        difficulty: 1,
      },
      {
        label: "Cryptids",
        items: ["Mothman", "Bray Road", "Chupacabra", "Yeti"],
        difficulty: 2,
      },
      {
        label: "Unsolved ciphers",
        items: ["Dorabella", "Cicada 3301", "Phaistos", "Voynich"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Vanished without a trace",
        items: ["Amelia Earhart", "Dyatlov Pass", "Flannan Isles", "Roanoke"],
        difficulty: 0,
      },
      {
        label: "Hauntings",
        items: ["Rosenheim", "Sauchie", "Enfield", "Borley"],
        difficulty: 1,
      },
      {
        label: "Declassified programs",
        items: ["MKULTRA", "Stargate", "Mockingbird", "Northwoods"],
        difficulty: 2,
      },
      {
        label: "Secret societies",
        items: ["Bohemian Grove", "Hellfire Club", "Freemasons", "Illuminati"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Cryptids of the deep & wild",
        items: ["Nessie", "Bigfoot", "Jersey Devil", "Flatwoods"],
        difficulty: 0,
      },
      {
        label: "Numbers stations",
        items: ["UVB-76", "Swedish Rhapsody", "Lincolnshire", "Atencion"],
        difficulty: 1,
      },
      {
        label: "UFO cases",
        items: ["Roswell", "Phoenix Lights", "Belgian Wave", "Tic-Tac"],
        difficulty: 2,
      },
      {
        label: "Remote viewers & psychics",
        items: ["Ingo Swann", "Uri Geller", "Pat Price", "PEAR Lab"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Ancient mysteries",
        items: ["Nazca", "Puma Punku", "Nan Madol", "Baghdad Battery"],
        difficulty: 0,
      },
      {
        label: "Secret societies",
        items: ["Skull & Bones", "Templars", "Bohemian Grove", "Hellfire Club"],
        difficulty: 1,
      },
      {
        label: "Lost / vanished",
        items: ["MH370", "Flight 19", "Mary Celeste", "Amelia Earhart"],
        difficulty: 2,
      },
      {
        label: "Unsolved ciphers",
        items: ["Beale", "Kryptos", "Dorabella", "Phaistos"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Cryptids",
        items: ["Mothman", "Chupacabra", "Bray Road", "Thylacine"],
        difficulty: 0,
      },
      {
        label: "Declassified programs",
        items: ["Paperclip", "Sea-Spray", "COINTELPRO", "Blue Book"],
        difficulty: 1,
      },
      {
        label: "Hauntings",
        items: ["Amityville", "Bell Witch", "Rosenheim", "Sauchie"],
        difficulty: 2,
      },
      {
        label: "Vanishings",
        items: ["Dyatlov Pass", "Flannan Isles", "Roanoke", "Flight 19"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "UFO cases",
        items: ["Nimitz", "Cash-Landrum", "Rendlesham", "Roswell"],
        difficulty: 0,
      },
      {
        label: "Ciphers",
        items: ["Zodiac", "Cicada 3301", "Voynich", "Phaistos"],
        difficulty: 1,
      },
      {
        label: "Secret societies",
        items: ["Illuminati", "Freemasons", "Bohemian Grove", "Skull & Bones"],
        difficulty: 2,
      },
      {
        label: "Remote-viewing & ESP",
        items: ["McMoneagle", "Pat Price", "PEAR Lab", "Uri Geller"],
        difficulty: 3,
      },
    ],
  },
  {
    groups: [
      {
        label: "Cryptids",
        items: ["Bigfoot", "Yeti", "Nessie", "Flatwoods"],
        difficulty: 0,
      },
      {
        label: "Numbers stations",
        items: ["Atencion", "UVB-76", "Lincolnshire", "Swedish Rhapsody"],
        difficulty: 1,
      },
      {
        label: "Vanished",
        items: ["Amelia Earhart", "MH370", "Mary Celeste", "Dyatlov Pass"],
        difficulty: 2,
      },
      {
        label: "Ancient out-of-place tech",
        items: ["Antikythera", "Baghdad Battery", "Nan Madol", "Puma Punku"],
        difficulty: 3,
      },
    ],
  },
]
