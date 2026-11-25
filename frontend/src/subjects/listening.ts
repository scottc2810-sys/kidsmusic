// The Listening room: music to calm down, focus, feel happy, get sleepy or simply enjoy, each with something to DO
// while listening (breathe with a circle, count the bells, dance on the prompts, count the 8 chords of the Canon),
// a "how do you feel?" before and after, and an honest reason why it can help.
// The claims stay modest on purpose: music can change mood, breathing and attention for a while; it is not a
// treatment and it does not make anyone "smarter" by itself (the "Mozart effect" did not hold up in later studies).
// Active listening (noticing, counting, moving) is what trains attention and memory, so every track has a task.
// All pieces are public domain (Brahms 1868, Pachelbel c. 1680, Beethoven 1824) and played by Melo's own synth.
import type { MoodDef, Piece } from "../audio/bgm";
import type { Binaural } from "../audio/binaural";
import type { Text } from "../i18n";

const T = (en: string, hi: string, hinglish: string): Text => ({ en, hi, hinglish });
export type ListenTask = "breathe" | "bells" | "dance" | "count8" | "hum" | "duet" | "imagine" | "chant";
export type ListenGroup = "melo" | "recordings" | "chants" | "binaural";

/** A real recording shipped with the app (frontend/public/listen), with its licence and credit. */
export interface Recording { src: string; performer: string; licence: string; source: string }

export interface Track {
  id: string;
  icon: string;
  title: Text;
  goal: Text;
  why: Text;
  how: Text; // what to do while listening
  task: ListenTask;
  group: ListenGroup;
  def?: MoodDef; // music Melo composes / plays on its synth
  recording?: Recording; // or a real recording
  binaural?: Binaural; // or binaural beats (headphones)
  video?: string; // a real, openly licensed video clip shown (muted) while listening: key of VIDEOS in videos.ts
  hook?: Text; // one line that makes a child want to listen
  words?: { dev: string; iast: string; meaning: Text }; // the words, when the whole chant (or its best-known line) is short
}

const I = [0, 4, 7], IV = [5, 9, 12], V = [7, 11, 14], VI = [9, 12, 16], III = [4, 7, 11];

// Brahms, Wiegenlied Op. 49 No. 4 (1868), in 3/4, simplified for children
export const LULLABY: Piece = {
  beatsPerBar: 3,
  notes: [[4, 0.5], [4, 0.5], [7, 2], [4, 0.5], [4, 0.5], [7, 2], [4, 0.5], [7, 0.5], [12, 1.5], [11, 0.5], [9, 1], [9, 1], [7, 1],
    [2, 0.5], [4, 0.5], [5, 1], [2, 1], [2, 0.5], [4, 0.5], [5, 2], [2, 0.5], [5, 0.5], [11, 0.5], [9, 0.5], [7, 1], [11, 1], [12, 2]],
  chords: [I, I, I, IV, V, V, V, I],
};

// Pachelbel, Canon in D (c. 1680), moved to C: the 8 chords that repeat, the slow line, then the line in quarters
export const CANON: Piece = {
  beatsPerBar: 2,
  notes: [[16, 2], [14, 2], [12, 2], [11, 2], [9, 2], [7, 2], [9, 2], [11, 2],
    [12, 1], [16, 1], [11, 1], [14, 1], [12, 1], [9, 1], [11, 1], [7, 1], [9, 1], [12, 1], [7, 1], [12, 1], [9, 1], [5, 1], [7, 1], [11, 1]],
  chords: [I, V, VI, III, IV, I, IV, V],
};

// Beethoven, Ode to Joy from Symphony No. 9 (1824)
export const ODE: Piece = {
  beatsPerBar: 4,
  notes: [[4, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 1], [0, 1], [2, 1], [4, 1], [4, 1.5], [2, 0.5], [2, 2],
    [4, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 1], [0, 1], [2, 1], [4, 1], [2, 1.5], [0, 0.5], [0, 2]],
  chords: [I, V, I, V, I, V, I, I],
};

function chant(id: string, icon: string, video: string, title: Text, hook: Text, why: Text, how: Text, performer: string, licence: string, page: string,
  words?: Track["words"]): Track {
  return { id, icon, task: "chant", group: "chants", video, title, goal: hook, hook, why, how, words,
    recording: { src: `/listen/chants/${id}.mp3`, performer, licence, source: page } };
}
const COMMONS = "https://commons.wikimedia.org/wiki/File:";
const YAGNA = "recorded at a real Soma yagna by Puranastudy";
const SAMA_WHY = T("This is the Sama Veda, the Veda of SONGS: the same old words, sung on long, wavy notes. Priests sang it around the sacred fire at a real yagna, and the recording was made right there. Long notes slow your breathing, just like when you hum.",
  "यह सामवेद है, गीतों का वेद: वही पुराने शब्द, लंबे लहराते सुरों पर गाए गए। पुरोहितों ने इसे एक असली यज्ञ में पवित्र अग्नि के पास गाया, और वहीं रिकॉर्ड किया गया। लंबे सुर साँस को धीमा करते हैं, जैसे गुनगुनाने से।",
  "Yeh Samaveda hai, geeton ka Veda: wahi puraane shabd, lambe lehraate suron par gaaye gaye. Purohiton ne ise ek asli yagya mein pavitra agni ke paas gaaya, aur wahin record kiya gaya. Lambe sur saans ko dheema karte hain, jaise gungunaane se.");
const HUM = T("Hum the long notes with the priests: mmmmm. Feel your chest buzz!", "पुरोहितों के साथ लंबे सुर गुनगुनाओ: म्म्म्म्। सीने में कंपन महसूस करो!", "Purohiton ke saath lambe sur gungunaao: mmmmm. Seene mein kampan mehsoos karo!");

const CHANTS: Track[] = [
  chant("gayatri", "🌅", "sunrise", T("Gayatri Mantra", "गायत्री मंत्र", "Gayatri Mantra"),
    T("The sunrise prayer, thousands of years old!", "सूर्योदय की प्रार्थना, हज़ारों साल पुरानी!", "Suryoday ki prarthana, hazaaron saal puraani!"),
    T("It asks the light of the sun to light up our minds, so we think clearly. In old India, children learned it on their very first day of school.", "यह सूर्य के प्रकाश से हमारी बुद्धि को रोशन करने की प्रार्थना है, ताकि हम साफ़ सोचें। पुराने भारत में बच्चे इसे स्कूल के पहले दिन सीखते थे।", "Yeh surya ke prakaash se hamaari buddhi ko roshan karne ki prarthana hai, taaki hum saaf sochein. Puraane Bharat mein bachche ise school ke pehle din seekhte the."),
    T("Fold your hands, close your eyes and imagine the sun rising inside your head.", "हाथ जोड़ो, आँखें बंद करो और कल्पना करो कि सूरज तुम्हारे मन में उग रहा है।", "Haath jodo, aankhein band karo aur kalpana karo ki sooraj tumhare mann mein ug raha hai."),
    "Rameshvar (Wikimedia Commons), recited respecting the tones", "Free Art Licence 1.3", `${COMMONS}Gayatri_Mantra_as_it_is.ogg`,
    { dev: "ॐ भूर्भुवः स्वः। तत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि। धियो यो नः प्रचोदयात्॥", iast: "oṃ bhūr bhuvaḥ svaḥ | tat savitur vareṇyaṃ bhargo devasya dhīmahi | dhiyo yo naḥ pracodayāt ||",
      meaning: T("We think of the bright light of the Sun; may it wake up our minds.", "हम सूर्य के उज्ज्वल प्रकाश का ध्यान करते हैं; वह हमारी बुद्धि को जगाए।", "Hum surya ke ujjwal prakaash ka dhyaan karte hain; woh hamaari buddhi ko jagaaye.") }),
  chant("mahamrityunjaya", "🥒", "waterfall", T("Mahamrityunjaya Mantra", "महामृत्युंजय मंत्र", "Mahamrityunjaya Mantra"),
    T("The mantra with a cucumber in it!", "वह मंत्र जिसमें ककड़ी है!", "Woh mantra jismein kakdi hai!"),
    T("It says: like a ripe cucumber slips easily off its vine, may we slip free from fear and sickness. People say it for anyone who is unwell, to send them strength.", "इसमें कहा है: जैसे पकी ककड़ी आसानी से बेल से छूट जाती है, वैसे हम डर और बीमारी से छूट जाएँ। लोग इसे बीमार लोगों को ताक़त भेजने के लिए बोलते हैं।", "Ismein kaha hai: jaise paki kakdi aasaani se bel se chhoot jaati hai, waise hum darr aur beemaari se chhoot jaayein. Log ise beemaar logon ko taakat bhejne ke liye bolte hain."),
    T("Think of someone who is ill or sad, and send them a little love while you listen.", "किसी बीमार या उदास को याद करो, और सुनते हुए उन्हें थोड़ा प्यार भेजो।", "Kisi beemaar ya udaas ko yaad karo, aur sunte hue unhe thoda pyaar bhejo."),
    "Rameshvar (Wikimedia Commons), recited respecting the tones", "Free Art Licence 1.3", `${COMMONS}Mrityunjaya.ogg`,
    { dev: "ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्। उर्वारुकमिव बन्धनान् मृत्योर्मुक्षीय मामृतात्॥", iast: "oṃ tryambakaṃ yajāmahe sugandhiṃ puṣṭivardhanam | urvārukam iva bandhanān mṛtyor mukṣīya māmṛtāt ||",
      meaning: T("We honour the three-eyed one who makes us strong. Like a cucumber from its vine, may we be freed from death, not from life.", "हम त्रिनेत्र भगवान को नमन करते हैं जो हमें शक्ति देते हैं। जैसे ककड़ी बेल से, वैसे हम मृत्यु से मुक्त हों, जीवन से नहीं।", "Hum trinetra Bhagwan ko naman karte hain jo humein shakti dete hain. Jaise kakdi bel se, waise hum mrityu se mukt hon, jeevan se nahi.") }),
  chant("guru_stotram", "🪔", "diyas", T("Guru Stotram", "गुरु स्तोत्रम्", "Guru Stotram"),
    T("A big thank-you song for teachers", "गुरुओं के लिए एक बड़ा धन्यवाद-गीत", "Guruon ke liye ek bada dhanyavaad-geet"),
    T("Guru means teacher: someone who takes away darkness (not knowing) and brings light (knowing). These verses thank the teacher, and the most famous one is below.", "गुरु यानी शिक्षक: जो अंधकार (न जानना) हटाकर प्रकाश (ज्ञान) लाता है। ये श्लोक गुरु को धन्यवाद देते हैं, सबसे प्रसिद्ध श्लोक नीचे है।", "Guru yaani shikshak: jo andhkaar (na jaanna) hatakar prakaash (gyaan) laata hai. Yeh shlok guru ko dhanyavaad dete hain, sabse prasiddh shlok neeche hai."),
    T("Think of your favourite teacher. What did they teach you?", "अपने सबसे प्यारे शिक्षक को याद करो। उन्होंने तुम्हें क्या सिखाया?", "Apne sabse pyaare teacher ko yaad karo. Unhone tumhe kya sikhaaya?"),
    "Swami Atmananda (Internet Archive)", "Public domain (CC0)", `${COMMONS}Sanskrit_Chanting_Guru_Stotram.ogg`,
    { dev: "गुरुर्ब्रह्मा गुरुर्विष्णुः गुरुर्देवो महेश्वरः। गुरुः साक्षात् परं ब्रह्म तस्मै श्रीगुरवे नमः॥", iast: "gurur brahmā gurur viṣṇuḥ gurur devo maheśvaraḥ | guruḥ sākṣāt paraṃ brahma tasmai śrī-gurave namaḥ ||",
      meaning: T("The teacher is like the creator, the protector and the great god: I bow to the teacher.", "गुरु ही ब्रह्मा, विष्णु और महेश्वर हैं: उस गुरु को नमन।", "Guru hi Brahma, Vishnu aur Maheshwar hain: us guru ko naman.") }),
  chant("ramayana_bala", "🏹", "sunrise", T("Ramayana: the opening verses", "रामायण: आरंभ के श्लोक", "Ramayan: aarambh ke shlok"),
    T("Two great Vedic masters begin the story of Rama", "दो महान वैदिक आचार्य राम की कथा शुरू करते हैं", "Do mahaan Vedic aacharya Ram ki katha shuru karte hain"),
    T("These reciters are Ghanapāṭhīs: Vedic masters who learned by heart for more than 12 years and can say every verse forwards, backwards and in knots. Before telling Rama's story, they sing these prayer verses, like a curtain opening.", "ये पाठक घनपाठी हैं: वैदिक आचार्य जिन्होंने 12 साल से ज़्यादा कंठस्थ किया और हर श्लोक आगे, पीछे और गाँठ बाँधकर बोल सकते हैं। राम की कथा से पहले वे ये प्रार्थना-श्लोक गाते हैं, जैसे परदा खुल रहा हो।", "Yeh paathak Ghanapaathi hain: Vedic aacharya jinhone 12 saal se zyada kanthasth kiya aur har shlok aage, peeche aur gaanth baandhkar bol sakte hain. Ram ki katha se pehle woh yeh prarthana-shlok gaate hain, jaise parda khul raha ho."),
    T("Sit like a story-listener: legs crossed, hands on knees, ears wide open!", "कथा सुनने वाले की तरह बैठो: पालथी मारकर, हाथ घुटनों पर, कान खुले!", "Katha sunne waale ki tarah baitho: paalthi maarkar, haath ghutno par, kaan khule!"),
    "Sriram Ghanapāṭhī and Harisītārāma Mūrti Ghanapāṭhī", "CC BY-SA 2.5 India", `${COMMONS}Kanda_1_BK-000-Dhyana_Shlokas.ogg`),
  chant("ramayana_sundara", "🐒", "lanka_waves", T("Sundara Kanda: Hanuman's journey", "सुंदरकांड: हनुमान की यात्रा", "Sundarkand: Hanuman ki yatra"),
    T("The part of the Ramayana where Hanuman leaps over the ocean!", "रामायण का वह भाग जहाँ हनुमान समुद्र पार छलाँग लगाते हैं!", "Ramayan ka woh bhaag jahaan Hanuman samudra paar chhalaang lagaate hain!"),
    T("Sundara Kanda is the brave and beautiful chapter: Hanuman jumps across the sea to find Sita. People recite it when they need courage. The same two Ghanapāṭhī masters recite its opening verses.", "सुंदरकांड वीर और सुंदर अध्याय है: हनुमान सीता को ढूँढने समुद्र पार कूदते हैं। लोग हिम्मत चाहिए तो इसे पढ़ते हैं। वही दो घनपाठी आचार्य इसके आरंभ के श्लोक पढ़ते हैं।", "Sundarkand veer aur sundar adhyaay hai: Hanuman Sita ko dhoondhne samudra paar koodte hain. Log himmat chahiye toh ise padhte hain. Wahi do Ghanapaathi aacharya iske aarambh ke shlok padhte hain."),
    T("Stretch your arms out like Hanuman flying over the waves!", "हनुमान की तरह बाँहें फैलाओ, लहरों के ऊपर उड़ते हुए!", "Hanuman ki tarah baahein phailaao, lehron ke upar udte hue!"),
    "Sriram Ghanapāṭhī and Harisītārāma Mūrti Ghanapāṭhī", "CC BY-SA 2.5 India", `${COMMONS}Kanda_5_SK-000-Dhyana_sloka.ogg`),
  chant("purusha_sukta", "🌌", "earth", T("Purusha Sukta (Rig Veda)", "पुरुष सूक्त (ऋग्वेद)", "Purush Sukt (Rigved)"),
    T("A giant with a thousand heads, eyes and feet!", "हज़ार सिर, हज़ार आँखें, हज़ार पैर वाला विराट!", "Hazaar sir, hazaar aankhein, hazaar pair waala viraat!"),
    T("This Rig Veda hymn imagines the whole universe as one huge person: the stars, the sun, the moon and all of us are parts of it. It's a way of saying everything is connected.", "यह ऋग्वेद का सूक्त पूरे ब्रह्मांड को एक विशाल पुरुष की तरह देखता है: तारे, सूरज, चाँद और हम सब उसके अंग हैं। यानी सब कुछ जुड़ा हुआ है।", "Yeh Rigved ka sukt poore brahmaand ko ek vishaal purush ki tarah dekhta hai: taare, sooraj, chaand aur hum sab uske ang hain. Yaani sab kuch juda hua hai."),
    T("Look at the stars in the picture. Can you count a thousand?", "तस्वीर में तारे देखो। क्या हज़ार गिन सकते हो?", "Tasveer mein taare dekho. Kya hazaar gin sakte ho?"),
    "Vedic recitation from the Internet Archive", "Public domain (CC0)", `${COMMONS}Purusha_Sukta.wav`,
    { dev: "सहस्रशीर्षा पुरुषः सहस्राक्षः सहस्रपात्।", iast: "sahasraśīrṣā puruṣaḥ sahasrākṣaḥ sahasrapāt |",
      meaning: T("The great Being has a thousand heads, a thousand eyes and a thousand feet.", "विराट पुरुष के हज़ार सिर, हज़ार आँखें और हज़ार पैर हैं।", "Viraat purush ke hazaar sir, hazaar aankhein aur hazaar pair hain.") }),
  chant("lingashtakam", "🔱", "ganga_aarti", T("Lingashtakam (for Shiva)", "लिङ्गाष्टकम् (शिव के लिए)", "Lingashtakam (Shiv ke liye)"),
    T("Eight verses that all end the same way: can you catch it?", "आठ श्लोक जो एक ही तरह ख़त्म होते हैं: पकड़ सकते हो?", "Aath shlok jo ek hi tarah khatam hote hain: pakad sakte ho?"),
    T("Ashtakam means 'eight verses'. Each verse ends with the same line, so after the first one you can join in. Repeating lines help our memory, that's why songs have choruses.", "अष्टकम् यानी 'आठ श्लोक'। हर श्लोक एक ही पंक्ति पर ख़त्म होता है, तो पहले के बाद तुम साथ बोल सकते हो। दोहराई पंक्तियाँ याद रखने में मदद करती हैं, इसीलिए गानों में मुखड़ा होता है।", "Ashtakam yaani 'aath shlok'. Har shlok ek hi line par khatam hota hai, toh pehle ke baad tum saath bol sakte ho. Dohraayi lines yaad rakhne mein madad karti hain, isiliye gaanon mein mukhda hota hai."),
    T("Raise one finger every time you hear the line come back. How many fingers at the end?", "हर बार वह पंक्ति लौटे तो एक उँगली उठाओ। आख़िर में कितनी उँगलियाँ?", "Har baar woh line laute toh ek ungli uthaao. Aakhir mein kitni ungliyaan?"),
    "Vaish@26 (Wikimedia Commons)", "Public domain (CC0)", `${COMMONS}श्रीलिङ्गाष्टकम्.ogg`,
    { dev: "तत् प्रणमामि सदाशिव लिङ्गम्॥", iast: "tat praṇamāmi sadāśiva liṅgam ||",
      meaning: T("The line that comes back: I bow to Sadashiva.", "जो पंक्ति लौटती है: मैं सदाशिव को प्रणाम करता हूँ।", "Jo line laut-ti hai: main Sadashiv ko pranaam karta hoon.") }),
  chant("mukunda_mala", "💿", "varanasi_1899", T("Mukunda Mala, sung 100 years ago", "मुकुंद माला, 100 साल पहले गाई गई", "Mukund Mala, 100 saal pehle gaayi gayi"),
    T("A voice from an old gramophone record!", "पुराने ग्रामोफ़ोन रिकॉर्ड की आवाज़!", "Puraane gramophone record ki awaaz!"),
    T("Bengaluru Nagaratnamma (1878–1952) was one of India's greatest singers and helped start the famous Tyagaraja music festival. This was recorded on a spinning disc long before phones existed: listen for the soft crackle!", "बेंगलुरु नागरत्नम्मा (1878–1952) भारत की महान गायिकाओं में थीं और प्रसिद्ध त्यागराज संगीत उत्सव शुरू करने में मदद की। यह फ़ोन आने से बहुत पहले घूमती डिस्क पर रिकॉर्ड हुआ: हल्की खरखराहट सुनो!", "Bengaluru Nagaratnamma (1878–1952) Bharat ki mahaan gaayikaaon mein thin aur prasiddh Tyagaraja sangeet utsav shuru karne mein madad ki. Yeh phone aane se bahut pehle ghoomti disc par record hua: halki kharkharaahat suno!"),
    T("Close your eyes: can you hear the crackle of the old record under the singing?", "आँखें बंद करो: क्या गाने के नीचे पुराने रिकॉर्ड की खरखराहट सुनाई देती है?", "Aankhein band karo: kya gaane ke neeche puraane record ki kharkharaahat sunaai deti hai?"),
    "Bengaluru Nagaratnamma (historic gramophone recording)", "Public domain", `${COMMONS}Mukunda_Mala_stotra_by_Bengaluru_Nagaratnamma.ogg`),
  chant("vamadevyam", "🔥", "yagna", T("Vamadevyam Sama", "वामदेव्यम् साम", "Vaamdevyam Saam"),
    T("Priests singing around a real sacred fire", "असली यज्ञ-अग्नि के पास गाते पुरोहित", "Asli yagya-agni ke paas gaate purohit"),
    SAMA_WHY, HUM, `Priests at the Jyoti Aptoryama Somayaga, Gargeyapuram, Kurnool (2014), ${YAGNA}`, "CC BY-SA 4.0", `${COMMONS}वामदेव्यं_साम_Vamadevyam_sama.ogg`),
  chant("dhenu_sama", "🐄", "cows", T("The cow-milking song (Dhenu Sama)", "गाय दुहने का गीत (धेनु साम)", "Gaay duhne ka geet (Dhenu Saam)"),
    T("A song sung while a cow is being milked!", "गाय दुहते समय गाया जाने वाला गीत!", "Gaay duhte samay gaaya jaane waala geet!"),
    T("Dhenu means cow. In this ritual the priests sing while a cow is milked, to thank her for her milk. Thousands of years ago people already sang to say thank you for food.", "धेनु यानी गाय। इस विधि में गाय दुहते समय पुरोहित गाते हैं, उसके दूध के लिए धन्यवाद देने। हज़ारों साल पहले भी लोग भोजन के लिए गाकर धन्यवाद देते थे।", "Dhenu yaani gaay. Is vidhi mein gaay duhte samay purohit gaate hain, uske doodh ke liye dhanyavaad dene. Hazaaron saal pehle bhi log bhojan ke liye gaakar dhanyavaad dete the."),
    T("Say thank you in your head to the cow for the milk you drink!", "जो दूध पीते हो उसके लिए गाय को मन में धन्यवाद कहो!", "Jo doodh peete ho uske liye gaay ko mann mein dhanyavaad kaho!"),
    `Priests at the Jyoti Aptoryama Somayaga, Gargeyapuram, Kurnool (28 Jan 2015), ${YAGNA}`, "CC BY-SA 4.0", `${COMMONS}धेनुसाम_Dhenu_sama.ogg`),
  chant("satrasya_rddhi", "🪜", "earth", T("Climbing to the sky (Satrasya Rddhi Sama)", "आकाश तक सीढ़ी (सत्रस्य ऋद्धि साम)", "Aakaash tak seedhi (Satrasya Riddhi Saam)"),
    T("A chant about climbing step by step to the stars", "कदम-कदम तारों तक चढ़ने का गान", "Kadam-kadam taaron tak chadhne ka gaan"),
    T("This Sama chant is about rising higher and higher, one step at a time, from the earth to the sky. It is sung by Dr. Girija Prasad Shadangi of Sri Venkateswara Vedic University, Tirupati.", "यह साम-गान धरती से आकाश तक एक-एक कदम ऊपर उठने के बारे में है। इसे श्री वेंकटेश्वर वैदिक विश्वविद्यालय, तिरुपति के डॉ. गिरिजा प्रसाद षडंगी ने गाया है।", "Yeh saam-gaan dharti se aakaash tak ek-ek kadam upar uthne ke baare mein hai. Ise Shri Venkateshwara Vedic Vishwavidyalaya, Tirupati ke Dr. Girija Prasad Shadangi ne gaaya hai."),
    T("Every time the voice goes up, lift your hands one step higher!", "हर बार आवाज़ ऊपर जाए, हाथ एक सीढ़ी ऊपर उठाओ!", "Har baar awaaz upar jaaye, haath ek seedhi upar uthaao!"),
    "Dr. Girija Prasad Shadangi (Sri Venkateswara Vedic University, Tirupati), recorded by Puranastudy", "CC BY-SA 4.0", `${COMMONS}सत्रस्य_ऋद्धिः_साम_Satrasya_rddhi_Sama.ogg`),
  chant("brihat_sama", "🏔️", "himalaya", T("Brihat Sama: the BIG song", "बृहत् साम: बड़ा गान", "Brihat Saam: bada gaan"),
    T("Brihat means BIG: one of the most important Vedic songs", "बृहत् यानी बड़ा: सबसे महत्वपूर्ण वैदिक गानों में से एक", "Brihat yaani bada: sabse mahatvapoorn Vedic gaanon mein se ek"),
    SAMA_WHY, HUM, `Priests at the Jyoti Aptoryama Somayaga, Gargeyapuram, Kurnool (2015), ${YAGNA}`, "CC BY-SA 4.0", `${COMMONS}बृहत्_साम_Brihat_sama.ogg`),
];

export const TRACKS: Track[] = [
  {
    id: "calm_waves", icon: "🌊", task: "breathe", group: "melo", video: "lanka_waves",
    title: T("Calm waves", "शांत लहरें", "Shaant lehrein"),
    goal: T("Calm down", "शांत हो जाओ", "Shaant ho jaao"),
    why: T("Slow, soft music helps your breathing slow down. Slow breathing tells your body \"you are safe\", so your heart slows and you feel calmer.", "धीमा, कोमल संगीत साँसों को धीमा करता है। धीमी साँसें शरीर को बताती हैं \"तुम सुरक्षित हो\", तो दिल धीमा होता है और मन शांत होता है।", "Dheema, komal sangeet saanson ko dheema karta hai. Dheemi saansein shareer ko bataati hain \"tum surakshit ho\", toh dil dheema hota hai aur mann shaant hota hai."),
    how: T("Breathe with the circle: in while it grows, out while it shrinks.", "गोले के साथ साँस लो: बड़ा हो तो अंदर, छोटा हो तो बाहर।", "Gole ke saath saans lo: bada ho toh andar, chhota ho toh bahar."),
    def: { bpm: 64, key: 65, prog: [I, VI, IV, V], density: 0.28, melody: "flute", shaker: false, bass: true },
  },
  {
    id: "bell_hunt", icon: "🔔", task: "bells", group: "melo",
    title: T("Bell hunt", "घंटी की खोज", "Ghanti ki khoj"),
    goal: T("Focus", "ध्यान लगाओ", "Dhyaan lagaao"),
    why: T("Listening for one special sound while other sounds play trains your attention, the same skill you use to listen to your teacher in a noisy class.", "दूसरी आवाज़ों के बीच एक ख़ास आवाज़ सुनना ध्यान को मज़बूत करता है, वही कौशल जो शोर वाली क्लास में टीचर को सुनने में काम आता है।", "Doosri awaazon ke beech ek khaas awaaz sunna dhyaan ko mazboot karta hai, wahi skill jo shor waali class mein teacher ko sunne mein kaam aata hai."),
    how: T("Close your eyes. Count the high bells in your head. At the end, tell Melo how many!", "आँखें बंद करो। ऊँची घंटियाँ मन में गिनो। आख़िर में मेलो को बताओ कितनी!", "Aankhein band karo. Oonchi ghantiyaan mann mein gino. Aakhir mein Melo ko batao kitni!"),
    def: { bpm: 84, key: 60, prog: [I, IV, VI, V], density: 0.35, melody: "pluck", shaker: false, bass: true, bells: true },
  },
  {
    id: "happy_dance", icon: "💃", task: "dance", group: "melo",
    title: T("Happy dance", "खुशी का नाच", "Khushi ka naach"),
    goal: T("Feel happy and awake", "खुश और ताज़ा महसूस करो", "Khush aur taaza mehsoos karo"),
    why: T("Bouncy music and moving your body make your heart beat a little faster and your body makes feel-good chemicals. That's why dancing can lift a grumpy mood.", "उछलता संगीत और नाचने से दिल थोड़ा तेज़ धड़कता है और शरीर अच्छा महसूस कराने वाले रसायन बनाता है। इसलिए नाचने से चिड़चिड़ा मन खुश हो जाता है।", "Uchhalta sangeet aur naachne se dil thoda tez dhadakta hai aur shareer achha mehsoos karaane waale chemicals banaata hai. Isliye naachne se chidchida mann khush ho jaata hai."),
    how: T("Stand up! Do what Melo shows: clap, jump, spin, and FREEZE!", "खड़े हो जाओ! मेलो जो दिखाए वह करो: ताली, कूदो, घूमो, और रुक जाओ!", "Khade ho jaao! Melo jo dikhaaye woh karo: taali, koodo, ghoomo, aur ruk jaao!"),
    def: { bpm: 124, key: 67, prog: [I, IV, I, V], density: 0.65, melody: "pluck", shaker: true, bass: true },
  },
  {
    id: "bhupali", icon: "🪔", task: "breathe", group: "melo", video: "sunrise",
    title: T("Morning raga: Bhupali", "सुबह का राग: भूपाली", "Subah ka raag: Bhupali"),
    goal: T("Peaceful and steady", "शांत और स्थिर", "Shaant aur sthir"),
    why: T("Indian ragas are melodies for a time of day. Bhupali uses only five notes, Sa Re Ga Pa Dha, which always sound sweet together. The drone (Sa and Pa humming underneath) gives your mind something steady to rest on.", "भारतीय राग दिन के अलग-अलग समय के सुर हैं। भूपाली में सिर्फ़ पाँच सुर हैं, सा रे ग प ध, जो साथ में हमेशा मीठे लगते हैं। नीचे गूँजता सा और प (तानपुरा) मन को टिकने का सहारा देता है।", "Bhaarteeya raag din ke alag-alag samay ke sur hain. Bhupali mein sirf paanch sur hain, Sa Re Ga Pa Dha, jo saath mein hamesha meethe lagte hain. Neeche goonjta Sa aur Pa (tanpura) mann ko tikne ka sahaara deta hai."),
    how: T("Sit straight, breathe with the circle, and listen to the humming Sa underneath.", "सीधे बैठो, गोले के साथ साँस लो, और नीचे गूँजते सा को सुनो।", "Seedhe baitho, gole ke saath saans lo, aur neeche goonjte Sa ko suno."),
    def: { bpm: 58, key: 60, prog: [I], density: 0.3, melody: "flute", shaker: false, bass: false, drone: true },
  },
  {
    id: "canon", icon: "🎻", task: "count8", group: "melo",
    title: T("Pachelbel's Canon", "पाखेलबेल का कैनन", "Pachelbel ka Canon"),
    goal: T("Calm and clever ears", "शांत मन, तेज़ कान", "Shaant mann, tez kaan"),
    why: T("The same 8 chords come back again and again. When your brain can guess what comes next, music feels safe and satisfying, and noticing the pattern is great exercise for your listening brain.", "वही 8 कॉर्ड बार-बार लौटते हैं। जब दिमाग़ अंदाज़ा लगा पाता है कि आगे क्या आएगा, संगीत सुरक्षित और अच्छा लगता है, और पैटर्न पहचानना सुनने वाले दिमाग़ की बढ़िया कसरत है।", "Wahi 8 chord baar-baar lautte hain. Jab dimaag andaaza laga paata hai ki aage kya aayega, sangeet surakshit aur achha lagta hai, aur pattern pehchaanna sunne waale dimaag ki badhiya kasrat hai."),
    how: T("Count the 8 chords with Melo: 1, 2, 3 ... 8, and back to 1!", "मेलो के साथ 8 कॉर्ड गिनो: 1, 2, 3 ... 8, और फिर 1!", "Melo ke saath 8 chord gino: 1, 2, 3 ... 8, aur phir 1!"),
    def: { bpm: 72, key: 60, prog: [I], density: 0, melody: "pluck", shaker: false, bass: true, piece: CANON },
  },
  {
    id: "ode_to_joy", icon: "🎉", task: "hum", group: "melo",
    title: T("Ode to Joy (Beethoven)", "आनंद का गीत (बीथोवन)", "Ode to Joy (Beethoven)"),
    goal: T("Joy and friendship", "आनंद और दोस्ती", "Aanand aur dosti"),
    why: T("Beethoven wrote this tune when he was almost deaf: he heard it in his mind. It moves step by step, like stairs, so it's easy to hum, and humming a happy tune lifts your mood.", "बीथोवन ने यह धुन तब बनाई जब वे लगभग सुन नहीं सकते थे: उन्होंने इसे मन में सुना। यह सीढ़ियों की तरह एक-एक कदम चलती है, इसलिए गुनगुनाना आसान है, और ख़ुशी की धुन गुनगुनाने से मन अच्छा होता है।", "Beethoven ne yeh dhun tab banaayi jab woh lagbhag sun nahi sakte the: unhone ise mann mein suna. Yeh seedhiyon ki tarah ek-ek kadam chalti hai, isliye gungunaana aasaan hai, aur khushi ki dhun gungunaane se mann achha hota hai."),
    how: T("Hum along, and show the tune going up and down with your hand, like stairs.", "साथ में गुनगुनाओ, और हाथ से धुन का ऊपर-नीचे जाना दिखाओ, सीढ़ियों की तरह।", "Saath mein gungunaao, aur haath se dhun ka upar-neeche jaana dikhaao, seedhiyon ki tarah."),
    def: { bpm: 100, key: 60, prog: [I], density: 0, melody: "flute", shaker: false, bass: true, piece: ODE },
  },
  {
    id: "lullaby", icon: "🌙", task: "breathe", group: "melo", video: "moonrise",
    title: T("Brahms' lullaby", "ब्राम्स की लोरी", "Brahms ki lori"),
    goal: T("Sleepy time", "सोने का समय", "Sone ka samay"),
    why: T("Gentle, slow, repeating music helps your body get ready for sleep. Brahms wrote this lullaby in 1868 for a friend's new baby, and children have fallen asleep to it ever since.", "कोमल, धीमा, दोहराता संगीत शरीर को सोने के लिए तैयार करता है। ब्राम्स ने यह लोरी 1868 में एक दोस्त के नए बच्चे के लिए लिखी थी, तब से बच्चे इसे सुनकर सोते हैं।", "Komal, dheema, dohraata sangeet shareer ko sone ke liye taiyaar karta hai. Brahms ne yeh lori 1868 mein ek dost ke naye bachche ke liye likhi thi, tab se bachche ise sunkar sote hain."),
    how: T("Lie down, close your eyes, and breathe slowly with the music.", "लेट जाओ, आँखें बंद करो, और संगीत के साथ धीरे-धीरे साँस लो।", "Let jaao, aankhein band karo, aur sangeet ke saath dheere-dheere saans lo."),
    def: { bpm: 60, key: 60, prog: [I], density: 0, melody: "box", shaker: false, bass: false, piece: LULLABY },
  },

  // --- real recordings (public domain or Creative Commons; see public/listen/CREDITS.md) ---
  {
    id: "mozart_k448", icon: "🎹🎹", task: "duet", group: "recordings", video: "piano",
    title: T("Mozart: Sonata for Two Pianos, K. 448", "मोत्सार्ट: दो पियानो की सोनाटा, K. 448", "Mozart: do piano ki sonata, K. 448"),
    goal: T("Bright and cheerful", "चमकीला और खुशमिज़ाज", "Chamkeela aur khushmizaaj"),
    why: T("Two pianos play together and talk to each other: one says a tune, the other answers. In 1993 scientists found that students did a puzzle a little better for about 15 minutes after hearing this piece. Later studies showed why: any music you enjoy puts you in a good, wide-awake mood, and a good mood helps you think. So enjoy it!", "दो पियानो साथ बजते हैं और आपस में बात करते हैं: एक धुन कहता है, दूसरा जवाब देता है। 1993 में वैज्ञानिकों ने पाया कि यह सुनने के बाद लगभग 15 मिनट तक विद्यार्थियों ने एक पहेली थोड़ी बेहतर की। बाद की खोजों ने कारण बताया: जो भी संगीत तुम्हें अच्छा लगे, वह मन को खुश और चुस्त करता है, और खुश मन अच्छा सोचता है। तो मज़े से सुनो!", "Do piano saath bajte hain aur aapas mein baat karte hain: ek dhun kehta hai, doosra jawaab deta hai. 1993 mein vaigyaanikon ne paaya ki yeh sunne ke baad lagbhag 15 minute tak students ne ek paheli thodi behtar ki. Baad ki khojon ne kaaran bataaya: jo bhi sangeet tumhe achha lage, woh mann ko khush aur chust karta hai, aur khush mann achha sochta hai. Toh maze se suno!"),
    how: T("Listen for the two pianos talking. Point left when you hear one, right when the other answers!", "दो पियानो की बातचीत सुनो। एक सुनाई दे तो बाईं ओर इशारा करो, दूसरा जवाब दे तो दाईं ओर!", "Do piano ki baatcheet suno. Ek sunaai de toh baayein or ishaara karo, doosra jawaab de toh daayein or!"),
    recording: { src: "/listen/mozart-k448-1.mp3", performer: "Wikimedia Commons user Alton and a friend (2005), 1st movement", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Mozart_K448.ogg" },
  },
  {
    id: "moonlight", icon: "🌕", task: "imagine", group: "recordings", video: "moonrise",
    title: T("Beethoven: Moonlight Sonata", "बीथोवन: मूनलाइट सोनाटा", "Beethoven: Moonlight Sonata"),
    goal: T("Quiet and dreamy", "शांत और सपनों जैसा", "Shaant aur sapnon jaisa"),
    why: T("This music is slow and soft, with the same gentle three-note pattern rolling on like small waves. Slow, steady music helps your body slow down. Someone once said it sounds like moonlight on a lake, and the name stuck!", "यह संगीत धीमा और कोमल है, जिसमें तीन सुरों का एक ही कोमल पैटर्न छोटी लहरों की तरह चलता रहता है। धीमा, स्थिर संगीत शरीर को धीमा करता है। किसी ने कहा कि यह झील पर चाँदनी जैसा लगता है, और यही नाम पड़ गया!", "Yeh sangeet dheema aur komal hai, jismein teen suron ka ek hi komal pattern chhoti lehron ki tarah chalta rehta hai. Dheema, sthir sangeet shareer ko dheema karta hai. Kisi ne kaha ki yeh jheel par chaandni jaisa lagta hai, aur yahi naam pad gaya!"),
    how: T("Close your eyes. Imagine the moon shining on a quiet lake. What else can you see?", "आँखें बंद करो। एक शांत झील पर चमकते चाँद की कल्पना करो। और क्या दिखता है?", "Aankhein band karo. Ek shaant jheel par chamakte chaand ki kalpana karo. Aur kya dikhta hai?"),
    recording: { src: "/listen/beethoven-moonlight-1.mp3", performer: "Paul Pitman for Musopen, 1st movement (Adagio sostenuto)", licence: "Public domain", source: "https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_sonata_no._14_in_c_sharp_minor_%27moonlight%27,_op._27_no._2_-_i._adagio_sostenuto.ogg" },
  },
  // --- shlokas and mantras recited by real reciters (see public/listen/chants/CREDITS.md) ---
  ...CHANTS,
  // --- binaural beats (headphones) ---
  ...BINAURAL_TRACKS(),
];

export const DANCE_MOVES: Text[] = [
  T("👏 Clap!", "👏 ताली!", "👏 Taali!"), T("🦘 Jump!", "🦘 कूदो!", "🦘 Koodo!"), T("🌀 Spin!", "🌀 घूमो!", "🌀 Ghoomo!"),
  T("🙌 Hands up!", "🙌 हाथ ऊपर!", "🙌 Haath upar!"), T("🧊 FREEZE!", "🧊 रुक जाओ!", "🧊 Ruk jaao!"), T("🐧 Waddle like a penguin!", "🐧 पेंगुइन की तरह चलो!", "🐧 Penguin ki tarah chalo!"),
];

function BINAURAL_TRACKS(): Track[] {
  const why = (band: string, bandHi: string, rest: Text): Text => ({
    en: `With headphones, each ear hears a slightly different tone and your brain hears the difference as a slow beat (${band}). ${rest.en} Scientists are still studying beats like these: some people feel a small change, others none. Many simply enjoy the steady sound.`,
    hi: `हेडफ़ोन से हर कान में थोड़ा अलग सुर जाता है और दिमाग़ दोनों का अंतर एक धीमी धड़कन की तरह सुनता है (${bandHi})। ${rest.hi} वैज्ञानिक अभी इस पर खोज कर रहे हैं: कुछ लोगों को थोड़ा फ़र्क़ लगता है, कुछ को नहीं। बहुतों को बस यह स्थिर आवाज़ अच्छी लगती है।`,
    hinglish: `Headphone se har kaan mein thoda alag sur jaata hai aur dimaag dono ka antar ek dheemi dhadkan ki tarah sunta hai (${band}). ${rest.hinglish} Vaigyaanik abhi is par khoj kar rahe hain: kuch logon ko thoda farak lagta hai, kuch ko nahi. Bahuton ko bas yeh sthir awaaz achhi lagti hai.`,
  });
  const how = T("Put on headphones first (both ears!). Keep the sound soft, sit or lie still, and breathe with the circle.", "पहले हेडफ़ोन लगाओ (दोनों कानों में!)। आवाज़ धीमी रखो, शांत बैठो या लेटो, और गोले के साथ साँस लो।", "Pehle headphone lagaao (dono kaanon mein!). Awaaz dheemi rakho, shaant baitho ya leto, aur gole ke saath saans lo.");
  const mk = (id: string, icon: string, beat: number, title: Text, goal: Text, band: string, bandHi: string, rest: Text): Track =>
    ({ id, icon, task: "breathe", group: "binaural", video: "aurora", title, goal, why: why(band, bandHi, rest), how, binaural: { beat, carrier: 200 } });
  return [
    mk("beat_delta", "😴", 2, T("Sleepy beats · 2 Hz", "नींद की धड़कन · 2 Hz", "Neend ki dhadkan · 2 Hz"), T("Get ready for sleep", "सोने की तैयारी", "Sone ki taiyaari"),
      "2 beats a second, like the brain's waves in deep sleep", "एक सेकंड में 2 धड़कन, गहरी नींद की दिमाग़ी लहरों जैसी",
      T("It is a slow, sleepy rhythm.", "यह धीमी, नींद वाली लय है।", "Yeh dheemi, neend waali lay hai.")),
    mk("beat_theta", "🌙", 6, T("Dreamy beats · 6 Hz", "सपनों की धड़कन · 6 Hz", "Sapnon ki dhadkan · 6 Hz"), T("Relax and daydream", "आराम और कल्पना", "Aaraam aur kalpana"),
      "6 beats a second, like the brain's waves when you are drowsy or daydreaming", "एक सेकंड में 6 धड़कन, उनींदे या ख़यालों में खोए दिमाग़ की लहरों जैसी",
      T("It is a calm, floating rhythm.", "यह शांत, तैरती-सी लय है।", "Yeh shaant, tairti si lay hai.")),
    mk("beat_alpha", "🍃", 10, T("Calm beats · 10 Hz", "शांत धड़कन · 10 Hz", "Shaant dhadkan · 10 Hz"), T("Calm and ready", "शांत और तैयार", "Shaant aur taiyaar"),
      "10 beats a second, like the brain's waves when you are awake but relaxed, eyes closed", "एक सेकंड में 10 धड़कन, जागते पर आराम में, आँखें बंद, दिमाग़ की लहरों जैसी",
      T("It is a relaxed-but-awake rhythm, nice before homework or practice.", "यह आराम वाली पर जागी हुई लय है, होमवर्क या अभ्यास से पहले अच्छी।", "Yeh aaraam waali par jaagi hui lay hai, homework ya abhyaas se pehle achhi.")),
    mk("beat_beta", "⚡", 15, T("Awake beats · 15 Hz", "चुस्ती की धड़कन · 15 Hz", "Chusti ki dhadkan · 15 Hz"), T("Wake up and pay attention", "जागो और ध्यान दो", "Jaago aur dhyaan do"),
      "15 beats a second, like the brain's waves when you are busy thinking", "एक सेकंड में 15 धड़कन, सोचने में व्यस्त दिमाग़ की लहरों जैसी",
      T("It is a busy, wide-awake rhythm.", "यह व्यस्त, पूरी तरह जागी हुई लय है।", "Yeh vyast, poori tarah jaagi hui lay hai.")),
    mk("beat_gamma", "✨", 40, T("Bright beats · 40 Hz", "चमक की धड़कन · 40 Hz", "Chamak ki dhadkan · 40 Hz"), T("Sharp attention", "तेज़ ध्यान", "Tez dhyaan"),
      "40 beats a second, like the brain's fastest waves when it puts things together", "एक सेकंड में 40 धड़कन, चीज़ें जोड़ते दिमाग़ की सबसे तेज़ लहरों जैसी",
      T("It is a very fast, bright rhythm.", "यह बहुत तेज़, चमकीली लय है।", "Yeh bahut tez, chamkeeli lay hai.")),
  ];
}

export const GROUPS: { id: ListenGroup; icon: string; title: Text }[] = [
  { id: "melo", icon: "🦉", title: T("Melo plays", "मेलो बजाता है", "Melo bajaata hai") },
  { id: "recordings", icon: "🎼", title: T("Real recordings of great music", "महान संगीत की असली रिकॉर्डिंग", "Mahaan sangeet ki asli recording") },
  { id: "chants", icon: "🕉️", title: T("Shlokas and mantras by real reciters", "असली पाठकों द्वारा श्लोक और मंत्र", "Asli paathakon dwaara shlok aur mantra") },
  { id: "binaural", icon: "🎧", title: T("Binaural beats (headphones)", "बाइनॉरल बीट्स (हेडफ़ोन)", "Binaural beats (headphone)") },
];

export const MOODS_FACES = ["😢", "😟", "🙂", "😄"] as const;
