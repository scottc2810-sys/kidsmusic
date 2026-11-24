// Meet the four Vedas, one at a time. Each Veda is a character with one hand action, so even a 3-year-old can
// remember the family by doing it: RIG recites 🔥 (palms together), SAMA sings 🎵 (hand cupped at the mouth),
// YAJUR does 🙌 (hands pouring), ATHARVA heals 🌿 (hand on the heart). Every Veda has: what it is, what is
// inside, one story or famous line, a "stick point" (a short line to remember for life) and what it means for
// the child's own day. Presented as India's literature and knowledge, with the usual scholarly figures
// (Rig Veda: 10 books, 1,028 hymns; Sama Veda: about 1,875 verses, nearly all from the Rig Veda; Atharva Veda:
// 20 books, about 730 hymns).
import type { Text } from "../i18n";
import { pick, shuffle, T, type Card, type Exercise, type Rng } from "./maths";
import type { VedaTopic } from "./vedas";

const D = (name: string): Card["visual"] => ({ type: "diagram", name, show: "names" });
const C = (title: Text, say: Text, visual?: Card["visual"]): Card => ({ title, say, ...(visual ? { visual } : {}) });
type Q = [string, string, string[], string, boolean?]; // prompt, answer, other choices, why, real-life?
const ask = (rng: Rng, pool: Q[], visual?: Exercise["visual"]): Exercise => {
  const [p, a, o, why, apply] = pick(rng, pool);
  return { prompt: T(p), visual, choices: shuffle(rng, [a, ...o]), answer: a, why: T(why), apply: !!apply };
};

/** The whole family first: four friends, four actions, one song. */
export const vedaFamily: VedaTopic = {
  id: "four_vedas", strand: "four", icon: "📜", title: T("The Veda family: meet all four", "वेद परिवार: चारों से मिलो", "Ved parivaar: chaaron se milo"), grades: [0, 5],
  cards: [
    C(T("'Veda' means knowledge", "'वेद' का अर्थ है ज्ञान", "'Ved' ka matlab hai gyaan"),
      T("'Veda' comes from 'vid', TO KNOW: Veda means KNOWLEDGE. The Vedas are among the oldest books in the world. For thousands of years there was no paper: they were LEARNED BY HEART, TEACHER TO STUDENT, so carefully that not one sound changed. There are FOUR Vedas, like four friends in one family.",
        "'वेद' 'विद्' से बना है, यानी जानना: वेद का अर्थ है ज्ञान। वेद दुनिया की सबसे पुरानी किताबों में हैं। हज़ारों साल तक कागज़ नहीं था: गुरु से शिष्य तक याद करके पहुँचे, इतनी सावधानी से कि एक भी ध्वनि नहीं बदली। वेद चार हैं, एक परिवार के चार दोस्तों जैसे।",
        "'Ved' 'vid' se bana hai, yaani jaanna: Ved ka matlab hai GYAAN. Ved duniya ki sabse puraani kitaabon mein hain. Hazaaron saal tak kaagaz nahi tha: guru se shishya tak yaad karke pahunche, itni saavdhaani se ki ek bhi awaaz nahi badli. Ved chaar hain, ek parivaar ke chaar dost jaise."), D("veda_family")),
    C(T("Do the Veda actions!", "वेद वाले इशारे करो!", "Ved wale ishaare karo!"),
      T("Stand up and do them with me. RIG RECITES: put your palms together 🙏 (Rig is the poem-saying Veda, the oldest). SAMA SINGS: cup your hand at your mouth 🎵 (Sama sings the same words as a song). YAJUR DOES: pretend to pour into a fire 🙌 (Yajur tells how to DO things, step by step). ATHARVA HEALS: hand on your heart 🌿 (Atharva is about health, home and the Earth). Rig, Sama, Yajur, Atharva: recite, sing, do, heal!",
        "खड़े हो जाओ और मेरे साथ करो। ऋग बोलता है: हाथ जोड़ो 🙏 (ऋग्वेद मंत्र-कविताओं वाला, सबसे पुराना)। साम गाता है: मुँह के पास हाथ 🎵 (साम वही शब्द गाकर)। यजुर करता है: अग्नि में डालने का इशारा 🙌 (यजुर बताता है काम कैसे करें, क़दम-दर-क़दम)। अथर्व ठीक करता है: दिल पर हाथ 🌿 (अथर्ववेद: स्वास्थ्य, घर, धरती)। ऋग, साम, यजुर, अथर्व: बोलो, गाओ, करो, सँभालो!",
        "Khade ho jao aur mere saath karo. RIG BOLTA hai: haath jodo 🙏 (Rigved mantra-kavitaon wala, sabse puraana). SAMA GAATA hai: munh ke paas haath 🎵 (Sama wahi shabd gaa ke). YAJUR KARTA hai: agni mein daalne ka ishaara 🙌 (Yajur batata hai kaam kaise karein, step by step). ATHARVA THEEK KARTA hai: dil pe haath 🌿 (Atharvaved: health, ghar, dharti). Rig, Sama, Yajur, Atharva: bolo, gaao, karo, sambhaalo!"), D("veda_family")),
    C(T("Upanishads: the big questions", "उपनिषद: बड़े सवाल", "Upanishad: bade sawaal"),
      T("At the end of the Vedas come the UPANISHADS. They ask the biggest questions: 'Who am I?', 'What is true?', 'What happens to us?'. 'Upa-ni-shad' means sitting down near the teacher to learn. Six VEDANGAS help study the Vedas, like helpers: SHIKSHA (saying sounds correctly), Vyakarana (grammar), Chandas (rhythm), Nirukta (meanings), Jyotisha (sky and maths) and Kalpa (how to do things properly).",
        "वेदों के अंत में उपनिषद हैं। वे सबसे बड़े सवाल पूछते हैं: 'मैं कौन हूँ?', 'सच क्या है?'। 'उप-नि-षद्' यानी गुरु के पास बैठकर सीखना। छह वेदांग मदद करते हैं: शिक्षा (सही उच्चारण), व्याकरण, छंद, निरुक्त (अर्थ), ज्योतिष (आकाश और गणित), कल्प (सही विधि)।",
        "Vedon ke ant mein UPANISHAD hain. Woh sabse bade sawaal poochhte hain: 'Main kaun hoon?', 'Sach kya hai?'. 'Upa-ni-shad' yaani guru ke paas baith ke seekhna. Chhe VEDANG madad karte hain: SHIKSHA (sahi uchchaaran), Vyakaran, Chhand, Nirukt (arth), Jyotish (aakaash aur ganit), Kalp (sahi vidhi).")),
  ],
  make: (d, rng) => ask(rng, [
    ["What does the word 'Veda' mean?", "knowledge", ["story", "song"], "Veda comes from 'vid', to know: Veda means knowledge."],
    ["How many Vedas are there?", "four", ["two", "seven"], "Rig, Sama, Yajur and Atharva: four Vedas, four friends."],
    ["Which Veda do we show with palms together, because it RECITES?", "Rig Veda", ["Sama Veda", "Atharva Veda"], "Rig recites 🙏: it is the Veda of hymns and praise, and the oldest."],
    ["Which Veda do we show with a hand at the mouth, because it SINGS?", "Sama Veda", ["Yajur Veda", "Rig Veda"], "Sama sings 🎵: it sets the Rig Veda's words to melody."],
    ["Which Veda do we show by pretending to pour, because it DOES?", "Yajur Veda", ["Sama Veda", "Atharva Veda"], "Yajur does 🙌: it gives the words and steps for doing things, like a yajña."],
    ["Which Veda do we show with a hand on the heart, because it HEALS?", "Atharva Veda", ["Rig Veda", "Yajur Veda"], "Atharva heals 🌿: health, home, herbs and the Earth."],
    ...(d >= 2 ? [
      ["How were the Vedas kept safe for thousands of years before books?", "learned by heart, teacher to student", ["carved in stone", "painted on walls"], "Students memorised them perfectly with special ways of repeating, so not one sound changed."],
      ["What do the Upanishads ask about?", "big questions like 'Who am I?'", ["how to cook rice", "the rules of cricket"], "The Upanishads come at the end of the Vedas and ask the deepest questions."],
      ["Which Vedanga is about saying sounds correctly?", "Shiksha", ["Jyotisha", "Kalpa"], "Shiksha teaches how each sound is made: in the throat, palate, teeth or lips."],
    ] as Q[] : []),
  ], D("veda_family")),
};

export const rigVeda: VedaTopic = {
  id: "rig_veda", strand: "four", icon: "🔥", title: T("Rig Veda: the Veda that recites", "ऋग्वेद: स्तुति का वेद", "Rigved: stuti ka Ved"), grades: [0, 5],
  cards: [
    C(T("Rig recites 🙏", "ऋग बोलता है 🙏", "Rig bolta hai 🙏"),
      T("The RIG VEDA is the OLDEST of the four Vedas. 'Rik' means a verse of praise. It is a big book of poems, called hymns: 10 books (mandalas) with 1,028 hymns! People sang them to say THANK YOU to the Sun, the dawn, fire, rain, wind and rivers, everything that keeps us alive.",
        "ऋग्वेद चारों वेदों में सबसे पुराना है। 'ऋक्' यानी स्तुति का मंत्र। यह कविताओं (सूक्तों) की बड़ी किताब है: 10 मंडल, 1,028 सूक्त! लोग इन्हें सूरज, उषा, अग्नि, बारिश, हवा और नदियों को धन्यवाद कहने के लिए गाते थे।",
        "RIGVED chaaron Vedon mein SABSE PURAANA hai. 'Rik' yaani stuti ka mantra. Yeh kavitaon (sookton) ki badi kitaab hai: 10 mandal, 1,028 sookt! Log inhe suraj, usha, agni, baarish, hawa aur nadiyon ko THANK YOU kehne ke liye gaate the."), D("veda_rig")),
    C(T("Stick point: it starts with FIRE 🔥", "याद रखो: शुरुआत अग्नि से 🔥", "Yaad rakho: shuruaat AGNI se 🔥"),
      T("The very first word of the Rig Veda is AGNI, fire: 'agnim īḷe', I praise the fire. Fire gave light, warmth and cooked food. So remember: the OLDEST Veda starts with FIRE. The famous GĀYATRĪ MANTRA, asking the Sun to light up our minds, is also in the Rig Veda.",
        "ऋग्वेद का पहला शब्द है अग्नि: 'अग्निमीळे', मैं अग्नि की स्तुति करता हूँ। आग ने रोशनी, गर्मी और पका खाना दिया। तो याद रखो: सबसे पुराना वेद अग्नि से शुरू होता है। प्रसिद्ध गायत्री मंत्र भी ऋग्वेद में है।",
        "Rigved ka sabse pehla shabd hai AGNI, aag: 'agnim eele', main agni ki stuti karta hoon. Aag ne roshni, garmi aur paka khaana diya. To yaad rakho: sabse puraana Ved AGNI se shuru hota hai. Mashhoor GAYATRI MANTRA bhi Rigved mein hai."), D("veda_rig")),
    C(T("The question hymn: be curious!", "सवालों वाला सूक्त: जिज्ञासु बनो!", "Sawaalon wala sookt: curious bano!"),
      T("One Rig Veda hymn, the NĀSADĪYA SŪKTA, wonders how the whole world began, and ends: 'Who really knows? Maybe even the one who sees from the highest sky does not know.' Thousands of years ago, the Rig Veda was brave enough to ASK. Big questions are good: scientists ask them too!",
        "ऋग्वेद का नासदीय सूक्त सोचता है कि दुनिया कैसे शुरू हुई, और अंत में कहता है: 'कौन सच में जानता है? शायद सबसे ऊँचे आकाश से देखने वाला भी नहीं जानता।' हज़ारों साल पहले ऋग्वेद ने पूछने की हिम्मत की। बड़े सवाल अच्छे हैं: वैज्ञानिक भी पूछते हैं!",
        "Rigved ka NASADIYA SOOKT sochta hai ki duniya kaise shuru hui, aur ant mein kehta hai: 'Kaun sach mein jaanta hai? Shaayad sabse oonche aakaash se dekhne wala bhi nahi jaanta.' Hazaaron saal pehle Rigved ne POOCHHNE ki himmat ki. Bade sawaal achhe hain: scientist bhi poochhte hain!")),
    C(T("Rig Veda in your day", "तुम्हारे दिन में ऋग्वेद", "Tumhare din mein Rigved"),
      T("Be like the Rig Veda: 1. Say THANK YOU for the sun, the rain, your food and the people who grow it: eating a mango? THANK THE FARMER, THE SUN AND THE RAIN. 2. ASK big questions and look for answers. 3. Work as a TEAM: 'saṃ gacchadhvam', walk together, speak together, is a Rig Veda line too.",
        "ऋग्वेद जैसे बनो: 1. सूरज, बारिश, खाने और उसे उगाने वालों को धन्यवाद कहो। 2. बड़े सवाल पूछो और जवाब खोजो। 3. मिलकर काम करो: 'संगच्छध्वम्', साथ चलो, साथ बोलो, यह भी ऋग्वेद की पंक्ति है।",
        "Rigved jaise bano: 1. Suraj, baarish, khaane aur use ugaane walon ko THANK YOU kaho. 2. BADE SAWAAL poochho aur jawaab dhoondo. 3. TEAM mein kaam karo: 'sam gachchhadhvam', saath chalo, saath bolo, yeh bhi Rigved ki line hai.")),
  ],
  make: (d, rng) => ask(rng, [
    ["Which is the oldest of the four Vedas?", "Rig Veda", ["Sama Veda", "Atharva Veda"], "The Rig Veda is the oldest; the other Vedas use many of its verses."],
    ["What is the very first word of the Rig Veda?", "Agni (fire)", ["Surya (sun)", "Jala (water)"], "'agnim īḷe': I praise the fire. The oldest Veda starts with fire."],
    ["What is the Rig Veda mostly made of?", "hymns: poems of praise", ["stories of kings", "maps"], "'Rik' means a verse of praise: 1,028 hymns in 10 books."],
    ["Why did people sing the Rig Veda hymns to the Sun, rain and rivers?", "to say thank you for what keeps us alive", ["to make them go away", "to win a prize"], "The hymns are full of gratitude for nature."],
    ["Which famous mantra about the Sun lighting up our minds is in the Rig Veda?", "Gāyatrī mantra", ["Bhūmi Sūkta", "Isha Upanishad"], "The Gāyatrī mantra is Rig Veda 3.62.10."],
    ...(d >= 2 ? [
      ["The Nāsadīya hymn asks how the world began and ends with 'Who really knows?'. What does it teach you?", "it's good to ask big questions", ["never ask questions", "only grown-ups can wonder"], "Curiosity is old and wise: the Rig Veda asked, and scientists still ask.", true],
      ["You enjoy a mango from the market. How can you be like the Rig Veda?", "thank the farmer, the sun and the rain", ["eat it fast", "complain it's small"], "The Rig Veda's hymns are thank-yous to everything that feeds us.", true],
      ["How many books (mandalas) does the Rig Veda have?", "10", ["4", "100"], "10 mandalas, with 1,028 hymns in all."],
      ["Your team can't agree on a game. Which Rig Veda line helps?", "'saṃ gacchadhvam': walk together, speak together", ["'agnim īḷe': I praise the fire", "'Veda means knowledge'"], "Rig Veda 10.191: listen to each other and decide together.", true],
    ] as Q[] : []),
  ], D("veda_rig")),
};

export const samaVeda: VedaTopic = {
  id: "sama_veda", strand: "four", icon: "🎵", title: T("Sama Veda: the Veda that sings", "सामवेद: गायन का वेद", "Samaved: gaayan ka Ved"), grades: [0, 5],
  cards: [
    C(T("Sama sings 🎵", "साम गाता है 🎵", "Sama gaata hai 🎵"),
      T("'Sāman' means a MELODY, a song. The SAMA VEDA takes verses from the Rig Veda and SINGS them: about 1,875 verses, and nearly all come from the Rig Veda. Stick point: SAMA sings the SAME words, now as a SONG. Special singers called udgātṛs sang them slowly, rising and falling on a few notes.",
        "'साम' का अर्थ है गीत, धुन। सामवेद ऋग्वेद के मंत्रों को गाता है: लगभग 1,875 मंत्र, लगभग सारे ऋग्वेद से। याद रखो: साम वही शब्द गाकर कहता है। उद्गाता नाम के गायक इन्हें धीरे-धीरे, कुछ स्वरों पर ऊपर-नीचे गाते थे।",
        "'Saam' ka matlab hai GEET, dhun. SAMAVED Rigved ke mantron ko GAATA hai: lagbhag 1,875 mantra, lagbhag saare Rigved se. Yaad rakho: SAMA wahi (SAME) shabd GAA KE kehta hai. Udgaata naam ke gaayak inhe dheere-dheere, kuch swaron pe upar-neeche gaate the."), D("veda_sama")),
    C(T("The seed of Indian music", "भारतीय संगीत का बीज", "Indian music ka beej"),
      T("Over hundreds of years, the few notes of Sama chanting grew into the SEVEN SWARAS: Sa Re Ga Ma Pa Dha Ni. Every time you play Sa Re Ga on your instrument, you are joining a song more than 3,000 years old! That's why music is called a gift of the Sama Veda.",
        "सैकड़ों सालों में साम-गान के कुछ स्वर सात स्वर बन गए: सा रे ग म प ध नि। जब भी तुम अपने वाद्य पर सा रे ग बजाते हो, तुम 3,000 साल से पुराने गीत में शामिल होते हो!",
        "Saikdon saalon mein Sama-gaan ke kuch swar SAAT SWAR ban gaye: Sa Re Ga Ma Pa Dha Ni. Jab bhi tum apne instrument pe Sa Re Ga bajaate ho, tum 3,000 saal se puraane geet mein shaamil hote ho!")),
    C(T("'Tat tvam asi': you are part of it all", "'तत् त्वम् असि'", "'Tat tvam asi': tum sab ka hissa ho"),
      T("The CHĀNDOGYA UPANISHAD belongs to the Sama Veda. In it, a father teaches his son Śvetaketu with salt in water: the salt disappears, but every sip tastes salty. 'Tat tvam asi': YOU ARE THAT. You are connected to everything, like the salt in all the water. So be kind: hurting others is like hurting yourself.",
        "छांदोग्य उपनिषद सामवेद का है। उसमें एक पिता अपने बेटे श्वेतकेतु को पानी में नमक से सिखाते हैं: नमक दिखता नहीं, पर हर घूँट नमकीन है। 'तत् त्वम् असि': तुम वही हो। तुम सबसे जुड़े हो।",
        "CHHANDOGYA UPANISHAD Samaved ka hai. Usmein ek pita apne bete Shvetaketu ko paani mein namak se sikhaate hain: namak dikhta nahi, par har ghoont namkeen hai. 'Tat tvam asi': TUM WAHI HO. Tum sab se jude ho, jaise namak saare paani mein. Isliye dayalu bano.")),
    C(T("Sama Veda in your day", "तुम्हारे दिन में सामवेद", "Tumhare din mein Samaved"),
      T("Be like the Sama Veda: 1. Practise SLOWLY and carefully: every note, every sound matters. 2. When someone is upset, like a little brother at bedtime, SING OR HUM HIM A SOFT SONG: music calms the mind. 3. Learn a song by heart, the way the Vedas were learned: listen, repeat, a little every day.",
        "सामवेद जैसे बनो: 1. धीरे और ध्यान से अभ्यास करो: हर स्वर मायने रखता है। 2. परेशान हो तो धीरे-धीरे गुनगुनाओ: संगीत मन शांत करता है। 3. एक गीत याद करो: सुनो, दोहराओ, रोज़ थोड़ा।",
        "Samaved jaise bano: 1. DHEERE aur dhyaan se practice karo: har swar maayne rakhta hai. 2. Pareshaan ho to dheere-dheere gungunaao: music mann shaant karta hai. 3. Ek geet yaad karo: suno, dohraao, roz thoda.")),
  ],
  make: (d, rng) => ask(rng, [
    ["What does 'sāman' mean?", "a melody, a song", ["a fire", "a river"], "Sāman means melody: the Sama Veda is the Veda of songs."],
    ["Where do nearly all the Sama Veda's verses come from?", "the Rig Veda", ["the Atharva Veda", "a newspaper"], "Sama sings the SAME words as the Rig Veda, as songs."],
    ["Which notes grew out of Sama Veda singing?", "Sa Re Ga Ma Pa Dha Ni", ["A B C D E F G", "1 2 3 4 5 6 7"], "Over centuries the Sama chant's notes became the seven swaras."],
    ["How many swaras are there from Sa to Ni?", "7", ["5", "12"], "Sa Re Ga Ma Pa Dha Ni: seven, then Sa again, higher."],
    ...(d >= 2 ? [
      ["A father showed his son salt in water to teach 'tat tvam asi'. What does it mean?", "you are connected to everything", ["salt is bad for you", "water is sweet"], "Like salt in all the water, you are part of everything: Chāndogya Upanishad, Sama Veda."],
      ["You can't get a song right on your keyboard. What would the Sama Veda way be?", "play it slowly, note by note, every day", ["give up", "play it faster"], "Sama singers practised every sound with care, until it was exact.", true],
      ["Your little brother is upset at bedtime. What Sama Veda gift could help?", "sing or hum him a soft song", ["shout at him", "turn on loud music"], "Gentle music calms the mind: that's why lullabies work.", true],
      ["What were the special Sama Veda singers called?", "udgātṛs", ["doctors", "kings"], "The udgātṛ priests sang the Sama chants."],
    ] as Q[] : []),
  ], D("veda_sama")),
};

export const yajurVeda: VedaTopic = {
  id: "yajur_veda", strand: "four", icon: "🙌", title: T("Yajur Veda: the Veda that does", "यजुर्वेद: कर्म का वेद", "Yajurved: karm ka Ved"), grades: [0, 5],
  cards: [
    C(T("Yajur does 🙌", "यजुर करता है 🙌", "Yajur karta hai 🙌"),
      T("'Yajus' means the words said while DOING a yajña, a fire ceremony. The YAJUR VEDA is like a careful guidebook: what to do first, next and last, and what to say at each step. Stick point: YAJUR = 'Yes, let's DO it, step by step!' It has two parts: the ŚUKLA (white) and the KṚṢṆA (black) Yajur Veda.",
        "'यजुस्' यानी यज्ञ करते समय बोले जाने वाले शब्द। यजुर्वेद एक ध्यान से बनी गाइडबुक जैसा है: पहले क्या, फिर क्या, आख़िर में क्या, और हर क़दम पर क्या बोलें। याद रखो: यजुर = 'हाँ, करते हैं, क़दम-दर-क़दम!' इसके दो भाग हैं: शुक्ल (सफ़ेद) और कृष्ण (काला) यजुर्वेद।",
        "'Yajus' yaani yagya karte samay bole jaane wale shabd. YAJURVED ek dhyaan se bani guidebook jaisa hai: pehle kya, phir kya, aakhir mein kya, aur har step pe kya bolein. Yaad rakho: YAJUR = 'Haan, KARTE hain, step by step!' Iske do bhaag hain: SHUKLA (safed) aur KRISHNA (kaala) Yajurved."), D("veda_yajur")),
    C(T("Nachiketa: the brave question boy", "नचिकेता: बहादुर सवाल पूछने वाला", "Nachiketa: bahaadur sawaal poochhne wala"),
      T("The KAṬHA UPANISHAD, from the Yajur Veda, tells of NACHIKETA, a boy who went to Yama, the lord of death, and waited three days to ask him a question. Yama offered him gold, toys, horses and long life instead. Nachiketa said: 'No thank you, I want the TRUE answer.' He chose what is GOOD (śreyas) over what is just fun (preyas), and Yama, impressed, taught him.",
        "कठ उपनिषद, यजुर्वेद से, नचिकेता की कहानी कहता है: एक लड़का जो यम के पास गया और तीन दिन इंतज़ार करके सवाल पूछा। यम ने बदले में सोना, खिलौने, घोड़े, लंबी उम्र दी। नचिकेता बोला: 'नहीं धन्यवाद, मुझे सच्चा उत्तर चाहिए।' उसने अच्छा (श्रेय) चुना, सिर्फ़ मज़ेदार (प्रेय) नहीं।",
        "KATHA UPANISHAD, Yajurved se, NACHIKETA ki kahaani kehta hai: ek ladka jo Yama ke paas gaya aur teen din intezaar karke sawaal poochha. Yama ne badle mein sona, khilaune, ghode, lambi umar di. Nachiketa bola: 'Nahi thank you, mujhe SACHCHA uttar chahiye.' Usne ACHHA (shreya) chuna, sirf mazedaar (preya) nahi.")),
    C(T("Isha Upanishad: enjoy by sharing", "ईश उपनिषद: बाँटकर आनंद", "Isha Upanishad: baant ke anand"),
      T("The last chapter of the Śukla Yajur Veda is the ĪŚA UPANISHAD. Its first verse says: everything is filled with the divine, so ENJOY WHAT YOU HAVE BY SHARING it, and don't be greedy for what belongs to others.",
        "शुक्ल यजुर्वेद का आख़िरी अध्याय ईश उपनिषद है। उसका पहला मंत्र कहता है: सब कुछ ईश्वर से भरा है, इसलिए जो है उसे बाँटकर आनंद लो, और दूसरों की चीज़ का लालच मत करो।",
        "Shukla Yajurved ka aakhri adhyaay ISHA UPANISHAD hai. Uska pehla mantra kehta hai: sab kuch ishwar se bhara hai, isliye jo hai use BAANT KE anand lo, aur doosron ki cheez ka laalach mat karo.")),
    C(T("Yajur Veda in your day", "तुम्हारे दिन में यजुर्वेद", "Tumhare din mein Yajurved"),
      T("Be like the Yajur Veda: 1. FOLLOW THE STEPS IN ORDER, CAREFULLY, with full attention: brushing, homework, a sandwich recipe, a song. 2. FINISH what you start. 3. Be like Nachiketa: when a shortcut tempts you, like copying a friend's homework, DO IT YOURSELF, THE GOOD WAY.",
        "यजुर्वेद जैसे बनो: 1. काम क़दम-दर-क़दम, क्रम से, पूरे ध्यान से करो। 2. जो शुरू करो, पूरा करो। 3. नचिकेता जैसे बनो: शॉर्टकट या लालच के बदले अच्छा चुनो।",
        "Yajurved jaise bano: 1. Kaam STEP BY STEP, order mein, poore dhyaan se karo: brush, homework, recipe, gaana. 2. Jo shuru karo, POORA karo. 3. Nachiketa jaise bano: shortcut ya treat ke badle ACHHA chuno.")),
  ],
  make: (d, rng) => ask(rng, [
    ["What does 'yajus' mean?", "words said while doing a ceremony", ["a sweet", "a song for sleeping"], "Yajus are the words for doing a yajña, step by step."],
    ["The Yajur Veda is most like…", "a careful step-by-step guidebook", ["a comic", "a map of the stars"], "It tells what to do first, next and last, and what to say."],
    ["Which two parts does the Yajur Veda have?", "Śukla (white) and Kṛṣṇa (black)", ["Big and small", "Old and new"], "The Śukla and Kṛṣṇa Yajur Veda."],
    ["Which brave boy asked Yama the true answer instead of taking gold and toys?", "Nachiketa", ["Śvetaketu", "Arjuna"], "Nachiketa's story is in the Kaṭha Upanishad, from the Yajur Veda."],
    ...(d >= 2 ? [
      ["Nachiketa chose the true answer over gold and toys. What did he choose?", "what is good (śreyas) over what is just fun (preyas)", ["the biggest toy", "to go home"], "Śreyas is the good; preyas is the merely pleasant. Wise people choose śreyas."],
      ["Your friend says 'Copy my homework, it's faster!'. What would Nachiketa do?", "do it yourself, the good way", ["copy it", "tear it up"], "Choose the good (learning) over the easy (copying).", true],
      ["You're making a sandwich for the first time. What is the Yajur Veda way?", "follow the steps in order, carefully", ["throw everything together", "skip the hard parts"], "Yajur does: step by step, with full attention.", true],
      ["Which Upanishad, the last chapter of the Śukla Yajur Veda, says 'enjoy by sharing'?", "Īśa Upanishad", ["Kaṭha Upanishad", "Chāndogya Upanishad"], "Īśa Upanishad, verse 1: enjoy by sharing, don't be greedy."],
    ] as Q[] : []),
  ], D("veda_yajur")),
};

export const atharvaVeda: VedaTopic = {
  id: "atharva_veda", strand: "four", icon: "🌿", title: T("Atharva Veda: the Veda that heals", "अथर्ववेद: जीवन और स्वास्थ्य का वेद", "Atharvaved: jeevan aur health ka Ved"), grades: [0, 5],
  cards: [
    C(T("Atharva heals 🌿", "अथर्व सँभालता है 🌿", "Atharva sambhaalta hai 🌿"),
      T("The ATHARVA VEDA is about EVERYDAY LIFE: health, healing plants and herbs, a happy home, friendship, peace and the Earth. It has 20 books with about 730 hymns. Many ideas about health and herbs later grew into AYURVEDA. Stick point: ATHARVA = AT HOME, at heart: it looks after our body, our family and our Earth.",
        "अथर्ववेद रोज़ के जीवन का वेद है: स्वास्थ्य, औषधि वाले पौधे, सुखी घर, दोस्ती, शांति और धरती। इसमें 20 कांड और लगभग 730 सूक्त हैं। स्वास्थ्य और जड़ी-बूटियों के कई विचार आगे आयुर्वेद बने। याद रखो: अथर्व = घर और दिल का वेद।",
        "ATHARVAVED roz ke jeevan ka Ved hai: health, jadi-booti wale paudhe, sukhi ghar, dosti, shaanti aur dharti. Ismein 20 kaand aur lagbhag 730 sookt hain. Health aur jadi-bootiyon ke kai vichaar aage AYURVED bane. Yaad rakho: ATHARVA = ghar aur dil ka Ved."), D("veda_atharva")),
    C(T("Bhūmi Sūkta: the Earth is my mother", "भूमि सूक्त: धरती मेरी माँ", "Bhoomi Sookt: dharti meri maa"),
      T("The Atharva Veda's BHŪMI SŪKTA is a long song of love for the Earth: 'mātā bhūmiḥ putro'haṃ pṛthivyāḥ', THE EARTH IS MY MOTHER, I AM HER CHILD. It thanks the Earth for food, water, mountains and forests, and asks us to take only what we need.",
        "अथर्ववेद का भूमि सूक्त धरती के लिए प्रेम का लंबा गीत है: 'माता भूमिः पुत्रोऽहं पृथिव्याः', धरती मेरी माँ है, मैं उसकी संतान हूँ। यह भोजन, पानी, पहाड़ों और जंगलों के लिए धन्यवाद करता है।",
        "Atharvaved ka BHOOMI SOOKT dharti ke liye pyaar ka lamba geet hai: 'maata bhoomih putro'ham prithivyaah', DHARTI MERI MAA HAI, MAIN USKI SANTAAN HOON. Yeh khaana, paani, pahaadon aur jangalon ke liye thank you kehta hai.")),
    C(T("'Satyameva jayate' is from here!", "'सत्यमेव जयते' यहीं से!", "'Satyameva jayate' yahin se!"),
      T("Look under the four lions of India's national emblem, on a rupee note: SATYAMEVA JAYATE, TRUTH ALONE WINS. These words come from the MUṆḌAKA UPANISHAD, which belongs to the Atharva Veda. So India's motto is a Vedic line you can carry in your pocket!",
        "भारत के राष्ट्रीय चिह्न के चार शेरों के नीचे, रुपये के नोट पर देखो: सत्यमेव जयते, सत्य ही जीतता है। ये शब्द मुण्डक उपनिषद से हैं, जो अथर्ववेद का है।",
        "Bharat ke national emblem ke chaar sheron ke neeche, rupaye ke note pe dekho: SATYAMEVA JAYATE, SACH HI JEETTA HAI. Yeh shabd MUNDAKA UPANISHAD se hain, jo Atharvaved ka hai. Bharat ka motto ek Vedic line hai jo tumhari jeb mein hai!")),
    C(T("Atharva Veda in your day", "तुम्हारे दिन में अथर्ववेद", "Tumhare din mein Atharvaved"),
      T("Be like the Atharva Veda: 1. Look after your BODY: fresh food, water, play and sleep. 2. Look after your HOME: help, share; after a fight over the TV, MAKE PEACE AND SHARE THE TIME. 3. Look after the EARTH: a tap dripping? CLOSE IT: THE EARTH IS OUR MOTHER. Plant something, never litter. 4. TELL THE TRUTH: truth alone wins.",
        "अथर्ववेद जैसे बनो: 1. शरीर का ध्यान: ताज़ा खाना, पानी, खेल, नींद। 2. घर का ध्यान: मदद, बाँटना, झगड़े के बाद मेल। 3. धरती का ध्यान: पानी बचाओ, पौधा लगाओ। 4. सच बोलो: सत्य ही जीतता है।",
        "Atharvaved jaise bano: 1. SHAREER ka dhyaan: taaza khaana, paani, khel, neend. 2. GHAR ka dhyaan: madad, baantna, jhagde ke baad mel. 3. DHARTI ka dhyaan: paani bachao, paudha lagao, kachra mat phenko. 4. SACH bolo: satya hi jeetta hai.")),
  ],
  make: (d, rng) => ask(rng, [
    ["Which Veda is about everyday life: health, home and the Earth?", "Atharva Veda", ["Sama Veda", "Rig Veda"], "Atharva heals 🌿: health, herbs, home, peace and the Earth."],
    ["Which line comes from the Atharva Veda's Bhūmi Sūkta?", "The Earth is my mother, I am her child", ["I praise the fire", "You are that"], "'mātā bhūmiḥ putro'haṃ pṛthivyāḥ' (Atharva Veda 12.1.12)."],
    ["Ideas about health and healing herbs in the Atharva Veda later grew into…", "Ayurveda", ["cricket", "astronomy"], "Ayurveda, India's traditional medicine, has roots in the Atharva Veda."],
    ["What does 'satyameva jayate' mean?", "truth alone wins", ["fire is hot", "music is fun"], "From the Muṇḍaka Upanishad (Atharva Veda), India's national motto."],
    ...(d >= 2 ? [
      ["Where can you see 'satyameva jayate' every day?", "under the four lions on a rupee note", ["on a cricket bat", "on a mango"], "It is India's national motto, under the Lion Capital emblem."],
      ["Which Upanishad, part of the Atharva Veda, gives us 'satyameva jayate'?", "Muṇḍaka Upanishad", ["Īśa Upanishad", "Kaṭha Upanishad"], "Muṇḍaka Upanishad 3.1.6."],
      ["You see a tap dripping at school. What would a Bhūmi Sūkta child do?", "close it: the Earth is our mother", ["ignore it", "open it more"], "Care for the Earth like your mother: every drop counts.", true],
      ["You and your sister fought over the TV. What is the Atharva Veda way?", "make peace and share the time", ["stop talking to her", "hide the remote"], "The Atharva Veda has hymns for a peaceful, loving home.", true],
      ["You broke a cup and are scared to tell. What does 'satyameva jayate' tell you?", "tell the truth: truth wins in the end", ["hide the pieces", "blame the cat"], "Truth alone wins: honesty builds trust.", true],
    ] as Q[] : []),
  ], D("veda_atharva")),
};

export const FOUR_VEDAS = [vedaFamily, rigVeda, samaVeda, yajurVeda, atharvaVeda];
