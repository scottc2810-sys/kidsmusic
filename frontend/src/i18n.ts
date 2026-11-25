import { langInfo, type Language } from "./languages";
import ar from "./locales/ar.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import zh from "./locales/zh.json";

// Translations work like gettext: English text is the key. Built-in languages (en, hi, hinglish)
// are written inline next to the English; every other language is one dictionary file in
// src/locales/<code>.json mapping the English sentence to its translation. Anything missing falls
// back to English, so a half-finished language pack never breaks a screen.
const DICT: Partial<Record<Language, Record<string, string>>> = { es, fr, zh, ar };

/** A string in several languages; `en` is required and is the key for dictionary languages. */
export type Text = { en: string } & Partial<Record<Language, string>>;

/** Pick the text for `lang`: inline translation, then the language's dictionary, then English. */
export const L = (text: Text, lang: Language): string => text[lang] || DICT[lang]?.[text.en] || text.en;
/** Translate a plain English string that came from the server (titles, labels). */
export const tr = (english: string, lang: Language): string => (lang === "en" ? english : DICT[lang]?.[english] || english);

// Child-facing UI strings. Parent area is English. Hindi avoids gendered first-person verbs.
const S = {
  start: { en: "Let's play!", hi: "चलो खेलें!", hinglish: "Chalo khelein!" },
  lesson: { en: "Music lesson", hi: "संगीत पाठ", hinglish: "Music lesson" },
  freePiano: { en: "Make a tune", hi: "धुन बनाओ", hinglish: "Dhun banao" },
  talk: { en: "Talk to Melo", hi: "मेलो से बात करो", hinglish: "Melo se baat karo" },
  tired: { en: "Rest", hi: "आराम", hinglish: "Aaraam" },
  tooHard: { en: "Too hard", hi: "बहुत मुश्किल", hinglish: "Bahut mushkil" },
  game: { en: "Game!", hi: "खेल!", hinglish: "Game!" },
  again: { en: "Hear again", hi: "फिर सुनो", hinglish: "Phir suno" },
  next: { en: "Next", hi: "आगे", hinglish: "Aage" },
  sound1: { en: "Sound 1", hi: "आवाज़ 1", hinglish: "Sound 1" },
  sound2: { en: "Sound 2", hi: "आवाज़ 2", hinglish: "Sound 2" },
  same: { en: "Same", hi: "एक जैसी", hinglish: "Same" },
  different: { en: "Different", hi: "अलग", hinglish: "Different" },
  yourTurn: { en: "Your turn!", hi: "तुम्हारी बारी!", hinglish: "Tumhari baari!" },
  listen: { en: "Listen…", hi: "सुनो…", hinglish: "Suno…" },
  tapHere: { en: "Tap the drum!", hi: "ढोल बजाओ!", hinglish: "Drum bajao!" },
  done: { en: "I'm done", hi: "हो गया", hinglish: "Ho gaya" },
  rest: { en: "Take a rest", hi: "आराम करो", hinglish: "Aaraam karo" },
  easyGame: { en: "Easy game", hi: "आसान खेल", hinglish: "Easy game" },
  useScreen: { en: "Use screen piano", hi: "स्क्रीन पियानो", hinglish: "Screen piano" },
  bye: { en: "Bye bye!", hi: "फिर मिलेंगे!", hinglish: "Bye bye!" },
  grownUps: { en: "Grown-ups", hi: "बड़ों के लिए", hinglish: "Grown-ups" },
  playYourSong: { en: "Listen to your song!", hi: "अपना गाना सुनो!", hinglish: "Apna gaana suno!" },
  handsSeen: { en: "I can see your hands", hi: "तुम्हारे हाथ दिख रहे हैं", hinglish: "Tumhare haath dikh rahe hain" },
  handsNotSeen: { en: "Show me your hands on the keys", hi: "कुंजियों पर हाथ दिखाओ", hinglish: "Keys par haath dikhao" },
  listening: { en: "Listening…", hi: "सुन रहे हैं…", hinglish: "Sun rahe hain…" },
  earsOn: { en: "Melo is listening to your keyboard", hi: "मेलो तुम्हारा कीबोर्ड सुन रहा है", hinglish: "Melo tumhara keyboard sun raha hai" },
  tryHigher: { en: "A little to the right", hi: "थोड़ा दाईं ओर", hinglish: "Thoda right side" },
  tryLower: { en: "A little to the left", hi: "थोड़ा बाईं ओर", hinglish: "Thoda left side" },
  spotPractice: { en: "Spot practice", hi: "छोटा अभ्यास", hinglish: "Spot practice" },
  oneMore: { en: "Lovely! One more time.", hi: "बहुत बढ़िया! एक बार और।", hinglish: "Bahut badhiya! Ek baar aur." },
  drillDone: { en: "That's it! Now the whole part again.", hi: "बस यही! अब पूरा हिस्सा फिर से।", hinglish: "Bas yahi! Ab poora part phir se." },
  nextStep: { en: "Next for you", hi: "तुम्हारा अगला कदम", hinglish: "Tumhara agla step" },
  myPath: { en: "My music path", hi: "मेरा संगीत रास्ता", hinglish: "Mera music path" },
  pathDone: { en: "You finished the whole path! Pick any song to play.", hi: "तुमने पूरा रास्ता पूरा किया! कोई भी गाना चुनो।", hinglish: "Tumne poora path complete kiya! Koi bhi gaana chuno." },
  level: { en: "Level", hi: "लेवल", hinglish: "Level" },
  languages: { en: "Languages", hi: "भाषाएँ", hinglish: "Languages" },
  pickLanguage: { en: "Which language shall we learn today?", hi: "आज कौन सी भाषा सीखें?", hinglish: "Aaj kaunsi language seekhein?" },
  skill_listen: { en: "Listen", hi: "सुनो", hinglish: "Suno" },
  skill_speak: { en: "Speak", hi: "बोलो", hinglish: "Bolo" },
  skill_read: { en: "Read", hi: "पढ़ो", hinglish: "Padho" },
  skill_write: { en: "Write", hi: "लिखो", hinglish: "Likho" },
  allSkills: { en: "Everything", hi: "सब कुछ", hinglish: "Sab kuch" },
  anotherOne: { en: "Another one", hi: "दूसरा वाला", hinglish: "Doosra wala" },
  sayIt: { en: "Tap the microphone and say it", hi: "माइक दबाओ और बोलो", hinglish: "Mic dabao aur bolo" },
  heardYou: { en: "I heard", hi: "हमने सुना", hinglish: "Maine suna" },
  wordsKnown: { en: "words", hi: "शब्द", hinglish: "words" },
  stage: { en: "Stage", hi: "स्टेज", hinglish: "Stage" },
  compare: { en: "Compare languages", hi: "भाषाएँ साथ-साथ", hinglish: "Languages saath-saath" },
  compareTitle: { en: "Side by side", hi: "साथ-साथ", hinglish: "Saath-saath" },
  compareIntro: { en: "Pick your languages. Hear, read, say and write the same words in each!", hi: "अपनी भाषाएँ चुनो। हर भाषा में एक ही बात सुनो, पढ़ो, बोलो और लिखो!", hinglish: "Apni languages chuno. Har language mein ek hi baat suno, padho, bolo aur likho!" },
  chooseLanguages: { en: "Choose languages", hi: "भाषाएँ चुनो", hinglish: "Languages chuno" },
  howMany: { en: "How many at once", hi: "एक साथ कितनी", hinglish: "Ek saath kitni" },
  allLanguages: { en: "All", hi: "सब", hinglish: "Sab" },
  showRoman: { en: "Show how to say it", hi: "उच्चारण दिखाओ", hinglish: "Pronunciation dikhao" },
  hideWords: { en: "Hide the words (test me)", hi: "शब्द छुपाओ (मेरी परीक्षा)", hinglish: "Words chhupao (mera test)" },
  showWord: { en: "Show the word", hi: "शब्द दिखाओ", hinglish: "Word dikhao" },
  hearAll: { en: "All", hi: "सब", hinglish: "Sab" },
  tryWriting: { en: "Write it", hi: "लिखो", hinglish: "Likho" },
  conversations: { en: "Conversations", hi: "बातचीत", hinglish: "Baatcheet" },
  words: { en: "Words", hi: "शब्द", hinglish: "Words" },
  helloName: { en: "Hi {name}!", hi: "नमस्ते {name}!", hinglish: "Hello {name}!" },
  canYouHear: { en: "Hello! Can you hear me?", hi: "नमस्ते! क्या आप मुझे सुन सकते हैं?", hinglish: "Hello! Kya aap mujhe sun sakte hain?" },
  send: { en: "Send", hi: "भेजो", hinglish: "Bhejo" },
  speak: { en: "Speak", hi: "बोलो", hinglish: "Bolo" },
  back: { en: "Back", hi: "वापस", hinglish: "Wapas" },
  songs: { en: "Learn a song", hi: "गाना सीखो", hinglish: "Gaana seekho" },
  pickSong: { en: "Which song shall we learn?", hi: "कौन सा गाना सीखें?", hinglish: "Kaunsa gaana seekhein?" },
  part: { en: "Part", hi: "हिस्सा", hinglish: "Part" },
  wholeSong: { en: "Play the whole song", hi: "पूरा गाना बजाओ", hinglish: "Poora gaana bajao" },
  wholeSongIntro: { en: "Now the whole song! Follow the glowing keys.", hi: "अब पूरा गाना! चमकती कुंजियों के साथ बजाओ।", hinglish: "Ab poora gaana! Chamakti keys follow karo." },
  learned: { en: "Learned!", hi: "सीख लिया!", hinglish: "Seekh liya!" },
  playAgain: { en: "Play again", hi: "फिर बजाओ", hinglish: "Phir bajao" },
  otherSong: { en: "Another song", hi: "दूसरा गाना", hinglish: "Doosra gaana" },
  slower: { en: "Slower", hi: "धीरे", hinglish: "Dheere" },
  howToPlay: { en: "Watch the shining key and press it. A long block means hold and count: one, two!", hi: "चमकती कुंजी देखो और दबाओ। लंबा डिब्बा मतलब रुको और गिनो: एक, दो!", hinglish: "Chamakti key dekho aur dabao. Lamba block matlab ruko aur gino: ek, do!" },
  howToBeat: { en: "Now with the beat! I'll count three, two, one, then press each key when it lights up.", hi: "अब ताल के साथ! हम तीन, दो, एक गिनेंगे, फिर हर कुंजी चमकते ही दबाओ।", hinglish: "Ab beat ke saath! Teen, do, ek ginenge, phir har key chamakte hi dabao." },
  waitForMe: { en: "Wait for me", hi: "मेरा इंतज़ार करो", hinglish: "Mera wait karo" },
  withBeat: { en: "With the beat", hi: "ताल के साथ", hinglish: "Beat ke saath" },
  go: { en: "Go!", hi: "चलो!", hinglish: "Chalo!" },
  composeTitle: { en: "Make your own tune!", hi: "अपनी धुन बनाओ!", hinglish: "Apni dhun banao!" },
  composeIntro: { en: "Let's make your own tune! Press any keys, one by one. Wait a little for a long note. Then press play to hear it!", hi: "चलो अपनी धुन बनाएँ! एक-एक करके कोई भी कुंजी दबाओ। लंबे सुर के लिए थोड़ा रुको। फिर सुनने के लिए प्ले दबाओ!", hinglish: "Chalo apni dhun banayein! Ek-ek karke koi bhi key dabao. Lambe note ke liye thoda ruko. Phir sunne ke liye play dabao!" },
  composeStep1: { en: "Press keys one at a time. Each key is a note.", hi: "एक-एक करके कुंजियाँ दबाओ। हर कुंजी एक सुर है।", hinglish: "Ek-ek karke keys dabao. Har key ek note hai." },
  composeStep2: { en: "Quick taps = short notes. Wait a little = a long note.", hi: "जल्दी दबाओ = छोटा सुर। थोड़ा रुको = लंबा सुर।", hinglish: "Jaldi dabao = chhota note. Thoda ruko = lamba note." },
  composeStep3: { en: "Press ▶ to hear your tune. Change it and try again!", hi: "अपनी धुन सुनने के लिए ▶ दबाओ। बदलो और फिर बजाओ!", hinglish: "Apni dhun sunne ke liye ▶ dabao. Badlo aur phir bajao!" },
  tryIdea: { en: "Try an idea:", hi: "यह आज़माओ:", hinglish: "Yeh try karo:" },
  ideaUp: { en: "Climb up", hi: "ऊपर चढ़ो", hinglish: "Upar chadho" },
  ideaDown: { en: "Slide down", hi: "नीचे फिसलो", hinglish: "Neeche phislo" },
  ideaJump: { en: "Frog jumps", hi: "मेंढक कूद", hinglish: "Mendhak jump" },
  ideaEcho: { en: "Long and short", hi: "लंबा और छोटा", hinglish: "Lamba aur chhota" },
  followIdea: { en: "Now you! Press the shining keys.", hi: "अब तुम! चमकती कुंजियाँ दबाओ।", hinglish: "Ab tum! Chamakti keys dabao." },
  ideaDone: { en: "Lovely! Now change it into your own tune.", hi: "बहुत बढ़िया! अब इसे अपनी धुन में बदलो।", hinglish: "Bahut badhiya! Ab ise apni dhun mein badlo." },
  yourTune: { en: "Your tune", hi: "तुम्हारी धुन", hinglish: "Tumhari dhun" },
  playMine: { en: "Play my tune", hi: "मेरी धुन बजाओ", hinglish: "Meri dhun bajao" },
  clear: { en: "Start again", hi: "फिर से शुरू", hinglish: "Phir se shuru" },
  remember: { en: "Do you remember this part? Play it! Press Help me if you need me.", hi: "क्या यह हिस्सा याद है? बजाओ! ज़रूरत हो तो 'मदद करो' दबाओ।", hinglish: "Yeh part yaad hai? Bajao! Zaroorat ho toh Help me dabao." },
  fromMemory: { en: "You know this one! Play it from memory.", hi: "यह तो तुम्हें आता है! याद से बजाओ।", hinglish: "Yeh toh tumhe aata hai! Yaad se bajao." },
  wholeFromMemory: { en: "Can you play the whole song from memory? Go!", hi: "क्या पूरा गाना याद से बजा सकते हो? चलो!", hinglish: "Kya poora gaana yaad se baja sakte ho? Chalo!" },
  helpMe: { en: "Help me", hi: "मदद करो", hinglish: "Help me" },
  hearIt: { en: "Hear it", hi: "सुनाओ", hinglish: "Sunao" },
  helpFull: { en: "Full help", hi: "पूरी मदद", hinglish: "Full help" },
  helpGuided: { en: "Some help", hi: "थोड़ी मदद", hinglish: "Thodi help" },
  helpLight: { en: "Little help", hi: "बहुत कम मदद", hinglish: "Kam help" },
  helpMemory: { en: "From memory", hi: "याद से", hinglish: "Yaad se" },
  hearWhole: { en: "Hear the whole song", hi: "पूरा गाना सुनो", hinglish: "Poora gaana suno" },
  wholeFirst: { en: "First, let's listen to the whole song!", hi: "पहले पूरा गाना सुनते हैं!", hinglish: "Pehle poora gaana sunte hain!" },
  nowParts: { en: "Now let's learn it, one part at a time!", hi: "अब इसे एक-एक हिस्सा करके सीखते हैं!", hinglish: "Ab ise ek-ek part karke seekhte hain!" },
  stop: { en: "Stop", hi: "रुको", hinglish: "Stop" },
  basics: { en: "Music basics", hi: "संगीत की बातें", hinglish: "Music basics" },
  learn: { en: "Learn", hi: "सीखो", hinglish: "Seekho" },
  practice: { en: "Practice", hi: "अभ्यास", hinglish: "Practice" },
  loading: { en: "Melo is getting ready…", hi: "मेलो तैयार हो रहा है…", hinglish: "Melo ready ho raha hai…" },
  oneByOne: { en: "One by one", hi: "एक-एक करके", hinglish: "Ek-ek karke" },
  why: { en: "Why?", hi: "क्यों?", hinglish: "Kyun?" },
  hearNote: { en: "Hear this note", hi: "यह सुर सुनो", hinglish: "Yeh note suno" },
  stepPress: { en: "Press the shining key", hi: "चमकती कुंजी दबाओ", hinglish: "Chamakti key dabao" },
  stepYes: { en: "Yes! That's it!", hi: "हाँ! बिल्कुल सही!", hinglish: "Haan! Bilkul sahi!" },
  stepTogether: { en: "You know every note! Now let's play them all together, nice and slow.", hi: "तुम्हें हर सुर आता है! अब सब एक साथ, आराम से धीरे-धीरे बजाते हैं।", hinglish: "Tumhe har note aata hai! Ab sab ek saath, aaraam se dheere-dheere bajate hain." },
  stepIntro: { en: "Let's learn this part one note at a time. I'll tell you why each key, then you press it, then tap Next.", hi: "चलो यह हिस्सा एक-एक सुर करके सीखते हैं। हम बताएँगे हर कुंजी क्यों, तुम दबाओ, फिर आगे दबाओ।", hinglish: "Chalo yeh part ek-ek note karke seekhte hain. Main bataunga har key kyun, tum dabao, phir Next dabao." },
  howMusic: { en: "How music is made", hi: "संगीत कैसे बनता है", hinglish: "Music kaise banta hai" },
  tryIt: { en: "Try it", hi: "आज़माओ", hinglish: "Try karo" },
  letsGo: { en: "Let's start!", hi: "चलो शुरू करें!", hinglish: "Chalo shuru karein!" },
  buildSong: { en: "Make a song with Melo", hi: "मेलो के साथ गाना बनाओ", hinglish: "Melo ke saath gaana banao" },
  freeKeys: { en: "Play freely", hi: "खुलकर बजाओ", hinglish: "Khul ke bajao" },
  stepUp: { en: "Step up", hi: "एक सीढ़ी ऊपर", hinglish: "Ek step upar" },
  stepDown: { en: "Step down", hi: "एक सीढ़ी नीचे", hinglish: "Ek step neeche" },
  sameAgain: { en: "Same again", hi: "वही फिर से", hinglish: "Wahi phir se" },
  jumpUp: { en: "Jump up", hi: "ऊपर छलाँग", hinglish: "Upar chhalaang" },
  jumpDown: { en: "Jump down", hi: "नीचे छलाँग", hinglish: "Neeche chhalaang" },
  goHome: { en: "Go home & finish", hi: "घर जाओ और ख़त्म", hinglish: "Ghar jao aur khatam" },
  shortNote: { en: "Short", hi: "छोटा", hinglish: "Chhota" },
  longNote: { en: "Long", hi: "लंबा", hinglish: "Lamba" },
  pickMove: { en: "Where should the tune go next?", hi: "धुन आगे कहाँ जाए?", hinglish: "Dhun aage kahan jaaye?" },
  pickLength: { en: "Short sound or long sound?", hi: "छोटी आवाज़ या लंबी?", hinglish: "Chhoti awaaz ya lambi?" },
  newSong: { en: "Make another", hi: "एक और बनाओ", hinglish: "Ek aur banao" },
} satisfies Record<string, Text>;

export type StrKey = keyof typeof S;
export const t = (key: StrKey, lang: Language) => L(S[key], lang);

const TOPIC_TITLE: Record<string, Text> = {
  words: { en: "Words", hi: "शब्द", hinglish: "Words" },
  greetings: { en: "Greetings", hi: "नमस्ते-अभिवादन", hinglish: "Greetings" },
  meeting: { en: "Meeting someone", hi: "किसी से मिलना", hinglish: "Kisi se milna" },
  polite: { en: "Polite words", hi: "विनम्र शब्द", hinglish: "Polite words" },
  directions: { en: "Directions", hi: "रास्ता बताना", hinglish: "Raasta" },
  food: { en: "Food and drink", hi: "खाना-पीना", hinglish: "Khaana-peena" },
  help: { en: "Asking for help", hi: "मदद माँगना", hinglish: "Madad maangna" },
  market: { en: "At the market", hi: "बाज़ार में", hinglish: "Bazaar mein" },
  school: { en: "At school", hi: "स्कूल में", hinglish: "School mein" },
  friends: { en: "Playing with friends", hi: "दोस्तों के साथ खेलना", hinglish: "Doston ke saath khelna" },
  feelings: { en: "Feelings and caring", hi: "भावनाएँ और देखभाल", hinglish: "Bhaavnaayein aur dekhbhaal" },
  home: { en: "At home", hi: "घर पर", hinglish: "Ghar par" },
  travel: { en: "Getting around", hi: "आना-जाना", hinglish: "Aana-jaana" },
  doctor: { en: "At the doctor", hi: "डॉक्टर के पास", hinglish: "Doctor ke paas" },
  celebrate: { en: "Celebrations", hi: "उत्सव और जश्न", hinglish: "Utsav aur jashn" },
  weather: { en: "Time and weather", hi: "समय और मौसम", hinglish: "Samay aur mausam" },
};
/** Conversation topic title in the child's language. */
export const topicTitle = (id: string, english: string, lang: Language) => (TOPIC_TITLE[id] ? L(TOPIC_TITLE[id], lang) : tr(english, lang));
/** Every English UI string, for the translation template (scripts/i18n-extract). */
export const UI_STRINGS = Object.values(S).map((x) => x.en);

export const TIMBRE_LABEL: Record<string, Text> = {
  piano: { en: "Piano", hi: "पियानो", hinglish: "Piano" },
  flute: { en: "Flute", hi: "बाँसुरी", hinglish: "Bansuri" },
  drum: { en: "Drum", hi: "ढोल", hinglish: "Dhol" },
  bell: { en: "Bell", hi: "घंटी", hinglish: "Ghanti" },
  guitar: { en: "Guitar", hi: "गिटार", hinglish: "Guitar" },
  harmonium: { en: "Harmonium", hi: "हारमोनियम", hinglish: "Harmonium" },
  violin: { en: "Violin", hi: "वायलिन", hinglish: "Violin" },
  sitar: { en: "Sitar", hi: "सितार", hinglish: "Sitar" },
  santoor: { en: "Santoor", hi: "संतूर", hinglish: "Santoor" },
  xylophone: { en: "Xylophone", hi: "ज़ाइलोफ़ोन", hinglish: "Xylophone" },
  kalimba: { en: "Kalimba", hi: "कलिम्बा", hinglish: "Kalimba" },
  tabla: { en: "Tabla", hi: "तबला", hinglish: "Tabla" },
};
export const TIMBRE_ICON: Record<string, string> = {
  piano: "🎹", flute: "🎶", drum: "🥁", bell: "🔔", guitar: "🎸", harmonium: "🪗",
  violin: "🎻", sitar: "🪕", santoor: "🎼", xylophone: "🌈", kalimba: "🎐", tabla: "🪘",
};

const WESTERN = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SARGAM_LATIN = ["Sa", "re", "Re", "ga", "Ga", "Ma", "ma", "Pa", "dha", "Dha", "ni", "Ni"];
const SARGAM_DEV = ["सा", "रे॒", "रे", "ग॒", "ग", "म", "म॑", "प", "ध॒", "ध", "नि॒", "नि"];
const SOLFEGE = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
const SOLFEGE_AR = ["دو", "دو♯", "ري", "ري♯", "مي", "فا", "فا♯", "صول", "صول♯", "لا", "لا♯", "سي"];
const pc = (midi: number) => ((midi % 12) + 12) % 12;

/** Note names chosen by the parent on this device ("auto" = the child's language decides). */
export type NoteNames = "auto" | "letters" | "sargam" | "solfege";
let noteNames: NoteNames = (() => { try { return (localStorage.getItem("melo.noteNames") as NoteNames) || "auto"; } catch { return "auto"; } })();
export const getNoteNames = () => noteNames;
export function setNoteNames(n: NoteNames) { noteNames = n; try { localStorage.setItem("melo.noteNames", n); } catch { /* private mode */ } }

/** Key label in the language's note names: C D E, Sa Re Ga (C = Sa) or Do Re Mi (C = Do). */
export function noteLabel(midi: number, lang: Language): string {
  const system = noteNames === "auto" ? langInfo(lang).notes : noteNames;
  if (system === "sargam") return (lang === "hi" ? SARGAM_DEV : SARGAM_LATIN)[pc(midi)];
  if (system === "solfege") return (lang === "ar" ? SOLFEGE_AR : SOLFEGE)[pc(midi)];
  return WESTERN[pc(midi)];
}

const SUNG_SARGAM = ["Sa", "Re", "Re", "Ga", "Ga", "Ma", "Ma", "Pa", "Dha", "Dha", "Ni", "Ni"];
const SUNG_SOLFEGE = ["Do", "Do", "Re", "Re", "Mi", "Fa", "Fa", "Sol", "Sol", "La", "La", "Si"];
/** The syllable Melo sings on a note (when singing is turned on): the note's name, or "La". */
export function sungName(midi: number, lang: Language): string {
  const system = langInfo(lang).notes;
  return system === "sargam" ? SUNG_SARGAM[pc(midi)] : system === "solfege" ? SUNG_SOLFEGE[pc(midi)] : "La";
}

export const SKILL_LABEL: Record<string, string> = {
  pitch: "High & low (pitch)", dynamics: "Loud & soft", timbre: "Instrument sounds", rhythm: "Rhythm", melody: "Melodies", creativity: "Creating music",
};
export const ACTIVITY_LABEL: Record<string, string> = {
  high_low: "High or low?", loud_soft: "Loud or soft?", instrument_guess: "Guess the instrument", rhythm_tap: "Tap the rhythm",
  find_note: "Find the note", fast_slow: "Fast or slow?", same_different: "Same or different?", echo_melody: "Echo the tune", play_song: "Play a song", free_play: "Make your own music",
};
