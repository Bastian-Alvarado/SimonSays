/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * Sandwichxample: a pixel avatar drawn in the Pixel avatars tab's own
 * format (shared/pixel-avatars.js), and an example of everything it can
 * hold — so it is a place to start a drawing of your own, and something
 * to check the format against.
 *
 *   faces       every face the app asks for, side and front: talking (soft,
 *               normal and loud), blinking and half-blinking, happy,
 *               surprised, startled with its "!", wink, sad with a tear,
 *               angry with its mark, star and heart eyes, dizzy, sleepy and
 *               fast asleep with its nose bubble
 *   extras      blush lines, a sweat drop, a headset mic, and three hats:
 *               a party hat, a chef's hat and a crown
 *   outfits     toasted, sesame, and a club sandwich whose toothpick wears
 *               a flag — headwear, so no other hat goes on it
 *   actions     drinking a glass of water, and waving
 *   colouring   the club's flag takes the layout's colour; the sandwich
 *               stays as it was drawn
 *   turn        a front view, faced while nobody talks in the call, with
 *               every outfit and extra drawn from the front as well — one
 *               that turns faces the front most of the time
 */

export const SANDWICHXAMPLE = {
  id: "example-sandwichxample",
  name: "Sandwichxample",
  example: "sandwichxample",
  version: 1,
  parts: [
    {
      id: "bun-outline",
      char: "o",
      color: "#c86a18",
      name: "Bun outline"
    },
    {
      id: "bun",
      char: "b",
      color: "#ed8424",
      name: "Bun"
    },
    {
      id: "bun-top",
      char: "t",
      color: "#f3933b",
      name: "Bun top"
    },
    {
      id: "bun-face",
      char: "a",
      color: "#f4bd7d",
      name: "Bun face"
    },
    {
      id: "bun-edge",
      char: "m",
      color: "#f9ab58",
      name: "Bun edge"
    },
    {
      id: "black",
      char: "k",
      color: "#111111",
      name: "Black"
    },
    {
      id: "eye-shine",
      char: "w",
      color: "#f6ead8",
      name: "Eye shine"
    },
    {
      id: "blush",
      char: "p",
      color: "#f28d86",
      name: "Blush"
    },
    {
      id: "lettuce-shade",
      char: "g",
      color: "#548431",
      name: "Lettuce shade"
    },
    {
      id: "lettuce",
      char: "l",
      color: "#7daa2f",
      name: "Lettuce"
    },
    {
      id: "cheese",
      char: "y",
      color: "#f3cd14",
      name: "Cheese"
    },
    {
      id: "cheese-shade",
      char: "j",
      color: "#d6961a",
      name: "Cheese shade"
    },
    {
      id: "tomato",
      char: "r",
      color: "#c62f2a",
      name: "Tomato"
    },
    {
      id: "tomato-shade",
      char: "d",
      color: "#8f1512",
      name: "Tomato shade"
    },
    {
      id: "sleep-z",
      char: "z",
      color: "#efe6ff",
      name: "Sleep z",
      effect: "float"
    },
    {
      id: "sleep-z-edge",
      char: "x",
      color: "#3b2f52",
      name: "Sleep z edge",
      effect: "float"
    },
    {
      id: "sleep-bubble",
      char: "e",
      color: "#c9ecff",
      name: "Sleep bubble",
      opacity: 0.55
    },
    {
      id: "sleep-bubble-edge",
      char: "u",
      color: "#8cc8ec",
      name: "Bubble edge"
    },
    {
      id: "sleep-bubble-shade",
      char: "v",
      color: "#5f9fcc",
      name: "Bubble shade"
    },
    {
      id: "drop",
      char: "T",
      color: "#8fd3ff",
      name: "Drop"
    },
    {
      id: "drop-edge",
      char: "U",
      color: "#3a86c8",
      name: "Drop edge"
    },
    {
      id: "drop-shine",
      char: "W",
      color: "#ffffff",
      name: "Drop shine"
    },
    {
      id: "startle",
      char: "X",
      color: "#ffe14d",
      name: "Startle mark",
      effect: "pop"
    },
    {
      id: "startle-edge",
      char: "Y",
      color: "#7a5400",
      name: "Startle edge",
      effect: "pop"
    },
    {
      id: "anger",
      char: "O",
      color: "#e8283c",
      name: "Anger mark"
    },
    {
      id: "blush-line",
      char: "P",
      color: "#e05866",
      name: "Blush lines"
    },
    {
      id: "headset",
      char: "M",
      color: "#4a4f5c",
      name: "Headset"
    },
    {
      id: "headset-shine",
      char: "N",
      color: "#9aa3b5",
      name: "Headset shine"
    },
    {
      id: "party-hat",
      char: "A",
      color: "#ff4fa0",
      name: "Party hat"
    },
    {
      id: "party-hat-stripe",
      char: "B",
      color: "#ffe14d",
      name: "Party hat stripe"
    },
    {
      id: "pompom",
      char: "C",
      color: "#ffffff",
      name: "Pompom"
    },
    {
      id: "party-hat-shade",
      char: "D",
      color: "#c2357a",
      name: "Party hat shade"
    },
    {
      id: "chef-hat",
      char: "E",
      color: "#ffffff",
      name: "Chef's hat"
    },
    {
      id: "chef-hat-shade",
      char: "F",
      color: "#d6dbe4",
      name: "Chef's hat shade"
    },
    {
      id: "chef-hat-edge",
      char: "G",
      color: "#9aa1ae",
      name: "Chef's hat edge"
    },
    {
      id: "crown",
      char: "I",
      color: "#ffd23f",
      name: "Crown"
    },
    {
      id: "crown-shade",
      char: "J",
      color: "#c89400",
      name: "Crown shade"
    },
    {
      id: "crown-edge",
      char: "K",
      color: "#8a5a00",
      name: "Crown edge"
    },
    {
      id: "gem",
      char: "L",
      color: "#3fa9ff",
      name: "Gem"
    },
    {
      id: "toast-outline",
      char: "1",
      color: "#7a3a0c",
      name: "Toast outline"
    },
    {
      id: "toast",
      char: "2",
      color: "#b8611a",
      name: "Toast"
    },
    {
      id: "toast-top",
      char: "3",
      color: "#c97428",
      name: "Toast top"
    },
    {
      id: "toast-face",
      char: "4",
      color: "#ebb47a",
      name: "Toast face"
    },
    {
      id: "toast-edge",
      char: "5",
      color: "#d98b45",
      name: "Toast edge"
    },
    {
      id: "grill-mark",
      char: "6",
      color: "#5c2a08",
      name: "Grill mark"
    },
    {
      id: "sesame",
      char: "S",
      color: "#fff3c8",
      name: "Sesame"
    },
    {
      id: "sesame-shade",
      char: "s",
      color: "#d8bd82",
      name: "Sesame shade"
    },
    {
      id: "toothpick",
      char: "7",
      color: "#d9b36c",
      name: "Toothpick"
    },
    {
      id: "toothpick-shade",
      char: "8",
      color: "#a4783a",
      name: "Toothpick shade"
    },
    {
      id: "flag",
      char: "Q",
      color: "#ff4f7b",
      name: "Flag"
    },
    {
      id: "flag-shade",
      char: "R",
      color: "#c2304f",
      name: "Flag shade"
    },
    {
      id: "olive",
      char: "V",
      color: "#5d6b1f",
      name: "Olive"
    },
    {
      id: "pimento",
      char: "Z",
      color: "#e2452c",
      name: "Pimento"
    },
    {
      id: "glass",
      char: "h",
      color: "#cddff5",
      name: "Glass"
    },
    {
      id: "glass-lit",
      char: "H",
      color: "#f3f8ff",
      name: "Glass, lit"
    },
    {
      id: "water",
      char: "n",
      color: "#8d9cd6",
      name: "Water"
    },
    {
      id: "water-shade",
      char: "q",
      color: "#6c78b8",
      name: "Water, shaded"
    }
  ],
  base: [
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    "....................................................................................................",
    ".......................................................ooooooo......................................",
    "..............................................oooooooootttttoooooooo................................",
    "..........................................oooooootttttttttttttttooooooo.............................",
    "......................................oooottttttttttttttttttttttttooooo.............................",
    ".................................oooooottttttttttttttttttttooooooooobbboo...........................",
    "..............................ooooottttttttttttttttttttooooooooobbbbbbbooo..........................",
    "............................ooobbbbtttttttttttoooooooooobbbbbbbbbmaaaabbbo..........................",
    "...........................otttbbbbbbbbttttooooooooobbbbbbbbmaaaaaaaaaabbo..........................",
    "...........................ottttttbbbbbbbbtoooobbbbbbbbmaaaaaaaaaaaaaaabbo..........................",
    "..........................obbbbttttttttttooobbbbbmaaaaaaaaaaaaaaaaaaaaaaao..........................",
    "..........................obbbbbbbbbttttooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaao..........................",
    "..........................obbbbbbbbbbbbtooobbtaaaaaaaaaaaaaaaaaaaaaaaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbbmaaaaaaaaaaaaaaaaaaaakkaaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbmaaaaaaaaaaaaaaaaaaaakwkkaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaakkkkaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaaakkaaaaaaaaaaaakkkkaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaakwkkaaaaaaaaaaaakkaaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaakkkkaaaaaaaaaaaaapaaaaaao..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaakkkkaaaaaaaaaaaapppppaaao..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaaakkaaaaakakakaappppppabbo..........................",
    "..........................obbbbbbbbbbbbbobbaaaaaaappaaaaakakakaaappaaaabbo..........................",
    "..........................obbbbbbbbbbbbbobbaaaappppppaaaaakakaaaaaaaambbbo..........................",
    ".........................oobbbbbbbbbbbbbobbaaaappppppaaaaaaaaaaatbbbbbboolgg........................",
    ".........................oobbbbbbbbbbbbbobbaaaappaaaaaaaaammbbbbbbooooojllllg.......................",
    ".........................oobbbbbbbbbbbbbobbaaaaaaaaaammbbbbbbbooooojllllllllg.......................",
    "........................gggooobbbbbbbbbbobbbmaaambbbbbbboooooojlllllllllllllg.......................",
    "......................ggllllljooooobbbbbooobbbbbbbboooooojllllllllllgggggggg........................",
    "......................gglllllllljoooooobooobbbboooooollllllllgggllllggyggggg........................",
    "......................ggllllggllllllooooglloooojlllllllglllllgggggggyyyyyj..........................",
    "........................ggggylgllllllllllllllllllglllllggggggyyygyyyyyyyyj..........................",
    "........................ggggyyglllllggglllllllgggglllggygggggyyyyyyyjjjojj..........................",
    ".........................jjyyyygggggggglllllllgggygggggyyyyyyyyyjjjjoooddd..........................",
    ".........................jjjyyyyyyyyyylgggggggyyyyyyyyyyyyyyyyyyoddddddddrd.........................",
    ".........................jjjjjjyyyyyyyygggggyyyyyyyyjjjoyyyyyyjjddddrrrrrrdd........................",
    ".........................dddooojjjjyjyyyjyyyyyyjjjjjooodjjyyyjrrrrrrrrrrrrdd........................",
    "........................drrdddddddjjjjjjjjjjjjjbboddddddddjyyjrrrrrrrrrrrrd.........................",
    "........................drrrrrdddddddoojooooodddddddrrrrddjjjdrrrrrrrrrrrdd.........................",
    "........................drrrrrrrdkkkrddddddddddddrrrrrrrddooodrrrrrrrddddd..........................",
    "........................drrrrrrkkkkkrrrrddrrrrrrrrrrrrrrddooooddddddddbbook.........................",
    "........................drrrrrrkkkkdrrrrdrrrrrrrrrrrrrrrddbbbbdddbbbbbbbbokk........................",
    ".........................dddrrrkkkrrrrrrdrrrrrrrrrrrrrddbbbtmmbbbbbmmmabbokk........................",
    ".........................oobddkkkkdrrrrrdrrrrrrrrddddddbaaaaaattaaaaaaabbokk........................",
    ".........................oobbokkkkdddddrddrrddddddddbbbbaaaaaaaaaaaaaaabbokk........................",
    ".........................oobbokkkbbbbbddddddddbbbbbbamaaaaaaaaaaaaaaaaabbokkk.......................",
    ".........................oobkkkkkbbbbbbboobbbbbbtaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
    ".........................oobkkkkkbbbbbbbobbbmaaaaaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
    ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
    ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaaaaabbbookkk........................",
    ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaabbbbbbookkk........................",
    ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaambbbbbboooooo...........................",
    ".........................ookkkkkkbbbbbbbobbbmaaaaaaaaaabbbbbbbooooooo...............................",
    ".........................ookkkkkkbbbbbbbobbbbbaaamttbbbbbbooooooo...................................",
    "...........................kkkkkkbbbbbbbobbbbbbbbbbbooooooo.........................................",
    "...........................kkkkkkooobbbbooobbbbbboooookkkk..........................................",
    "...........................kkkkkoooooooboooboooooooo.kkkkk..........................................",
    "............................kkk......................kkkkk..........................................",
    "..........................................kkkk.......kkkkk..........................................",
    "..........................................kkkk.......kkkkk..........................................",
    "..........................................kkkk.......kkkkk..........................................",
    "..........................................kkkk.......kkkkkkkkk......................................",
    "..........................................kkkk.......kkkkkkkkk......................................",
    "..........................................kkkk.......kkkkkkkkk......................................",
    "..........................................kkkkkkkk......kkkkkk......................................",
    "..........................................kkkkkkkk..................................................",
    "..........................................kkkkkkkk..................................................",
    "............................................kkkkkk.................................................."
  ],
  baseLabel: "Classic",
  baseWords: [
    "classic",
    "clasico",
    "normal",
    "original",
    "default"
  ],
  faces: [
    {
      name: "talking",
      label: "",
      patches: [
        {
          at: [
            57,
            53
          ],
          rows: [
            "ak.ka",
            ".ddd.",
            "kdrdk",
            ".kkk."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "blink",
      label: "",
      patches: [
        {
          at: [
            49,
            46
          ],
          rows: [
            "................aa.",
            "...............aaaa",
            "................aa.",
            ".aa............a..a",
            "aaaa............aa.",
            ".aa.............a..",
            "a..a...............",
            ".aa................"
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "blink-half",
      label: "",
      patches: [
        {
          at: [
            49,
            46
          ],
          rows: [
            "................aa.",
            "...............aaaa",
            "...................",
            ".aa................",
            "aaaa..............."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "sleepy",
      label: "",
      patches: [
        {
          at: [
            49,
            9
          ],
          rows: [
            "...................................xxxxxx.",
            "..................................xzzzzzzx",
            "...................................xxxxzx.",
            ".....................................xzx..",
            "....................................xzx...",
            "...................................xzxxxx.",
            "..................................xzzzzzzx",
            "...................................xxxxxx.",
            "..........................................",
            "..........................................",
            "..........................................",
            "............................xxxx..........",
            "...........................xzzzzx.........",
            "............................xxzx..........",
            "............................xzxx..........",
            "...........................xzzzzx.........",
            "............................xxxx..........",
            "..........................................",
            "..........................................",
            "..........................................",
            "......................xxx.................",
            "......................zzzx................",
            ".......................z..................",
            ".....................xzzz.................",
            "......................x.x.................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "..........................................",
            "................aa........................",
            "...............aaaa.......................",
            "...............aaaa.......................",
            ".aa.......................................",
            "aaaa......................................",
            "aaaa............a........................."
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "deep-sleep",
      label: "",
      patches: [
        {
          at: [
            49,
            6
          ],
          rows: [
            "....................................xxxxxxxxxx.",
            "...................................xzzzzzzzzzzx",
            "...................................xzzzzzzzzzzx",
            "....................................xxxxxxxzzx.",
            "........................................xxzzx..",
            "......................................xxzzxx...",
            ".....................................xzzxx.....",
            "....................................xzzxxxxxxx.",
            "...................................xzzzzzzzzzzx",
            "...................................xzzzzzzzzzzx",
            "....................................xxxxxxxxxx.",
            "...............................................",
            "...........................xxxxxxx.............",
            "..........................xzzzzzzzx............",
            "..........................xzzzzzzzx............",
            "...........................xxxxzzx.............",
            "............................xxzzx..............",
            "...........................xzzxxxx.............",
            "..........................xzzzzzzzx............",
            "..........................xzzzzzzzx............",
            "...........................xxxxxxx.............",
            "...............................................",
            "...............................................",
            "......................xxxx.....................",
            ".....................xzzzzx....................",
            "......................xxzx.....................",
            "......................xzxx.....................",
            ".....................xzzzzx....................",
            "......................xxxx.....................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "...............................................",
            "................aa.............................",
            "...............aaaa............................",
            "................aa.............................",
            ".aa............a..a............................",
            "aaaa............aa.............................",
            ".aa.............a..............................",
            "a..a...........................................",
            ".aa.....a...a..................................",
            "........akdka..................................",
            ".........aka..................................."
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "talking-soft",
      label: "",
      patches: [
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "ak.ka",
            ".ddd.",
            ".kkk."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "talking-loud",
      label: "",
      patches: [
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            56,
            53
          ],
          rows: [
            "kkkkkkk",
            "kdddddk",
            "kdrrrdk",
            ".kkkkk."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "happy",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "aaaa",
            "akka",
            "kaak",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "aaaa",
            "akka",
            "kaak",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "kkkkk",
            "kdrdk",
            ".kkk."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        },
        {
          at: [
            67,
            51
          ],
          rows: [
            "pp"
          ]
        },
        {
          at: [
            65,
            54
          ],
          rows: [
            "pp"
          ]
        },
        {
          at: [
            66,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "surprised",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "akka",
            "kwwk",
            "kkkk",
            "kkkk",
            "akka"
          ]
        },
        {
          at: [
            50,
            46
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            51,
            46
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "akka",
            "kwwk",
            "kkkk",
            "kkkk",
            "akka"
          ]
        },
        {
          at: [
            65,
            43
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            66,
            43
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            ".kk..",
            "kddk.",
            "kddk.",
            ".kk.."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "startled",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "akka",
            "kwwk",
            "kwkk",
            "kwwk",
            "akka"
          ]
        },
        {
          at: [
            50,
            46
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            51,
            46
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "akka",
            "kwwk",
            "kwkk",
            "kwwk",
            "akka"
          ]
        },
        {
          at: [
            65,
            43
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            66,
            43
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            ".kk..",
            "kddk.",
            "kddk.",
            ".kk.."
          ]
        },
        {
          at: [
            74,
            23
          ],
          rows: [
            "YYY",
            "YXY",
            "YXY",
            "YXY",
            "YXY",
            "YYY",
            "...",
            "YYY",
            "YXY",
            "YYY"
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "wink",
      label: "",
      patches: [
        {
          at: [
            64,
            46
          ],
          rows: [
            "aaaa",
            "akka",
            "kaak",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "....k",
            "k..k.",
            ".kk.."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "sad",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "aaaa",
            "akka",
            "kwkk",
            "kkkk",
            "akka"
          ]
        },
        {
          at: [
            52,
            46
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            51,
            47
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            50,
            47
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            49,
            48
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "aaaa",
            "akka",
            "kwkk",
            "kkkk",
            "akka"
          ]
        },
        {
          at: [
            64,
            43
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            65,
            44
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            66,
            44
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            67,
            45
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            ".kkk.",
            "k...k",
            "....."
          ]
        },
        {
          at: [
            67,
            51
          ],
          rows: [
            ".U.",
            "UTU",
            "UTU",
            ".U."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "angry",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "aaaa",
            "kkkk",
            "kwkk",
            "kkkk",
            "akka"
          ]
        },
        {
          at: [
            49,
            46
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            50,
            47
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            51,
            47
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            52,
            48
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "aaaa",
            "kkkk",
            "kwkk",
            "kkkk",
            "akka"
          ]
        },
        {
          at: [
            67,
            43
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            66,
            44
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            65,
            44
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            64,
            45
          ],
          rows: [
            "k"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "kkkkk",
            "kwwwk",
            "kkkkk"
          ]
        },
        {
          at: [
            68,
            37
          ],
          rows: [
            ".O.O.",
            "OO.OO",
            ".....",
            "OO.OO",
            ".O.O."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: true
    },
    {
      name: "star-eyes",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            48,
            49
          ],
          rows: [
            "..j..",
            ".jyj.",
            "jyyyj",
            ".jyj.",
            ".j.j."
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            63,
            46
          ],
          rows: [
            "..j..",
            ".jyj.",
            "jyyyj",
            ".jyj.",
            ".j.j."
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "kkkkk",
            "kdrdk",
            ".kkk."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "heart-eyes",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            48,
            49
          ],
          rows: [
            "rr.rr",
            "rwrrr",
            "rrrrr",
            ".rrr.",
            "..r.."
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa",
            "aaaa"
          ]
        },
        {
          at: [
            63,
            46
          ],
          rows: [
            "rr.rr",
            "rwrrr",
            "rrrrr",
            ".rrr.",
            "..r.."
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "kkkkk",
            "kdrdk",
            ".kkk."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: false
    },
    {
      name: "dizzy",
      label: "",
      patches: [
        {
          at: [
            49,
            49
          ],
          rows: [
            "kaak",
            "akka",
            "akka",
            "kaak",
            "aaaa"
          ]
        },
        {
          at: [
            64,
            46
          ],
          rows: [
            "kaak",
            "akka",
            "akka",
            "kaak",
            "aaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            "aaaaa",
            "aaaaa",
            "aaaaa"
          ]
        },
        {
          at: [
            57,
            53
          ],
          rows: [
            ".k...",
            "k.k.k",
            "...k."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      glances: false,
      blinks: false
    }
  ],
  extras: [
    {
      name: "blush",
      label: "",
      patches: [
        {
          at: [
            47,
            51
          ],
          rows: [
            "..................P.P.P",
            ".................P.P.P.",
            ".......................",
            ".P.P.P.................",
            "P.P.P.................."
          ]
        }
      ],
      hat: false,
      words: []
    },
    {
      name: "sweat",
      label: "",
      patches: [
        {
          at: [
            69,
            35
          ],
          rows: [
            "..U..",
            ".UTU.",
            ".UTU.",
            "UTTTU",
            "UTWTU",
            "UTTTU",
            ".UUU."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      hat: false,
      words: []
    },
    {
      name: "mic",
      label: "",
      patches: [
        {
          at: [
            25,
            34
          ],
          rows: [
            "...............MMM",
            ".........MMMMMM...",
            ".....MMMM.........",
            "....M.............",
            "...M..............",
            "...M..............",
            "..M...............",
            ".MM...............",
            "MMNM..............",
            "MMMM..............",
            ".MM...............",
            "...M..............",
            "....M.............",
            "....M.............",
            ".....M............",
            "......M...........",
            "......M...........",
            ".......M..........",
            "........M.........",
            "........M..MM.....",
            ".........MMNM.....",
            "...........M......"
          ]
        },
        {
          at: [
            43,
            34
          ],
          rows: [
            "MMMMMMM"
          ]
        },
        {
          at: [
            52,
            34
          ],
          rows: [
            "MMMMMMMMMMM..........",
            "..........MMMMMMM....",
            "................MMM..",
            "..................MMM"
          ]
        },
        {
          at: [
            50,
            34
          ],
          rows: [
            "MM"
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      hat: false,
      words: []
    },
    {
      name: "party-hat",
      label: "",
      patches: [
        {
          at: [
            42,
            13
          ],
          rows: [
            ".......CCC.......",
            "......CCCCC......",
            "......CCCCC......",
            "......CCCCC......",
            ".......CCC.......",
            "........A........",
            ".......AAD.......",
            ".......AAD.......",
            ".......BBD.......",
            "......BBBBD......",
            "......BBBBD......",
            ".....BBBBBBD.....",
            ".....AAAAAAD.....",
            ".....AAAAAAD.....",
            "....AAAAAAAAD....",
            "....AAAAAAAAD....",
            "....BBBBBBBBD....",
            "...BBBBBBBBBBD...",
            "...BBBBBBBBBBD...",
            "..BBBBBBBBBBBBD..",
            "..AAAAAAAAAAAAD..",
            "..AAAAAAAAAAAAD..",
            ".AAAAAAAAAAAAAAD.",
            ".AAAAAAAAAAAAAAD.",
            "DDDDDDDDDDDDDDDDD"
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      hat: true,
      words: [
        "party",
        "fiesta",
        "cumple",
        "birthday",
        "cumpleanos"
      ]
    },
    {
      name: "chef-hat",
      label: "",
      patches: [
        {
          at: [
            40,
            14
          ],
          rows: [
            ".........GGG.........",
            ".......GGEEEGG.......",
            "......GEEEEEEEG......",
            ".....GEEEEEEEEEG.....",
            ".....GEEEEEEEEEG.....",
            "....GEEEEEEEEEEFG....",
            "..GGEEEEEEEEEEEFFGG..",
            ".GEEEEEEEEEEEEEFFFFG.",
            ".GEEEEEEEEEEEEEFFFFG.",
            "GEEEEEEEEEEEEEEFFFFFG",
            "GEEEEEEEEEEEEEEFFFFFG",
            "GEEEEEEEEEEEEEEFFFFFG",
            ".GEEEEEEEEGEEEEFFFFG.",
            ".GEEEEEEEG.GEEEFFFFG.",
            "..GEEEEEG...GEEFFFG..",
            "..GEEEEEEGGGEEEFFFG..",
            "..GFFFFFFFFFFFFFFFG..",
            "..GEEEEEEEEEEEEFFFG..",
            "..GEEEEEEEEEEEEFFFG..",
            "..GEEEEEEEEEEEEFFFG..",
            "..GEEEEEEEEEEEEFFFG..",
            "..GEEEEEEEEEEEEFFFG..",
            "..GFFFFFFFFFFFFFFFG..",
            "..GFFFFFFFFFFFFFFFG..",
            "..GGGGGGGGGGGGGGGGG.."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      hat: true,
      words: [
        "chef",
        "cocinero",
        "cocinera",
        "cook",
        "toque"
      ]
    },
    {
      name: "crown",
      label: "",
      patches: [
        {
          at: [
            41,
            24
          ],
          rows: [
            "..L.....L.....L..",
            "..K.....K.....K..",
            "..K.....K.....K..",
            "..K.....K.....K..",
            ".KIK...KIK...KIK.",
            ".KIK...KIK...KIK.",
            ".KIK...KIK...KIK.",
            "KIIIK.KIIIK.KIIIK",
            "KIIIIKIIIIIKIIIIK",
            ".KIIIIIIIIIIIIIK.",
            ".KIrIIILLIIIIrIK.",
            ".KIIIIIIIIIIIIIK.",
            ".KIIIIIIIIIIIIIK.",
            ".KJJJJJJJJJJJJJK.",
            ".KKKKKKKKKKKKKKK."
          ]
        },
        {
          at: [
            65,
            51
          ],
          rows: [
            "a"
          ]
        }
      ],
      hat: true,
      words: [
        "crown",
        "corona",
        "king",
        "queen",
        "rey",
        "reina",
        "royal",
        "realeza"
      ]
    }
  ],
  outfits: [
    {
      name: "toasted",
      label: "Toasted",
      rows: [
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        ".......................................................1111111......................................",
        "..............................................1111111116333311111111................................",
        "..........................................11111113333363333363331111111.............................",
        "......................................111133333633333633333633333611111.............................",
        ".................................1111113633333633333633333611111111122211...........................",
        "..............................11111333363333363333363331111111112222222111..........................",
        "............................1112222333633333631111111111222222222544442221..........................",
        "...........................13332222222233331111111112222222254444444444221..........................",
        "...........................13363332222222261111222222225444444444444444221..........................",
        "..........................122223333633333111222225444444444444444444444441..........................",
        "..........................122222222233331112224444444444444444444444444441..........................",
        "..........................122222222222261112264444444444444444444444444441..........................",
        "..........................122222222222221222544444444444444444444kk4444441..........................",
        "..........................12222222222222122544444444444444444444kwkk444441..........................",
        "..........................12222222222222122444444444444444444444kkkk444441..........................",
        "..........................122222222222221224444444kk444444444444kkkk444441..........................",
        "..........................12222222222222122444444kwkk444444444444kk4444441..........................",
        "..........................12222222222222122444444kkkk4444444444444p4444441..........................",
        "..........................12222222222222122444444kkkk444444444444ppppp4441..........................",
        "..........................122222222222221224444444kk44444k4k4k44pppppp4221..........................",
        "..........................122222222222221224444444pp44444k4k4k444pp4444221..........................",
        "..........................122222222222221224444pppppp44444k4k4444444452221..........................",
        ".........................1122222222222221224444pppppp44444444444622222211lgg........................",
        ".........................1122222222222221224444pp4444444445522222211111jllllg.......................",
        ".........................112222222222222122444444444455222222211111jllllllllg.......................",
        "........................ggg11122222222221222544452222222111111jlllllllllllllg.......................",
        "......................gglllllj111112222211122222222111111jllllllllllgggggggg........................",
        "......................ggllllllllj11111121112222111111llllllllgggllllggyggggg........................",
        "......................ggllllggllllll1111gll1111jlllllllglllllgggggggyyyyyj..........................",
        "........................ggggylgllllllllllllllllllglllllggggggyyygyyyyyyyyj..........................",
        "........................ggggyyglllllggglllllllgggglllggygggggyyyyyyyjjj1jj..........................",
        ".........................jjyyyygggggggglllllllgggygggggyyyyyyyyyjjjj111ddd..........................",
        ".........................jjjyyyyyyyyyylgggggggyyyyyyyyyyyyyyyyyy1ddddddddrd.........................",
        ".........................jjjjjjyyyyyyyygggggyyyyyyyyjjj1yyyyyyjjddddrrrrrrdd........................",
        ".........................ddd111jjjjyjyyyjyyyyyyjjjjj111djjyyyjrrrrrrrrrrrrdd........................",
        "........................drrdddddddjjjjjjjjjjjjj221ddddddddjyyjrrrrrrrrrrrrd.........................",
        "........................drrrrrddddddd11j11111dddddddrrrrddjjjdrrrrrrrrrrrdd.........................",
        "........................drrrrrrrdkkkrddddddddddddrrrrrrrdd111drrrrrrrddddd..........................",
        "........................drrrrrrkkkkkrrrrddrrrrrrrrrrrrrrdd1111dddddddd2211k.........................",
        "........................drrrrrrkkkkdrrrrdrrrrrrrrrrrrrrrdd2222ddd222222221kk........................",
        ".........................dddrrrkkkrrrrrrdrrrrrrrrrrrrrdd222355222225554221kk........................",
        ".........................112ddkkkkdrrrrrdrrrrrrrrdddddd2444444364444444221kk........................",
        ".........................11221kkkkdddddrddrrdddddddd2222444444444444444221kk........................",
        ".........................11221kkk22222dddddddd2222224544444444444444444221kkk.......................",
        ".........................112kkkkk22222221122222264444444444444444444452221kkk.......................",
        ".........................112kkkkk22222221222544444444444444444444444452221kkk.......................",
        ".........................112kkk2222222221224444444444444444444444444452221kkk.......................",
        ".........................112kkk222222222122444444444444444444444444422211kkk........................",
        ".........................112kkk222222222122444444444444444444444422222211kkk........................",
        ".........................112kkk222222222122444444444444444445222222111111...........................",
        ".........................11kkkkkk222222212225444444444422222221111111...............................",
        ".........................11kkkkkk22222221222224445332222221111111...................................",
        "...........................kkkkkk22222221222222222221111111.........................................",
        "...........................kkkkkk111222211122222211111kkkk..........................................",
        "...........................kkkkk11111112111211111111.kkkkk..........................................",
        "............................kkk......................kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkkkkkk......kkkkkk......................................",
        "..........................................kkkkkkkk..................................................",
        "..........................................kkkkkkkk..................................................",
        "............................................kkkkkk.................................................."
      ],
      headwear: false,
      words: [
        "toasted",
        "toast",
        "tostado",
        "tostada",
        "grill",
        "grilled",
        "plancha"
      ]
    },
    {
      name: "sesame",
      label: "Sesame",
      rows: [
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        ".......................................................ooooooo......................................",
        "..............................................oooooooootSSttoooooooo................................",
        "..........................................ooooooottSSttttsttttSSooooooo.............................",
        "......................................oooottttSSttttsttttttttttsttooooo.............................",
        ".................................oooooottSSttttstttttttttttooooooooobbboo...........................",
        "..............................oooootSSttttsttttttttttttooooooooobbbbbbbooo..........................",
        "............................ooobbbbttsttttttttoooooooooobbbbbbbbbmaaaabbbo..........................",
        "...........................otttbbbbbbbbttttooooooooobbbbbbbbmaaaaaaaaaabbo..........................",
        "...........................ottttSSbbbbbbbbtoooobbbbbbbbmaaaaaaaaaaaaaaabbo..........................",
        "..........................obbbbttsttttSStooobbbbbmaaaaaaaaaaaaaaaaaaaaaaao..........................",
        "..........................obbbbbbbbbtttsooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaao..........................",
        "..........................obbbbbbbbbbbbtooobbtaaaaaaaaaaaaaaaaaaaaaaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbbmaaaaaaaaaaaaaaaaaaaakkaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbmaaaaaaaaaaaaaaaaaaaakwkkaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaakkkkaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaakkaaaaaaaaaaaakkkkaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaakwkkaaaaaaaaaaaakkaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaakkkkaaaaaaaaaaaaapaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaakkkkaaaaaaaaaaaapppppaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaakkaaaaakakakaappppppabbo..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaappaaaaakakakaaappaaaabbo..........................",
        "..........................obbbbbbbbbbbbbobbaaaappppppaaaaakakaaaaaaaambbbo..........................",
        ".........................oobbbbbbbbbbbbbobbaaaappppppaaaaaaaaaaatbbbbbboolgg........................",
        ".........................oobbbbbbbbbbbbbobbaaaappaaaaaaaaammbbbbbbooooojllllg.......................",
        ".........................oobbbbbbbbbbbbbobbaaaaaaaaaammbbbbbbbooooojllllllllg.......................",
        "........................gggooobbbbbbbbbbobbbmaaambbbbbbboooooojlllllllllllllg.......................",
        "......................ggllllljooooobbbbbooobbbbbbbboooooojllllllllllgggggggg........................",
        "......................gglllllllljoooooobooobbbboooooollllllllgggllllggyggggg........................",
        "......................ggllllggllllllooooglloooojlllllllglllllgggggggyyyyyj..........................",
        "........................ggggylgllllllllllllllllllglllllggggggyyygyyyyyyyyj..........................",
        "........................ggggyyglllllggglllllllgggglllggygggggyyyyyyyjjjojj..........................",
        ".........................jjyyyygggggggglllllllgggygggggyyyyyyyyyjjjjoooddd..........................",
        ".........................jjjyyyyyyyyyylgggggggyyyyyyyyyyyyyyyyyyoddddddddrd.........................",
        ".........................jjjjjjyyyyyyyygggggyyyyyyyyjjjoyyyyyyjjddddrrrrrrdd........................",
        ".........................dddooojjjjyjyyyjyyyyyyjjjjjooodjjyyyjrrrrrrrrrrrrdd........................",
        "........................drrdddddddjjjjjjjjjjjjjbboddddddddjyyjrrrrrrrrrrrrd.........................",
        "........................drrrrrdddddddoojooooodddddddrrrrddjjjdrrrrrrrrrrrdd.........................",
        "........................drrrrrrrdkkkrddddddddddddrrrrrrrddooodrrrrrrrddddd..........................",
        "........................drrrrrrkkkkkrrrrddrrrrrrrrrrrrrrddooooddddddddbbook.........................",
        "........................drrrrrrkkkkdrrrrdrrrrrrrrrrrrrrrddbbbbdddbbbbbbbbokk........................",
        ".........................dddrrrkkkrrrrrrdrrrrrrrrrrrrrddbbbtmmbbbbbmmmabbokk........................",
        ".........................oobddkkkkdrrrrrdrrrrrrrrddddddbaaaaaattaaaaaaabbokk........................",
        ".........................oobbokkkkdddddrddrrddddddddbbbbaaaaaaaaaaaaaaabbokk........................",
        ".........................oobbokkkbbbbbddddddddbbbbbbamaaaaaaaaaaaaaaaaabbokkk.......................",
        ".........................oobkkkkkbbbbbbboobbbbbbtaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
        ".........................oobkkkkkbbbbbbbobbbmaaaaaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaaaaabbbookkk........................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaabbbbbbookkk........................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaambbbbbboooooo...........................",
        ".........................ookkkkkkbbbbbbbobbbmaaaaaaaaaabbbbbbbooooooo...............................",
        ".........................ookkkkkkbbbbbbbobbbbbaaamttbbbbbbooooooo...................................",
        "...........................kkkkkkbbbbbbbobbbbbbbbbbbooooooo.........................................",
        "...........................kkkkkkooobbbbooobbbbbboooookkkk..........................................",
        "...........................kkkkkoooooooboooboooooooo.kkkkk..........................................",
        "............................kkk......................kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkkkkkk......kkkkkk......................................",
        "..........................................kkkkkkkk..................................................",
        "..........................................kkkkkkkk..................................................",
        "............................................kkkkkk.................................................."
      ],
      headwear: false,
      words: [
        "sesame",
        "seeds",
        "ajonjoli",
        "sesamo",
        "semillas"
      ]
    },
    {
      name: "club",
      label: "Club",
      rows: [
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "...............................................Q.Q.Q.Q..............................................",
        "..............................................QQQQQQQQQ.............................................",
        ".............................................QQQQQQQQQQR............................................",
        "..............................................RQQQQQQQR.............................................",
        "...............................................R.R.R.R..............................................",
        ".................................................RR.................................................",
        "..................................................7.................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        ".................................................VVVV...............................................",
        "................................................VVVVVV..............................................",
        "...............................................VVVZZVVV.............................................",
        "...............................................VVVZVVVV.............................................",
        "................................................VVVVVV..............................................",
        ".................................................VVVV...............................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78................................................",
        "..................................................78...ooooooo......................................",
        "..............................................oooo78oootttttoooooooo................................",
        "..........................................ooooooot78ttttttttttttooooooo.............................",
        "......................................ooootttttttt78ttttttttttttttooooo.............................",
        ".................................oooooottttttttttttttttttttooooooooobbboo...........................",
        "..............................ooooottttttttttttttttttttooooooooobbbbbbbooo..........................",
        "............................ooobbbbtttttttttttoooooooooobbbbbbbbbmaaaabbbo..........................",
        "...........................otttbbbbbbbbttttooooooooobbbbbbbbmaaaaaaaaaabbo..........................",
        "...........................ottttttbbbbbbbbtoooobbbbbbbbmaaaaaaaaaaaaaaabbo..........................",
        "..........................obbbbttttttttttooobbbbbmaaaaaaaaaaaaaaaaaaaaaaao..........................",
        "..........................obbbbbbbbbttttooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaao..........................",
        "..........................obbbbbbbbbbbbtooobbtaaaaaaaaaaaaaaaaaaaaaaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbbmaaaaaaaaaaaaaaaaaaaakkaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbmaaaaaaaaaaaaaaaaaaaakwkkaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaakkkkaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaakkaaaaaaaaaaaakkkkaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaakwkkaaaaaaaaaaaakkaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaakkkkaaaaaaaaaaaaapaaaaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaakkkkaaaaaaaaaaaapppppaaao..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaakkaaaaakakakaappppppabbo..........................",
        "..........................obbbbbbbbbbbbbobbaaaaaaappaaaaakakakaaappaaaabbo..........................",
        "..........................obbbbbbbbbbbbbobbaaaappppppaaaaakakaaaaaaaambbbo..........................",
        ".........................oobbbbbbbbbbbbbobbaaaappppppaaaaaaaaaaatbbbbbboolgg........................",
        ".........................oobbbbbbbbbbbbbobbaaaappaaaaaaaaammbbbbbbooooojllllg.......................",
        ".........................oobbbbbbbbbbbbbobbaaaaaaaaaammbbbbbbbooooojllllllllg.......................",
        "........................gggooobbbbbbbbbbobbbmaaambbbbbbboooooojlllllllllllllg.......................",
        "......................ggllllljooooobbbbbooobbbbbbbboooooojllllllllllgggggggg........................",
        "......................gglllllllljoooooobooobbbboooooollllllllgggllllggyggggg........................",
        "......................ggllllggllllllooooglloooojlllllllglllllgggggggyyyyyj..........................",
        "........................ggggylgllllllllllllllllllglllllggggggyyygyyyyyyyyj..........................",
        "........................ggggyyglllllggglllllllgggglllggygggggyyyyyyyjjjojj..........................",
        ".........................jjyyyygggggggglllllllgggygggggyyyyyyyyyjjjjoooddd..........................",
        ".........................jjjyyyyyyyyyylgggggggyyyyyyyyyyyyyyyyyyoddddddddrd.........................",
        ".........................jjjjjjyyyyyyyygggggyyyyyyyyjjjoyyyyyyjjddddrrrrrrdd........................",
        ".........................dddooojjjjyjyyyjyyyyyyjjjjjooodjjyyyjrrrrrrrrrrrrdd........................",
        "........................drrdddddddjjjjjjjjjjjjjbboddddddddjyyjrrrrrrrrrrrrd.........................",
        "........................drrrrrdddddddoojooooodddddddrrrrddjjjdrrrrrrrrrrrdd.........................",
        "........................drrrrrrrdkkkrddddddddddddrrrrrrrddooodrrrrrrrddddd..........................",
        "........................drrrrrrkkkkkrrrrddrrrrrrrrrrrrrrddooooddddddddbbook.........................",
        "........................drrrrrrkkkkdrrrrdrrrrrrrrrrrrrrrddbbbbdddbbbbbbbbokk........................",
        ".........................dddrrrkkkrrrrrrdrrrrrrrrrrrrrddbbbtmmbbbbbmmmabbokk........................",
        ".........................oobddkkkkdrrrrrdrrrrrrrrddddddbaaaaaattaaaaaaabbokk........................",
        ".........................oobbokkkkdddddrddrrddddddddbbbbaaaaaaaaaaaaaaabbokk........................",
        ".........................oobbokkkbbbbbddddddddbbbbbbamaaaaaaaaaaaaaaaaabbokkk.......................",
        ".........................oobkkkkkbbbbbbboobbbbbbtaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
        ".........................oobkkkkkbbbbbbbobbbmaaaaaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaaaaaambbbokkk.......................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaaaaabbbookkk........................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaaaaaaabbbbbbookkk........................",
        ".........................oobkkkbbbbbbbbbobbaaaaaaaaaaaaaaaaambbbbbboooooo...........................",
        ".........................ookkkkkkbbbbbbbobbbmaaaaaaaaaabbbbbbbooooooo...............................",
        ".........................ookkkkkkbbbbbbbobbbbbaaamttbbbbbbooooooo...................................",
        "...........................kkkkkkbbbbbbbobbbbbbbbbbbooooooo.........................................",
        "...........................kkkkkkooobbbbooobbbbbboooookkkk..........................................",
        "...........................kkkkkoooooooboooboooooooo.kkkkk..........................................",
        "............................kkk......................kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkk.......kkkkkkkkk......................................",
        "..........................................kkkkkkkk......kkkkkk......................................",
        "..........................................kkkkkkkk..................................................",
        "..........................................kkkkkkkk..................................................",
        "............................................kkkkkk.................................................."
      ],
      headwear: true,
      words: [
        "club",
        "pick",
        "palillo",
        "olive",
        "aceituna",
        "bandera",
        "flag"
      ]
    }
  ],
  actions: [
    {
      name: "drink",
      label: "",
      words: [
        "drink",
        "water",
        "sip",
        "agua",
        "tomar",
        "beber",
        "tomar agua",
        "hidratarse",
        "hidratar",
        "hidratate"
      ],
      outfits: {
        "": [
          {
            ms: 220,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnnh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              },
              {
                at: [
                  65,
                  51
                ],
                rows: [
                  "a"
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnnh.............",
                  "hnnnqh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              },
              {
                at: [
                  65,
                  51
                ],
                rows: [
                  "a"
                ]
              }
            ]
          },
          {
            ms: 1500,
            eyes: "shut",
            patches: [
              {
                at: [
                  60,
                  48
                ],
                rows: [
                  "....hhh..............",
                  "...hHHh..............",
                  "..hHHHh..............",
                  ".hnnHh..kk...........",
                  "hnnnh..kkkk..........",
                  "hnqh...kkkk..........",
                  ".hh.....kkkk.........",
                  "..........kkk........",
                  "...........kkk.......",
                  "............kkkk.....",
                  "..............kkk....",
                  "...............kkk...",
                  "................kkk..",
                  ".................kkk.",
                  "..................kkk",
                  "..................kkk",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  ".............._kkk...",
                  ".............._kkk...",
                  "..............__.....",
                  "..............__.....",
                  "..............__.....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  ".............___.....",
                  ".............___....."
                ]
              }
            ]
          },
          {
            ms: 500,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              },
              {
                at: [
                  65,
                  51
                ],
                rows: [
                  "a"
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              },
              {
                at: [
                  65,
                  51
                ],
                rows: [
                  "a"
                ]
              }
            ]
          }
        ],
        toasted: [
          {
            ms: 220,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnnh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnnh.............",
                  "hnnnqh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              }
            ]
          },
          {
            ms: 1500,
            eyes: "shut",
            patches: [
              {
                at: [
                  60,
                  48
                ],
                rows: [
                  "....hhh..............",
                  "...hHHh..............",
                  "..hHHHh..............",
                  ".hnnHh..kk...........",
                  "hnnnh..kkkk..........",
                  "hnqh...kkkk..........",
                  ".hh.....kkkk.........",
                  "..........kkk........",
                  "...........kkk.......",
                  "............kkkk.....",
                  "..............kkk....",
                  "...............kkk...",
                  "................kkk..",
                  ".................kkk.",
                  "..................kkk",
                  "..................kkk",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  ".............._kkk...",
                  ".............._kkk...",
                  "..............__.....",
                  "..............__.....",
                  "..............__.....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  ".............___.....",
                  ".............___....."
                ]
              }
            ]
          },
          {
            ms: 500,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              }
            ]
          }
        ],
        sesame: [
          {
            ms: 220,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnnh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnnh.............",
                  "hnnnqh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              }
            ]
          },
          {
            ms: 1500,
            eyes: "shut",
            patches: [
              {
                at: [
                  60,
                  48
                ],
                rows: [
                  "....hhh..............",
                  "...hHHh..............",
                  "..hHHHh..............",
                  ".hnnHh..kk...........",
                  "hnnnh..kkkk..........",
                  "hnqh...kkkk..........",
                  ".hh.....kkkk.........",
                  "..........kkk........",
                  "...........kkk.......",
                  "............kkkk.....",
                  "..............kkk....",
                  "...............kkk...",
                  "................kkk..",
                  ".................kkk.",
                  "..................kkk",
                  "..................kkk",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  ".............._kkk...",
                  ".............._kkk...",
                  "..............__.....",
                  "..............__.....",
                  "..............__.....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  ".............___.....",
                  ".............___....."
                ]
              }
            ]
          },
          {
            ms: 500,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              }
            ]
          }
        ],
        club: [
          {
            ms: 220,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnnh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnnh.............",
                  "hnnnqh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              }
            ]
          },
          {
            ms: 1500,
            eyes: "shut",
            patches: [
              {
                at: [
                  60,
                  48
                ],
                rows: [
                  "....hhh..............",
                  "...hHHh..............",
                  "..hHHHh..............",
                  ".hnnHh..kk...........",
                  "hnnnh..kkkk..........",
                  "hnqh...kkkk..........",
                  ".hh.....kkkk.........",
                  "..........kkk........",
                  "...........kkk.......",
                  "............kkkk.....",
                  "..............kkk....",
                  "...............kkk...",
                  "................kkk..",
                  ".................kkk.",
                  "..................kkk",
                  "..................kkk",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  ".................kkk.",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  "................kkk..",
                  ".............._kkk...",
                  ".............._kkk...",
                  "..............__.....",
                  "..............__.....",
                  "..............__.....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  "..............___....",
                  ".............___.....",
                  ".............___....."
                ]
              }
            ]
          },
          {
            ms: 500,
            patches: [
              {
                at: [
                  62,
                  52
                ],
                rows: [
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hHHHHh.............",
                  "hnnnqh.............",
                  "hnnnqh.kk..........",
                  ".hhhh.kkkk.........",
                  "......kkkkk........",
                  ".......kkkkkk......",
                  "...........kkkk....",
                  ".............kkkk..",
                  "...............kkkk",
                  "................kkk",
                  "...............kkk.",
                  "...............kkk.",
                  "...............kkk.",
                  "..............kkk..",
                  "..............kkk..",
                  "..............kkk..",
                  "............_kkk...",
                  "............_kkk...",
                  "............__.....",
                  "............__.....",
                  "............__.....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "............___....",
                  "...........___.....",
                  "...........___....."
                ]
              }
            ]
          },
          {
            ms: 260,
            patches: [
              {
                at: [
                  73,
                  53
                ],
                rows: [
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hHHHHh.",
                  "...hnnnqh.",
                  "...hnnnqh.",
                  "....hhhh..",
                  ".....kkkk.",
                  ".....kkkk.",
                  "......kkk.",
                  "......kkk.",
                  ".......kkk",
                  ".......kkk",
                  ".......kkk",
                  "......kkk.",
                  ".....kkk..",
                  ".....kkk..",
                  "....kkk...",
                  "._.kkk....",
                  "._kkk.....",
                  ".__.......",
                  ".__.......",
                  ".__.......",
                  ".___......",
                  ".___......",
                  ".___......",
                  ".___......",
                  "___.......",
                  "___......."
                ]
              }
            ]
          }
        ]
      }
    },
    {
      name: "wave",
      label: "Wave",
      words: [
        "wave",
        "hola",
        "hi",
        "hello",
        "hey",
        "saludo",
        "saludar",
        "adios",
        "bye"
      ],
      outfits: {
        "": [
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          }
        ],
        toasted: [
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          }
        ],
        sesame: [
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          }
        ],
        club: [
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  60
                ],
                rows: [
                  "............kk.",
                  "...........kkkk",
                  "...........kkkk",
                  "...........kkk.",
                  "..........kkk..",
                  ".........kkk...",
                  "........kkk....",
                  ".......kkk.....",
                  "......kkk......",
                  ".....kkk.......",
                  ".....kkk.......",
                  "....kkk........",
                  "._.kkk.........",
                  "._kkk..........",
                  ".__............",
                  ".__............",
                  ".__............",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  ".___...........",
                  "___............",
                  "___............"
                ]
              }
            ]
          },
          {
            ms: 200,
            patches: [
              {
                at: [
                  73,
                  57
                ],
                rows: [
                  "........kk.",
                  ".......kkkk",
                  ".......kkkk",
                  "........kkk",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  ".......kkk.",
                  "......kkk..",
                  "......kkk..",
                  ".....kkk...",
                  ".....kkk...",
                  "....kkk....",
                  "....kkk....",
                  "...kkk.....",
                  "._.kkk.....",
                  "._kkk......",
                  ".__........",
                  ".__........",
                  ".__........",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  ".___.......",
                  "___........",
                  "___........"
                ]
              }
            ]
          }
        ]
      }
    }
  ],
  split: {
    headLastRow: 99,
    carried: [],
    follow: false
  },
  overHat: [
    "sleep-z",
    "sleep-z-edge",
    "startle",
    "startle-edge",
    "drop",
    "drop-edge",
    "drop-shine",
    "anger"
  ],
  eyes: null,
  colouring: {
    main: "flag",
    coloured: [
      "flag",
      "flag-shade"
    ],
    eyes: [],
    suit: null
  },
  bubble: [
    {
      at: [
        48,
        54
      ],
      rows: [
        ".u.",
        "uwv",
        ".v."
      ]
    },
    {
      at: [
        47,
        52
      ],
      rows: [
        ".uuu.",
        "uweev",
        "ueeev",
        "ueeev",
        ".vvv."
      ]
    },
    {
      at: [
        46,
        50
      ],
      rows: [
        "..uuu..",
        ".ueeeu.",
        "ueweeev",
        "ueeeeev",
        "ueeeeev",
        ".veeev.",
        "..vvv.."
      ]
    },
    {
      at: [
        45,
        48
      ],
      rows: [
        "...uuu...",
        ".uueeeuu.",
        ".ueeeeeu.",
        "ueweeeeev",
        "ueeeeeeev",
        "ueeeeeeev",
        ".veeeeev.",
        ".vveeevv.",
        "...vvv..."
      ]
    }
  ],
  turn: {
    front: {
      base: [
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "....................................................................................................",
        "............................ooooooooooooooooooooooooooooooooooooooooooo.............................",
        "............................ooooooooooooooooooooooooooooooooooooooooooo.............................",
        "...........................ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo...........................",
        ".........................ooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbooo..........................",
        ".........................ooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaatbbooo..........................",
        ".........................oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo..........................",
        ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaaakkaaaaaaaaaaaaaaaaaaakkaaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaakwkkaaaaaaaaaaaaaaaaakwkkaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaakkkkaaaaaaaaaaaaaaaaakkkkaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaakkkkaaaaaaaaaaaaaaaaakkkkaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaaakkaaaaaaaaaaaaaaaaaaakkaaaaaaaaaabbo..........................",
        ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
        ".........................oobaaaaaapppppppaaaaakaakaakaaaaapppppppaaaaaabbo..........................",
        ".........................oobaaaaaapppppppaaaaakaakaakaaaaapppppppaaaaaabbo..........................",
        ".........................oobaaaaaapppppppaaaaaakkakkaaaaaapppppppaaaaaabbo..........................",
        ".........................oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo..........................",
        ".........................gjbbbmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmbbboj..........................",
        ".........................ggobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbboog..........................",
        "........................glllooooooooooooooooooooooooooooooooooooooooooolllgg........................",
        "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
        "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
        "......................gggllllllggggggggllllgggllllggggggllllllggggggllllllggg.......................",
        ".........................ggggggyyyyyyylggggggyggggggyyyygggggglyyyyygggggggg........................",
        ".........................ggggggyyyyyyyygggggyyggggggyyyyggggggyyyyyygggggg..........................",
        ".........................jjyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyj..........................",
        ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
        ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
        "........................kkkdddddddddddddddddddjyyyyyyjjjdddddddddddddddddkkk........................",
        "......................kkkddrrrrrrrrrrrrrrrrrrrdjjyyyjddrrrrrrrrrrrrrrrrrddkkk.......................",
        "......................kkkddrrrrrrrrrrrrrrrrrrrdbbyyybddrrrrrrrrrrrrrrrrrrdkkk.......................",
        ".....................kkkkddrrrrrrrrrrrrrrrrrrrdoojbjoddrrrrrrrrrrrrrrrrrrdkkkk......................",
        "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrdooooooddrrrrrrrrrrrrrrrrrrd..kkkk....................",
        "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrdooooooddrrrrrrrrrrrrrrrrrrd..kkkk....................",
        "...................kkk.....dddddddddddddddddddbbbbbbbbbdddddddddddddddddd....kkk....................",
        "..................kkkk...oobbbbbbbbbbbbbbbbbbbaaaaaaaaabbbbbbbbbbbbbbbbbbo...kkkk...................",
        "..................kkkk...oobbbbbbbbbbbbbbbbbbbaaaaaaaaabbbbbbbbbbbbbbbbbbo...kkkk...................",
        "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaambbbo.....kk...................",
        "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo.....kk...................",
        "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo....kkkk..................",
        "................kkkkkk...oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaambbbo...kkkkkk.................",
        "................kkkkkk...oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbo...kkkkkk.................",
        "................kkkkkk...oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbo...kkkkkk.................",
        "................kkkkkk...oobbbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbo...kkkkkk.................",
        "..................kkk....ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo.....kk...................",
        "..................kkk....ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo.....kk...................",
        "...........................oooooooooooooooooooooooooooooooooooooooooooooo...........................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        "..........................................kkkk.......kkkkk..........................................",
        ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
        ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
        ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
        ".....................................kkkkkkkkk.......kkkkkkkkk......................................"
      ],
      faces: [
        {
          name: "talking",
          label: "",
          patches: [
            {
              at: [
                46,
                56
              ],
              rows: [
                "akk.kka",
                ".ddddd.",
                "kdrrrdk",
                ".kkkkk."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "blink",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                ".aa...................aa.",
                "aaaa.................aaaa",
                ".aa...................aa.",
                "a..a.................a..a",
                ".aa...................aa."
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "blink-half",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                ".aa...................aa.",
                "aaaa.................aaaa"
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "sleepy",
          label: "",
          patches: [
            {
              at: [
                37,
                9
              ],
              rows: [
                "...............................................xxxxxx.",
                "..............................................xzzzzzzx",
                "...............................................xxxxzx.",
                ".................................................xzx..",
                "................................................xzx...",
                "...............................................xzxxxx.",
                "..............................................xzzzzzzx",
                "...............................................xxxxxx.",
                "......................................................",
                "......................................................",
                "......................................................",
                "........................................xxxx..........",
                ".......................................xzzzzx.........",
                "........................................xxzx..........",
                "........................................xzxx..........",
                ".......................................xzzzzx.........",
                "........................................xxxx..........",
                "......................................................",
                "......................................................",
                "......................................................",
                "..................................xxx.................",
                "..................................zzzx................",
                "...................................z..................",
                ".................................xzzz.................",
                "..................................x.x.................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                "......................................................",
                ".aa...................aa..............................",
                "aaaa.................aaaa.............................",
                "aaaa.................aaaa............................."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "deep-sleep",
          label: "",
          patches: [
            {
              at: [
                37,
                6
              ],
              rows: [
                "................................................xxxxxxxxxx.",
                "...............................................xzzzzzzzzzzx",
                "...............................................xzzzzzzzzzzx",
                "................................................xxxxxxxzzx.",
                "....................................................xxzzx..",
                "..................................................xxzzxx...",
                ".................................................xzzxx.....",
                "................................................xzzxxxxxxx.",
                "...............................................xzzzzzzzzzzx",
                "...............................................xzzzzzzzzzzx",
                "................................................xxxxxxxxxx.",
                "...........................................................",
                ".......................................xxxxxxx.............",
                "......................................xzzzzzzzx............",
                "......................................xzzzzzzzx............",
                ".......................................xxxxzzx.............",
                "........................................xxzzx..............",
                ".......................................xzzxxxx.............",
                "......................................xzzzzzzzx............",
                "......................................xzzzzzzzx............",
                ".......................................xxxxxxx.............",
                "...........................................................",
                "...........................................................",
                "..................................xxxx.....................",
                ".................................xzzzzx....................",
                "..................................xxzx.....................",
                "..................................xzxx.....................",
                ".................................xzzzzx....................",
                "..................................xxxx.....................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                "...........................................................",
                ".aa...................aa...................................",
                "aaaa.................aaaa..................................",
                ".aa...................aa...................................",
                "a..a.................a..a..................................",
                ".aa...................aa...................................",
                "...........................................................",
                ".........a.....a...........................................",
                ".........a.kdk.a...........................................",
                "..........aakaa............................................"
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "talking-soft",
          label: "",
          patches: [
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                ".kkkkk.",
                ".kdddk.",
                "..kkk.."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "talking-loud",
          label: "",
          patches: [
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "kkkkkkk",
                "kdddddk",
                "kdrrrdk",
                ".kkkkk."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "happy",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "aaaa",
                "akka",
                "kaak",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "aaaa",
                "akka",
                "kaak",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "kkkkkkk",
                "kdrrrdk",
                ".kkkkk."
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "surprised",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "akka",
                "kwwk",
                "kkkk",
                "kkkk",
                "akka"
              ]
            },
            {
              at: [
                38,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                39,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "akka",
                "kwwk",
                "kkkk",
                "kkkk",
                "akka"
              ]
            },
            {
              at: [
                59,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                60,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "..kkk..",
                ".kdddk.",
                "..kkk.."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "startled",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "akka",
                "kwwk",
                "kwkk",
                "kwwk",
                "akka"
              ]
            },
            {
              at: [
                38,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                39,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "akka",
                "kwwk",
                "kwkk",
                "kwwk",
                "akka"
              ]
            },
            {
              at: [
                59,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                60,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "..kkk..",
                ".kdddk.",
                "..kkk.."
              ]
            },
            {
              at: [
                66,
                29
              ],
              rows: [
                "YYY",
                "YXY",
                "YXY",
                "YXY",
                "YXY",
                "YYY",
                "...",
                "YYY",
                "YXY",
                "YYY"
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "wink",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "aaaa",
                "akka",
                "kaak",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "......k",
                "k....k.",
                ".kkkk.."
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "sad",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "aaaa",
                "akka",
                "kwkk",
                "kkkk",
                "akka"
              ]
            },
            {
              at: [
                40,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                39,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                38,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                37,
                49
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "aaaa",
                "akka",
                "kwkk",
                "kkkk",
                "akka"
              ]
            },
            {
              at: [
                58,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                59,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                60,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                61,
                49
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "..kkk..",
                ".k...k.",
                "k.....k"
              ]
            },
            {
              at: [
                40,
                55
              ],
              rows: [
                ".U.",
                "UTU",
                "UTU",
                ".U."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "angry",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "aaaa",
                "kkkk",
                "kwkk",
                "kkkk",
                "akka"
              ]
            },
            {
              at: [
                37,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                38,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                39,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                40,
                49
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "aaaa",
                "kkkk",
                "kwkk",
                "kkkk",
                "akka"
              ]
            },
            {
              at: [
                61,
                47
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                60,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                59,
                48
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                58,
                49
              ],
              rows: [
                "k"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "kkkkkkk",
                "kwwwwwk",
                "kkkkkkk"
              ]
            },
            {
              at: [
                62,
                43
              ],
              rows: [
                ".O.O.",
                "OO.OO",
                ".....",
                "OO.OO",
                ".O.O."
              ]
            }
          ],
          glances: false,
          blinks: true
        },
        {
          name: "star-eyes",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                36,
                50
              ],
              rows: [
                "..j..",
                ".jyj.",
                "jyyyj",
                ".jyj.",
                ".j.j."
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                57,
                50
              ],
              rows: [
                "..j..",
                ".jyj.",
                "jyyyj",
                ".jyj.",
                ".j.j."
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "kkkkkkk",
                "kdrrrdk",
                ".kkkkk."
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "heart-eyes",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                36,
                50
              ],
              rows: [
                "rr.rr",
                "rwrrr",
                "rrrrr",
                ".rrr.",
                "..r.."
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa",
                "aaaa"
              ]
            },
            {
              at: [
                57,
                50
              ],
              rows: [
                "rr.rr",
                "rwrrr",
                "rrrrr",
                ".rrr.",
                "..r.."
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "kkkkkkk",
                "kdrrrdk",
                ".kkkkk."
              ]
            }
          ],
          glances: false,
          blinks: false
        },
        {
          name: "dizzy",
          label: "",
          patches: [
            {
              at: [
                37,
                50
              ],
              rows: [
                "kaak",
                "akka",
                "akka",
                "kaak",
                "aaaa"
              ]
            },
            {
              at: [
                58,
                50
              ],
              rows: [
                "kaak",
                "akka",
                "akka",
                "kaak",
                "aaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                "aaaaaaa",
                "aaaaaaa",
                "aaaaaaa"
              ]
            },
            {
              at: [
                46,
                56
              ],
              rows: [
                ".k...k.",
                "k.k.k.k",
                "...k..."
              ]
            }
          ],
          glances: false,
          blinks: false
        }
      ],
      headLastRow: 99,
      outfits: [
        {
          name: "toasted",
          rows: [
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "............................1111111111111111111111111111111111111111111.............................",
            "............................1111111111111111111111111111111111111111111.............................",
            "...........................1112222222222222222222222222222222222222222111...........................",
            ".........................1112224446444446444446444446444446444446444222111..........................",
            ".........................1112224464444464444464444464444464444464444322111..........................",
            ".........................1122244644444644444644444644444644444644444642221..........................",
            ".........................1124444444444444444444444444444444444444444444221..........................",
            ".........................1124444444444444444444444444444444444444444444221..........................",
            ".........................1124444444444444444444444444444444444444444444221..........................",
            ".........................1124444444444kk4444444444444444444kk4444444444221..........................",
            ".........................112444444444kwkk44444444444444444kwkk444444444221..........................",
            ".........................112444444444kkkk44444444444444444kkkk444444444221..........................",
            ".........................112444444444kkkk44444444444444444kkkk444444444221..........................",
            ".........................1124444444444kk4444444444444444444kk4444444444221..........................",
            ".........................1124444444444444444444444444444444444444444444221..........................",
            ".........................112444444ppppppp44444k44k44k44444ppppppp444444221..........................",
            ".........................112444444ppppppp44444k44k44k44444ppppppp444444221..........................",
            ".........................112444444ppppppp444444kk4kk444444ppppppp444444221..........................",
            ".........................1122244444444444444444444444444444444444444442221..........................",
            ".........................gj2225555555555555555555555555555555555555552221j..........................",
            ".........................gg1222222222222222222222222222222222222222222211g..........................",
            "........................glll1111111111111111111111111111111111111111111lllgg........................",
            "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
            "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
            "......................gggllllllggggggggllllgggllllggggggllllllggggggllllllggg.......................",
            ".........................ggggggyyyyyyylggggggyggggggyyyygggggglyyyyygggggggg........................",
            ".........................ggggggyyyyyyyygggggyyggggggyyyyggggggyyyyyygggggg..........................",
            ".........................jjyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyj..........................",
            ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
            ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
            "........................kkkdddddddddddddddddddjyyyyyyjjjdddddddddddddddddkkk........................",
            "......................kkkddrrrrrrrrrrrrrrrrrrrdjjyyyjddrrrrrrrrrrrrrrrrrddkkk.......................",
            "......................kkkddrrrrrrrrrrrrrrrrrrrd22yyy2ddrrrrrrrrrrrrrrrrrrdkkk.......................",
            ".....................kkkkddrrrrrrrrrrrrrrrrrrrd11j2j1ddrrrrrrrrrrrrrrrrrrdkkkk......................",
            "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrd111111ddrrrrrrrrrrrrrrrrrrd..kkkk....................",
            "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrd111111ddrrrrrrrrrrrrrrrrrrd..kkkk....................",
            "...................kkk.....ddddddddddddddddddd222222222dddddddddddddddddd....kkk....................",
            "..................kkkk...1122222222222222222224444444442222222222222222221...kkkk...................",
            "..................kkkk...1122222222222222222224444444442222222222222222221...kkkk...................",
            "..................kkk....1126444446444446444446444446444446444446444452221.....kk...................",
            "..................kkk....1124444464444464444464444464444464444464444462221.....kk...................",
            "..................kkk....1124444644444644444644444644444644444644444642221....kkkk..................",
            "................kkkkkk...1124446444446444446444446444446444446444446452221...kkkkkk.................",
            "................kkkkkk...1122264444464444464444464444464444464444464222221...kkkkkk.................",
            "................kkkkkk...1122244444644444644444644444644444644444644222221...kkkkkk.................",
            "................kkkkkk...1122224446444446444446444446444446444446442222221...kkkkkk.................",
            "..................kkk....1112222222222222222222222222222222222222222222111.....kk...................",
            "..................kkk....1112222222222222222222222222222222222222222222111.....kk...................",
            "...........................1111111111111111111111111111111111111111111111...........................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................"
          ]
        },
        {
          name: "sesame",
          rows: [
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "............................ooooooooooooooooooooooooooooooooooooooooooo.............................",
            "............................ooooooooooooooooooooooooooooooooooooooooooo.............................",
            "...........................ooobSSbbbbbbbSSbbbbbbbSSbbbbbbbSSbbbbbbSSbbooo...........................",
            ".........................ooobbbasaaaaaaaasaaaaaaaasaaaaaaaasaaaaaaasbbbooo..........................",
            ".........................ooobbbaaaaSSaaaaaaaSSaaaaaaaSSaaaaaaaSSaaaatbbooo..........................",
            ".........................oobbbaaaaaasaaaaaaaasaaaaaaaasaaaaaaaasaaaaaabbbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaakkaaaaaaaaaaaaaaaaaaakkaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaakwkkaaaaaaaaaaaaaaaaakwkkaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaakkkkaaaaaaaaaaaaaaaaakkkkaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaakkkkaaaaaaaaaaaaaaaaakkkkaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaakkaaaaaaaaaaaaaaaaaaakkaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaapppppppaaaaakaakaakaaaaapppppppaaaaaabbo..........................",
            ".........................oobaaaaaapppppppaaaaakaakaakaaaaapppppppaaaaaabbo..........................",
            ".........................oobaaaaaapppppppaaaaaakkakkaaaaaapppppppaaaaaabbo..........................",
            ".........................oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo..........................",
            ".........................gjbbbmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmbbboj..........................",
            ".........................ggobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbboog..........................",
            "........................glllooooooooooooooooooooooooooooooooooooooooooolllgg........................",
            "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
            "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
            "......................gggllllllggggggggllllgggllllggggggllllllggggggllllllggg.......................",
            ".........................ggggggyyyyyyylggggggyggggggyyyygggggglyyyyygggggggg........................",
            ".........................ggggggyyyyyyyygggggyyggggggyyyyggggggyyyyyygggggg..........................",
            ".........................jjyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyj..........................",
            ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
            ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
            "........................kkkdddddddddddddddddddjyyyyyyjjjdddddddddddddddddkkk........................",
            "......................kkkddrrrrrrrrrrrrrrrrrrrdjjyyyjddrrrrrrrrrrrrrrrrrddkkk.......................",
            "......................kkkddrrrrrrrrrrrrrrrrrrrdbbyyybddrrrrrrrrrrrrrrrrrrdkkk.......................",
            ".....................kkkkddrrrrrrrrrrrrrrrrrrrdoojbjoddrrrrrrrrrrrrrrrrrrdkkkk......................",
            "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrdooooooddrrrrrrrrrrrrrrrrrrd..kkkk....................",
            "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrdooooooddrrrrrrrrrrrrrrrrrrd..kkkk....................",
            "...................kkk.....dddddddddddddddddddbbbbbbbbbdddddddddddddddddd....kkk....................",
            "..................kkkk...oobbbbbbbbbbbbbbbbbbbaaaaaaaaabbbbbbbbbbbbbbbbbbo...kkkk...................",
            "..................kkkk...oobbbbbbbbbbbbbbbbbbbaaaaaaaaabbbbbbbbbbbbbbbbbbo...kkkk...................",
            "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaambbbo.....kk...................",
            "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo.....kk...................",
            "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo....kkkk..................",
            "................kkkkkk...oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaambbbo...kkkkkk.................",
            "................kkkkkk...oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbo...kkkkkk.................",
            "................kkkkkk...oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbo...kkkkkk.................",
            "................kkkkkk...oobbbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbo...kkkkkk.................",
            "..................kkk....ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo.....kk...................",
            "..................kkk....ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo.....kk...................",
            "...........................oooooooooooooooooooooooooooooooooooooooooooooo...........................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................"
          ]
        },
        {
          name: "club",
          rows: [
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "....................................................................................................",
            "...............................................Q.Q.Q.Q..............................................",
            "..............................................QQQQQQQQQ.............................................",
            ".............................................QQQQQQQQQQR............................................",
            "..............................................RQQQQQQQR.............................................",
            "...............................................R.R.R.R..............................................",
            ".................................................RR.................................................",
            "..................................................7.................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            ".................................................VVVV...............................................",
            "................................................VVVVVV..............................................",
            "...............................................VVVZZVVV.............................................",
            "...............................................VVVZVVVV.............................................",
            "................................................VVVVVV..............................................",
            ".................................................VVVV...............................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "..................................................78................................................",
            "............................oooooooooooooooooooooo78ooooooooooooooooooo.............................",
            "............................oooooooooooooooooooooo78ooooooooooooooooooo.............................",
            "...........................ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo...........................",
            ".........................ooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbooo..........................",
            ".........................ooobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaatbbooo..........................",
            ".........................oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaakkaaaaaaaaaaaaaaaaaaakkaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaakwkkaaaaaaaaaaaaaaaaakwkkaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaakkkkaaaaaaaaaaaaaaaaakkkkaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaakkkkaaaaaaaaaaaaaaaaakkkkaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaakkaaaaaaaaaaaaaaaaaaakkaaaaaaaaaabbo..........................",
            ".........................oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbo..........................",
            ".........................oobaaaaaapppppppaaaaakaakaakaaaaapppppppaaaaaabbo..........................",
            ".........................oobaaaaaapppppppaaaaakaakaakaaaaapppppppaaaaaabbo..........................",
            ".........................oobaaaaaapppppppaaaaaakkakkaaaaaapppppppaaaaaabbo..........................",
            ".........................oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo..........................",
            ".........................gjbbbmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmbbboj..........................",
            ".........................ggobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbboog..........................",
            "........................glllooooooooooooooooooooooooooooooooooooooooooolllgg........................",
            "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
            "......................gglllllllllllllllllllllllllllllgglllllllllllllllllllllg.......................",
            "......................gggllllllggggggggllllgggllllggggggllllllggggggllllllggg.......................",
            ".........................ggggggyyyyyyylggggggyggggggyyyygggggglyyyyygggggggg........................",
            ".........................ggggggyyyyyyyygggggyyggggggyyyyggggggyyyyyygggggg..........................",
            ".........................jjyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyj..........................",
            ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
            ".........................jjjjjjjjjjjjjjjjjjjjjyyyyyyyyyyjjjjjjjjjjjjjjjjjj..........................",
            "........................kkkdddddddddddddddddddjyyyyyyjjjdddddddddddddddddkkk........................",
            "......................kkkddrrrrrrrrrrrrrrrrrrrdjjyyyjddrrrrrrrrrrrrrrrrrddkkk.......................",
            "......................kkkddrrrrrrrrrrrrrrrrrrrdbbyyybddrrrrrrrrrrrrrrrrrrdkkk.......................",
            ".....................kkkkddrrrrrrrrrrrrrrrrrrrdoojbjoddrrrrrrrrrrrrrrrrrrdkkkk......................",
            "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrdooooooddrrrrrrrrrrrrrrrrrrd..kkkk....................",
            "...................kkkkk.ddrrrrrrrrrrrrrrrrrrrdooooooddrrrrrrrrrrrrrrrrrrd..kkkk....................",
            "...................kkk.....dddddddddddddddddddbbbbbbbbbdddddddddddddddddd....kkk....................",
            "..................kkkk...oobbbbbbbbbbbbbbbbbbbaaaaaaaaabbbbbbbbbbbbbbbbbbo...kkkk...................",
            "..................kkkk...oobbbbbbbbbbbbbbbbbbbaaaaaaaaabbbbbbbbbbbbbbbbbbo...kkkk...................",
            "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaambbbo.....kk...................",
            "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo.....kk...................",
            "..................kkk....oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbo....kkkk..................",
            "................kkkkkk...oobaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaambbbo...kkkkkk.................",
            "................kkkkkk...oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbo...kkkkkk.................",
            "................kkkkkk...oobbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbo...kkkkkk.................",
            "................kkkkkk...oobbbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbo...kkkkkk.................",
            "..................kkk....ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo.....kk...................",
            "..................kkk....ooobbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbooo.....kk...................",
            "...........................oooooooooooooooooooooooooooooooooooooooooooooo...........................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            "..........................................kkkk.......kkkkk..........................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................",
            ".....................................kkkkkkkkk.......kkkkkkkkk......................................"
          ]
        }
      ],
      extras: [
        {
          name: "blush",
          patches: [
            {
              at: [
                33,
                56
              ],
              rows: [
                ".P.P.P.....................P.P.P",
                "P.P.P.....................P.P.P."
              ]
            }
          ]
        },
        {
          name: "sweat",
          patches: [
            {
              at: [
                72,
                36
              ],
              rows: [
                "..U..",
                ".UTU.",
                ".UTU.",
                "UTTTU",
                "UTWTU",
                "UTTTU",
                ".UUU."
              ]
            }
          ]
        },
        {
          name: "mic",
          patches: [
            {
              at: [
                22,
                38
              ],
              rows: [
                ".......MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM......",
                "......M.........................................M.....",
                ".....M...........................................M....",
                "....M.............................................M...",
                "....M.............................................M...",
                "...M...............................................M..",
                "...M...............................................M..",
                "..M.................................................M.",
                ".MM................................................MM.",
                "MMNM..............................................MNMM",
                "MMMM..............................................MMMM",
                ".MM................................................MM.",
                "...................................................M..",
                ".................................................MM...",
                "...............................................MM.....",
                ".............................................MM.......",
                "...........................................MM.........",
                ".........................................MM...........",
                ".......................................MM.............",
                "................................MM...MM...............",
                "................................MNMMM.................",
                ".................................M...................."
              ]
            }
          ]
        },
        {
          name: "party-hat",
          patches: [
            {
              at: [
                41,
                18
              ],
              rows: [
                ".......CCC.......",
                "......CCCCC......",
                "......CCCCC......",
                "......CCCCC......",
                ".......CCC.......",
                "........A........",
                ".......AAD.......",
                ".......AAD.......",
                ".......BBD.......",
                "......BBBBD......",
                "......BBBBD......",
                ".....BBBBBBD.....",
                ".....AAAAAAD.....",
                ".....AAAAAAD.....",
                "....AAAAAAAAD....",
                "....AAAAAAAAD....",
                "....BBBBBBBBD....",
                "...BBBBBBBBBBD...",
                "...BBBBBBBBBBD...",
                "..BBBBBBBBBBBBD..",
                "..AAAAAAAAAAAAD..",
                "..AAAAAAAAAAAAD..",
                ".AAAAAAAAAAAAAAD.",
                ".AAAAAAAAAAAAAAD.",
                "DDDDDDDDDDDDDDDDD"
              ]
            }
          ]
        },
        {
          name: "chef-hat",
          patches: [
            {
              at: [
                39,
                18
              ],
              rows: [
                ".........GGG.........",
                ".......GGEEEGG.......",
                "......GEEEEEEEG......",
                ".....GEEEEEEEEEG.....",
                ".....GEEEEEEEEEG.....",
                "....GEEEEEEEEEEFG....",
                "..GGEEEEEEEEEEEFFGG..",
                ".GEEEEEEEEEEEEEFFFFG.",
                ".GEEEEEEEEEEEEEFFFFG.",
                "GEEEEEEEEEEEEEEFFFFFG",
                "GEEEEEEEEEEEEEEFFFFFG",
                "GEEEEEEEEEEEEEEFFFFFG",
                ".GEEEEEEEEGEEEEFFFFG.",
                ".GEEEEEEEG.GEEEFFFFG.",
                "..GEEEEEG...GEEFFFG..",
                "..GEEEEEEGGGEEEFFFG..",
                "..GFFFFFFFFFFFFFFFG..",
                "..GEEEEEEEEEEEEFFFG..",
                "..GEEEEEEEEEEEEFFFG..",
                "..GEEEEEEEEEEEEFFFG..",
                "..GEEEEEEEEEEEEFFFG..",
                "..GEEEEEEEEEEEEFFFG..",
                "..GFFFFFFFFFFFFFFFG..",
                "..GFFFFFFFFFFFFFFFG..",
                "..GGGGGGGGGGGGGGGGG.."
              ]
            }
          ]
        },
        {
          name: "crown",
          patches: [
            {
              at: [
                41,
                28
              ],
              rows: [
                "..L.....L.....L..",
                "..K.....K.....K..",
                "..K.....K.....K..",
                "..K.....K.....K..",
                ".KIK...KIK...KIK.",
                ".KIK...KIK...KIK.",
                ".KIK...KIK...KIK.",
                "KIIIK.KIIIK.KIIIK",
                "KIIIIKIIIIIKIIIIK",
                ".KIIIIIIIIIIIIIK.",
                ".KIrIIILLIIIIrIK.",
                ".KIIIIIIIIIIIIIK.",
                ".KIIIIIIIIIIIIIK.",
                ".KJJJJJJJJJJJJJK.",
                ".KKKKKKKKKKKKKKK."
              ]
            }
          ]
        }
      ]
    },
    mirrorKeep: [
      [
        70,
        6,
        96,
        34
      ]
    ]
  },
  drawnFacing: "right"
};
