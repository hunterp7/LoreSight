/**
 * Story metadata derived from jeffnyman/zcode_catalog.
 *
 * The catalog intentionally stores metadata and upstream URLs rather than
 * copying the repository's story binaries into the widget bundle. This keeps
 * the app lightweight and lets the copyright holder's repository remain the
 * source of truth. Entries are fetched only after the player chooses one.
 */
export type StoryCatalogEntry = {
  id: string;
  title: string;
  file: string;
  format: "z1" | "z2" | "z3" | "z4" | "z5" | "z6" | "z8" | "blorb";
  category: "classic" | "inform";
  sourceUrl: string;
};

const catalogBase = "https://raw.githubusercontent.com/jeffnyman/zcode_catalog/master";

function entry(id: string, title: string, path: string, category: StoryCatalogEntry["category"] = "classic"): StoryCatalogEntry {
  const file = path.split("/").pop() ?? path;
  const extension = file.toLowerCase().endsWith(".zblorb") || file.toLowerCase().endsWith(".blb")
    ? "blorb"
    : (file.match(/\.(z[1-8])$/i)?.[1].toLowerCase() ?? "z5");
  return { id, title, file, format: extension as StoryCatalogEntry["format"], category, sourceUrl: `${catalogBase}/${path}` };
}

/** Canonical playable releases represented in the upstream contents.txt file. */
export const storyCatalog: StoryCatalogEntry[] = [
  entry("amfv", "A Mind Forever Voyaging", "amfv/amfv-r79-s851122.z4"),
  entry("abyss", "Abyss", "abyss/abyss-r1-s890320.z6"),
  entry("arthur", "Arthur", "arthur/arthur-r74-s890714.z6"),
  entry("ballyhoo", "Ballyhoo", "ballyhoo/ballyhoo-r99-s861014.z3"),
  entry("beyond-zork", "Beyond Zork", "beyondzork/beyondzork-r60-s880610.z5"),
  entry("border-zone", "Border Zone", "borderzone/borderzone-r9-s871008.z5"),
  entry("bureaucracy", "Bureaucracy", "bureaucracy/bureaucracy-r160-s880521.z4"),
  entry("cutthroats", "Cutthroats", "cutthroats/cutthroats-r25-s840917.z3"),
  entry("deadline", "Deadline", "deadline/deadline-r28-s850129.z3"),
  entry("enchanter", "Enchanter", "enchanter/enchanter-r29-s860820.z3"),
  entry("hitchhikers-guide", "The Hitchhiker's Guide to the Galaxy", "hitchhiker/hitchhiker-r60-s861002.z3"),
  entry("hollywood-hijinx", "Hollywood Hijinx", "hollywood/hollywoodhijinx-r37-s861215.z3"),
  entry("hypochondriac", "Hypochondriac", "hypochondriac/hypochondriac-r11-s870225.z3"),
  entry("infidel", "Infidel", "infidel/infidel-r22-s830916.z3"),
  entry("journey", "Journey", "journey/journey-r83-s890706.z6"),
  entry("leather-goddesses", "Leather Goddesses of Phobos", "leathergoddesses/leathergoddesses-r59-s860730.z3"),
  entry("lurking-horror", "The Lurking Horror", "lurkinghorror/lurkinghorror-r221-s870918.z3"),
  entry("mini-zork", "Mini-Zork", "minizork/minizork-r34-s871124.z3"),
  entry("moonmist", "Moonmist", "moonmist/moonmist-r13-s880501.z3"),
  entry("nord-and-bert", "Nord and Bert Couldn't Make Head or Tail of It", "nordandbert/nordandbert-r20-s870722.z4"),
  entry("planetfall", "Planetfall", "planetfall/planetfall-r39-s880501.z3"),
  entry("plundered-hearts", "Plundered Hearts", "plunderedhearts/plunderedhearts-r26-s870730.z3"),
  entry("restaurant", "Restaurant at the End of the Universe", "restaurant/restaurant-r15-s880512.z5"),
  entry("seastalker", "Seastalker", "seastalker/seastalker-r18-s850919.z3"),
  entry("sherlock", "Sherlock", "sherlock/sherlock-r26-s880127.z5"),
  entry("shogun", "Shogun", "shogun/shogun-r322-s890706.z6"),
  entry("sorcerer", "Sorcerer", "sorcerer/sorcerer-r18-s860904.z3"),
  entry("spellbreaker", "Spellbreaker", "spellbreaker/spellbreaker-r87-s860904.z3"),
  entry("starcross", "Starcross", "starcross/starcross-r18-s830114.z3"),
  entry("stationfall", "Stationfall", "stationfall/stationfall-r107-s870430.z3"),
  entry("suspect", "Suspect", "suspect/suspect-i190-r18-s850222.z3"),
  entry("suspended", "Suspended", "suspended/suspended-r8-s830521.z3"),
  entry("trinity", "Trinity", "trinity/trinity-r15-s870628.z4"),
  entry("wishbringer", "Wishbringer", "wishbringer/wishbringer-r69-s850920.z3"),
  entry("witness", "The Witness", "witness/witness-r23-s840925.z3"),
  entry("zork-0", "Zork 0", "zork0/zork0-r393-s890714.z6"),
  entry("zork-1", "Zork I", "zork1/zork1-r119-s880429.z3"),
  entry("zork-2", "Zork II", "zork2/zork2-r63-s860811.z3"),
  entry("zork-3", "Zork III", "zork3/zork3-r25-s860811.z3"),
  entry("bronze", "Bronze", "zblorb/bronze.zblorb"),
  entry("hoosegow", "Hoosegow", "zblorb/hoosegow.zblorb"),
  entry("wedding", "Wedding", "zblorb/wedding.zblorb"),
  entry("wscholars", "Wumpus Scholars", "zblorb/wscholars.zblorb"),
  entry("aug4", "Augmented Inform: Aug 4", "inform/aug4.z8", "inform"),
  entry("dreamhold", "Dreamhold", "inform/dreamhold.z8", "inform"),
  entry("varicella", "Varicella", "inform/varicella.z8", "inform"),
  entry("vespers", "Vespers", "inform/vespers.z8", "inform"),
  entry("zombies", "Zombies", "inform/zombies.z5", "inform"),
];

export const classicStoryCatalog = storyCatalog.filter((story) => story.category === "classic");
export const informStoryCatalog = storyCatalog.filter((story) => story.category === "inform");
/** Releases that the current browser interpreter can execute directly. */
export const playableStoryCatalog = storyCatalog.filter((story) => ["z3", "z4", "z5", "z8", "blorb"].includes(story.format));
