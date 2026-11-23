// Vedas & wisdom: the four Vedas and their knowledge, shlokas for awakening and enrichment, Bhagavad Gita
// concepts, and life skills that help in childhood, as an adult and in old age. Most questions are real-life
// situations ("your friend breaks your toy by mistake...") so the result measures whether the child can USE
// the wisdom, not only repeat it. Presented as India's literature, knowledge and values, with sources.
import type { Text } from "../i18n";
import { pick, shuffle, T, type Card, type Exercise, type Rng } from "./maths";
import { SHLOKAS } from "./shlokas";

export type VedaStrand = "texts" | "shlokas" | "gita" | "life" | "links";
export const VEDA_STRANDS: { id: VedaStrand; icon: string; title: Text }[] = [
  { id: "texts", icon: "📜", title: T("The Vedas", "वेद", "Ved") },
  { id: "shlokas", icon: "🪔", title: T("Shlokas", "श्लोक", "Shlok") },
  { id: "gita", icon: "🪷", title: T("Gita wisdom", "गीता का ज्ञान", "Gita ka gyaan") },
  { id: "life", icon: "🌟", title: T("Life skills for every age", "हर उम्र के जीवन-कौशल", "Har umar ke life skills") },
  { id: "links", icon: "🔗", title: T("Vedic knowledge in every subject", "हर विषय में वैदिक ज्ञान", "Har subject mein Vedic gyaan") },
];
export interface VedaTopic { id: string; strand: VedaStrand; icon: string; title: Text; grades: [number, number]; cards: Card[]; make: (d: number, rng: Rng) => Exercise }

const S = (id: string): Card["visual"] => ({ type: "shloka", id });
type Q = [string, string, string[], string, boolean?]; // prompt, answer, others, why, real-life?
const ask = (rng: Rng, pool: Q[], visual?: Exercise["visual"]): Exercise => {
  const [p, a, o, why, apply] = pick(rng, pool);
  return { prompt: T(p), visual, choices: shuffle(rng, [a, ...o]), answer: a, why: T(why), apply: !!apply };
};
/** A card that teaches one shloka: the verse, its meaning and the everyday lesson. */
const shlokaCard = (id: string, title?: string): Card => ({ title: T(title ?? SHLOKAS[id].source), say: { en: `${SHLOKAS[id].meaning.en} ${SHLOKAS[id].lesson.en}`, hi: `${SHLOKAS[id].meaning.hi ?? ""} ${SHLOKAS[id].lesson.hi ?? ""}`, hinglish: `${SHLOKAS[id].meaning.hinglish ?? ""} ${SHLOKAS[id].lesson.hinglish ?? ""}` }, visual: S(id) });

const fourVedas: VedaTopic = {
  id: "four_vedas", strand: "texts", icon: "📜", title: T("The four Vedas", "चार वेद", "Chaar Ved"), grades: [1, 5],
  cards: [
    { title: T("The oldest books of knowledge"), say: T("'Veda' means KNOWLEDGE. The Vedas are among the oldest books in the world, first passed on by heart, teacher to student, for thousands of years. There are four: the RIG Veda (hymns and praise), the SAMA Veda (the same verses set to melody: the root of Indian music), the YAJUR Veda (words for actions and ceremonies) and the ATHARVA Veda (everyday life: health, home, the Earth).", "'वेद' का अर्थ है ज्ञान। वेद दुनिया की सबसे पुरानी पुस्तकों में हैं, हज़ारों साल गुरु से शिष्य तक याद करके पहुँचाए गए। चार वेद: ऋग्वेद (स्तुति के मंत्र), सामवेद (वही मंत्र गायन में: भारतीय संगीत की जड़), यजुर्वेद (कर्म और यज्ञ के मंत्र), अथर्ववेद (रोज़ का जीवन: स्वास्थ्य, घर, धरती)।", "'Ved' ka matlab hai GYAAN. Ved duniya ki sabse puraani kitaabon mein hain, hazaaron saal guru se shishya tak yaad karke pahunchaaye gaye. Chaar Ved: Rigved (stuti ke mantra), Samaved (wahi mantra gaayan mein: Indian music ki jad), Yajurved (karm aur yagya ke mantra), Atharvaved (roz ka jeevan: health, ghar, dharti).") },
    { title: T("Upanishads and Vedangas"), say: T("At the end of each Veda come the UPANISHADS: big questions like 'Who am I?' and 'What is truth?'. Six VEDANGAS ('limbs of the Veda') help us study them: Shiksha (pronunciation), Vyakarana (grammar), Chandas (rhythm of verses), Nirukta (meaning of words), Jyotisha (astronomy and maths) and Kalpa (how to do things properly).", "हर वेद के अंत में उपनिषद हैं: 'मैं कौन हूँ?', 'सत्य क्या है?' जैसे बड़े प्रश्न। छह वेदांग पढ़ने में मदद करते हैं: शिक्षा (उच्चारण), व्याकरण, छंद, निरुक्त (शब्दों का अर्थ), ज्योतिष (खगोल-गणित), कल्प (विधि)।", "Har Ved ke ant mein Upanishad hain: 'Main kaun hoon?', 'Satya kya hai?' jaise bade sawaal. Chhe Vedang padhne mein madad karte hain: Shiksha (uchchaaran), Vyakaran, Chhand, Nirukt (shabdon ka arth), Jyotish (astronomy-ganit), Kalp (vidhi).") },
  ],
  make: (_d, rng) => ask(rng, [
    ["Which Veda is the Veda of melodies, the root of Indian music?", "Sama Veda", ["Rig Veda", "Atharva Veda"], "The Sama Veda sets the Rig Veda's verses to tunes: Indian classical music grew from this singing."],
    ["What does the word 'Veda' mean?", "knowledge", ["story", "song"], "Veda comes from 'vid', to know: Veda means knowledge."],
    ["Which is the oldest of the four Vedas?", "Rig Veda", ["Sama Veda", "Atharva Veda"], "The Rig Veda is the oldest; the Sama Veda takes many of its verses and sings them."],
    ["Which Veda talks most about everyday life, health and the Earth?", "Atharva Veda", ["Sama Veda", "Yajur Veda"], "The Atharva Veda has hymns for home, health and the Earth, like the Bhūmi Sūkta: 'The Earth is my mother'."],
    ["How were the Vedas kept safe for thousands of years before books?", "learned by heart, teacher to student", ["carved in stone", "painted on walls"], "Students memorised them perfectly with special methods of repeating, so not one sound changed."],
    ["Which Vedanga is about the correct pronunciation of sounds?", "Shiksha", ["Jyotisha", "Kalpa"], "Shiksha teaches how each sound is made: in the throat, palate, teeth or lips."],
  ]),
};

const learnShloka: VedaTopic = {
  id: "shloka_meaning", strand: "shlokas", icon: "🪔", title: T("Shlokas and their meaning", "श्लोक और उनका अर्थ", "Shlok aur unka arth"), grades: [0, 5],
  cards: [
    { title: T("How to learn a shloka"), say: T("1. LISTEN to it a few times. 2. Say it line by line, slowly, copying each sound. 3. Understand what it MEANS. 4. USE it: remember it when the moment comes in your day. A shloka you understand stays with you for life.", "1. कुछ बार सुनो। 2. धीरे-धीरे एक-एक पंक्ति दोहराओ। 3. अर्थ समझो। 4. उपयोग करो: दिन में सही पल आने पर याद करो। समझा हुआ श्लोक जीवन भर साथ रहता है।", "1. Kuch baar suno. 2. Dheere-dheere ek-ek line dohraao. 3. Arth samjho. 4. Use karo: din mein sahi pal aane pe yaad karo. Samjha hua shlok zindagi bhar saath rehta hai."), visual: S("saha_navavatu") },
    shlokaCard("gayatri", "Gāyatrī mantra"), shlokaCard("asato_ma", "Asato mā sad gamaya"), shlokaCard("sarve_bhavantu", "Sarve bhavantu sukhinaḥ"),
  ],
  make: (d, rng) => {
    const ids = Object.keys(SHLOKAS);
    const id = pick(rng, ids), sh = SHLOKAS[id];
    const others = shuffle(rng, ids.filter((x) => x !== id)).slice(0, 2).map((x) => SHLOKAS[x]);
    if (d <= 2 || rng() < 0.5) {
      return { prompt: T("What does this shloka mean?", "इस श्लोक का अर्थ क्या है?", "Is shlok ka arth kya hai?"), visual: S(id),
        choices: shuffle(rng, [sh.meaning.en, ...others.map((o) => o.meaning.en)]), answer: sh.meaning.en, why: T(`It comes from ${sh.source}. ${sh.lesson.en}`) };
    }
    return { prompt: T(`When would this shloka help you? "${sh.iast.split("|")[0].trim()}…"`), visual: S(id),
      choices: shuffle(rng, [sh.lesson.en, ...others.map((o) => o.lesson.en)]), answer: sh.lesson.en, why: T(`${sh.meaning.en} So: ${sh.lesson.en}`), apply: true };
  },
};

const gitaKarma: VedaTopic = {
  id: "gita_karma", strand: "gita", icon: "🏹", title: T("Do your best, let go of the result", "पूरी मेहनत, फल की चिंता नहीं", "Poori mehnat, phal ki chinta nahi"), grades: [2, 5],
  cards: [
    { title: T("The Gita: a teacher and a student"), say: T("The Bhagavad Gita is a conversation: Arjuna is confused and scared before a big challenge, and Krishna teaches him how to think clearly and act well. Its lessons help with exams, games, friendships and work, at every age.", "भगवद्गीता एक संवाद है: बड़ी चुनौती से पहले अर्जुन उलझन और डर में है, और कृष्ण उसे साफ़ सोचना और अच्छा कर्म करना सिखाते हैं। इसकी सीख परीक्षा, खेल, दोस्ती और काम में हर उम्र में काम आती है।", "Bhagavad Gita ek samvaad hai: badi chunauti se pehle Arjun uljhan aur darr mein hai, aur Krishna use saaf sochna aur achha karm karna sikhaate hain. Iski seekh exam, game, dosti aur kaam mein har umar mein kaam aati hai.") },
    shlokaCard("karmanye", "Gita 2.47: your work, not the fruits"), shlokaCard("samatvam", "Gita 2.48: steady in success and failure"),
  ],
  make: (_d, rng) => ask(rng, [
    ["You practised hard for a race but came 4th. What would Gita 2.47 say?", "You did your part well; keep practising", ["Practice was useless", "Never race again"], "Your right is to the effort, not the result. The effort made you stronger, and results follow steady effort.", true],
    ["Before a test you are worried about marks. What helps most?", "Focus on studying well, step by step", ["Think only about the marks", "Skip studying"], "The Gita teaches: put your mind on the work in front of you; worrying about the result doesn't help it.", true],
    ["You won a game and your friend lost. What is the Gita way?", "Stay humble and kind", ["Tease your friend", "Boast loudly"], "Samatvam (2.48): stay the same in winning and losing, steady and kind.", true],
    ["What does 'samatvam' mean?", "staying calm and balanced in success and failure", ["always winning", "never trying"], "Gita 2.48 calls this evenness of mind 'yoga'."],
    ["You get a wrong answer in class. What does the Gita suggest?", "Stay calm, learn from it, try again", ["Give up the subject", "Get angry"], "Success and failure come and go; a calm mind learns from both.", true],
  ], S("karmanye")),
};

const gitaSelf: VedaTopic = {
  id: "gita_self", strand: "gita", icon: "💪", title: T("Lift yourself up", "ख़ुद को ऊपर उठाओ", "Khud ko upar uthao"), grades: [2, 5],
  cards: [shlokaCard("uddhared", "Gita 6.5: be your own best friend"), shlokaCard("titiksha", "Gita 2.14: feelings come and go")],
  make: (_d, rng) => ask(rng, [
    ["You think 'I'm bad at maths'. What would Gita 6.5 tell you?", "Say 'I can't do it YET' and keep trying", ["Believe it and stop", "Blame the teacher"], "You can be your own best friend: lift yourself up with kind, brave words and effort.", true],
    ["You feel sad because it rained on your picnic day. What does Gita 2.14 teach?", "The sad feeling will pass; find something else fun", ["Stay sad all week", "Shout at everyone"], "Happy and sad feelings come and go like cold and heat. Bear them patiently: they don't last.", true],
    ["Who can be your best friend or your worst enemy, says Gita 6.5?", "yourself", ["your neighbour", "your teacher"], "How you treat yourself, encouraging or putting yourself down, matters most."],
    ["You're scared to sing on stage. What helps, the Gita way?", "Breathe, remember you practised, do your best", ["Run away", "Think everyone will laugh"], "Lift yourself with your own effort and steady mind; the fear passes.", true],
  ], S("uddhared")),
};

const gitaBalance: VedaTopic = {
  id: "gita_balance", strand: "gita", icon: "⚖️", title: T("Balance, kind words, good example", "संतुलन, मीठी वाणी, अच्छा उदाहरण", "Santulan, meethi vaani, achha example"), grades: [2, 5],
  cards: [shlokaCard("yuktahara", "Gita 6.17: balance in everything"), shlokaCard("vak_tapas", "Gita 17.15: true, kind, helpful words"), shlokaCard("yad_yad", "Gita 3.21: others follow your example")],
  make: (_d, rng) => ask(rng, [
    ["You want to play on the tablet all evening. What does Gita 6.17 suggest?", "Balance: some play, then homework, dinner and sleep on time", ["Play until midnight", "Never play at all"], "Balance in eating, playing, working and sleeping removes sorrow: not too much, not too little.", true],
    ["Your friend's drawing is messy. What should you say, by Gita 17.15?", "Something true and kind, like 'I like your colours!'", ["'That's ugly'", "Laugh at it"], "Words should be true, pleasant and helpful, and never upset others needlessly.", true],
    ["Your little cousin copies everything you do. What does Gita 3.21 remind you?", "Be a good example", ["It doesn't matter what I do", "Tell them to stop copying"], "Whatever a good person does, others follow. Your actions teach.", true],
    ["Before speaking, which three questions does Gita 17.15 suggest?", "Is it true? Is it kind? Is it helpful?", ["Is it loud? Is it fast? Is it long?", "Will I win? Will they lose? Is it funny?"], "Speech that is true, pleasant and beneficial is the discipline of speech."],
  ], S("yuktahara")),
};

const honesty: VedaTopic = {
  id: "honesty_gratitude", strand: "life", icon: "🙏", title: T("Honesty and gratitude", "ईमानदारी और कृतज्ञता", "Imaandari aur shukriya"), grades: [0, 5],
  cards: [shlokaCard("satyam_vada", "Satyaṃ vada: speak the truth"), shlokaCard("matru_devo", "Respect parents, teachers and guests"),
    { title: T("Why honesty matters all your life"), say: T("As a child, honesty earns your parents' trust. As a student, honest work means you really learn. As an adult, honest people are trusted with jobs and money. As an elder, an honest life is your best gift to the family.", "बचपन में ईमानदारी से माता-पिता का भरोसा मिलता है। विद्यार्थी के रूप में ईमानदार काम से सच में सीखते हो। बड़े होकर ईमानदार लोगों पर काम और पैसे का भरोसा होता है। बुढ़ापे में ईमानदार जीवन परिवार के लिए सबसे अच्छा उपहार है।", "Bachpan mein imaandari se maa-baap ka bharosa milta hai. Student ke roop mein imaandar kaam se sach mein seekhte ho. Bade hoke imaandar logon pe kaam aur paise ka bharosa hota hai. Budhaape mein imaandar jeevan parivaar ke liye sabse achha tohfa hai.") }],
  make: (_d, rng) => ask(rng, [
    ["You broke a glass by mistake and no one saw. What is right?", "Tell the truth and say sorry", ["Hide the pieces", "Blame the cat"], "Satyaṃ vada: speak the truth. Honest people are trusted, and a mistake told is quickly forgiven.", true],
    ["The shopkeeper gives you ₹10 too much change. What do you do?", "Give it back", ["Keep it quietly", "Spend it fast"], "Honesty with money builds trust for life; it isn't yours to keep.", true],
    ["Your teacher helped you understand fractions. How can you show gratitude?", "Say 'thank you' and keep practising", ["Say nothing", "Forget it"], "Ācāryadevo bhava: honour your teacher. Gratitude makes both of you happy.", true],
    ["A guest comes home. What does 'atithi devo bhava' teach?", "Welcome them warmly, offer water", ["Ignore them", "Keep watching TV"], "Treat guests with the highest respect and warmth.", true],
    ["Your friend copies your homework answers. What is the honest choice?", "Help them understand, not copy", ["Let them copy everything", "Tell everyone they're bad"], "Real help is teaching; copying means they don't learn.", true],
  ], S("satyam_vada")),
};

const kindness: VedaTopic = {
  id: "kindness_teamwork", strand: "life", icon: "🤝", title: T("Kindness and teamwork", "दयालुता और टीमवर्क", "Dayaaluta aur teamwork"), grades: [0, 5],
  cards: [shlokaCard("vasudhaiva", "Vasudhaiva kuṭumbakam: the world is one family"), shlokaCard("sangacchadhvam", "Saṃ gacchadhvam: walk together"), shlokaCard("sarve_bhavantu", "May all be happy")],
  make: (_d, rng) => ask(rng, [
    ["A new child in class speaks a different language. What would 'vasudhaiva kutumbakam' have you do?", "Smile, help, and play with them", ["Ignore them", "Laugh at how they talk"], "The whole world is one family: a new friend is family too.", true],
    ["Your team disagrees about a project. What does Rig Veda 10.191 suggest?", "Listen to each other and decide together", ["Do it all alone", "Shout louder"], "Walk together, speak together, let your minds understand each other.", true],
    ["Your friend is sad. What is the kind thing?", "Sit with them and ask what happened", ["Walk away", "Tell them to stop crying"], "Sarve bhavantu sukhinaḥ: wish and work for everyone's happiness.", true],
    ["A street dog is hungry and thirsty on a hot day. What can you do?", "Ask an adult to help give it water", ["Throw stones", "Shout at it"], "Kindness includes animals: they are part of the world family too.", true],
  ], S("vasudhaiva")),
};

const earth: VedaTopic = {
  id: "care_earth", strand: "life", icon: "🌍", title: T("Caring for Mother Earth", "धरती माँ की देखभाल", "Dharti maa ki dekhbhaal"), grades: [0, 5],
  cards: [shlokaCard("mata_bhumih", "Atharva Veda: the Earth is my mother"),
    { title: T("Small actions, big difference"), say: T("Close the tap while brushing, switch off lights, carry a cloth bag, plant a tree, never litter. If every child does this, millions of litres of water and tonnes of plastic are saved!", "ब्रश करते समय नल बंद करो, बत्ती बुझाओ, कपड़े का थैला रखो, पेड़ लगाओ, कचरा मत फैलाओ। हर बच्चा ऐसा करे तो लाखों लीटर पानी और टनों प्लास्टिक बचेगा!", "Brush karte waqt nal band karo, batti bujhao, kapde ka thaila rakho, ped lagao, kachra mat phailao. Har bachcha aisa kare toh laakhon litre paani aur tonon plastic bachega!") }],
  make: (_d, rng) => ask(rng, [
    ["You see a tap running in the school washroom. What would a child of Mother Earth do?", "Close it", ["Leave it", "Splash more water"], "Mātā bhūmiḥ: care for the Earth like your mother. Every drop saved matters.", true],
    ["You finish a snack in the park and there's no bin nearby. What do you do?", "Keep the wrapper and throw it in a bin later", ["Drop it on the grass", "Throw it in the pond"], "The Earth is our mother: we keep her clean.", true],
    ["Which helps the Earth most when shopping?", "Carry your own cloth bag", ["Ask for many plastic bags", "Buy things you don't need"], "Cloth bags are reused for years; plastic bags pollute for hundreds of years.", true],
  ], S("mata_bhumih")),
};

const health: VedaTopic = {
  id: "health_routine", strand: "life", icon: "🌅", title: T("A healthy daily routine", "स्वस्थ दिनचर्या", "Healthy dincharya"), grades: [0, 5],
  cards: [shlokaCard("shariram", "Śarīram ādyam: the body is the first tool"),
    { title: T("Dinacharya: a good day's rhythm"), say: T("Wake up early, drink water, brush your teeth, move your body (play, yoga, a walk), eat fresh food at regular times, study when the mind is fresh, play outside, and sleep on time. A steady routine keeps body and mind strong, from childhood to old age. (Ask a doctor about any health problem.)", "जल्दी उठो, पानी पियो, दाँत साफ़ करो, शरीर हिलाओ (खेल, योग, सैर), समय पर ताज़ा खाना, ताज़ा मन से पढ़ाई, बाहर खेलो, समय पर सोओ। नियमित दिनचर्या बचपन से बुढ़ापे तक शरीर-मन मज़बूत रखती है।", "Jaldi utho, paani piyo, daant saaf karo, shareer hilao (khel, yoga, walk), time pe taaza khaana, fresh mann se padhai, bahar khelo, time pe soo. Regular dincharya bachpan se budhaape tak shareer-mann mazboot rakhti hai.") }],
  make: (_d, rng) => ask(rng, [
    ["It's 10 pm and you want one more episode. What keeps you healthy?", "Switch off and sleep", ["Watch three more", "Play games in bed"], "Sleep is when the body grows and the brain stores what you learned: balance (Gita 6.17).", true],
    ["Which breakfast gives the best start to the day?", "Fruit, milk and a roti or poha", ["Only chips", "Only a soft drink"], "The body is your first tool (śarīram ādyam): fuel it with good food.", true],
    ["Why move your body every day?", "It keeps the heart, bones and mind strong", ["It's only for athletes", "It makes you tired forever"], "Daily play and exercise build strength at every age, even for grandparents."],
  ], S("shariram")),
};

const emotions: VedaTopic = {
  id: "emotions", strand: "life", icon: "🌬️", title: T("Handling anger and sadness", "गुस्से और दुख को संभालना", "Gussa aur dukh sambhaalna"), grades: [1, 5],
  cards: [shlokaCard("titiksha", "Gita 2.14: patience"),
    { title: T("Stop, breathe, think"), say: T("When anger comes: STOP (don't hit or shout), BREATHE slowly 5 times, THINK of a kind choice. Feelings are like weather: a storm passes. Grown-ups use this at work and at home too.", "जब गुस्सा आए: रुको (मारो या चिल्लाओ मत), 5 बार धीरे साँस लो, एक अच्छा विकल्प सोचो। भावनाएँ मौसम जैसी हैं: तूफ़ान गुज़र जाता है।", "Jab gussa aaye: RUKO (maaro ya chillao mat), 5 baar dheere SAANS lo, ek achha option SOCHO. Feelings mausam jaisi hain: toofaan guzar jaata hai.") }],
  make: (_d, rng) => ask(rng, [
    ["Your brother takes your toy without asking. You feel angry. What first?", "Stop and take 5 slow breaths", ["Hit him", "Scream"], "A calm mind chooses well. Then say 'Please ask before you take it.'", true],
    ["Your friend breaks your toy by mistake. What is the wise response?", "Stay calm, tell them it's okay, fix it together", ["Never talk to them again", "Break their toy"], "It was a mistake. Samatvam: stay steady; friendship is worth more than a toy.", true],
    ["You lost a match and feel like crying. What helps?", "It's okay to feel sad; it will pass; practise for next time", ["Never play again", "Blame the referee"], "Gita 2.14: sadness comes and goes. Feel it, then rise again (6.5).", true],
  ], S("titiksha")),
};

const effort: VedaTopic = {
  id: "effort_time", strand: "life", icon: "⏳", title: T("Effort and using time well", "मेहनत और समय का सदुपयोग", "Mehnat aur time ka sahi use"), grades: [1, 5],
  cards: [shlokaCard("udyamena", "Udyamena hi sidhyanti: success needs effort"), shlokaCard("jalabindu", "Drop by drop the pot fills"),
    { title: T("Plan your day"), say: T("Make a little plan: first the important things (homework, practice), then play. 15 minutes every day beats 2 hours once a week, because the brain learns in small, regular drops.", "छोटी योजना बनाओ: पहले ज़रूरी काम (होमवर्क, अभ्यास), फिर खेल। रोज़ 15 मिनट हफ़्ते में एक बार 2 घंटे से बेहतर, क्योंकि दिमाग़ छोटी-छोटी बूँदों में सीखता है।", "Chhoti planning karo: pehle zaroori kaam (homework, practice), phir khel. Roz 15 minute hafte mein ek baar 2 ghante se better, kyunki dimaag chhoti-chhoti boondon mein seekhta hai.") }],
  make: (_d, rng) => ask(rng, [
    ["You want to play the keyboard well by your birthday. What works best?", "Practise a little every day", ["Practise only the day before", "Just wish for it"], "Udyamena: work is done by effort, not wishes. Jalabindu: drop by drop the pot fills.", true],
    ["You have homework and want to play. Which plan is wise?", "Homework first, then play", ["Play all evening, homework at bedtime", "Skip homework"], "Important things first: then you can play without worry.", true],
    ["Why does a little practice every day beat a lot once a week?", "The brain learns best in small, regular steps", ["It doesn't, both are the same", "Because practice is boring"], "Like drops filling a pot, daily practice adds up and stays."],
  ], S("udyamena")),
};

const lifeStages: VedaTopic = {
  id: "life_stages", strand: "life", icon: "🌳", title: T("Life skills from childhood to old age", "बचपन से बुढ़ापे तक जीवन-कौशल", "Bachpan se budhaape tak life skills"), grades: [3, 5],
  cards: [{ title: T("The four stages of life (āśramas)"), say: T("The Vedic tradition sees life in four stages. 1. BRAHMACHARYA, the student: learn, build habits and health. 2. GṚHASTHA, the householder: work honestly, care for family, earn and save, help society. 3. VĀNAPRASTHA, the guide: slow down, share experience, mentor the young. 4. SANNYĀSA, the free one: let go, live simply, seek inner peace. Every stage needs its own skills!", "वैदिक परंपरा जीवन को चार आश्रमों में देखती है। 1. ब्रह्मचर्य, विद्यार्थी: सीखो, अच्छी आदतें और स्वास्थ्य बनाओ। 2. गृहस्थ: ईमानदारी से काम, परिवार की देखभाल, कमाओ-बचाओ, समाज की मदद। 3. वानप्रस्थ, मार्गदर्शक: धीमे चलो, अनुभव बाँटो, युवाओं को सिखाओ। 4. संन्यास: छोड़ना, सादा जीवन, भीतर की शांति।", "Vedic parampara jeevan ko chaar aashramon mein dekhti hai. 1. Brahmacharya, student: seekho, achhi aadatein aur health banao. 2. Grihastha: imaandari se kaam, parivaar ki dekhbhaal, kamao-bachao, samaaj ki madad. 3. Vanaprastha, guide: dheeme chalo, anubhav baanto, yuvaon ko sikhao. 4. Sannyasa: chhodna, saada jeevan, andar ki shaanti.") },
    { title: T("Skills that last a lifetime"), say: T("Some skills help at EVERY age: reading and learning, managing money, cooking a simple meal, keeping healthy, speaking kindly, solving problems, asking for help, and helping others.", "कुछ कौशल हर उम्र में काम आते हैं: पढ़ना-सीखना, पैसे संभालना, सादा खाना बनाना, स्वस्थ रहना, मीठा बोलना, समस्याएँ सुलझाना, मदद माँगना और मदद करना।", "Kuch skills har umar mein kaam aate hain: padhna-seekhna, paise sambhaalna, saada khaana banana, healthy rehna, meetha bolna, problem solve karna, madad maangna aur madad karna.") }],
  make: (_d, rng) => ask(rng, [
    ["Which stage of life are you in now?", "student (brahmacharya)", ["householder (gṛhastha)", "guide (vānaprastha)"], "Childhood and youth are the student stage: the time to learn and build good habits."],
    ["Your grandparents tell stories of their life. Which stage's skill is that?", "sharing wisdom (vānaprastha)", ["earning money (gṛhastha)", "learning letters (brahmacharya)"], "Elders guide the young by sharing experience: listen, it's a treasure!", true],
    ["Which skill helps a student, a parent AND a grandparent?", "managing money wisely", ["only playing video games", "staying up late"], "Money skills, like saving and not wasting, are needed at every stage.", true],
    ["A grown-up in the householder stage should…", "work honestly and care for the family", ["stop working at 25", "spend everything at once"], "Gṛhastha: earn honestly, care for family and help society.", true],
  ]),
};

const samaMusic: VedaTopic = {
  id: "sama_music", strand: "links", icon: "🎶", title: T("Sama Veda and music", "सामवेद और संगीत", "Samaved aur sangeet"), grades: [1, 5],
  cards: [{ title: T("Music began as chanting"), say: T("Long ago, the verses of the Sama Veda were sung on a few notes. Over centuries those notes grew into the seven swaras of Indian music: Sa Re Ga Ma Pa Dha Ni. So every time you play Sa Re Ga, you are continuing a 3000-year-old tradition!", "बहुत पहले सामवेद के मंत्र कुछ स्वरों पर गाए जाते थे। सदियों में वही स्वर भारतीय संगीत के सात स्वर बने: सा रे ग म प ध नि। तो जब तुम सा रे ग बजाते हो, 3000 साल पुरानी परंपरा आगे बढ़ाते हो!", "Bahut pehle Samaved ke mantra kuch swaron pe gaaye jaate the. Sadiyon mein wahi swar Indian music ke saat swar bane: Sa Re Ga Ma Pa Dha Ni. Toh jab tum Sa Re Ga bajate ho, 3000 saal puraani parampara aage badhate ho!") }],
  make: (_d, rng) => ask(rng, [
    ["Which Veda is closely linked to Indian music?", "Sama Veda", ["Atharva Veda", "Yajur Veda"], "Sama Veda verses were sung: the root of the seven swaras."],
    ["How many swaras are in the Indian scale (Sa to Ni)?", "7", ["5", "12"], "Sa Re Ga Ma Pa Dha Ni: seven notes, then Sa again, higher."],
    ["Why does chanting slowly and clearly matter in Vedic tradition?", "Each sound must be exact, like notes in music", ["To finish quickly", "It doesn't matter"], "Exact pitch and pronunciation kept the Vedas unchanged for thousands of years, like playing the right notes."],
  ]),
};

const shulba: VedaTopic = {
  id: "shulba_geometry", strand: "links", icon: "📐", title: T("Shulba Sutras: rope geometry", "शुल्ब सूत्र: रस्सी की ज्यामिति", "Shulba Sutra: rassi ki geometry"), grades: [3, 5],
  cards: [{ title: T("Building altars with ropes"), say: T("The Shulba Sutras (around 800 BCE and later) explain how to build fire altars of exact shapes using only ropes and pegs. Baudhāyana wrote that the rope stretched along a rectangle's diagonal makes as much area (as a square on it) as the two sides together: the idea later called the Pythagoras theorem! A rope knotted into 3 + 4 + 5 parts makes a perfect square corner.", "शुल्ब सूत्र बताते हैं कि सिर्फ़ रस्सी और खूँटियों से सही आकार की वेदियाँ कैसे बनाएँ। बौधायन ने लिखा कि आयत के विकर्ण पर बना वर्ग दोनों भुजाओं के वर्गों के बराबर: जिसे बाद में पाइथागोरस प्रमेय कहा गया! 3 + 4 + 5 गाँठों वाली रस्सी एकदम समकोण बनाती है।", "Shulba Sutra batate hain ki sirf rassi aur khoontiyon se sahi shape ki vediyan kaise banayein. Baudhayan ne likha ki rectangle ke diagonal pe bana square dono sides ke squares ke barabar: jise baad mein Pythagoras theorem kaha gaya! 3 + 4 + 5 gaanthon wali rassi ekdam right angle banati hai."), visual: { type: "gridshape", w: 4, h: 3 } }],
  make: (_d, rng) => ask(rng, [
    ["A rope with knots dividing it into 3, 4 and 5 parts, pulled tight into a triangle, makes…", "a square corner (right angle)", ["a circle", "a straight line"], "3² + 4² = 9 + 16 = 25 = 5²: the Shulba Sutras used this to make perfect right angles.", true],
    ["What were the Shulba Sutras used for?", "building altars of exact shapes", ["cooking", "writing letters"], "Exact shapes and areas with only ropes and pegs: early geometry!"],
    ["You want a perfect square corner for a garden bed but have only string. What can you do?", "Mark 3 and 4 steps on the sides and make the diagonal 5", ["Guess by eye", "Use a round plate"], "The 3-4-5 rope trick from the Shulba Sutras still works today.", true],
  ]),
};

const sanskritSounds: VedaTopic = {
  id: "sanskrit_sounds", strand: "links", icon: "🔤", title: T("Sanskrit: sounds in order", "संस्कृत: क्रम से ध्वनियाँ", "Sanskrit: order mein sounds"), grades: [2, 5],
  cards: [{ title: T("An alphabet sorted by the mouth"), say: T("The Devanagari alphabet is arranged by WHERE the sound is made, from the throat to the lips: ka kha ga gha ṅa (throat), ca cha ja jha ña (palate), ṭa ṭha ḍa ḍha ṇa (roof), ta tha da dha na (teeth), pa pha ba bha ma (lips). Pāṇini wrote about 4000 short rules describing all of Sanskrit grammar, one of the greatest grammar books ever.", "देवनागरी वर्णमाला इस क्रम में है कि ध्वनि कहाँ बनती है, गले से होंठों तक: क ख ग घ ङ (कंठ), च छ ज झ ञ (तालु), ट ठ ड ढ ण (मूर्धा), त थ द ध न (दाँत), प फ ब भ म (होंठ)। पाणिनि ने लगभग 4000 छोटे सूत्रों में पूरा संस्कृत व्याकरण लिखा।", "Devanagari varnamala is order mein hai ki sound kahan banti hai, gale se honthon tak: ka kha ga gha ṅa (kanth), ca cha ja jha ña (taalu), ṭa ṭha ḍa ḍha ṇa (moordha), ta tha da dha na (daant), pa pha ba bha ma (honth). Panini ne lagbhag 4000 chhote sutron mein poora Sanskrit vyakaran likha.") }],
  make: (_d, rng) => ask(rng, [
    ["Where in the mouth are प फ ब भ म (pa pha ba bha ma) made?", "lips", ["throat", "teeth"], "Say 'pa' and 'ma': your lips close. That's why they're together in the alphabet."],
    ["Where are क ख ग घ (ka kha ga gha) made?", "throat", ["lips", "teeth"], "Say 'ka': the back of your tongue touches near the throat."],
    ["Who wrote the famous Sanskrit grammar of about 4000 rules?", "Pāṇini", ["Baudhāyana", "Kālidāsa"], "Pāṇini's Aṣṭādhyāyī describes all of Sanskrit in short rules."],
  ]),
};

const jyotisha: VedaTopic = {
  id: "vedic_sky", strand: "links", icon: "🌙", title: T("Sky, calendar and Jyotisha", "आकाश, पंचांग और ज्योतिष", "Aakaash, panchaang aur Jyotish"), grades: [3, 5],
  cards: [{ title: T("Watching the sky to keep time"), say: T("Vedic people watched the Moon and stars to make calendars. A lunar month follows the Moon from new moon to new moon, about 29½ days, and is divided into 30 TITHIS. The sky was divided into 27 NAKSHATRAS (star groups) that the Moon passes. Later, Āryabhaṭa (5th century) explained that the Earth spins, which makes day and night.", "वैदिक लोग चाँद-तारे देखकर पंचांग बनाते थे। चांद्र मास अमावस से अमावस तक, लगभग साढ़े 29 दिन, 30 तिथियों में बँटा। आकाश को 27 नक्षत्रों में बाँटा गया। बाद में आर्यभट (5वीं सदी) ने बताया कि पृथ्वी घूमती है, जिससे दिन-रात होते हैं।", "Vedic log chaand-taare dekh ke panchaang banate the. Chaandra maas amavas se amavas tak, lagbhag saadhe 29 din, 30 tithiyon mein bata. Aakaash ko 27 nakshatron mein baanta gaya. Baad mein Aryabhata (5vi sadi) ne bataya ki prithvi ghoomti hai, jisse din-raat hote hain."), visual: { type: "diagram", name: "moon", show: "names" } }],
  make: (_d, rng) => ask(rng, [
    ["About how long is a lunar month (new moon to new moon)?", "about 29½ days", ["7 days", "365 days"], "That's why many festivals move a little each year in the solar calendar."],
    ["Into how many nakshatras is the sky divided?", "27", ["12", "100"], "The Moon passes roughly one nakshatra a day."],
    ["Which later Indian scientist said the Earth spins, making day and night?", "Āryabhaṭa", ["Pāṇini", "Kālidāsa"], "Āryabhaṭa (476 CE) explained the Earth's rotation."],
  ]),
};

const purusharthas: VedaTopic = {
  id: "four_aims", strand: "links", icon: "🪙", title: T("The four aims of life and money", "चार पुरुषार्थ और धन", "Chaar purushaarth aur dhan"), grades: [3, 5],
  cards: [{ title: T("Dharma, Artha, Kama, Moksha"), say: T("Indian tradition names four aims of a good life: DHARMA (doing what is right), ARTHA (earning wealth and security), KĀMA (enjoying life) and MOKṢA (inner freedom). Artha is good, but always inside dharma: earn honestly, spend wisely, share, and don't be greedy (Īśa Upaniṣad).", "भारतीय परंपरा अच्छे जीवन के चार लक्ष्य बताती है: धर्म (सही करना), अर्थ (धन और सुरक्षा कमाना), काम (जीवन का आनंद), मोक्ष (भीतरी मुक्ति)। अर्थ अच्छा है, पर हमेशा धर्म के भीतर: ईमानदारी से कमाओ, समझदारी से ख़र्च करो, बाँटो, लालच मत करो।", "Indian parampara achhe jeevan ke chaar lakshya batati hai: Dharma (sahi karna), Artha (dhan aur security kamaana), Kama (jeevan ka aanand), Moksha (andar ki azaadi). Artha achha hai, par hamesha dharma ke andar: imaandari se kamao, samajhdaari se kharch karo, baanto, laalach mat karo."), visual: S("isha_vasyam") }],
  make: (_d, rng) => ask(rng, [
    ["Which aim is about earning money and security?", "Artha", ["Moksha", "Dharma"], "Artha means wealth and means of life."],
    ["Someone gets rich by cheating. Which aim did they forget?", "Dharma", ["Artha", "Kama"], "Wealth (artha) must be earned inside dharma, honestly.", true],
    ["You got ₹100 as a gift. Which choice follows the four aims best?", "Save some, spend some wisely, share a little", ["Spend it all on sweets at once", "Hide it and never use it"], "Artha with dharma: save, enjoy wisely (kama), and share (Īśa Upaniṣad: enjoy by sharing).", true],
  ], S("isha_vasyam")),
};

export const VEDA_TOPICS: VedaTopic[] = [fourVedas, learnShloka, gitaKarma, gitaSelf, gitaBalance, honesty, kindness, earth, health, emotions, effort, lifeStages,
  samaMusic, shulba, sanskritSounds, jyotisha, purusharthas];
