"""Language-learning content: the languages a child can learn, their letters, and a shared set of
picture concepts translated into each language.

Every concept has a picture (emoji), so a child can learn a word without reading an explanation
in another language. Entries are "native text|romanisation" (romanisation only for non-Latin
scripts; it is a reading aid shown at the easy levels). Words are grouped in 5 tiers:
  1 first words · 2 family, body, home · 3 numbers, colours, animals · 4 greetings · 5 short sentences

NOTE: translations were written by the model and need a native-speaking teacher's review
(see docs/PROGRESS.md). Adding a language = one entry in TARGETS, LETTERS and WORDS.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Target:
    code: str
    name: str
    native: str
    locale: str  # speech synthesis / recognition locale
    flag: str
    rtl: bool = False
    latin: bool = False  # written in Latin letters (no romanisation needed)


TARGETS: dict[str, Target] = {t.code: t for t in [
    Target("en", "English", "English", "en-US", "🇬🇧", latin=True),
    Target("hi", "Hindi", "हिंदी", "hi-IN", "🇮🇳"),
    Target("mr", "Marathi", "मराठी", "mr-IN", "🇮🇳"),
    Target("fr", "French", "Français", "fr-FR", "🇫🇷", latin=True),
    Target("es", "Spanish", "Español", "es-ES", "🇪🇸", latin=True),
    Target("ar", "Arabic", "العربية", "ar-SA", "🇸🇦", rtl=True),
    Target("zh", "Chinese (Mandarin)", "中文", "zh-CN", "🇨🇳"),
    Target("yue", "Cantonese", "廣東話", "zh-HK", "🇭🇰"),
    Target("ko", "Korean", "한국어", "ko-KR", "🇰🇷"),
    Target("ru", "Russian", "Русский", "ru-RU", "🇷🇺"),
    Target("tr", "Turkish", "Türkçe", "tr-TR", "🇹🇷", latin=True),
    # Sanskrit: no speech engine has a Sanskrit voice or recogniser; a Hindi voice reads Devanagari
    # Sanskrit clearly, so Sanskrit is spoken and heard through hi-IN.
    Target("sa", "Sanskrit", "संस्कृतम्", "hi-IN", "🪔"),
    Target("gu", "Gujarati", "ગુજરાતી", "gu-IN", "🇮🇳"),
    Target("bn", "Bengali", "বাংলা", "bn-IN", "🇮🇳"),
    Target("pa", "Punjabi", "ਪੰਜਾਬੀ", "pa-IN", "🇮🇳"),
    Target("ta", "Tamil", "தமிழ்", "ta-IN", "🇮🇳"),
    Target("te", "Telugu", "తెలుగు", "te-IN", "🇮🇳"),
    Target("kn", "Kannada", "ಕನ್ನಡ", "kn-IN", "🇮🇳"),
    Target("de", "German", "Deutsch", "de-DE", "🇩🇪", latin=True),
    Target("ja", "Japanese", "日本語", "ja-JP", "🇯🇵"),
]}
# Scripts written without spaces between words: phrases are built from characters, not words.
NO_SPACES = frozenset({"zh", "yue", "ja"})

# (id, picture, tier)
CONCEPTS: list[tuple[str, str, int]] = [
    ("cat", "🐱", 1), ("dog", "🐶", 1), ("apple", "🍎", 1), ("water", "💧", 1), ("milk", "🥛", 1), ("ball", "⚽", 1), ("sun", "☀️", 1), ("moon", "🌙", 1),
    ("mother", "👩", 2), ("father", "👨", 2), ("hand", "✋", 2), ("eye", "👁️", 2), ("house", "🏠", 2), ("book", "📖", 2), ("tree", "🌳", 2), ("flower", "🌸", 2),
    ("one", "1️⃣", 3), ("two", "2️⃣", 3), ("three", "3️⃣", 3), ("red", "🔴", 3), ("blue", "🔵", 3), ("green", "🟢", 3), ("fish", "🐟", 3), ("bird", "🐦", 3),
    ("hello", "👋", 4), ("thanks", "🙏", 4), ("yes", "✅", 4), ("no", "❌", 4), ("morning", "🌅", 4), ("night", "😴", 4), ("friend", "🧑‍🤝‍🧑", 4), ("school", "🏫", 4),
    ("s_book", "📘", 5), ("s_cat", "🐈", 5), ("s_sun", "🌞", 5), ("s_love", "💖", 5), ("s_water", "🧊", 5), ("s_flower", "🌹", 5),
]
CONCEPT_IDS = [c[0] for c in CONCEPTS]
MAX_TIER = 5

_W = {
    "en": "cat;dog;apple;water;milk;ball;sun;moon;mother;father;hand;eye;house;book;tree;flower;one;two;three;red;blue;green;fish;bird;"
          "hello;thank you;yes;no;good morning;good night;friend;school;"
          "This is a book;The cat is small;The sun is big;I love my mother;The water is cold;The flower is red",
    "hi": "बिल्ली|billi;कुत्ता|kutta;सेब|seb;पानी|paani;दूध|doodh;गेंद|gend;सूरज|sooraj;चाँद|chaand;माँ|maa;पिता|pita;हाथ|haath;आँख|aankh;घर|ghar;"
          "किताब|kitaab;पेड़|ped;फूल|phool;एक|ek;दो|do;तीन|teen;लाल|laal;नीला|neela;हरा|hara;मछली|machhli;चिड़िया|chidiya;"
          "नमस्ते|namaste;धन्यवाद|dhanyavaad;हाँ|haan;नहीं|nahin;सुप्रभात|suprabhaat;शुभ रात्रि|shubh raatri;दोस्त|dost;स्कूल|school;"
          "यह किताब है|yah kitaab hai;बिल्ली छोटी है|billi chhoti hai;सूरज बड़ा है|sooraj bada hai;मुझे माँ से प्यार है|mujhe maa se pyaar hai;"
          "पानी ठंडा है|paani thanda hai;फूल लाल है|phool laal hai",
    "mr": "मांजर|maanjar;कुत्रा|kutra;सफरचंद|safarchand;पाणी|paani;दूध|doodh;चेंडू|chendu;सूर्य|soorya;चंद्र|chandra;आई|aai;बाबा|baba;हात|haat;डोळा|dola;घर|ghar;"
          "पुस्तक|pustak;झाड|jhaad;फूल|phool;एक|ek;दोन|don;तीन|teen;लाल|laal;निळा|nila;हिरवा|hirva;मासा|maasa;पक्षी|pakshi;"
          "नमस्कार|namaskaar;धन्यवाद|dhanyavaad;हो|ho;नाही|naahi;शुभ प्रभात|shubh prabhaat;शुभ रात्री|shubh raatri;मित्र|mitra;शाळा|shaala;"
          "हे पुस्तक आहे|he pustak aahe;मांजर लहान आहे|maanjar lahaan aahe;सूर्य मोठा आहे|soorya motha aahe;माझं आईवर प्रेम आहे|maajha aaivar prem aahe;"
          "पाणी थंड आहे|paani thand aahe;फूल लाल आहे|phool laal aahe",
    "fr": "chat;chien;pomme;eau;lait;ballon;soleil;lune;mère;père;main;œil;maison;livre;arbre;fleur;un;deux;trois;rouge;bleu;vert;poisson;oiseau;"
          "salut;merci;oui;non;bonjour;bonne nuit;ami;école;"
          "C'est un livre;Le chat est petit;Le soleil est grand;J'aime ma mère;L'eau est froide;La fleur est rouge",
    "es": "gato;perro;manzana;agua;leche;pelota;sol;luna;madre;padre;mano;ojo;casa;libro;árbol;flor;uno;dos;tres;rojo;azul;verde;pez;pájaro;"
          "hola;gracias;sí;no;buenos días;buenas noches;amigo;escuela;"
          "Esto es un libro;El gato es pequeño;El sol es grande;Amo a mi madre;El agua está fría;La flor es roja",
    "ar": "قطة|qitta;كلب|kalb;تفاحة|tuffaha;ماء|maa';حليب|haleeb;كرة|kura;شمس|shams;قمر|qamar;أم|umm;أب|ab;يد|yad;عين|ayn;بيت|bayt;"
          "كتاب|kitaab;شجرة|shajara;زهرة|zahra;واحد|waahid;اثنان|ithnaan;ثلاثة|thalaatha;أحمر|ahmar;أزرق|azraq;أخضر|akhdar;سمكة|samaka;طائر|taa'ir;"
          "مرحبا|marhaba;شكرا|shukran;نعم|na'am;لا|laa;صباح الخير|sabaah al-khayr;تصبح على خير|tusbih ala khayr;صديق|sadeeq;مدرسة|madrasa;"
          "هذا كتاب|haadha kitaab;القطة صغيرة|al-qitta sagheera;الشمس كبيرة|ash-shams kabeera;أحب أمي|uhibbu ummi;الماء بارد|al-maa' baarid;"
          "الزهرة حمراء|az-zahra hamraa'",
    "zh": "猫|māo;狗|gǒu;苹果|píngguǒ;水|shuǐ;牛奶|niúnǎi;球|qiú;太阳|tàiyáng;月亮|yuèliang;妈妈|māma;爸爸|bàba;手|shǒu;眼睛|yǎnjing;房子|fángzi;"
          "书|shū;树|shù;花|huā;一|yī;二|èr;三|sān;红色|hóngsè;蓝色|lánsè;绿色|lǜsè;鱼|yú;鸟|niǎo;"
          "你好|nǐ hǎo;谢谢|xièxie;是|shì;不|bù;早上好|zǎoshang hǎo;晚安|wǎn'ān;朋友|péngyou;学校|xuéxiào;"
          "这是书|zhè shì shū;猫很小|māo hěn xiǎo;太阳很大|tàiyáng hěn dà;我爱妈妈|wǒ ài māma;水很冷|shuǐ hěn lěng;花是红色的|huā shì hóngsè de",
    "yue": "貓|maau1;狗|gau2;蘋果|ping4 gwo2;水|seoi2;牛奶|ngau4 naai5;波|bo1;太陽|taai3 joeng4;月亮|jyut6 loeng6;媽媽|maa4 maa1;爸爸|baa4 baa1;手|sau2;眼|ngaan5;屋|uk1;"
           "書|syu1;樹|syu6;花|faa1;一|jat1;二|ji6;三|saam1;紅色|hung4 sik1;藍色|laam4 sik1;綠色|luk6 sik1;魚|jyu2;雀仔|zoek3 zai2;"
           "你好|nei5 hou2;多謝|do1 ze6;係|hai6;唔係|m4 hai6;早晨|zou2 san4;早唞|zou2 tau2;朋友|pang4 jau5;學校|hok6 haau6;"
           "呢本係書|ni1 bun2 hai6 syu1;隻貓好細|zek3 maau1 hou2 sai3;太陽好大|taai3 joeng4 hou2 daai6;我愛媽媽|ngo5 oi3 maa4 maa1;"
           "啲水好凍|di1 seoi2 hou2 dung3;朵花係紅色|do2 faa1 hai6 hung4 sik1",
    "ko": "고양이|goyangi;개|gae;사과|sagwa;물|mul;우유|uyu;공|gong;해|hae;달|dal;엄마|eomma;아빠|appa;손|son;눈|nun;집|jip;"
          "책|chaek;나무|namu;꽃|kkot;하나|hana;둘|dul;셋|set;빨강|ppalgang;파랑|parang;초록|chorok;물고기|mulgogi;새|sae;"
          "안녕하세요|annyeonghaseyo;감사합니다|gamsahamnida;네|ne;아니요|aniyo;좋은 아침|joeun achim;잘 자요|jal jayo;친구|chingu;학교|hakgyo;"
          "이것은 책이에요|igeoseun chaegieyo;고양이는 작아요|goyangineun jagayo;해는 커요|haeneun keoyo;엄마를 사랑해요|eommareul saranghaeyo;"
          "물이 차가워요|muri chagawoyo;꽃은 빨개요|kkocheun ppalgaeyo",
    "ru": "кошка|koshka;собака|sobaka;яблоко|yabloko;вода|voda;молоко|moloko;мяч|myach;солнце|solntse;луна|luna;мама|mama;папа|papa;рука|ruka;глаз|glaz;дом|dom;"
          "книга|kniga;дерево|derevo;цветок|tsvetok;один|odin;два|dva;три|tri;красный|krasnyy;синий|siniy;зелёный|zelyonyy;рыба|ryba;птица|ptitsa;"
          "привет|privet;спасибо|spasibo;да|da;нет|net;доброе утро|dobroye utro;спокойной ночи|spokoynoy nochi;друг|drug;школа|shkola;"
          "Это книга|eto kniga;Кошка маленькая|koshka malen'kaya;Солнце большое|solntse bol'shoye;Я люблю маму|ya lyublyu mamu;"
          "Вода холодная|voda kholodnaya;Цветок красный|tsvetok krasnyy",
    "tr": "kedi;köpek;elma;su;süt;top;güneş;ay;anne;baba;el;göz;ev;kitap;ağaç;çiçek;bir;iki;üç;kırmızı;mavi;yeşil;balık;kuş;"
          "merhaba;teşekkürler;evet;hayır;günaydın;iyi geceler;arkadaş;okul;"
          "Bu bir kitap;Kedi küçük;Güneş büyük;Annemi seviyorum;Su soğuk;Çiçek kırmızı",
    "sa": "मार्जारः|maarjaarah;कुक्कुरः|kukkurah;सेवम्|sevam;जलम्|jalam;दुग्धम्|dugdham;कन्दुकः|kandukah;सूर्यः|sooryah;चन्द्रः|chandrah;"
          "माता|maataa;पिता|pitaa;हस्तः|hastah;नेत्रम्|netram;गृहम्|griham;पुस्तकम्|pustakam;वृक्षः|vrikshah;पुष्पम्|pushpam;"
          "एकम्|ekam;द्वे|dve;त्रीणि|treeni;रक्तः|raktah;नीलः|neelah;हरितः|haritah;मत्स्यः|matsyah;खगः|khagah;"
          "नमस्ते|namaste;धन्यवादः|dhanyavaadah;आम्|aam;न|na;सुप्रभातम्|suprabhaatam;शुभरात्रिः|shubharaatrih;मित्रम्|mitram;विद्यालयः|vidyaalayah;"
          "इदं पुस्तकम्|idam pustakam;मार्जारः लघुः|maarjaarah laghuh;सूर्यः विशालः|sooryah vishaalah;मम माता प्रिया|mama maataa priyaa;"
          "जलं शीतलम्|jalam sheetalam;पुष्पं रक्तम्|pushpam raktam",
    "gu": "બિલાડી|bilaadi;કૂતરો|kootro;સફરજન|safarjan;પાણી|paani;દૂધ|doodh;દડો|dado;સૂરજ|sooraj;ચાંદ|chaand;"
          "મા|maa;પિતા|pitaa;હાથ|haath;આંખ|aankh;ઘર|ghar;પુસ્તક|pustak;ઝાડ|jhaad;ફૂલ|phool;"
          "એક|ek;બે|be;ત્રણ|tran;લાલ|laal;વાદળી|vaadli;લીલો|leelo;માછલી|maachhli;પક્ષી|pakshi;"
          "નમસ્તે|namaste;આભાર|aabhaar;હા|haa;ના|naa;સુપ્રભાત|suprabhaat;શુભ રાત્રિ|shubh raatri;મિત્ર|mitra;શાળા|shaala;"
          "આ પુસ્તક છે|aa pustak chhe;બિલાડી નાની છે|bilaadi naani chhe;સૂરજ મોટો છે|sooraj moto chhe;હું મારી માને પ્રેમ કરું છું|hu maari maane prem karu chhu;"
          "પાણી ઠંડું છે|paani thandu chhe;ફૂલ લાલ છે|phool laal chhe",
    "bn": "বিড়াল|biral;কুকুর|kukur;আপেল|apel;জল|jol;দুধ|dudh;বল|bol;সূর্য|surjo;চাঁদ|chand;"
          "মা|ma;বাবা|baba;হাত|haat;চোখ|chokh;বাড়ি|bari;বই|boi;গাছ|gachh;ফুল|phul;"
          "এক|ek;দুই|dui;তিন|tin;লাল|lal;নীল|neel;সবুজ|sobuj;মাছ|maachh;পাখি|pakhi;"
          "নমস্কার|nomoshkar;ধন্যবাদ|dhonnobad;হ্যাঁ|hyan;না|na;সুপ্রভাত|suprobhat;শুভ রাত্রি|shubho ratri;বন্ধু|bondhu;স্কুল|skul;"
          "এটা একটা বই|eta ekta boi;বিড়ালটা ছোট|biralta chhoto;সূর্য বড়|surjo boro;আমি মাকে ভালোবাসি|ami make bhalobashi;"
          "জল ঠান্ডা|jol thanda;ফুলটা লাল|phulta lal",
    "pa": "ਬਿੱਲੀ|billi;ਕੁੱਤਾ|kutta;ਸੇਬ|seb;ਪਾਣੀ|paani;ਦੁੱਧ|duddh;ਗੇਂਦ|gend;ਸੂਰਜ|sooraj;ਚੰਨ|chann;"
          "ਮਾਂ|maan;ਪਿਤਾ|pitaa;ਹੱਥ|hatth;ਅੱਖ|akkh;ਘਰ|ghar;ਕਿਤਾਬ|kitaab;ਰੁੱਖ|rukkh;ਫੁੱਲ|phull;"
          "ਇੱਕ|ikk;ਦੋ|do;ਤਿੰਨ|tinn;ਲਾਲ|laal;ਨੀਲਾ|neela;ਹਰਾ|hara;ਮੱਛੀ|machhi;ਚਿੜੀ|chiri;"
          "ਸਤ ਸ੍ਰੀ ਅਕਾਲ|sat sri akaal;ਧੰਨਵਾਦ|dhannvaad;ਹਾਂ|haan;ਨਹੀਂ|nahin;ਸ਼ੁਭ ਸਵੇਰ|shubh saver;ਸ਼ੁਭ ਰਾਤ|shubh raat;ਦੋਸਤ|dost;ਸਕੂਲ|school;"
          "ਇਹ ਕਿਤਾਬ ਹੈ|ih kitaab hai;ਬਿੱਲੀ ਛੋਟੀ ਹੈ|billi chhoti hai;ਸੂਰਜ ਵੱਡਾ ਹੈ|sooraj vadda hai;ਮੈਨੂੰ ਮਾਂ ਨਾਲ ਪਿਆਰ ਹੈ|mainu maan naal pyaar hai;"
          "ਪਾਣੀ ਠੰਢਾ ਹੈ|paani thandha hai;ਫੁੱਲ ਲਾਲ ਹੈ|phull laal hai",
    "ta": "பூனை|poonai;நாய்|naai;ஆப்பிள்|aappil;தண்ணீர்|thanneer;பால்|paal;பந்து|panthu;சூரியன்|sooriyan;நிலா|nilaa;"
          "அம்மா|ammaa;அப்பா|appaa;கை|kai;கண்|kan;வீடு|veedu;புத்தகம்|puthagam;மரம்|maram;பூ|poo;"
          "ஒன்று|onru;இரண்டு|irandu;மூன்று|moonru;சிவப்பு|sivappu;நீலம்|neelam;பச்சை|pachai;மீன்|meen;பறவை|paravai;"
          "வணக்கம்|vanakkam;நன்றி|nanri;ஆம்|aam;இல்லை|illai;காலை வணக்கம்|kaalai vanakkam;இனிய இரவு|iniya iravu;நண்பர்|nanbar;பள்ளி|palli;"
          "இது ஒரு புத்தகம்|idhu oru puthagam;பூனை சிறியது|poonai siriyadhu;சூரியன் பெரியது|sooriyan periyadhu;நான் அம்மாவை நேசிக்கிறேன்|naan ammaavai nesikkiren;"
          "தண்ணீர் குளிர்ச்சியாக உள்ளது|thanneer kulirchiyaaga ulladhu;பூ சிவப்பாக உள்ளது|poo sivappaaga ulladhu",
    "te": "పిల్లి|pilli;కుక్క|kukka;ఆపిల్|aapil;నీళ్ళు|neellu;పాలు|paalu;బంతి|banti;సూర్యుడు|sooryudu;చంద్రుడు|chandrudu;"
          "అమ్మ|amma;నాన్న|naanna;చేయి|cheyi;కన్ను|kannu;ఇల్లు|illu;పుస్తకం|pustakam;చెట్టు|chettu;పువ్వు|puvvu;"
          "ఒకటి|okati;రెండు|rendu;మూడు|moodu;ఎరుపు|erupu;నీలం|neelam;ఆకుపచ్చ|aakupachcha;చేప|chepa;పక్షి|pakshi;"
          "నమస్కారం|namaskaaram;ధన్యవాదాలు|dhanyavaadaalu;అవును|avunu;కాదు|kaadu;శుభోదయం|shubhodayam;శుభ రాత్రి|shubha raatri;స్నేహితుడు|snehitudu;బడి|badi;"
          "ఇది ఒక పుస్తకం|idi oka pustakam;పిల్లి చిన్నది|pilli chinnadi;సూర్యుడు పెద్దవాడు|sooryudu peddavaadu;నేను అమ్మను ప్రేమిస్తాను|nenu ammanu premistaanu;"
          "నీళ్ళు చల్లగా ఉన్నాయి|neellu challagaa unnaayi;పువ్వు ఎర్రగా ఉంది|puvvu erragaa undi",
    "kn": "ಬೆಕ್ಕು|bekku;ನಾಯಿ|naayi;ಸೇಬು|sebu;ನೀರು|neeru;ಹಾಲು|haalu;ಚೆಂಡು|chendu;ಸೂರ್ಯ|soorya;ಚಂದ್ರ|chandra;"
          "ಅಮ್ಮ|amma;ಅಪ್ಪ|appa;ಕೈ|kai;ಕಣ್ಣು|kannu;ಮನೆ|mane;ಪುಸ್ತಕ|pustaka;ಮರ|mara;ಹೂವು|hoovu;"
          "ಒಂದು|ondu;ಎರಡು|eradu;ಮೂರು|mooru;ಕೆಂಪು|kempu;ನೀಲಿ|neeli;ಹಸಿರು|hasiru;ಮೀನು|meenu;ಹಕ್ಕಿ|hakki;"
          "ನಮಸ್ಕಾರ|namaskaara;ಧನ್ಯವಾದ|dhanyavaada;ಹೌದು|haudu;ಇಲ್ಲ|illa;ಶುಭೋದಯ|shubhodaya;ಶುಭ ರಾತ್ರಿ|shubha raatri;ಸ್ನೇಹಿತ|snehita;ಶಾಲೆ|shaale;"
          "ಇದು ಒಂದು ಪುಸ್ತಕ|idu ondu pustaka;ಬೆಕ್ಕು ಚಿಕ್ಕದು|bekku chikkadu;ಸೂರ್ಯ ದೊಡ್ಡದು|soorya doddadu;ನಾನು ಅಮ್ಮನನ್ನು ಪ್ರೀತಿಸುತ್ತೇನೆ|naanu ammanannu preetisuttene;"
          "ನೀರು ತಣ್ಣಗಿದೆ|neeru tannagide;ಹೂವು ಕೆಂಪಾಗಿದೆ|hoovu kempaagide",
    "de": "Katze;Hund;Apfel;Wasser;Milch;Ball;Sonne;Mond;Mutter;Vater;Hand;Auge;Haus;Buch;Baum;Blume;eins;zwei;drei;rot;blau;grün;Fisch;Vogel;"
          "hallo;danke;ja;nein;guten Morgen;gute Nacht;Freund;Schule;"
          "Das ist ein Buch;Die Katze ist klein;Die Sonne ist groß;Ich liebe meine Mutter;Das Wasser ist kalt;Die Blume ist rot",
    # Japanese words are in hiragana (what children learn first), so writing them uses kana tiles.
    "ja": "ねこ|neko;いぬ|inu;りんご|ringo;みず|mizu;ぎゅうにゅう|gyuunyuu;ボール|booru;たいよう|taiyou;つき|tsuki;"
          "おかあさん|okaasan;おとうさん|otousan;て|te;め|me;いえ|ie;ほん|hon;き|ki;はな|hana;"
          "いち|ichi;に|ni;さん|san;あか|aka;あお|ao;みどり|midori;さかな|sakana;とり|tori;"
          "こんにちは|konnichiwa;ありがとう|arigatou;はい|hai;いいえ|iie;おはよう|ohayou;おやすみ|oyasumi;ともだち|tomodachi;がっこう|gakkou;"
          "これはほんです|kore wa hon desu;ねこはちいさい|neko wa chiisai;たいようはおおきい|taiyou wa ookii;おかあさんがだいすき|okaasan ga daisuki;"
          "みずはつめたい|mizu wa tsumetai;はなはあかい|hana wa akai",
}

# First letters / characters to recognise and trace, easiest first.
_L = {
    "en": "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z",
    "hi": "अ आ इ ई उ ऊ ए ओ क ख ग घ च छ ज ट ड त द न प फ ब भ म य र ल व स ह",
    "mr": "अ आ इ ई उ ऊ ए ओ क ख ग घ च छ ज ट ड त द न प फ ब भ म य र ल व स ह ळ",
    "fr": "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z É È Ç",
    "es": "A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z",
    "ar": "ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي",
    "zh": "一 二 三 人 大 小 口 日 月 山 水 火 木 手 花 书",
    "yue": "一 二 三 人 大 細 口 日 月 山 水 火 木 手 花 書",
    "ko": "ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅎ ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ 가 나 다",
    "ru": "А Б В Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Э Ю Я",
    "tr": "A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z",
    "sa": "अ आ इ ई उ ऊ ऋ ए ऐ ओ औ क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह",
    "gu": "અ આ ઇ ઈ ઉ ઊ એ ઓ ક ખ ગ ઘ ચ છ જ ટ ડ ત દ ન પ ફ બ ભ મ ય ર લ વ સ હ",
    "bn": "অ আ ই ঈ উ ঊ এ ও ক খ গ ঘ চ ছ জ ট ড ত দ ন প ফ ব ভ ম য র ল শ স হ",
    "pa": "ੳ ਅ ੲ ਸ ਹ ਕ ਖ ਗ ਘ ਚ ਛ ਜ ਝ ਟ ਠ ਡ ਢ ਣ ਤ ਥ ਦ ਧ ਨ ਪ ਫ ਬ ਭ ਮ ਯ ਰ ਲ ਵ ੜ",
    "ta": "அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ க ங ச ஞ ட ண த ந ப ம ய ர ல வ ழ ள ற ன",
    "te": "అ ఆ ఇ ఈ ఉ ఊ ఎ ఏ ఐ ఒ ఓ ఔ క ఖ గ ఘ చ జ ట డ త ద న ప బ మ య ర ల వ స హ",
    "kn": "ಅ ಆ ಇ ಈ ಉ ಊ ಎ ಏ ಐ ಒ ಓ ಔ ಕ ಖ ಗ ಘ ಚ ಜ ಟ ಡ ತ ದ ನ ಪ ಬ ಮ ಯ ರ ಲ ವ ಸ ಹ",
    "de": "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü ß",
    "ja": "あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん",
}


@dataclass(frozen=True)
class Word:
    id: str
    emoji: str
    tier: int
    text: str
    roman: str | None


def _build(code: str) -> dict[str, Word]:
    parts = _W[code].split(";")
    assert len(parts) == len(CONCEPTS), (code, len(parts))
    out = {}
    for (cid, emoji, tier), raw in zip(CONCEPTS, parts):
        text, _, roman = raw.partition("|")
        out[cid] = Word(cid, emoji, tier, text.strip(), roman.strip() or None)
    return out


WORDS: dict[str, dict[str, Word]] = {code: _build(code) for code in TARGETS}
LETTERS: dict[str, list[str]] = {code: _L[code].split() for code in TARGETS}

# --- Barakhadi: a consonant with each vowel sign (क का कि की ...), the heart of reading Indian scripts ---
# The Indian scripts share one Unicode layout, so the vowel signs sit at the same offsets in every block.
_SCRIPT_BLOCK = {"hi": 0x0900, "mr": 0x0900, "sa": 0x0900, "bn": 0x0980, "pa": 0x0A00, "gu": 0x0A80, "ta": 0x0B80, "te": 0x0C00, "kn": 0x0C80}
# a, aa, i, ii, u, uu, e, ai, o, au (+ am for scripts with an anusvara); Tamil/Telugu/Kannada also have short e and o
_SIGNS_NORTH = (None, 0x3E, 0x3F, 0x40, 0x41, 0x42, 0x47, 0x48, 0x4B, 0x4C, 0x02)
_SIGNS_SOUTH = (None, 0x3E, 0x3F, 0x40, 0x41, 0x42, 0x46, 0x47, 0x48, 0x4A, 0x4B, 0x4C)


def _barakhadi(code: str) -> list[list[str]]:
    import unicodedata

    base = _SCRIPT_BLOCK[code]
    signs = _SIGNS_SOUTH if code in ("ta", "te", "kn") else _SIGNS_NORTH
    if code in ("pa", "ta"):  # Gurmukhi and Tamil have no anusvara sign in this slot
        signs = tuple(s for s in signs if s != 0x02)
    rows = []
    for letter in LETTERS[code]:
        if len(letter) != 1 or not 0x15 <= ord(letter) - base <= 0x39:
            continue  # vowels and special letters are not combined with signs
        row = [letter + (chr(base + s) if s else "") for s in signs if s is None or unicodedata.name(chr(base + s), "")]
        rows.append(row)
    return rows


# lang -> rows; each row is one consonant with every vowel sign, in teaching order
BARAKHADI: dict[str, list[list[str]]] = {code: _barakhadi(code) for code in TARGETS if code in _SCRIPT_BLOCK}
