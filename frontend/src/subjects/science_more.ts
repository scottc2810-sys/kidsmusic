// More class 1-5 science, explained with the simplest everyday comparisons ("your bones are a frame like the
// poles of a tent"), each topic with diagrams and questions that ask WHY, plus extra concept cards for the
// first science topics.
import type { Text } from "../i18n";
import { pick, shuffle, T, type Card, type Exercise, type Rng } from "./maths";
import type { SciTopic } from "./science";

const D = (name: string, show: "names" | "numbers" = "names") => ({ type: "diagram" as const, name, show });
/** A question from a pool: [prompt, right answer, other choices, why]. */
type Q = [string, string, string[], string];
const fromPool = (rng: Rng, pool: Q[], visual?: Exercise["visual"]): Exercise => {
  const [p, a, others, why] = pick(rng, pool);
  return { prompt: T(p), visual, choices: shuffle(rng, [a, ...others]), answer: a, why: T(why) };
};

const bones: SciTopic = {
  id: "bones_muscles", strand: "body", icon: "🦴", title: T("Bones and muscles", "हड्डियाँ और मांसपेशियाँ", "Haddiyan aur muscles"), grades: [2, 4],
  cards: [
    { title: T("A frame inside you"), say: T("Your bones are like the poles of a tent: they hold you up and give you shape. Without bones you'd be floppy like a jelly! Your skull is a helmet for your brain, your ribs are a cage that protects your heart and lungs.", "हड्डियाँ तंबू के डंडों जैसी हैं: तुम्हें खड़ा रखती हैं और आकार देती हैं। बिना हड्डियों के तुम जैली जैसे ढीले होते! खोपड़ी दिमाग़ का हेलमेट है, पसलियाँ दिल-फेफड़ों का पिंजरा।", "Haddiyan tent ke dando jaisi hain: tumhe khada rakhti hain aur shape deti hain. Bina haddiyon ke tum jelly jaise dheele hote! Khopdi dimaag ka helmet hai, pasliyan dil-phephdon ka pinjra."), visual: D("skeleton") },
    { title: T("Muscles pull"), say: T("Muscles are like strings that PULL on bones to move them. They can only pull, never push, so they work in pairs: one bends your arm, the other straightens it. Bones meet at JOINTS, like hinges on a door.", "मांसपेशियाँ डोरियों जैसी हैं जो हड्डियों को खींचती हैं। वे सिर्फ़ खींच सकती हैं, धकेल नहीं सकतीं, इसलिए जोड़ी में काम करती हैं: एक बाँह मोड़ती, दूसरी सीधी करती। हड्डियाँ जोड़ों पर मिलती हैं, दरवाज़े के कब्ज़े जैसे।", "Muscles doriyon jaisi hain jo haddiyon ko KHEENCHTI hain. Woh sirf kheench sakti hain, dhakel nahi sakti, isliye jodi mein kaam karti hain: ek baanh modti, doosri seedhi karti. Haddiyan JOINTS pe milti hain, darwaaze ke kabze jaise.") },
  ],
  make: (_d, rng) => fromPool(rng, [
    ["Which bones protect your heart and lungs like a cage?", "ribs", ["skull", "toes"], "The ribs curve around your chest like a cage, keeping the heart and lungs safe."],
    ["What protects your brain like a helmet?", "skull", ["ribs", "spine"], "The skull is a hard, round case around the brain."],
    ["Where two bones meet and bend, like a door hinge, is called a…", "joint", ["muscle", "skin"], "Joints (knee, elbow) let bones bend, just like a hinge lets a door swing."],
    ["What do muscles do to move your bones?", "pull", ["push", "melt"], "Muscles can only pull. That's why they work in pairs: one pulls one way, its partner pulls back."],
    ["Which food helps build strong bones?", "milk", ["chips", "soda"], "Milk has calcium, the stuff bones are made of."],
  ], D("skeleton")),
};

const teeth: SciTopic = {
  id: "teeth", strand: "body", icon: "🦷", title: T("Our teeth", "हमारे दाँत", "Hamare daant"), grades: [1, 3],
  cards: [
    { title: T("Different teeth, different jobs"), say: T("Front teeth (incisors) are like scissors: they CUT. Pointy teeth (canines) TEAR. Big back teeth (molars) are like a grinding stone: they CRUSH food into small bits.", "आगे के दाँत (कृंतक) कैंची जैसे: काटते हैं। नुकीले (रदनक) फाड़ते हैं। पीछे के बड़े (दाढ़) चक्की जैसे: पीसते हैं।", "Aage ke daant (incisors) kainchi jaise: KAATTE hain. Nukeele (canines) PHAADTE hain. Peeche ke bade (molars) chakki jaise: PEESTE hain."), visual: D("tooth") },
    { title: T("Keep them clean"), say: T("Tiny germs love sugar left on teeth. They make acid that makes holes (cavities). Brush twice a day, rinse after sweets, and visit the dentist. Your milk teeth fall out around age 6 and grown-up teeth come in!", "छोटे कीटाणु दाँतों पर बची चीनी पसंद करते हैं। वे एसिड बनाते हैं जिससे छेद होते हैं। दिन में दो बार ब्रश करो, मीठे के बाद कुल्ला करो। दूध के दाँत 6 साल के आसपास गिरते हैं और पक्के आते हैं!", "Chhote germs daanton pe bachi cheeni pasand karte hain. Woh acid banate hain jisse chhed hote hain. Din mein do baar brush karo, meethe ke baad kulla karo. Doodh ke daant 6 saal ke aaspaas girte hain aur pakke aate hain!") },
  ],
  make: (_d, rng) => fromPool(rng, [
    ["Which teeth cut food like scissors?", "front teeth", ["back teeth", "pointy teeth"], "Front teeth (incisors) are thin and sharp: perfect for biting and cutting."],
    ["Which teeth grind food like a grinding stone?", "back teeth", ["front teeth", "pointy teeth"], "Back teeth (molars) are wide and flat to crush food."],
    ["How often should you brush your teeth?", "twice a day", ["once a week", "never"], "Morning and night, to remove the food and germs that cause holes."],
    ["Why do sweets cause cavities?", "germs turn sugar into acid", ["sweets are hard", "sugar is cold"], "Germs eat the sugar and make acid, which slowly makes holes in teeth."],
  ], D("tooth")),
};

const digestion: SciTopic = {
  id: "digestion", strand: "body", icon: "🍽️", title: T("Where food goes", "भोजन कहाँ जाता है", "Khaana kahan jaata hai"), grades: [3, 5],
  cards: [{ title: T("A long tube journey"), say: T("1. MOUTH: teeth chew, saliva makes food soft. 2. FOOD PIPE: a slide down to the stomach. 3. STOMACH: a mixing bag with juices. 4. SMALL INTESTINE: good stuff goes into the blood. 5. LARGE INTESTINE: water is taken back, waste leaves the body.", "1. मुँह: दाँत चबाते, लार नरम करती। 2. भोजन नली: पेट तक फिसलपट्टी। 3. पेट: रसों वाला मिक्सर। 4. छोटी आँत: पोषण ख़ून में जाता। 5. बड़ी आँत: पानी वापस, कचरा बाहर।", "1. MUNH: daant chabate, laar naram karti. 2. FOOD PIPE: pet tak slide. 3. PET: juices wala mixer. 4. CHHOTI AANT: poshan khoon mein jaata. 5. BADI AANT: paani wapas, kachra bahar."), visual: D("digestion") }],
  make: (_d, rng) => {
    const steps = ["mouth", "food pipe", "stomach", "small intestine", "large intestine"];
    if (rng() < 0.5) {
      const i = Math.floor(rng() * 4);
      return { prompt: T(`Where does food go after the ${steps[i]}?`), visual: D("digestion"), choices: shuffle(rng, steps.filter((_, k) => k !== i)), answer: steps[i + 1], why: T(`The order is ${steps.join(" → ")}.`) };
    }
    return fromPool(rng, [
      ["Why should we chew food well?", "small bits are easier to digest", ["to make it cold", "teeth get bored"], "Chewing breaks food into small, soft bits so the stomach's juices can work fast."],
      ["Where do the good parts of food go into the blood?", "small intestine", ["mouth", "teeth"], "The small intestine is long and has tiny fingers (villi) that pass food goodness into the blood."],
      ["Why do we need to drink water and eat fibre (fruits, vegetables)?", "to help waste move out easily", ["to grow taller instantly", "to see better"], "Fibre and water keep things moving smoothly through the intestines."],
    ], D("digestion"));
  },
};

const heart: SciTopic = {
  id: "heart_lungs", strand: "body", icon: "❤️", title: T("Heart and breathing", "दिल और साँस", "Dil aur saans"), grades: [3, 5],
  cards: [
    { title: T("Lungs: balloons for air"), say: T("When you breathe in, your two lungs fill up like balloons. The air's oxygen goes into your blood. When you breathe out, used air (carbon dioxide) leaves.", "साँस लेने पर दोनों फेफड़े गुब्बारों जैसे भरते हैं। हवा की ऑक्सीजन ख़ून में जाती है। साँस छोड़ने पर इस्तेमाल हुई हवा (कार्बन डाइऑक्साइड) बाहर।", "Saans lene pe dono phephde gubbaaron jaise bharte hain. Hawa ki oxygen khoon mein jaati hai. Saans chhodne pe used hawa (carbon dioxide) bahar."), visual: D("heart_lungs") },
    { title: T("Heart: a pump"), say: T("Your heart is a strong pump about the size of your fist. It squeezes about 100 times a minute to push blood, carrying oxygen and food, all around your body. Feel your pulse on your wrist: that's your heart pumping! It beats faster when you run, because muscles need more oxygen.", "दिल मुट्ठी जितना एक मज़बूत पंप है। एक मिनट में लगभग 100 बार दबाकर ख़ून पूरे शरीर में भेजता है। कलाई पर नब्ज़ महसूस करो! दौड़ने पर तेज़ धड़कता है, क्योंकि मांसपेशियों को ज़्यादा ऑक्सीजन चाहिए।", "Dil mutthi jitna ek mazboot pump hai. Ek minute mein lagbhag 100 baar dabaa ke khoon poore shareer mein bhejta hai. Kalaai pe nabz feel karo! Daudne pe tez dhadakta hai, kyunki muscles ko zyada oxygen chahiye.") },
  ],
  make: (_d, rng) => fromPool(rng, [
    ["What does the heart do?", "pumps blood around the body", ["helps us see", "makes food"], "The heart squeezes again and again to push blood through tubes to every part of you."],
    ["Why does your heart beat faster when you run?", "muscles need more oxygen", ["it is scared of running", "the blood gets cold"], "Running muscles use lots of oxygen, so the heart pumps faster to bring more."],
    ["Which gas do we breathe IN that our body needs?", "oxygen", ["smoke", "carbon dioxide"], "Our body uses oxygen to get energy from food."],
    ["What do the lungs do?", "take in air", ["pump blood", "digest food"], "Lungs fill with air and pass its oxygen into the blood."],
  ], D("heart_lungs")),
};

const hygiene: SciTopic = {
  id: "hygiene", strand: "body", icon: "🧼", title: T("Germs and staying clean", "कीटाणु और सफ़ाई", "Germs aur safaai"), grades: [1, 3],
  cards: [{ title: T("Invisible germs"), say: T("Germs are so tiny we can't see them, but some make us ill. Soap breaks them apart and water washes them away. Wash hands before eating and after the toilet, for as long as it takes to sing 'Happy Birthday' twice!", "कीटाणु इतने छोटे हैं कि दिखते नहीं, पर कुछ बीमार करते हैं। साबुन उन्हें तोड़ता है, पानी बहा देता है। खाने से पहले और शौच के बाद हाथ धोओ, 'हैप्पी बर्थडे' दो बार गाने जितनी देर!", "Germs itne chhote hain ki dikhte nahi, par kuch beemar karte hain. Saabun unhe todta hai, paani baha deta hai. Khaane se pehle aur toilet ke baad haath dhoo, 'Happy Birthday' do baar gaane jitni der!") }],
  make: (_d, rng) => fromPool(rng, [
    ["When must we wash our hands?", "before eating", ["after sleeping only", "never"], "Hands touch lots of things with germs. Washing before eating stops germs going into your mouth."],
    ["Why do we use soap, not just water?", "soap breaks up germs and grease", ["soap smells nice only", "water is too wet"], "Soap grabs grease and breaks germs apart so water can wash them away."],
    ["Why cover your mouth when you sneeze?", "to stop germs spreading", ["to look funny", "to stop the sneeze"], "A sneeze sprays tiny drops with germs. Covering it (with your elbow) protects others."],
  ]),
};

const sound: SciTopic = {
  id: "sound", strand: "forces", icon: "🔊", title: T("Sound", "ध्वनि", "Sound"), grades: [2, 5],
  cards: [
    { title: T("Sound is a wobble"), say: T("Every sound is made by something shaking very fast (vibrating). Touch your throat and hum: feel the buzz? The shaking pushes the air, the air pushes your eardrum, and your brain hears it!", "हर आवाज़ किसी चीज़ के बहुत तेज़ काँपने (कंपन) से बनती है। गले को छूकर गुनगुनाओ: झनझनाहट महसूस हुई? कंपन हवा को धकेलता है, हवा कान के पर्दे को, और दिमाग़ सुनता है!", "Har awaaz kisi cheez ke bahut tez kaanpne (vibration) se banti hai. Gale ko chhoo ke gungunao: buzz feel hua? Vibration hawa ko dhakelta hai, hawa kaan ke parde ko, aur dimaag sunta hai!"), visual: D("sound") },
    { title: T("High, low, loud, soft"), say: T("FAST shaking makes a HIGH sound (a short thin string, a small bell). SLOW shaking makes a LOW sound (a long thick string, a big drum). A BIG shake makes a LOUD sound, a small shake a SOFT one. That's why music works!", "तेज़ कंपन = ऊँची आवाज़ (छोटा पतला तार, छोटी घंटी)। धीमा कंपन = नीची (लंबा मोटा तार, बड़ा ढोल)। बड़ा कंपन = तेज़ आवाज़, छोटा = धीमी। यही संगीत का राज़ है!", "TEZ vibration = OONCHI awaaz (chhota patla taar, chhoti ghanti). DHEEMA = NEECHI (lamba mota taar, bada dhol). BADA vibration = LOUD, chhota = SOFT. Yahi music ka raaz hai!") },
  ],
  make: (_d, rng) => fromPool(rng, [
    ["All sounds are made by…", "vibrations (shaking)", ["light", "colours"], "Something must shake back and forth fast to push the air and make sound."],
    ["Which makes a HIGHER sound?", "a short thin string", ["a long thick string", "a big drum"], "Short, thin things vibrate faster, and fast vibrations sound high."],
    ["Why is a big drum's sound LOW?", "it vibrates slowly", ["it is red", "it is far away"], "Big, heavy things vibrate slowly, and slow vibrations sound low."],
    ["Can sound travel in empty space, where there is no air?", "no", ["yes"], "Sound needs something (air, water, a wall) to shake and pass it along. Space is silent!"],
    ["How do you make a drum sound LOUDER?", "hit it harder", ["hit it softer", "paint it"], "A harder hit makes bigger vibrations, and bigger vibrations sound louder."],
  ], D("sound")),
};

const floatSink: SciTopic = {
  id: "float_sink", strand: "materials", icon: "🛶", title: T("Float or sink?", "तैरेगा या डूबेगा?", "Tairega ya doobega?"), grades: [1, 3],
  cards: [{ title: T("Heavy for its size"), say: T("Things that are heavy for their size, like a stone or a coin, SINK. Things that are light for their size, like wood, a leaf or a plastic ball, FLOAT. A big ship floats because its shape is hollow and full of air!", "जो चीज़ अपने आकार के हिसाब से भारी हो, जैसे पत्थर, सिक्का, वह डूबती है। जो हल्की हो, जैसे लकड़ी, पत्ता, प्लास्टिक की गेंद, वह तैरती है। बड़ा जहाज़ तैरता है क्योंकि अंदर खोखला और हवा भरा है!", "Jo cheez apne size ke hisaab se bhaari ho, jaise patthar, sikka, woh DOOBTI hai. Jo halki ho, jaise lakdi, patta, plastic ball, woh TAIRTI hai. Bada jahaaz tairta hai kyunki andar khokhla aur hawa bhara hai!"), visual: D("float") }],
  make: (_d, rng) => fromPool(rng, [
    ["Will a stone 🪨 float or sink?", "sink", ["float"], "A stone is heavy for its size, so water can't hold it up."],
    ["Will a wooden stick 🪵 float or sink?", "float", ["sink"], "Wood is light for its size, so water pushes it up."],
    ["Will a coin 🪙 float or sink?", "sink", ["float"], "Metal is heavy for its size: it sinks."],
    ["Will a leaf 🍃 float or sink?", "float", ["sink"], "A leaf is very light and flat: water holds it up."],
    ["Why does a huge iron ship float?", "it is hollow and full of air", ["iron is light", "the sea is shallow"], "The ship's shape holds lots of air, so overall it is light for its huge size."],
  ], D("float")),
};

const seeds: SciTopic = {
  id: "seeds", strand: "living", icon: "🌰", title: T("How a seed grows", "बीज कैसे उगता है", "Beej kaise ugta hai"), grades: [2, 4],
  cards: [{ title: T("A baby plant with a lunchbox"), say: T("A seed is a baby plant sleeping with its own packed lunch. Give it WATER, AIR and WARMTH and it wakes up (germinates): first a little root grows DOWN, then a shoot grows UP towards the light, then leaves open.", "बीज एक सोया हुआ बच्चा-पौधा है अपने टिफ़िन के साथ। पानी, हवा और गर्मी दो तो वह जागता है (अंकुरित): पहले जड़ नीचे, फिर अंकुर ऊपर रोशनी की ओर, फिर पत्तियाँ खुलती हैं।", "Beej ek soya hua baby-paudha hai apne tiffin ke saath. Paani, hawa aur garmi do toh woh jaagta hai (germinate): pehle jad NEECHE, phir shoot UPAR roshni ki taraf, phir pattiyan khulti hain."), visual: D("seed") }],
  make: (_d, rng) => (rng() < 0.4
    ? (() => { const s = ["seed", "root", "shoot", "leaves", "flower"]; const i = Math.floor(rng() * 4); return { prompt: T(`What grows after the ${s[i]}?`), visual: D("seed"), choices: shuffle(rng, s.filter((_, k) => k !== i)), answer: s[i + 1], why: T(`The order is ${s.join(" → ")}.`) }; })()
    : fromPool(rng, [
      ["What does a seed need to start growing?", "water, air and warmth", ["darkness only", "salt"], "Water wakes the seed up, air lets it breathe, warmth helps it grow."],
      ["Which grows first from a seed?", "the root", ["the flower", "the fruit"], "The root comes first to hold the plant and drink water."],
      ["Why does the shoot grow upwards?", "towards the light", ["to escape the root", "because it is heavy"], "The leaves will need sunlight to make food, so the shoot grows towards light."],
    ], D("seed"))),
};

const habitats: SciTopic = {
  id: "habitats", strand: "living", icon: "🏜️", title: T("Habitats & adaptations", "आवास और अनुकूलन", "Habitats aur adaptation"), grades: [3, 5],
  cards: [{ title: T("Built for their home"), say: T("A habitat is an animal's natural home. Animals have special body parts for it: a camel's hump stores fat and its wide feet don't sink in sand (desert). A polar bear's thick fur and fat keep it warm (ice). A fish's gills breathe in water (ocean). A duck's webbed feet paddle (pond).", "आवास जानवर का प्राकृतिक घर है। जानवरों के ख़ास अंग होते हैं: ऊँट का कूबड़ चर्बी जमा करता, चौड़े पैर रेत में नहीं धँसते (रेगिस्तान)। ध्रुवीय भालू का मोटा फ़र गर्म रखता (बर्फ़)। मछली के गलफड़े पानी में साँस लेते। बत्तख के झिल्लीदार पैर तैरते।", "Habitat jaanwar ka natural ghar hai. Jaanwaron ke khaas body parts hote hain: oont ka koobad charbi jama karta, chaude pair ret mein nahi dhanste (desert). Polar bear ka mota fur garam rakhta (barf). Machhli ke gills paani mein saans lete. Batakh ke webbed pair tairte.") }],
  make: (_d, rng) => fromPool(rng, [
    ["Why doesn't a camel 🐫 sink in desert sand?", "wide, padded feet", ["long neck", "small ears"], "Wide feet spread the camel's weight, like snowshoes, so it stays on top of the sand."],
    ["What keeps a polar bear 🐻‍❄️ warm on the ice?", "thick fur and fat", ["thin skin", "long tail"], "Thick fur and a layer of fat are like a warm blanket against the freezing cold."],
    ["How does a fish 🐟 breathe under water?", "with gills", ["with lungs", "through its tail"], "Gills take the oxygen out of water."],
    ["Why does a duck 🦆 have webbed feet?", "to paddle in water", ["to climb trees", "to dig"], "The skin between the toes works like a paddle to push the water."],
    ["Where does a cactus 🌵 live, storing water in its thick stem?", "desert", ["ocean", "polar ice"], "Deserts get very little rain, so the cactus stores water and has spines instead of leaves to lose less."],
  ]),
};

const moon: SciTopic = {
  id: "moon_phases", strand: "earth", icon: "🌙", title: T("The Moon", "चाँद", "Chaand"), grades: [3, 5],
  cards: [{ title: T("The Moon borrows light"), say: T("The Moon has no light of its own: it shines because the Sun lights it up, like a ball in a torch beam. As the Moon goes around the Earth (about a month), we see different amounts of its lit side: new moon, crescent, half, full, and back again. These are the PHASES.", "चाँद की अपनी रोशनी नहीं: सूरज उसे रोशन करता है, जैसे टॉर्च में गेंद। चाँद पृथ्वी के चारों ओर घूमता है (लगभग एक महीना), तो हमें रोशन हिस्सा कम-ज़्यादा दिखता है: अमावस, अर्धचंद्र, आधा, पूर्णिमा, फिर वापस।", "Chaand ki apni roshni nahi: suraj use roshan karta hai, jaise torch mein ball. Chaand prithvi ke chaaron taraf ghoomta hai (lagbhag ek mahina), toh humein roshan hissa kam-zyada dikhta hai: amavas, crescent, aadha, poornima, phir wapas."), visual: D("moon") }],
  make: (_d, rng) => fromPool(rng, [
    ["Why does the Moon shine?", "it reflects the Sun's light", ["it is on fire", "it has bulbs"], "The Moon is a rock; sunlight bounces off it towards us."],
    ["About how long does the Moon take to go around the Earth?", "about a month", ["one day", "one year"], "About 29 days: that's where the word 'month' comes from (moon-th)!"],
    ["When we can't see the Moon at all, it is called…", "new moon", ["full moon", "half moon"], "At new moon the lit side faces away from us."],
    ["When the whole round face of the Moon is bright, it is…", "full moon", ["new moon", "crescent"], "At full moon the lit side faces us completely."],
  ], D("moon")),
};

const machines: SciTopic = {
  id: "simple_machines", strand: "forces", icon: "⚙️", title: T("Simple machines", "सरल मशीनें", "Simple machines"), grades: [3, 5],
  cards: [
    { title: T("Machines make work easier"), say: T("A LEVER (like a see-saw) lifts heavy things with a small push. A PULLEY (a wheel with a rope, like at a well) lets you pull DOWN to lift something UP. A RAMP lets you push a load up slowly instead of lifting it. A WHEEL makes things roll instead of drag.", "उत्तोलक (सी-सॉ जैसा) छोटे धक्के से भारी चीज़ उठाता है। घिरनी (कुएँ की रस्सी वाला पहिया) नीचे खींचकर ऊपर उठाती है। ढलान पर धीरे-धीरे धकेलना उठाने से आसान। पहिया घसीटने की बजाय लुढ़काता है।", "LEVER (see-saw jaisa) chhote push se bhaari cheez uthata hai. PULLEY (kuein ki rassi wala pahiya) neeche kheench ke upar uthati hai. RAMP pe dheere-dheere dhakelna uthane se easy. WHEEL ghaseetne ki jagah ludhkata hai."), visual: D("lever") },
    { title: T("Why a lever helps"), say: T("On a see-saw, a small child far from the middle can lift a big grown-up near the middle. The farther you push from the pivot (fulcrum), the less strength you need!", "सी-सॉ पर, बीच से दूर बैठा छोटा बच्चा बीच के पास बैठे बड़े को उठा सकता है। धुरी से जितनी दूर धक्का, उतनी कम ताक़त चाहिए!", "See-saw pe, beech se door baitha chhota bachcha beech ke paas baithe bade ko utha sakta hai. Pivot se jitni door push, utni kam taakat chahiye!") },
  ],
  make: (_d, rng) => fromPool(rng, [
    ["A see-saw is a kind of…", "lever", ["pulley", "magnet"], "A see-saw is a bar that turns on a pivot: a lever."],
    ["Which helps lift a bucket of water from a well?", "pulley", ["ramp", "screw"], "A pulley lets you pull down on the rope to lift the bucket up."],
    ["Why do we use a ramp to load a heavy box into a truck?", "pushing up a slope needs less force", ["the box gets lighter", "ramps are fun"], "A ramp spreads the lift over a longer path, so each push is easier."],
    ["Which simple machine is in a bicycle and a cart?", "wheel and axle", ["lever", "pulley"], "Wheels roll, so things move with much less rubbing than dragging."],
  ], D("lever")),
};

const air: SciTopic = {
  id: "air", strand: "materials", icon: "💨", title: T("Air around us", "हमारे आसपास हवा", "Hamare aaspaas hawa"), grades: [1, 3],
  cards: [{ title: T("Invisible but real"), say: T("We can't see air, but it's everywhere. It fills a balloon, moves a kite, dries clothes and spins a windmill. Moving air is wind. All living things need air, and air takes up space: an 'empty' glass is full of air!", "हवा दिखती नहीं, पर हर जगह है। गुब्बारा भरती, पतंग उड़ाती, कपड़े सुखाती, पवनचक्की घुमाती है। चलती हवा = पवन। सब सजीवों को हवा चाहिए, और हवा जगह घेरती है: 'ख़ाली' गिलास हवा से भरा है!", "Hawa dikhti nahi, par har jagah hai. Gubbara bharti, patang udaati, kapde sukhaati, windmill ghumaati hai. Chalti hawa = wind. Sab living things ko hawa chahiye, aur hawa jagah gherti hai: 'khaali' glass hawa se bhara hai!") }],
  make: (_d, rng) => fromPool(rng, [
    ["What fills a balloon when you blow into it?", "air", ["water", "nothing"], "Your breath pushes air in; the air takes up space and stretches the balloon."],
    ["Moving air is called…", "wind", ["rain", "steam"], "Wind is air on the move."],
    ["Why do clothes dry faster on a windy day?", "wind carries the water vapour away", ["wind is wet", "clothes get scared"], "Wind keeps taking away the damp air, so more water can evaporate."],
    ["Is an 'empty' glass really empty?", "no, it is full of air", ["yes, it has nothing"], "Push an upside-down glass into water: the water can't get in, because air is already inside!"],
  ]),
};

const soil: SciTopic = {
  id: "soil_rocks", strand: "earth", icon: "🪨", title: T("Soil and rocks", "मिट्टी और चट्टानें", "Mitti aur chattaanein"), grades: [3, 5],
  cards: [{ title: T("Soil is made from rocks"), say: T("Over many, many years, wind, rain and roots break big rocks into tiny bits. Mixed with dead leaves and tiny creatures, these bits become SOIL. Sandy soil drains fast, clay soil holds water, and loamy soil is best for plants. Earthworms are the soil's helpers!", "बहुत सालों में हवा, बारिश और जड़ें बड़ी चट्टानों को छोटे कणों में तोड़ती हैं। सूखे पत्तों और छोटे जीवों के साथ मिलकर ये मिट्टी बनते हैं। रेतीली मिट्टी पानी जल्दी बहाती, चिकनी मिट्टी पानी रोकती, दोमट पौधों के लिए सबसे अच्छी। केंचुए मिट्टी के मददगार!", "Bahut saalon mein hawa, baarish aur jadein badi chattaanon ko chhote kanon mein todti hain. Sookhe patton aur chhote jeevon ke saath milke yeh MITTI bante hain. Sandy mitti paani jaldi bahaati, clay paani rokti, loamy paudhon ke liye best. Kenchue mitti ke helpers!") }],
  make: (_d, rng) => fromPool(rng, [
    ["What is soil made from?", "broken rocks and rotted leaves", ["melted ice", "clouds"], "Rocks break into tiny bits and mix with decayed plants and animals: that's soil."],
    ["Which soil holds the most water?", "clay soil", ["sandy soil", "pebbles"], "Clay has tiny, tightly packed bits that hold water."],
    ["How do earthworms help the soil?", "they make tunnels for air and water", ["they eat all the roots", "they make it rain"], "Earthworm tunnels let air and water reach the roots, and their waste feeds the soil."],
  ]),
};

const heat: SciTopic = {
  id: "heat", strand: "forces", icon: "🌡️", title: T("Hot and cold", "गर्म और ठंडा", "Garam aur thanda"), grades: [3, 5],
  cards: [{ title: T("Heat moves from hot to cold"), say: T("Heat always travels from something hot to something colder: a hot spoon in cold water cools down, the water warms up. METALS let heat through fast (that's why pots are metal), WOOD and PLASTIC are slow (that's why pot handles are plastic). A thermometer measures how hot.", "गर्मी हमेशा गर्म से ठंडी चीज़ की ओर जाती है: ठंडे पानी में गर्म चम्मच ठंडा होता, पानी गर्म। धातु गर्मी जल्दी पहुँचाती (इसलिए बर्तन धातु के), लकड़ी-प्लास्टिक धीमे (इसलिए हैंडल प्लास्टिक के)। थर्मामीटर गर्मी नापता है।", "Garmi hamesha garam se thandi cheez ki taraf jaati hai: thande paani mein garam chammach thanda hota, paani garam. METAL garmi jaldi pahunchata (isliye bartan metal ke), LAKDI-PLASTIC dheeme (isliye handle plastic ke). Thermometer garmi naapta hai.") }],
  make: (_d, rng) => fromPool(rng, [
    ["Why are cooking pots made of metal?", "metal lets heat through quickly", ["metal is pretty", "metal is light"], "Metals are good conductors: the fire's heat reaches the food fast."],
    ["Why do pot handles have plastic or wood?", "they don't let heat through easily", ["to look nice", "to make it heavier"], "Plastic and wood are insulators, so the handle stays cool enough to hold."],
    ["What measures how hot something is?", "thermometer", ["ruler", "clock"], "A thermometer shows the temperature."],
    ["Ice in your hand melts. Which way did the heat go?", "from your hand to the ice", ["from the ice to your hand"], "Heat always moves from warmer to colder: your warm hand gives heat to the ice."],
  ]),
};

const recycle: SciTopic = {
  id: "recycle", strand: "earth", icon: "♻️", title: T("Reduce, reuse, recycle", "कम करो, दोबारा, पुनर्चक्रण", "Reduce, reuse, recycle"), grades: [1, 4],
  cards: [{ title: T("Look after our Earth"), say: T("REDUCE: use less (turn off taps and lights). REUSE: use things again (a jar as a pencil holder). RECYCLE: turn old things into new (old paper into new paper). Put wet waste (peels) and dry waste (plastic, paper) in different bins!", "कम करो: कम इस्तेमाल (नल-बत्ती बंद)। दोबारा: चीज़ें फिर से काम में (जार को पेन-स्टैंड)। पुनर्चक्रण: पुराने से नया (पुराना काग़ज़ से नया)। गीला कचरा (छिलके) और सूखा (प्लास्टिक, काग़ज़) अलग डिब्बों में!", "REDUCE: kam use karo (nal-batti band). REUSE: cheezein phir se kaam mein (jar ko pen-stand). RECYCLE: purane se naya (purana kaagaz se naya). Geela kachra (chhilke) aur sookha (plastic, kaagaz) alag dabbon mein!") }],
  make: (_d, rng) => fromPool(rng, [
    ["A banana peel 🍌 goes in which bin?", "wet waste", ["dry waste"], "Peels rot naturally and can become compost for plants."],
    ["An empty plastic bottle 🧴 goes in which bin?", "dry waste", ["wet waste"], "Plastic doesn't rot; dry waste can be sorted and recycled."],
    ["Using an old jar as a pencil holder is…", "reuse", ["reduce", "waste"], "You used the same thing again for a new job: reuse."],
    ["Turning off the tap while brushing is…", "reduce", ["recycle", "reuse"], "You used less water: reduce."],
  ]),
};

export const MORE_SCIENCE: SciTopic[] = [bones, teeth, digestion, heart, hygiene, seeds, habitats, floatSink, air, soil, moon, sound, machines, heat, recycle];

export const EXTRA_SCIENCE_CARDS: Record<string, Card[]> = {
  living: [{ title: T("Plants are alive too"), say: T("Plants don't walk, but they ARE living: they grow, drink water, breathe through tiny holes in leaves, and make seeds. Some even turn to follow the sun!", "पौधे चलते नहीं, पर सजीव हैं: बढ़ते हैं, पानी पीते हैं, पत्तियों के छोटे छेदों से साँस लेते हैं, बीज बनाते हैं। कुछ तो सूरज की ओर मुड़ते हैं!", "Paudhe chalte nahi, par living hain: badhte hain, paani peete hain, pattiyon ke chhote chhedon se saans lete hain, beej banate hain. Kuch toh suraj ki taraf mudte hain!") }],
  water_cycle: [{ title: T("Try it at home"), say: T("Breathe on a cold mirror: it gets foggy. That's condensation, your breath's water vapour turning back into tiny drops, exactly like a cloud forming!", "ठंडे शीशे पर साँस छोड़ो: धुंधला हो जाता है। यह संघनन है, साँस की भाप छोटी बूँदें बनती है, बिल्कुल बादल बनने जैसा!", "Thande sheeshe pe saans chhodo: dhundhla ho jaata hai. Yeh condensation hai, saans ki bhaap chhoti boondein banti hai, bilkul baadal banne jaisa!") }],
  states_matter: [{ title: T("Water can be all three"), say: T("Water is the only thing you see every day as all three: ice (solid) in the freezer, water (liquid) in a glass, steam (gas) from a kettle.", "पानी को तुम रोज़ तीनों रूप में देखते हो: फ़्रीज़र में बर्फ़ (ठोस), गिलास में पानी (द्रव), केतली से भाप (गैस)।", "Paani ko tum roz teeno roop mein dekhte ho: freezer mein barf (solid), glass mein paani (liquid), kettle se bhaap (gas).") }],
  magnets: [{ title: T("Earth is a giant magnet"), say: T("A compass needle is a tiny magnet. It always points north because the whole Earth acts like a giant magnet! Sailors used this to find their way.", "कम्पास की सुई एक छोटा चुंबक है। हमेशा उत्तर की ओर इशारा करती है क्योंकि पूरी पृथ्वी एक विशाल चुंबक जैसी है! नाविक इससे रास्ता ढूँढते थे।", "Compass ki sui ek chhota magnet hai. Hamesha north ki taraf point karti hai kyunki poori prithvi ek giant magnet jaisi hai! Sailors isse raasta dhoondhte the.") }],
  solar_system: [{ title: T("Why it's hot in summer"), say: T("The Earth is tilted. In summer our part of the Earth leans towards the Sun, so sunlight hits it more directly and days are longer: hot! In winter we lean away: cold.", "पृथ्वी थोड़ी झुकी है। गर्मी में हमारा हिस्सा सूरज की ओर झुका होता है, धूप सीधी पड़ती है और दिन लंबे: गर्म! सर्दी में दूर झुका: ठंडा।", "Prithvi thodi jhuki hai. Garmi mein hamara hissa suraj ki taraf jhuka hota hai, dhoop seedhi padti hai aur din lambe: garam! Sardi mein door jhuka: thanda.") }],
  plant_parts: [{ title: T("Try it: coloured celery"), say: T("Put a white flower or celery stick in water with food colour. In a day the petals turn coloured: proof that the stem carries water up like a straw!", "सफ़ेद फूल को रंग वाले पानी में रखो। एक दिन में पंखुड़ियाँ रंगीन: सबूत कि तना स्ट्रॉ जैसा पानी ऊपर ले जाता है!", "Safed phool ko rang wale paani mein rakho. Ek din mein pankhudiyan rangin: proof ki tana straw jaisa paani upar le jaata hai!") }],
  push_pull: [{ title: T("Friction slows things"), say: T("A ball rolling on grass stops sooner than on a smooth floor. The rubbing between surfaces is called FRICTION: it slows things down, but it also stops us from slipping when we walk!", "घास पर लुढ़कती गेंद चिकने फ़र्श से जल्दी रुकती है। सतहों की रगड़ को घर्षण कहते हैं: चीज़ों को धीमा करता है, पर चलते समय फिसलने से भी बचाता है!", "Ghaas pe ludhakti ball chikne farsh se jaldi rukti hai. Satahon ki ragad ko FRICTION kehte hain: cheezon ko dheema karta hai, par chalte waqt phisalne se bhi bachaata hai!") }],
  food_groups: [{ title: T("Water and fibre too"), say: T("Besides the three food jobs, we need WATER (about 6-8 glasses a day) and FIBRE (fruits, vegetables, whole grains) to keep the tummy working smoothly.", "तीन भोजन-कामों के अलावा पानी (दिन में 6-8 गिलास) और रेशा (फल, सब्ज़ी, साबुत अनाज) चाहिए, ताकि पेट ठीक चले।", "Teen khaana-kaamon ke alawa PAANI (din mein 6-8 glass) aur FIBRE (phal, sabzi, saabut anaaj) chahiye, taaki pet theek chale.") }],
};
export type { Text };
