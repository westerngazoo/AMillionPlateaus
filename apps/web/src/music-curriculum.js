// music-curriculum.js — the DETAILED music-theory core (R-0068), for the Composer
// lens (and any MUSIC-facing lens). Music had only 4 bare seed plateaus
// (Rhythm/Melody/Harmony/Counterpoint, no bodies, no path); this seeds the standard
// music-theory sequence a learner actually walks — pitch and notation up through
// harmony, form, and counterpoint — as real, numbered, followable plateaus.
//
// Same contract as the other curricula: pure data, fixed ids in a reserved MUSIC
// namespace (plateaus f0…, bridges f1…, resources f2…, path f3…), idempotently
// upserted by main.js. Each body ends in a concrete **Deliverable** and a
// **Study (official)** pointer (musictheory.net / Open Music Theory / Khan) so the
// teaching is source-grounded, not generic. Music is the CREATIVE axis
// (e3-dominant), matching the seed pillars.

import { MUSIC_DOMAIN } from "./persona.js";

const RHYTHM = "00000000-0000-0000-0000-0000000000c1"; // the seed MUSIC trailhead, threaded into

export const MUSIC_PLATEAUS = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    name: "Pitch, the Keyboard & the Octave",
    domain: MUSIC_DOMAIN, e1: 0.14, e2: 0.1, e3: 0.9,
    description:
`# Pitch, the Keyboard & the Octave
Pitch is how high or low a note sounds — physically, the frequency of the vibration. The twelve keys of the piano (seven white, five black) repeat every **octave**, a doubling of frequency (A4 = 440 Hz, A5 = 880 Hz). Note names (A–G), sharps/flats, and enharmonics (C♯ = D♭) are the alphabet; the half-step (one key) and whole-step (two) are the ruler everything else is measured in.

**Deliverable:** name every white and black key in one octave, and give two enharmonic spellings of the black key between F and G.

**Study (official):** musictheory.net — *The Staff, Clefs, and Ledger Lines* / *The Piano*; Khan Academy — *Music basics*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000002",
    name: "Reading Music: Staff, Clefs & Ledger Lines",
    domain: MUSIC_DOMAIN, e1: 0.2, e2: 0.1, e3: 0.86,
    description:
`# Reading Music: Staff, Clefs & Ledger Lines
The five-line **staff** maps pitch to vertical position; a **clef** fixes which line is which note (treble/G clef for higher voices, bass/F clef for lower). Ledger lines extend the staff; the grand staff joins both for piano. Reading fluently — line/space mnemonics, octave designations — is the literacy the rest depends on.

**Deliverable:** write middle C in both treble and bass clef, and identify three notes above and below the staff using ledger lines.

**Study (official):** musictheory.net — *The Staff, Clefs, and Ledger Lines*; Open Music Theory — *Notation of Notes, Clefs, and Ledger Lines*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000003",
    name: "Rhythm, Meter & Time Signatures",
    domain: MUSIC_DOMAIN, e1: 0.16, e2: 0.14, e3: 0.88,
    description:
`# Rhythm, Meter & Time Signatures
Music in time: note values (whole, half, quarter, eighth…) each halve the last, and **meter** groups beats into recurring patterns marked by the **time signature** — top number = beats per measure, bottom = which note gets the beat. Simple vs compound meter, dotted notes, ties, rests, and syncopation are the vocabulary of groove.

**Deliverable:** in $\\tfrac{4}{4}$, fill one measure three different ways using at least one dotted note; then say what $\\tfrac{6}{8}$ groups differently.

**Study (official):** musictheory.net — *Note Duration* / *Time Signatures*; Khan Academy — *Rhythm and meter*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000004",
    name: "Major Scales, Keys & Key Signatures",
    domain: MUSIC_DOMAIN, e1: 0.26, e2: 0.12, e3: 0.82,
    description:
`# Major Scales, Keys & Key Signatures
A **major scale** is a fixed pattern of steps — W-W-H-W-W-W-H — starting on any note, giving that key its seven pitches. The **circle of fifths** orders the keys and predicts each **key signature** (which sharps/flats to carry). This is the gravity of tonal music: a "home" note (tonic) the ear wants to return to.

**Deliverable:** build the G-major and F-major scales by the W-W-H pattern and give each key signature.

**Study (official):** musictheory.net — *Major Scales* / *The Circle of Fifths*; Open Music Theory — *Major Scales, Scale Degrees, and Key Signatures*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000005",
    name: "Minor Scales & Modes",
    domain: MUSIC_DOMAIN, e1: 0.28, e2: 0.12, e3: 0.8,
    description:
`# Minor Scales & Modes
The **minor** scale and its three forms (natural, harmonic, melodic) give tonal music its darker color; each major key shares a signature with its **relative minor** (a minor third below). The **modes** (Dorian, Phrygian, Lydian, Mixolydian…) are the same seven notes started on a different degree — the palette of folk, jazz, and film.

**Deliverable:** write A natural, harmonic, and melodic minor, and name the relative minor of C major.

**Study (official):** musictheory.net — *Minor Scales*; Open Music Theory — *Minor Scales and Keys* / *Diatonic Modes*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000006",
    name: "Intervals",
    domain: MUSIC_DOMAIN, e1: 0.34, e2: 0.16, e3: 0.74,
    description:
`# Intervals
The distance between two pitches, named by **size** (second, third… octave) and **quality** (major, minor, perfect, augmented, diminished). Intervals are the atoms of both melody (played in sequence) and harmony (stacked). Consonance vs dissonance — why a perfect fifth sounds stable and a tritone tense — is heard here first.

**Deliverable:** identify the intervals C→E, C→E♭, and C→G by size and quality, and say which is a tritone.

**Study (official):** musictheory.net — *Generic Intervals* / *Specific Intervals*; Open Music Theory — *Intervals*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000007",
    name: "Triads & Chord Qualities",
    domain: MUSIC_DOMAIN, e1: 0.4, e2: 0.16, e3: 0.7,
    description:
`# Triads & Chord Qualities
Stack two thirds and you have a **triad** — the basic chord. Its quality (major, minor, diminished, augmented) comes from which thirds you stack; inversions (root, first, second) reorder the same notes. Triads are the building blocks of harmony: name them, spell them in any key, and hear the difference.

**Deliverable:** spell the four triad qualities on the root C, and give the first inversion of C-major.

**Study (official):** musictheory.net — *Introduction to Chords* / *Triad Inversion*; Open Music Theory — *Triads*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000008",
    name: "Diatonic Harmony & Roman Numerals",
    domain: MUSIC_DOMAIN, e1: 0.46, e2: 0.18, e3: 0.64,
    description:
`# Diatonic Harmony & Roman Numerals
Build a triad on each scale degree and you get the seven **diatonic chords**, labeled with **Roman numerals** (I ii iii IV V vi vii°) — uppercase major, lowercase minor. This is the abstraction that lets a progression transpose to any key: I–IV–V–I is the same *function* everywhere. Tonic, subdominant, and dominant are the three harmonic jobs.

**Deliverable:** write the diatonic triads of C major with Roman numerals, and label each as tonic, subdominant, or dominant function.

**Study (official):** musictheory.net — *Roman Numerals*; Open Music Theory — *Roman Numerals and SATB Chord Construction* / *Harmonic Function*.`,
  },
  {
    id: "f0000000-0000-0000-0000-000000000009",
    name: "Chord Progressions & Cadences",
    domain: MUSIC_DOMAIN, e1: 0.44, e2: 0.2, e3: 0.64,
    description:
`# Chord Progressions & Cadences
Chords in motion. Functional progressions tend to flow tonic → subdominant → dominant → tonic; a **cadence** is how a phrase closes — authentic (V–I), plagal (IV–I), half (…–V), deceptive (V–vi). This is where harmony becomes grammar: the difference between a comma and a period in music.

**Deliverable:** harmonize a I–IV–V–I in C, then change the last chord to make it a deceptive cadence and name what you did.

**Study (official):** musictheory.net — *Cadences*; Open Music Theory — *Phrases and Cadences* / *Harmonic Progression*.`,
  },
  {
    id: "f0000000-0000-0000-0000-00000000000a",
    name: "Seventh Chords & Non-Chord Tones",
    domain: MUSIC_DOMAIN, e1: 0.5, e2: 0.2, e3: 0.6,
    description:
`# Seventh Chords & Non-Chord Tones
Add a fourth note a third above a triad and you get a **seventh chord** — the dominant seventh (V7) is the engine of tonal pull, and jazz lives on the full family (maj7, m7, ø7, °7). **Non-chord tones** (passing, neighbor, suspension, appoggiatura) are the melodic dissonances that make lines sing over the harmony.

**Deliverable:** spell G7 and resolve it to C; then add a $4\\text{–}3$ suspension over the final chord.

**Study (official):** musictheory.net — *Seventh Chords*; Open Music Theory — *Seventh Chords* / *Embellishing Tones*.`,
  },
  {
    id: "f0000000-0000-0000-0000-00000000000b",
    name: "Melody, Motive & Phrase",
    domain: MUSIC_DOMAIN, e1: 0.3, e2: 0.18, e3: 0.82,
    description:
`# Melody, Motive & Phrase
What makes a tune. A **motive** is the smallest memorable idea; **phrases** (often four bars) are musical sentences that answer each other (antecedent/consequent); contour, range, and the tension/release of stepwise motion vs leaps shape a melody. Development — sequence, inversion, augmentation — is how a small idea fills a whole piece.

**Deliverable:** write a two-bar motive and answer it with a consequent phrase that closes on the tonic.

**Study (official):** Khan Academy — *Melody*; Open Music Theory — *Melody* / *Phrases and Cadences*.`,
  },
  {
    id: "f0000000-0000-0000-0000-00000000000c",
    name: "Voice-Leading & Four-Part Writing",
    domain: MUSIC_DOMAIN, e1: 0.5, e2: 0.2, e3: 0.6,
    description:
`# Voice-Leading & Four-Part Writing
How chords connect *smoothly*. Writing for four voices (SATB), you keep common tones, move the others by the smallest step, and obey the classic rules — no parallel fifths or octaves, resolve the leading tone, watch the ranges. Good voice-leading is why a progression sounds like music and not a stack of blocks.

**Deliverable:** connect I–V–I in C major in four voices with no parallel fifths or octaves.

**Study (official):** Open Music Theory — *Voice Leading* / *SATB Part-Writing*; musictheory.net — *Chord Progressions*.`,
  },
  {
    id: "f0000000-0000-0000-0000-00000000000d",
    name: "Modulation & Tonicization",
    domain: MUSIC_DOMAIN, e1: 0.52, e2: 0.22, e3: 0.58,
    description:
`# Modulation & Tonicization
Changing key. **Tonicization** briefly points at a new chord with its own dominant (a **secondary dominant**, V/V); **modulation** commits — a pivot chord shared by both keys reinterprets the harmony and the music settles into a new tonic. This is how longer pieces travel and return, the large-scale tension of tonal form.

**Deliverable:** in C major, insert a V/V (D major) before the cadential G, and explain why D major "points at" G.

**Study (official):** Open Music Theory — *Tonicization* / *Modulation*; musictheory.net — *Roman Numerals* (secondary dominants).`,
  },
  {
    id: "f0000000-0000-0000-0000-00000000000e",
    name: "Musical Form",
    domain: MUSIC_DOMAIN, e1: 0.42, e2: 0.24, e3: 0.66,
    description:
`# Musical Form
The architecture of a whole piece. Small forms (binary AB, ternary ABA), the phrase-based period and sentence, and larger designs (rondo, theme-and-variations, sonata form) organize repetition and contrast across time. Form is how music makes a listener remember, expect, and feel arrival.

**Deliverable:** diagram a familiar song as sections (e.g. verse–chorus or ABA) and mark where the main contrast happens.

**Study (official):** Open Music Theory — *Form* (Binary, Ternary, Sonata); Khan Academy — *Form in music*.`,
  },
  {
    id: "f0000000-0000-0000-0000-00000000000f",
    name: "Counterpoint",
    domain: MUSIC_DOMAIN, e1: 0.5, e2: 0.22, e3: 0.62,
    description:
`# Counterpoint
Two or more independent melodies that sound good together. **Species counterpoint** (Fux) trains this in stages — note-against-note, then two/three/four notes against one, then florid — teaching consonance, dissonance treatment, and independent motion (contrary, oblique, parallel). It is the discipline behind Bach and the summit the seed "Counterpoint" pillar names.

**Deliverable:** write a first-species counterpoint line above a short cantus firmus using only consonances and mostly contrary motion.

**Study (official):** Open Music Theory — *Counterpoint*; Fux — *Gradus ad Parnassum* (species counterpoint).`,
  },
];

// ── Prerequisite spine (build order) + a link from the seed Rhythm trailhead ─────
const F = (n) => `f0000000-0000-0000-0000-0000000000${n}`;
export const MUSIC_BRIDGES = [
  { id: "f1000000-0000-0000-0000-000000000001", from: RHYTHM, to: F("01"), concept: "from time to pitch — the other axis of music" },
  { id: "f1000000-0000-0000-0000-000000000002", from: F("01"), to: F("02"), concept: "pitch needs notation to be written" },
  { id: "f1000000-0000-0000-0000-000000000003", from: F("02"), to: F("03"), concept: "notation carries rhythm as well as pitch" },
  { id: "f1000000-0000-0000-0000-000000000004", from: F("02"), to: F("04"), concept: "the staff organizes into scales & keys" },
  { id: "f1000000-0000-0000-0000-000000000005", from: F("04"), to: F("05"), concept: "major implies its relative minor & modes" },
  { id: "f1000000-0000-0000-0000-000000000006", from: F("04"), to: F("06"), concept: "scale distances are intervals" },
  { id: "f1000000-0000-0000-0000-000000000007", from: F("06"), to: F("07"), concept: "stacked intervals (thirds) make triads" },
  { id: "f1000000-0000-0000-0000-000000000008", from: F("07"), to: F("08"), concept: "a triad on each degree → diatonic harmony" },
  { id: "f1000000-0000-0000-0000-000000000009", from: F("08"), to: F("09"), concept: "diatonic chords in motion → progressions" },
  { id: "f1000000-0000-0000-0000-00000000000a", from: F("09"), to: F("0a"), concept: "extend triads to sevenths; add non-chord tones" },
  { id: "f1000000-0000-0000-0000-00000000000b", from: F("06"), to: F("0b"), concept: "intervals in sequence build melody" },
  { id: "f1000000-0000-0000-0000-00000000000c", from: F("09"), to: F("0c"), concept: "progressions must be voice-led smoothly" },
  { id: "f1000000-0000-0000-0000-00000000000d", from: F("0c"), to: F("0d"), concept: "voice-leading through a pivot → modulation" },
  { id: "f1000000-0000-0000-0000-00000000000e", from: F("0b"), to: F("0e"), concept: "phrases assemble into form" },
  { id: "f1000000-0000-0000-0000-00000000000f", from: F("0c"), to: F("0f"), concept: "independent voice-leading is counterpoint" },
];

// Canonical, free/official references (R-0027 shape).
export const MUSIC_RESOURCES = [
  { id: "f2000000-0000-0000-0000-000000000001", plateau: F("02"), title: "musictheory.net — Lessons (staff → chords)", kind: "Course", uri: "https://www.musictheory.net/lessons" },
  { id: "f2000000-0000-0000-0000-000000000002", plateau: F("08"), title: "Open Music Theory (2e)", kind: "Book", uri: "https://viva.pressbooks.pub/openmusictheory/" },
  { id: "f2000000-0000-0000-0000-000000000003", plateau: F("04"), title: "Khan Academy — Music (basics & notation)", kind: "Course", uri: "https://www.khanacademy.org/humanities/music" },
  { id: "f2000000-0000-0000-0000-000000000004", plateau: F("0f"), title: "Fux — Gradus ad Parnassum (species counterpoint)", kind: "Book", uri: "https://imslp.org/wiki/Gradus_ad_Parnassum_(Fux%2C_Johann_Joseph)" },
];

// The numbered curriculum path — pitch & notation → scales → harmony → form & counterpoint.
export const MUSIC_PATH = {
  id: "f3000000-0000-0000-0000-000000000001",
  title: "The Music Theory Core",
  goal: "Walk the standard theory sequence: pitch & notation → scales & keys → intervals & chords → harmony, melody, voice-leading → modulation, form, and counterpoint.",
  steps: [
    RHYTHM, // seed trailhead
    F("01"), F("02"), F("03"), F("04"), F("05"), F("06"), F("07"), F("08"),
    F("09"), F("0a"), F("0b"), F("0c"), F("0d"), F("0e"), F("0f"),
  ],
  domains: [MUSIC_DOMAIN],
};
