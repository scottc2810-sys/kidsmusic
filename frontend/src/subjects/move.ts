// Move & stretch: simple exercises and yoga asanas a 3-year-old can follow. Each one has a real, openly licensed
// video (a step-by-step yoga guide, or the animal the pose is named after: watch the cobra rise, then rise like it)
// and/or a real photo of the pose, a few steps read aloud one at a time (Next), the reason, a safety tip, and
// sound: a drum beat to count jumps with, a soft chime and "breathe in / out" to hold a pose.
// Movement and slow breathing help children's bodies, sleep, mood and attention; nothing here claims more.
import type { Text } from "../i18n";

const T = (en: string, hi: string, hinglish: string): Text => ({ en, hi, hinglish });

export type MoveKind = "exercise" | "yoga";
/** count: do it N times on a drum beat; hold: stay in the pose for N slow breaths. */
export type MoveAction = { type: "count"; n: number; bpm: number } | { type: "hold"; breaths: number };

export interface Move {
  id: string;
  kind: MoveKind;
  icon: string;
  name: Text;
  sanskrit?: string;
  video?: string; // key of MOVE_MEDIA (real video, muted unless it is a spoken guide)
  photo?: string; // key of MOVE_MEDIA (real photo of the pose)
  guideVideo?: boolean; // the video is a spoken step-by-step guide (may be played with sound)
  steps: Text[];
  action: MoveAction;
  why: Text;
  careful?: Text;
}

export const MOVES: Move[] = [
  // --- exercises ---------------------------------------------------------------------------------------
  { id: "jumping_jacks", kind: "exercise", icon: "⭐", video: "v_jumping_jack", name: T("Star jumps", "तारा कूद", "Taara kood"),
    steps: [T("Even astronauts exercise every day in space! Now it's your turn: stand tall, feet together, arms down.", "अंतरिक्ष में अंतरिक्ष-यात्री भी रोज़ कसरत करते हैं! अब तुम्हारी बारी: सीधे खड़े हो, पैर साथ, हाथ नीचे।", "Antariksh mein astronaut bhi roz kasrat karte hain! Ab tumhari baari: seedhe khade ho, pair saath, haath neeche."),
      T("Jump! Feet go wide and arms go up: you're a star!", "कूदो! पैर फैलाओ और हाथ ऊपर: तुम तारा हो!", "Koodo! Pair phailaao aur haath upar: tum taara ho!"),
      T("Jump back: feet together, arms down. Again!", "वापस कूदो: पैर साथ, हाथ नीचे। फिर से!", "Wapas koodo: pair saath, haath neeche. Phir se!")],
    action: { type: "count", n: 10, bpm: 70 },
    why: T("Jumping makes your heart pump faster, so more air and blood reach your brain: you feel wide awake!", "कूदने से दिल तेज़ धड़कता है, दिमाग़ तक ज़्यादा हवा और ख़ून पहुँचता है: तुम एकदम चुस्त हो जाते हो!", "Koodne se dil tez dhadakta hai, dimaag tak zyada hawa aur khoon pahunchta hai: tum ekdam chust ho jaate ho!") },
  { id: "frog_jumps", kind: "exercise", icon: "🐸", video: "v_frog", name: T("Frog jumps", "मेंढक कूद", "Mendhak kood"),
    steps: [T("Squat down low like a frog, hands on the floor.", "मेंढक की तरह नीचे बैठो, हाथ ज़मीन पर।", "Mendhak ki tarah neeche baitho, haath zameen par."),
      T("Jump up and forward: ribbit!", "ऊपर और आगे कूदो: टर्र!", "Upar aur aage koodo: tarr!"),
      T("Land softly on your feet and squat again.", "धीरे से पैरों पर उतरो और फिर बैठो।", "Dheere se pairon par utro aur phir baitho.")],
    action: { type: "count", n: 6, bpm: 40 },
    why: T("Frog jumps make your legs strong and teach your body to land softly and keep its balance.", "मेंढक कूद पैरों को मज़बूत बनाती है और शरीर को धीरे उतरना और संतुलन रखना सिखाती है।", "Mendhak kood pairon ko mazboot banaati hai aur shareer ko dheere utarna aur santulan rakhna sikhaati hai."),
    careful: T("Make space around you, and jump on a soft floor or carpet.", "आस-पास जगह बनाओ, और नरम ज़मीन या दरी पर कूदो।", "Aas-paas jagah banao, aur naram zameen ya dari par koodo.") },
  { id: "cheetah_run", kind: "exercise", icon: "🐆", video: "v_cheetah", name: T("Cheetah run (on the spot)", "चीते जैसी दौड़ (एक जगह)", "Cheete jaisi daud (ek jagah)"),
    steps: [T("Watch the cheetah, the fastest animal on land!", "चीता देखो, ज़मीन का सबसे तेज़ जानवर!", "Cheeta dekho, zameen ka sabse tez jaanwar!"),
      T("Run on the spot: lift your knees high, swing your arms.", "एक जगह दौड़ो: घुटने ऊपर, हाथ झुलाओ।", "Ek jagah daudo: ghutne upar, haath jhulaao."),
      T("Faster with the drum... and slow down at the end.", "ढोल के साथ तेज़... और आख़िर में धीमे।", "Dhol ke saath tez... aur aakhir mein dheeme.")],
    action: { type: "count", n: 20, bpm: 120 },
    why: T("Running fast for a short time is great for your heart and lungs, and it shakes away sleepiness.", "थोड़ी देर तेज़ दौड़ना दिल और फेफड़ों के लिए बढ़िया है, और नींद भगा देता है।", "Thodi der tez daudna dil aur phephdon ke liye badhiya hai, aur neend bhaga deta hai.") },
  { id: "jump_rope", kind: "exercise", icon: "🪢", video: "v_jumprope", name: T("Pretend skipping", "नकली रस्सी कूद", "Nakli rassi kood"),
    steps: [T("Hold a pretend rope in both hands.", "दोनों हाथों में एक नकली रस्सी पकड़ो।", "Dono haathon mein ek nakli rassi pakdo."),
      T("Turn your wrists round and round.", "कलाइयाँ गोल-गोल घुमाओ।", "Kalaaiyaan gol-gol ghumaao."),
      T("Hop with both feet each time the drum goes boom!", "हर बार ढोल बजे, दोनों पैरों से उछलो!", "Har baar dhol baje, dono pairon se uchhlo!")],
    action: { type: "count", n: 15, bpm: 90 },
    why: T("Jumping to a beat trains your timing: your feet and the music work together, just like playing an instrument.", "ताल पर कूदने से समय की समझ बनती है: पैर और संगीत साथ चलते हैं, बिल्कुल वाद्य बजाने की तरह।", "Taal par koodne se samay ki samajh banti hai: pair aur sangeet saath chalte hain, bilkul vaadya bajaane ki tarah.") },
  { id: "freeze_dance", kind: "exercise", icon: "💃", video: "v_dance", name: T("Dance and freeze!", "नाचो और रुक जाओ!", "Naacho aur ruk jaao!"),
    steps: [T("Dance any way you like while the drum plays!", "जब तक ढोल बजे, जैसे चाहो नाचो!", "Jab tak dhol baje, jaise chaaho naacho!"),
      T("When Melo says FREEZE, stop like a statue!", "जब मेलो कहे रुको, मूर्ति की तरह रुक जाओ!", "Jab Melo kahe ruko, moorti ki tarah ruk jaao!"),
      T("Then dance again!", "फिर से नाचो!", "Phir se naacho!")],
    action: { type: "count", n: 24, bpm: 110 },
    why: T("Stopping when you hear 'freeze' trains self-control: your brain learns to stop and listen, even when you're excited.", "'रुको' सुनकर रुकना ख़ुद पर काबू सिखाता है: मज़े के बीच भी दिमाग़ रुकना और सुनना सीखता है।", "'Ruko' sunkar rukna khud par kaabu sikhaata hai: maze ke beech bhi dimaag rukna aur sunna seekhta hai.") },
  { id: "cat_stretch", kind: "exercise", icon: "🐱", video: "v_cat", name: T("Big cat stretch and yawn", "बिल्ली जैसी अंगड़ाई", "Billi jaisi angdaai"),
    steps: [T("Watch the cat yawn... then stand up.", "बिल्ली को जम्हाई लेते देखो... फिर खड़े हो जाओ।", "Billi ko jamhaai lete dekho... phir khade ho jaao."),
      T("Reach your arms up as high as you can and open your mouth: a big yawn!", "हाथ जितना हो सके ऊपर फैलाओ और मुँह खोलो: बड़ी जम्हाई!", "Haath jitna ho sake upar phailaao aur munh kholo: badi jamhaai!"),
      T("Bend slowly to touch your toes, then roll up slowly.", "धीरे झुककर पैरों की उँगलियाँ छुओ, फिर धीरे ऊपर आओ।", "Dheere jhukkar pairon ki ungliyaan chhuo, phir dheere upar aao.")],
    action: { type: "hold", breaths: 3 },
    why: T("Animals stretch after resting to wake up their muscles. A big stretch makes your body ready to move and learn.", "जानवर आराम के बाद अंगड़ाई लेते हैं ताकि मांसपेशियाँ जागें। बड़ी अंगड़ाई शरीर को चलने और सीखने के लिए तैयार करती है।", "Jaanwar aaraam ke baad angdaai lete hain taaki maanspeshiyaan jaagein. Badi angdaai shareer ko chalne aur seekhne ke liye taiyaar karti hai.") },

  // --- yoga --------------------------------------------------------------------------------------------
  { id: "tadasana", kind: "yoga", icon: "⛰️", sanskrit: "ताडासन · Tāḍāsana", video: "v_tadasana", guideVideo: true, name: T("Mountain pose", "पर्वत आसन", "Parvat aasan"),
    steps: [T("Stand with your feet together, tall like a mountain.", "पैर साथ रखकर पर्वत की तरह सीधे खड़े हो।", "Pair saath rakhkar parvat ki tarah seedhe khade ho."),
      T("Breathe in and stretch your arms up over your head.", "साँस लो और हाथ सिर के ऊपर फैलाओ।", "Saans lo aur haath sir ke upar phailaao."),
      T("Go up on your toes if you can. Strong and still!", "हो सके तो पंजों पर उठो। मज़बूत और स्थिर!", "Ho sake toh panjon par utho. Mazboot aur sthir!")],
    action: { type: "hold", breaths: 5 },
    why: T("Standing tall and still helps your balance and posture, the way you sit at the piano or at your desk.", "सीधे और स्थिर खड़े होने से संतुलन और बैठने का ढंग सुधरता है, जैसे पियानो या मेज़ पर।", "Seedhe aur sthir khade hone se santulan aur baithne ka dhang sudharta hai, jaise piano ya mez par.") },
  { id: "vrikshasana", kind: "yoga", icon: "🌳", sanskrit: "वृक्षासन · Vṛkṣāsana", video: "v_vrikshasana", guideVideo: true, name: T("Tree pose", "वृक्ष आसन", "Vriksh aasan"),
    steps: [T("Stand tall. Look at one spot in front of you.", "सीधे खड़े हो। सामने एक जगह देखो।", "Seedhe khade ho. Saamne ek jagah dekho."),
      T("Lift one foot and rest it on your other leg (ankle or knee is fine).", "एक पैर उठाकर दूसरे पैर पर रखो (टखने या घुटने पर ठीक है)।", "Ek pair uthaakar doosre pair par rakho (takhne ya ghutne par theek hai)."),
      T("Hands together like a bud, then grow your branches up high!", "हाथ जोड़ो जैसे कली, फिर डालियाँ ऊपर फैलाओ!", "Haath jodo jaise kali, phir daaliyaan upar phailaao!"),
      T("Now the other leg.", "अब दूसरा पैर।", "Ab doosra pair.")],
    action: { type: "hold", breaths: 5 },
    why: T("Balancing on one leg makes your brain focus hard on one thing: great practice for concentration.", "एक पैर पर संतुलन से दिमाग़ एक चीज़ पर ध्यान लगाता है: एकाग्रता का बढ़िया अभ्यास।", "Ek pair par santulan se dimaag ek cheez par dhyaan lagaata hai: ekaagrata ka badhiya abhyaas."),
    careful: T("Stand near a wall or a grown-up if you wobble. Wobbling is fine!", "डगमगाओ तो दीवार या किसी बड़े के पास खड़े हो। डगमगाना ठीक है!", "Dagmagao toh deewar ya kisi bade ke paas khade ho. Dagmagaana theek hai!") },
  { id: "trikonasana", kind: "yoga", icon: "🔺", sanskrit: "त्रिकोणासन · Trikoṇāsana", video: "v_trikonasana", guideVideo: true, name: T("Triangle pose", "त्रिकोण आसन", "Trikon aasan"),
    steps: [T("Stand with your feet wide apart.", "पैर चौड़े करके खड़े हो।", "Pair chaude karke khade ho."),
      T("Arms out to the sides, like an aeroplane.", "हाथ बगल में फैलाओ, हवाई जहाज़ की तरह।", "Haath bagal mein phailaao, hawaai jahaaz ki tarah."),
      T("Lean to one side: one hand goes down to your leg, the other points up to the sky.", "एक तरफ़ झुको: एक हाथ पैर पर, दूसरा आसमान की ओर।", "Ek taraf jhuko: ek haath pair par, doosra aasmaan ki or."),
      T("Come up and do the other side.", "ऊपर आओ और दूसरी तरफ़ करो।", "Upar aao aur doosri taraf karo.")],
    action: { type: "hold", breaths: 4 },
    why: T("Your body makes a triangle! It stretches the sides of your body and your legs.", "तुम्हारा शरीर त्रिकोण बनाता है! इससे शरीर की बगल और पैर खिंचते हैं।", "Tumhara shareer trikon banaata hai! Isse shareer ki bagal aur pair khinchte hain.") },
  { id: "surya_namaskar", kind: "yoga", icon: "☀️", sanskrit: "सूर्य नमस्कार · Sūrya Namaskāra", video: "v_surya", name: T("Sun salutation (slowly)", "सूर्य नमस्कार (धीरे-धीरे)", "Surya namaskar (dheere-dheere)"),
    steps: [T("Watch the whole sun salutation once. It's a chain of poses, like a dance for the sun.", "पूरा सूर्य नमस्कार एक बार देखो। यह आसनों की माला है, सूरज के लिए नाच जैसी।", "Poora surya namaskar ek baar dekho. Yeh aasanon ki maala hai, sooraj ke liye naach jaisi."),
      T("Hands together, then reach up and back.", "हाथ जोड़ो, फिर ऊपर और पीछे फैलाओ।", "Haath jodo, phir upar aur peeche phailaao."),
      T("Fold down, step back, slide down and lift up like a cobra.", "नीचे झुको, पीछे जाओ, लेटकर नाग की तरह उठो।", "Neeche jhuko, peeche jaao, letkar naag ki tarah utho."),
      T("Make a mountain with your bottom up, then come back up slowly.", "कूल्हे ऊपर करके पहाड़ बनाओ, फिर धीरे से ऊपर आओ।", "Koolhe upar karke pahaad banao, phir dheere se upar aao.")],
    action: { type: "hold", breaths: 6 },
    why: T("The sun salutation moves your whole body in one go, and you breathe in when you stretch up and out when you fold.", "सूर्य नमस्कार में पूरा शरीर एक साथ चलता है, और ऊपर खिंचते हुए साँस लेते, झुकते हुए छोड़ते हैं।", "Surya namaskar mein poora shareer ek saath chalta hai, aur upar khinchte hue saans lete, jhukte hue chhodte hain."),
    careful: T("Go slowly, and only as far as feels comfy. A grown-up can do it with you.", "धीरे करो, और जितना आराम से हो उतना ही। कोई बड़ा साथ कर सकता है।", "Dheere karo, aur jitna aaraam se ho utna hi. Koi bada saath kar sakta hai.") },
  { id: "bhujangasana", kind: "yoga", icon: "🐍", sanskrit: "भुजङ्गासन · Bhujaṅgāsana", video: "v_cobra", photo: "p_cobra", name: T("Cobra pose", "भुजंग आसन (नाग)", "Bhujang aasan (naag)"),
    steps: [T("Watch the cobra rise up to the music!", "संगीत पर नाग को उठते देखो!", "Sangeet par naag ko uthte dekho!"),
      T("Lie on your tummy, hands under your shoulders.", "पेट के बल लेटो, हाथ कंधों के नीचे।", "Pet ke bal leto, haath kandhon ke neeche."),
      T("Slowly lift your head and chest, like the cobra. Hiss: ssssss!", "धीरे से सिर और छाती उठाओ, नाग की तरह। फुफकारो: स्स्स्स!", "Dheere se sir aur chhaati uthaao, naag ki tarah. Phuphkaaro: ssssss!")],
    action: { type: "hold", breaths: 4 },
    why: T("The cobra bends your back the other way after sitting a lot: it keeps your back strong and bendy.", "बहुत बैठने के बाद नाग आसन पीठ को उल्टी तरफ़ मोड़ता है: पीठ मज़बूत और लचीली रहती है।", "Bahut baithne ke baad naag aasan peeth ko ulti taraf modta hai: peeth mazboot aur lachili rehti hai.") },
  { id: "baddha_konasana", kind: "yoga", icon: "🦋", sanskrit: "बद्धकोणासन · Baddha Koṇāsana", video: "v_butterfly", photo: "p_butterfly", name: T("Butterfly pose", "तितली आसन", "Titli aasan"),
    steps: [T("Sit down and put the bottoms of your feet together.", "बैठो और दोनों पैरों के तलवे मिलाओ।", "Baitho aur dono pairon ke talve milaao."),
      T("Hold your feet. Your legs are the wings!", "पैर पकड़ो। तुम्हारे पैर पंख हैं!", "Pair pakdo. Tumhare pair pankh hain!"),
      T("Flap your wings gently up and down, like the butterfly.", "पंख धीरे-धीरे ऊपर-नीचे फड़फड़ाओ, तितली की तरह।", "Pankh dheere-dheere upar-neeche phadphadaao, titli ki tarah.")],
    action: { type: "count", n: 12, bpm: 60 },
    why: T("Flapping gently loosens your hips and legs, and sitting tall like this is a good way to sit on the floor.", "धीरे फड़फड़ाने से कूल्हे और पैर ढीले होते हैं, और ऐसे सीधे बैठना ज़मीन पर बैठने का अच्छा तरीका है।", "Dheere phadphadaane se koolhe aur pair dheele hote hain, aur aise seedhe baithna zameen par baithne ka achha tareeka hai.") },
  { id: "marjaryasana", kind: "yoga", icon: "🐈", sanskrit: "मार्जार्यासन · Mārjāryāsana", video: "v_cat", photo: "p_catcow", name: T("Cat and cow", "बिल्ली और गाय", "Billi aur gaay"),
    steps: [T("Get on your hands and knees, like a table.", "हाथों और घुटनों पर आओ, मेज़ की तरह।", "Haathon aur ghutno par aao, mez ki tarah."),
      T("Cow: breathe in, tummy down, look up and say 'moo'!", "गाय: साँस लो, पेट नीचे, ऊपर देखो और कहो 'माँ'!", "Gaay: saans lo, pet neeche, upar dekho aur kaho 'maa'!"),
      T("Cat: breathe out, round your back up high and say 'meow'!", "बिल्ली: साँस छोड़ो, पीठ गोल ऊपर करो और कहो 'म्याऊँ'!", "Billi: saans chhodo, peeth gol upar karo aur kaho 'myaaon'!")],
    action: { type: "count", n: 8, bpm: 30 },
    why: T("Moving your back up and down with your breath makes your spine bendy and calms you down.", "साँस के साथ पीठ ऊपर-नीचे करने से रीढ़ लचीली होती है और मन शांत होता है।", "Saans ke saath peeth upar-neeche karne se reedh lachili hoti hai aur mann shaant hota hai.") },
  { id: "adho_mukha", kind: "yoga", icon: "🐕", sanskrit: "अधोमुखश्वानासन · Adho Mukha Śvānāsana", photo: "p_dog", name: T("Downward dog", "नीचे देखता कुत्ता", "Neeche dekhta kutta"),
    steps: [T("Start on your hands and knees.", "हाथों और घुटनों पर शुरू करो।", "Haathon aur ghutno par shuru karo."),
      T("Push your bottom up high: you're an upside-down V!", "कूल्हे ऊँचे करो: तुम उल्टा V हो!", "Koolhe oonche karo: tum ulta V ho!"),
      T("Wag your tail (wiggle your hips) and bark: woof!", "पूँछ हिलाओ (कूल्हे हिलाओ) और भौंको: भौं!", "Poonch hilaao (koolhe hilaao) aur bhaunko: bhau!")],
    action: { type: "hold", breaths: 4 },
    why: T("Dogs stretch like this every morning. It stretches your legs and back, and your arms get strong.", "कुत्ते रोज़ सुबह ऐसे अंगड़ाई लेते हैं। इससे पैर और पीठ खिंचते हैं, और हाथ मज़बूत होते हैं।", "Kutte roz subah aise angdaai lete hain. Isse pair aur peeth khinchte hain, aur haath mazboot hote hain.") },
  { id: "balasana", kind: "yoga", icon: "🧒", sanskrit: "बालासन · Bālāsana", photo: "p_child", name: T("Child's pose", "बाल आसन", "Baal aasan"),
    steps: [T("Kneel down and sit on your heels.", "घुटनों के बल बैठकर एड़ियों पर बैठो।", "Ghutno ke bal baithkar ediyon par baitho."),
      T("Fold forward and rest your forehead on the floor.", "आगे झुककर माथा ज़मीन पर रखो।", "Aage jhukkar maatha zameen par rakho."),
      T("Arms along your sides. Breathe slowly, like a sleeping mouse.", "हाथ बगल में। धीरे साँस लो, सोते चूहे की तरह।", "Haath bagal mein. Dheere saans lo, sote choohe ki tarah.")],
    action: { type: "hold", breaths: 5 },
    why: T("This is a resting pose. Curling up small and breathing slowly helps you calm down when you feel too wild or upset.", "यह आराम का आसन है। सिकुड़कर धीरे साँस लेने से मन शांत होता है जब बहुत उछल-कूद या दुख हो।", "Yeh aaraam ka aasan hai. Sikudkar dheere saans lene se mann shaant hota hai jab bahut uchhal-kood ya dukh ho.") },
  { id: "setu_bandhasana", kind: "yoga", icon: "🌉", sanskrit: "सेतुबन्धासन · Setubandhāsana", photo: "p_bridge", name: T("Bridge pose", "सेतु आसन (पुल)", "Setu aasan (pul)"),
    steps: [T("Lie on your back with your knees bent, feet flat.", "पीठ के बल लेटो, घुटने मोड़ो, पैर ज़मीन पर।", "Peeth ke bal leto, ghutne modo, pair zameen par."),
      T("Push your feet down and lift your bottom up: you're a bridge!", "पैर दबाओ और कूल्हे ऊपर उठाओ: तुम पुल हो!", "Pair dabaao aur koolhe upar uthaao: tum pul ho!"),
      T("Can a toy car drive under your bridge? Then come down slowly.", "क्या खिलौना गाड़ी पुल के नीचे से जा सकती है? फिर धीरे नीचे आओ।", "Kya khilona gaadi pul ke neeche se ja sakti hai? Phir dheere neeche aao.")],
    action: { type: "hold", breaths: 4 },
    why: T("Lifting up like a bridge makes your back and legs strong, the muscles that help you sit up tall.", "पुल की तरह उठने से पीठ और पैर मज़बूत होते हैं, वही मांसपेशियाँ जो सीधे बैठने में मदद करती हैं।", "Pul ki tarah uthne se peeth aur pair mazboot hote hain, wahi maanspeshiyaan jo seedhe baithne mein madad karti hain.") },
  { id: "naukasana", kind: "yoga", icon: "⛵", sanskrit: "नौकासन · Naukāsana", video: "v_boat", photo: "p_boat", name: T("Boat pose", "नौका आसन", "Nauka aasan"),
    steps: [T("Watch the boat float in the Kerala backwaters.", "केरल के पानी में नाव को तैरते देखो।", "Kerala ke paani mein naav ko tairte dekho."),
      T("Sit down, bend your knees, hold behind your knees.", "बैठो, घुटने मोड़ो, घुटनों के पीछे पकड़ो।", "Baitho, ghutne modo, ghutno ke peeche pakdo."),
      T("Lean back a little and lift your feet: you're a boat! Rock gently on the waves.", "थोड़ा पीछे झुको और पैर उठाओ: तुम नाव हो! लहरों पर धीरे झूलो।", "Thoda peeche jhuko aur pair uthaao: tum naav ho! Lehron par dheere jhoolo.")],
    action: { type: "hold", breaths: 3 },
    why: T("Balancing like a boat makes your tummy muscles strong: they hold your whole body steady.", "नाव की तरह संतुलन से पेट की मांसपेशियाँ मज़बूत होती हैं: वे पूरे शरीर को स्थिर रखती हैं।", "Naav ki tarah santulan se pet ki maanspeshiyaan mazboot hoti hain: woh poore shareer ko sthir rakhti hain.") },
  { id: "malasana", kind: "yoga", icon: "🐸", sanskrit: "मालासन · Mālāsana", video: "v_frog", photo: "p_frog", name: T("Frog squat", "मेंढक बैठक", "Mendhak baithak"),
    steps: [T("Stand with your feet a little apart.", "पैर थोड़े दूर रखकर खड़े हो।", "Pair thode door rakhkar khade ho."),
      T("Squat down low like a frog sitting on a lily pad.", "नीचे बैठो, जैसे मेंढक कमल-पत्ते पर बैठा हो।", "Neeche baitho, jaise mendhak kamal-patte par baitha ho."),
      T("Hands together in front of your heart. Look around for flies!", "हाथ दिल के सामने जोड़ो। मक्खियाँ ढूँढो!", "Haath dil ke saamne jodo. Makkhiyaan dhoondho!")],
    action: { type: "hold", breaths: 4 },
    why: T("Squatting is how children naturally play and rest. It keeps your legs and hips bendy.", "बच्चे अपने-आप ऐसे बैठकर खेलते हैं। इससे पैर और कूल्हे लचीले रहते हैं।", "Bachche apne-aap aise baithkar khelte hain. Isse pair aur koolhe lachile rehte hain.") },
  { id: "simhasana", kind: "yoga", icon: "🦁", sanskrit: "सिंहासन · Siṃhāsana", video: "v_lion", name: T("Lion pose", "सिंह आसन", "Singh aasan"),
    steps: [T("Watch the lion cubs play!", "शेर के बच्चों को खेलते देखो!", "Sher ke bachchon ko khelte dekho!"),
      T("Sit on your heels, hands on your knees, fingers spread like claws.", "एड़ियों पर बैठो, हाथ घुटनों पर, उँगलियाँ पंजों जैसी फैलाओ।", "Ediyon par baitho, haath ghutno par, ungliyaan panjon jaisi phailaao."),
      T("Breathe in... then open your mouth wide, stick out your tongue and ROAR (a breathy haaaa)!", "साँस लो... फिर मुँह खोलो, जीभ बाहर निकालो और दहाड़ो (हाआआ)!", "Saans lo... phir munh kholo, jeebh bahar nikaalo aur dahaado (haaaa)!")],
    action: { type: "count", n: 3, bpm: 12 },
    why: T("A big lion roar lets out grumpy or shy feelings, and it relaxes your face and throat. It's also very funny!", "शेर की दहाड़ से चिढ़ या शर्म बाहर निकलती है, और चेहरा-गला ढीला होता है। और बहुत मज़ेदार भी है!", "Sher ki dahaad se chidh ya sharm bahar nikalti hai, aur chehra-gala dheela hota hai. Aur bahut mazedaar bhi hai!") },
  { id: "bhramari", kind: "yoga", icon: "🐝", sanskrit: "भ्रामरी · Bhrāmarī", video: "v_bee", photo: "p_bee", name: T("Bee breath", "भ्रामरी (भौंरे की साँस)", "Bhramari (bhaunre ki saans)"),
    steps: [T("Watch the bee fly to the flower in slow motion.", "धीमी गति में भौंरे को फूल तक उड़ते देखो।", "Dheemi gati mein bhaunre ko phool tak udte dekho."),
      T("Sit tall and close your ears gently with your fingers.", "सीधे बैठो और उँगलियों से कान धीरे से बंद करो।", "Seedhe baitho aur ungliyon se kaan dheere se band karo."),
      T("Breathe in through your nose, then hum like a bee: mmmmmm... Feel the buzz in your head!", "नाक से साँस लो, फिर भौंरे की तरह गुनगुनाओ: म्म्म्म्... सिर में कंपन महसूस करो!", "Naak se saans lo, phir bhaunre ki tarah gungunaao: mmmmmm... Sir mein kampan mehsoos karo!")],
    action: { type: "hold", breaths: 5 },
    why: T("Humming makes your breathing out long and slow, which tells your body to calm down. Hear how loud the buzz is inside your head!", "गुनगुनाने से साँस छोड़ना लंबा और धीमा होता है, जिससे शरीर शांत होता है। सुनो सिर के अंदर कंपन कितना तेज़ है!", "Gungunaane se saans chhodna lamba aur dheema hota hai, jisse shareer shaant hota hai. Suno sir ke andar kampan kitna tez hai!") },
  { id: "shavasana", kind: "yoga", icon: "😌", sanskrit: "शवासन · Śavāsana", photo: "p_shavasana", name: T("Starfish rest", "शवासन (आराम)", "Shavasan (aaraam)"),
    steps: [T("Lie on your back like a starfish, arms and legs spread out.", "पीठ के बल तारामछली की तरह लेटो, हाथ-पैर फैलाकर।", "Peeth ke bal taaraamachhli ki tarah leto, haath-pair phailaakar."),
      T("Close your eyes. Let your whole body go soft and heavy, like melting ice cream.", "आँखें बंद करो। पूरा शरीर ढीला और भारी छोड़ दो, पिघलती आइसक्रीम की तरह।", "Aankhein band karo. Poora shareer dheela aur bhaari chhod do, pighalti ice cream ki tarah."),
      T("Breathe slowly and listen to the quiet.", "धीरे साँस लो और शांति सुनो।", "Dheere saans lo aur shaanti suno.")],
    action: { type: "hold", breaths: 8 },
    why: T("Every yoga time ends with resting. Your body and mind get a moment of quiet to feel how much they have done.", "हर योग के बाद आराम होता है। शरीर और मन को चुप रहकर महसूस करने का समय मिलता है कि कितना किया।", "Har yog ke baad aaraam hota hai. Shareer aur mann ko chup rehkar mehsoos karne ka samay milta hai ki kitna kiya.") },
];
