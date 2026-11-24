"""Everyday conversations: short phrases a child can really use, grouped by situation.

Same format as content.py: "native text|romanisation" (romanisation only for non-Latin scripts).
NOTE: written by the model; a native-speaking teacher should review them (see docs/PROGRESS.md).
Gender-neutral forms were chosen where a language allows it (e.g. Hindi "meri umr chhah saal hai").
"""
from __future__ import annotations

from .content import TARGETS, WORDS, Word

# (topic id, picture, English title). Titles are translated by the app.
PHRASE_TOPICS: list[tuple[str, str, str]] = [
    ("greetings", "👋", "Greetings"), ("meeting", "🤝", "Meeting someone"), ("polite", "🙏", "Polite words"),
    ("directions", "🧭", "Directions"), ("food", "🍽️", "Food and drink"), ("help", "🆘", "Asking for help"),
    ("market", "🛒", "At the market"),
    ("school", "🏫", "At school"), ("friends", "🛝", "Playing with friends"), ("feelings", "💛", "Feelings and caring"),
]
# five more day-to-day scenarios, and every topic at 10+ phrases (phrases_more.py)
from .phrases_more import MORE_PHRASES, MORE_TOPICS  # noqa: E402
from .phrases_more_a import MORE_A  # noqa: E402
from .phrases_more_b import MORE_B  # noqa: E402
from .phrases_more_c import MORE_C  # noqa: E402
from .phrases_more_d import MORE_D  # noqa: E402

PHRASE_TOPICS += MORE_TOPICS
TOPIC_IDS = [t[0] for t in PHRASE_TOPICS]
_MORE: dict[str, list[str]] = {**MORE_A, **MORE_B, **MORE_C, **MORE_D}

# (id, topic, picture): every picture differs, so picture choices are never ambiguous
PHRASES: list[tuple[str, str, str]] = [
    ("p_hello", "greetings", "😃"), ("p_morning", "greetings", "🌄"), ("p_how", "greetings", "🤗"), ("p_fine", "greetings", "😊"), ("p_bye", "greetings", "🚶"),
    ("p_name_q", "meeting", "🏷️"), ("p_name", "meeting", "🦉"), ("p_nice", "meeting", "🫱"), ("p_age_q", "meeting", "🎂"), ("p_age", "meeting", "6️⃣"),
    ("p_please", "polite", "🥺"), ("p_thanks", "polite", "💐"), ("p_sorry", "polite", "😔"), ("p_excuse", "polite", "🙋"), ("p_welcome", "polite", "😄"),
    ("p_toilet", "directions", "🚻"), ("p_left", "directions", "⬅️"), ("p_right", "directions", "➡️"), ("p_straight", "directions", "⬆️"), ("p_near", "directions", "📍"),
    ("p_hungry", "food", "🍽️"), ("p_want_water", "food", "🚰"), ("p_tasty", "food", "😋"), ("p_more", "food", "➕"), ("p_full", "food", "😌"),
    ("p_help", "help", "🆘"), ("p_dont_get", "help", "🤷"), ("p_again", "help", "🔁"), ("p_slowly", "help", "🐢"), ("p_happy", "help", "😁"),
    ("p_price", "market", "💲"), ("p_expensive", "market", "💸"), ("p_two", "market", "✌️"), ("p_bag", "market", "🛍️"), ("p_money", "market", "💵"),
    ("p_teacher_hi", "school", "👩‍🏫"), ("p_come_in", "school", "🚪"), ("p_question", "school", "❓"), ("p_toilet_go", "school", "🚽"),
    ("p_pencil", "school", "✏️"), ("p_finished", "school", "🏁"), ("p_dont_know", "school", "🤔"), ("p_here", "school", "🙌"),
    ("p_play_q", "friends", "🧸"), ("p_play_yes", "friends", "🎉"), ("p_friends", "friends", "👫"), ("p_my_turn", "friends", "🎲"),
    ("p_your_turn", "friends", "👉"), ("p_share", "friends", "🍪"), ("p_well_done", "friends", "👏"), ("p_stop", "friends", "🛑"),
    ("p_ok_q", "feelings", "🫂"), ("p_hurt", "feelings", "🩹"), ("p_sad", "feelings", "😢"), ("p_sleepy", "feelings", "🥱"),
    ("p_like", "feelings", "👍"), ("p_scared", "feelings", "😨"),
]
PHRASES += [(pid, topic, emoji) for pid, topic, emoji, _en in MORE_PHRASES]
# At the market: added later, kept apart so each language's list above stays readable
_MARKET = {'en': ['How much is this?', 'It is too expensive.', 'Two, please.', 'A bag, please.', 'Here is the money.'], 'hi': ['यह कितने का है?|yah kitne ka hai?', 'यह बहुत महँगा है।|yah bahut mahanga hai.', 'दो दीजिए, कृपया।|do deejiye, kripya.', 'एक थैला दीजिए।|ek thaila deejiye.', 'यह लीजिए पैसे।|yah leejiye paise.'], 'mr': ['हे किती रुपयांचं आहे?|he kiti rupayancha aahe?', 'हे खूप महाग आहे.|he khoop mahaag aahe.', 'दोन द्या, कृपया.|don dya, krupaya.', 'एक पिशवी द्या.|ek pishvi dya.', 'हे घ्या पैसे.|he ghya paise.'], 'fr': ["C'est combien ?", "C'est trop cher.", "Deux, s'il vous plaît.", "Un sac, s'il vous plaît.", "Voici l'argent."], 'es': ['¿Cuánto cuesta esto?', 'Es demasiado caro.', 'Dos, por favor.', 'Una bolsa, por favor.', 'Aquí está el dinero.'], 'ar': ['بكم هذا؟|bikam haadha?', 'هذا غالٍ جدا.|haadha ghaalin jiddan.', 'اثنان من فضلك.|ithnaan min fadlik.', 'كيس من فضلك.|kees min fadlik.', 'تفضل المال.|tafaddal al-maal.'], 'zh': ['这个多少钱？|zhège duōshao qián?', '太贵了。|tài guì le.', '请给我两个。|qǐng gěi wǒ liǎng gè.', '请给我一个袋子。|qǐng gěi wǒ yí gè dàizi.', '给你钱。|gěi nǐ qián.'], 'yue': ['呢個幾多錢？|ni1 go3 gei2 do1 cin2?', '太貴喇。|taai3 gwai3 laa3.', '唔該俾兩個我。|m4 goi1 bei2 loeng5 go3 ngo5.', '唔該俾個袋我。|m4 goi1 bei2 go3 doi2 ngo5.', '俾錢你。|bei2 cin2 nei5.'], 'ko': ['이거 얼마예요?|igeo eolmayeyo?', '너무 비싸요.|neomu bissayo.', '두 개 주세요.|du gae juseyo.', '봉투 주세요.|bongtu juseyo.', '여기 돈이요.|yeogi doniyo.'], 'ru': ["Сколько это стоит?|skol'ko eto stoit?", 'Это слишком дорого.|eto slishkom dorogo.', 'Два, пожалуйста.|dva, pozhaluysta.', 'Пакет, пожалуйста.|paket, pozhaluysta.', "Вот деньги.|vot den'gi."], 'tr': ['Bu ne kadar?', 'Çok pahalı.', 'İki tane, lütfen.', 'Bir poşet, lütfen.', 'Buyurun, para.'], 'sa': ['एतत् कियत् मूल्यम्?|etat kiyat moolyam?', 'एतत् अतीव महार्घम्।|etat ateeva mahaargham.', 'कृपया द्वे ददातु।|kripayaa dve dadaatu.', 'कृपया एकं स्यूतं ददातु।|kripayaa ekam syootam dadaatu.', 'इदं धनम्।|idam dhanam.'], 'gu': ['આ કેટલાનું છે?|aa ketlaanu chhe?', 'આ બહુ મોંઘું છે.|aa bahu monghu chhe.', 'બે આપો, કૃપા કરીને.|be aapo, krupa karine.', 'એક થેલી આપો.|ek theli aapo.', 'આ લો પૈસા.|aa lo paisa.'], 'bn': ['এটার দাম কত?|etar dam koto?', 'এটা খুব দামি।|eta khub dami.', 'দুটো দিন, দয়া করে।|duto din, doya kore.', 'একটা ব্যাগ দিন।|ekta byag din.', 'এই নিন টাকা।|ei nin taka.'], 'pa': ['ਇਹ ਕਿੰਨੇ ਦਾ ਹੈ?|ih kinne da hai?', 'ਇਹ ਬਹੁਤ ਮਹਿੰਗਾ ਹੈ।|ih bahut mehnga hai.', 'ਦੋ ਦਿਓ, ਕਿਰਪਾ ਕਰਕੇ।|do dio, kirpa karke.', 'ਇੱਕ ਥੈਲਾ ਦਿਓ।|ikk thaila dio.', 'ਆਹ ਲਓ ਪੈਸੇ।|aah lao paise.'], 'ta': ['இது எவ்வளவு?|idhu evvalavu?', 'இது மிகவும் விலை அதிகம்.|idhu migavum vilai adhigam.', 'இரண்டு கொடுங்கள்.|irandu kodungal.', 'ஒரு பை கொடுங்கள்.|oru pai kodungal.', 'இதோ பணம்.|idho panam.'], 'te': ['ఇది ఎంత?|idi enta?', 'ఇది చాలా ఖరీదు.|idi chaalaa khareedu.', 'రెండు ఇవ్వండి.|rendu ivvandi.', 'ఒక సంచి ఇవ్వండి.|oka sanchi ivvandi.', 'ఇదిగో డబ్బు.|idigo dabbu.'], 'kn': ['ಇದು ಎಷ್ಟು?|idu eshtu?', 'ಇದು ತುಂಬಾ ದುಬಾರಿ.|idu tumbaa dubaari.', 'ಎರಡು ಕೊಡಿ.|eradu kodi.', 'ಒಂದು ಚೀಲ ಕೊಡಿ.|ondu cheela kodi.', 'ಇಗೋ ಹಣ.|igo hana.'], 'de': ['Wie viel kostet das?', 'Das ist zu teuer.', 'Zwei, bitte.', 'Eine Tüte, bitte.', 'Hier ist das Geld.'], 'ja': ['これはいくらですか？|kore wa ikura desu ka?', 'たかすぎます。|takasugimasu.', 'ふたつください。|futatsu kudasai.', 'ふくろをください。|fukuro o kudasai.', 'はい、おかねです。|hai, okane desu.']}


# At school, playing with friends, feelings: what a child needs to take part in class and play with other
# children. Added later (2026-11-18), kept apart like _MARKET. Gender-neutral first person where the language
# allows it ("I am sleepy" rather than a gendered "I am tired"; Hindi "kya main andar aaoon?").
_SCHOOL = {
    'en': ['Good morning, teacher!', 'May I come in?', 'I have a question.', 'May I go to the toilet?', 'Can I borrow a pencil?',
           'I have finished.', "I don't know.", 'I am here!',
           'Can I play with you?', 'Yes, come and play!', "Let's be friends!", 'It is my turn.', 'Your turn!', "Let's share.", 'Well done!',
           'Stop, please!',
           'Are you okay?', 'I am hurt.', 'I am sad.', 'I am sleepy.', 'I like it!', 'I am scared.'],
    'hi': ['नमस्ते, टीचर जी!|namaste, teacher ji!', 'क्या मैं अंदर आऊँ?|kya main andar aaoon?', 'मेरा एक सवाल है।|mera ek sawaal hai.',
           'क्या मैं टॉयलेट जाऊँ?|kya main toilet jaaoon?', 'क्या मुझे एक पेंसिल मिलेगी?|kya mujhe ek pencil milegi?',
           'मेरा काम हो गया।|mera kaam ho gaya.', 'मुझे नहीं पता।|mujhe nahin pata.', 'मैं यहाँ हूँ!|main yahaan hoon!',
           'क्या मैं तुम्हारे साथ खेलूँ?|kya main tumhare saath kheloon?', 'हाँ, आओ खेलें!|haan, aao khelen!', 'चलो दोस्ती करें!|chalo dosti karen!',
           'मेरी बारी है।|meri baari hai.', 'तुम्हारी बारी!|tumhari baari!', 'चलो मिलकर बाँटें।|chalo milkar baanten.', 'शाबाश!|shaabaash!',
           'कृपया रुको!|kripya ruko!',
           'क्या तुम ठीक हो?|kya tum theek ho?', 'मुझे चोट लगी है।|mujhe chot lagi hai.', 'मैं उदास हूँ।|main udaas hoon.',
           'मुझे नींद आ रही है।|mujhe neend aa rahi hai.', 'मुझे यह अच्छा लगा!|mujhe yah achchha laga!', 'मुझे डर लग रहा है।|mujhe dar lag raha hai.'],
    'mr': ['नमस्कार, टीचर!|namaskar, teacher!', 'मी आत येऊ का?|mi aat yeu ka?', 'मला एक प्रश्न आहे.|mala ek prashna aahe.',
           'मी टॉयलेटला जाऊ का?|mi toiletla jaau ka?', 'मला एक पेन्सिल मिळेल का?|mala ek pencil milel ka?',
           'माझं काम झालं.|maajha kaam jhaala.', 'मला माहीत नाही.|mala maahit naahi.', 'मी इथे आहे!|mi ithe aahe!',
           'मी तुझ्याबरोबर खेळू का?|mi tujhyabarobar khelu ka?', 'हो, ये खेळायला!|ho, ye khelayla!', 'चल, आपण मित्र होऊया!|chal, aapan mitra houya!',
           'माझी पाळी आहे.|maajhi paali aahe.', 'तुझी पाळी!|tujhi paali!', 'चल, वाटून घेऊया.|chal, vaatun gheuya.', 'शाब्बास!|shaabbaas!',
           'कृपया थांब!|krupaya thaamb!',
           'तू ठीक आहेस का?|tu theek aahes ka?', 'मला लागलं.|mala laagla.', 'मला वाईट वाटतंय.|mala vaait vaatatay.',
           'मला झोप येतेय.|mala jhop yetey.', 'मला हे आवडलं!|mala he aavadla!', 'मला भीती वाटतेय.|mala bheeti vaatatey.'],
    'fr': ['Bonjour, maîtresse !', 'Je peux entrer ?', "J'ai une question.", 'Je peux aller aux toilettes ?', 'Tu peux me prêter un crayon ?',
           "J'ai fini.", 'Je ne sais pas.', 'Je suis là !',
           'Je peux jouer avec toi ?', 'Oui, viens jouer !', 'Soyons amis !', "C'est mon tour.", 'À toi !', 'On partage.', 'Bravo !',
           "Arrête, s'il te plaît !",
           'Ça va ?', "J'ai mal.", 'Je suis triste.', "J'ai sommeil.", "J'aime bien !", "J'ai peur."],
    'es': ['¡Buenos días, profe!', '¿Puedo pasar?', 'Tengo una pregunta.', '¿Puedo ir al baño?', '¿Me prestas un lápiz?',
           'Ya terminé.', 'No lo sé.', '¡Aquí estoy!',
           '¿Puedo jugar contigo?', '¡Sí, ven a jugar!', '¡Seamos amigos!', 'Es mi turno.', '¡Te toca!', 'Vamos a compartir.', '¡Muy bien hecho!',
           '¡Para, por favor!',
           '¿Estás bien?', 'Me hice daño.', 'Estoy triste.', 'Tengo sueño.', '¡Me gusta!', 'Tengo miedo.'],
    'ar': ['صباح الخير يا أستاذ!|sabaah al-khayr yaa ustaadh!', 'هل يمكنني الدخول؟|hal yumkinuni ad-dukhool?', 'عندي سؤال.|\'indi su\'aal.',
           'هل يمكنني الذهاب إلى الحمام؟|hal yumkinuni adh-dhahaab ilaa al-hammaam?', 'هل تعيرني قلما؟|hal tu\'eeruni qalaman?',
           'انتهيت.|intahaytu.', 'لا أعرف.|laa a\'rif.', 'أنا هنا!|anaa hunaa!',
           'هل يمكنني أن ألعب معك؟|hal yumkinuni an al\'ab ma\'ak?', 'نعم، تعال نلعب!|na\'am, ta\'aal nal\'ab!', 'لنكن أصدقاء!|linakun asdiqaa\'!',
           'هذا دوري.|haadha dawri.', 'دورك!|dawruk!', 'لنتشارك.|linatashaarak.', 'أحسنت!|ahsant!',
           'توقف من فضلك!|tawaqqaf min fadlik!',
           'هل أنت بخير؟|hal anta bikhayr?', 'لقد تأذيت.|laqad ta\'adhaytu.', 'أشعر بالحزن.|ash\'uru bil-huzn.',
           'أشعر بالنعاس.|ash\'uru bin-nu\'aas.', 'يعجبني!|yu\'jibuni!', 'أشعر بالخوف.|ash\'uru bil-khawf.'],
    'zh': ['老师早上好！|lǎoshī zǎoshang hǎo!', '我可以进来吗？|wǒ kěyǐ jìnlái ma?', '我有一个问题。|wǒ yǒu yí gè wèntí.',
           '我可以去厕所吗？|wǒ kěyǐ qù cèsuǒ ma?', '可以借我一支铅笔吗？|kěyǐ jiè wǒ yì zhī qiānbǐ ma?',
           '我做完了。|wǒ zuò wán le.', '我不知道。|wǒ bù zhīdào.', '我在这里！|wǒ zài zhèlǐ!',
           '我可以和你一起玩吗？|wǒ kěyǐ hé nǐ yìqǐ wán ma?', '好啊，一起来玩吧！|hǎo a, yìqǐ lái wán ba!', '我们做朋友吧！|wǒmen zuò péngyou ba!',
           '轮到我了。|lún dào wǒ le.', '轮到你了！|lún dào nǐ le!', '我们一起分享吧。|wǒmen yìqǐ fēnxiǎng ba.', '真棒！|zhēn bàng!',
           '请停下来！|qǐng tíng xiàlái!',
           '你还好吗？|nǐ hái hǎo ma?', '我受伤了。|wǒ shòushāng le.', '我很难过。|wǒ hěn nánguò.', '我困了。|wǒ kùn le.', '我喜欢！|wǒ xǐhuan!',
           '我害怕。|wǒ hàipà.'],
    'yue': ['老師早晨！|lou5 si1 zou2 san4!', '我可唔可以入嚟？|ngo5 ho2 m4 ho2 ji5 jap6 lai4?', '我有個問題。|ngo5 jau5 go3 man6 tai4.',
            '我可唔可以去廁所？|ngo5 ho2 m4 ho2 ji5 heoi3 ci3 so2?', '可唔可以借支鉛筆俾我？|ho2 m4 ho2 ji5 ze3 zi1 jyun4 bat1 bei2 ngo5?',
            '我做完喇。|ngo5 zou6 jyun4 laa3.', '我唔知。|ngo5 m4 zi1.', '我喺度！|ngo5 hai2 dou6!',
            '我可唔可以同你一齊玩？|ngo5 ho2 m4 ho2 ji5 tung4 nei5 jat1 cai4 waan2?', '好呀，一齊嚟玩啦！|hou2 aa3, jat1 cai4 lai4 waan2 laa1!',
            '我哋做朋友啦！|ngo5 dei6 zou6 pang4 jau5 laa1!', '輪到我喇。|leon4 dou3 ngo5 laa3.', '輪到你喇！|leon4 dou3 nei5 laa3!',
            '我哋一齊分享啦。|ngo5 dei6 jat1 cai4 fan1 hoeng2 laa1.', '好叻呀！|hou2 lek1 aa3!', '唔該停手！|m4 goi1 ting4 sau2!',
            '你冇事吖嘛？|nei5 mou5 si6 aa1 maa3?', '我整親呀。|ngo5 zing2 can1 aa3.', '我好唔開心。|ngo5 hou2 m4 hoi1 sam1.',
            '我好眼瞓。|ngo5 hou2 ngaan5 fan3.', '我鍾意！|ngo5 zung1 ji3!', '我好驚。|ngo5 hou2 geng1.'],
    'ko': ['선생님, 안녕하세요!|seonsaengnim, annyeonghaseyo!', '들어가도 돼요?|deureogado dwaeyo?', '질문이 있어요.|jilmuni isseoyo.',
           '화장실에 가도 돼요?|hwajangsire gado dwaeyo?', '연필 좀 빌려줄래?|yeonpil jom billyeojullae?',
           '다 했어요.|da haesseoyo.', '몰라요.|mollayo.', '여기 있어요!|yeogi isseoyo!',
           '같이 놀아도 돼?|gachi norado dwae?', '응, 같이 놀자!|eung, gachi nolja!', '우리 친구 하자!|uri chingu haja!',
           '내 차례야.|nae charyeya.', '네 차례야!|ne charyeya!', '같이 나누자.|gachi nanuja.', '잘했어!|jalhaesseo!', '그만해 줘!|geumanhae jwo!',
           '괜찮아?|gwaenchana?', '다쳤어요.|dachyeosseoyo.', '슬퍼요.|seulpeoyo.', '졸려요.|jollyeoyo.', '좋아요!|joayo!', '무서워요.|museowoyo.'],
    'ru': ['Здравствуйте, учитель!|zdravstvuyte, uchitel\'!', 'Можно войти?|mozhno voyti?', 'У меня вопрос.|u menya vopros.',
           'Можно выйти в туалет?|mozhno vyyti v tualet?', 'Дашь мне карандаш?|dash\' mne karandash?',
           'Готово!|gotovo!', 'Я не знаю.|ya ne znayu.', 'Я здесь!|ya zdes\'!',
           'Можно с тобой поиграть?|mozhno s toboy poigrat\'?', 'Да, давай играть!|da, davay igrat\'!', 'Давай дружить!|davay druzhit\'!',
           'Моя очередь.|moya ochered\'.', 'Твоя очередь!|tvoya ochered\'!', 'Давай поделимся.|davay podelimsya.', 'Молодец!|molodets!',
           'Стой, пожалуйста!|stoy, pozhaluysta!',
           'Ты в порядке?|ty v poryadke?', 'Мне больно.|mne bol\'no.', 'Мне грустно.|mne grustno.', 'Я хочу спать.|ya khochu spat\'.',
           'Мне нравится!|mne nravitsya!', 'Мне страшно.|mne strashno.'],
    'tr': ['Günaydın öğretmenim!', 'Girebilir miyim?', 'Bir sorum var.', 'Tuvalete gidebilir miyim?', 'Bir kalem ödünç alabilir miyim?',
           'Bitirdim.', 'Bilmiyorum.', 'Buradayım!',
           'Seninle oynayabilir miyim?', 'Evet, gel oynayalım!', 'Arkadaş olalım!', 'Sıra bende.', 'Sıra sende!', 'Paylaşalım.', 'Aferin!',
           'Dur, lütfen!',
           'İyi misin?', 'Canım yandı.', 'Mutsuzum.', 'Uykum geldi.', 'Beğendim!', 'Korkuyorum.'],
    'sa': ['सुप्रभातम्, आचार्य!|suprabhaatam, aachaarya!', 'अहम् अन्तः आगच्छानि वा?|aham antah aagachchhaani vaa?',
           'मम एकः प्रश्नः अस्ति।|mama ekah prashnah asti.', 'अहं शौचालयं गच्छानि वा?|aham shauchaalayam gachchhaani vaa?',
           'कृपया एकां लेखनीं ददातु।|kripayaa ekaam lekhaneem dadaatu.',
           'मम कार्यं समाप्तम्।|mama kaaryam samaaptam.', 'अहं न जानामि।|aham na jaanaami.', 'अहम् अत्र अस्मि!|aham atra asmi!',
           'अहं त्वया सह क्रीडानि वा?|aham tvayaa saha kreedaani vaa?', 'आम्, आगच्छ, क्रीडामः!|aam, aagachchha, kreedaamah!',
           'वयं मित्राणि भवामः!|vayam mitraani bhavaamah!', 'मम वारः।|mama vaarah.', 'तव वारः!|tava vaarah!', 'वयं विभजामः।|vayam vibhajaamah.',
           'साधु!|saadhu!', 'कृपया तिष्ठ!|kripayaa tishtha!',
           'किं सर्वं कुशलम्?|kim sarvam kushalam?', 'मम पीडा अस्ति।|mama peedaa asti.', 'मम दुःखम् अस्ति।|mama duhkham asti.',
           'मम निद्रा आगच्छति।|mama nidraa aagachchhati.', 'मह्यम् एतत् रोचते!|mahyam etat rochate!', 'मम भयम् अस्ति।|mama bhayam asti.'],
    'gu': ['નમસ્તે, ટીચર!|namaste, teacher!', 'હું અંદર આવું?|hun andar aavun?', 'મારે એક પ્રશ્ન છે.|maare ek prashna chhe.',
           'હું ટૉઇલેટ જાઉં?|hun toilet jaaun?', 'મને એક પેન્સિલ આપશો?|mane ek pencil aapsho?',
           'મારું કામ થઈ ગયું.|maaru kaam thai gayu.', 'મને ખબર નથી.|mane khabar nathi.', 'હું અહીં છું!|hun ahin chhun!',
           'હું તારી સાથે રમું?|hun taari saathe ramun?', 'હા, ચાલ રમીએ!|haa, chaal ramie!', 'ચાલ, આપણે મિત્રો બનીએ!|chaal, aapane mitro banie!',
           'મારો વારો છે.|maaro vaaro chhe.', 'તારો વારો!|taaro vaaro!', 'ચાલ, વહેંચીએ.|chaal, vahenchie.', 'શાબાશ!|shaabaash!',
           'મહેરબાની કરીને રોકાઈ જા!|maherbaani karine rokaai jaa!',
           'તું ઠીક છે?|tun theek chhe?', 'મને વાગ્યું.|mane vaagyu.', 'હું ઉદાસ છું.|hun udaas chhun.', 'મને ઊંઘ આવે છે.|mane oongh aave chhe.',
           'મને ગમ્યું!|mane gamyu!', 'મને ડર લાગે છે.|mane dar laage chhe.'],
    'bn': ['সুপ্রভাত, শিক্ষক!|suprobhat, shikkhok!', 'আমি কি ভেতরে আসতে পারি?|ami ki bhetore ashte pari?',
           'আমার একটা প্রশ্ন আছে।|amar ekta proshno achhe.', 'আমি কি বাথরুমে যেতে পারি?|ami ki bathroome jete pari?',
           'আমাকে একটা পেন্সিল দেবে?|amake ekta pencil debe?',
           'আমার হয়ে গেছে।|amar hoye gechhe.', 'আমি জানি না।|ami jani na.', 'আমি এখানে!|ami ekhane!',
           'আমি কি তোমার সাথে খেলতে পারি?|ami ki tomar sathe khelte pari?', 'হ্যাঁ, এসো খেলি!|hyan, esho kheli!', 'চলো বন্ধু হই!|cholo bondhu hoi!',
           'এবার আমার পালা।|ebar amar pala.', 'তোমার পালা!|tomar pala!', 'চলো ভাগ করে নিই।|cholo bhag kore nii.', 'শাবাশ!|shabash!',
           'থামো, দয়া করে!|thamo, doya kore!',
           'তুমি ঠিক আছো?|tumi thik achho?', 'আমি ব্যথা পেয়েছি।|ami byatha peyechhi.', 'আমার মন খারাপ।|amar mon kharap.',
           'আমার ঘুম পাচ্ছে।|amar ghum pachchhe.', 'আমার এটা ভালো লেগেছে!|amar eta bhalo legechhe!', 'আমার ভয় করছে।|amar bhoy korchhe.'],
    'pa': ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਟੀਚਰ ਜੀ!|sat sri akaal, teacher ji!', 'ਕੀ ਮੈਂ ਅੰਦਰ ਆ ਜਾਵਾਂ?|ki main andar aa jaavaan?',
           'ਮੇਰਾ ਇੱਕ ਸਵਾਲ ਹੈ।|mera ikk savaal hai.', 'ਕੀ ਮੈਂ ਟਾਇਲਟ ਜਾਵਾਂ?|ki main toilet jaavaan?',
           'ਕੀ ਮੈਨੂੰ ਇੱਕ ਪੈਨਸਿਲ ਮਿਲੇਗੀ?|ki mainu ikk pencil milegi?',
           'ਮੇਰਾ ਕੰਮ ਹੋ ਗਿਆ।|mera kamm ho gaya.', 'ਮੈਨੂੰ ਨਹੀਂ ਪਤਾ।|mainu nahin pata.', 'ਮੈਂ ਇੱਥੇ ਹਾਂ!|main itthe haan!',
           'ਕੀ ਮੈਂ ਤੇਰੇ ਨਾਲ ਖੇਡਾਂ?|ki main tere naal khedaan?', 'ਹਾਂ, ਆਜਾ ਖੇਡੀਏ!|haan, aaja khediye!', 'ਆਪਾਂ ਦੋਸਤ ਬਣੀਏ!|aapaan dost baniye!',
           'ਮੇਰੀ ਵਾਰੀ ਹੈ।|meri vaari hai.', 'ਤੇਰੀ ਵਾਰੀ!|teri vaari!', 'ਆਓ ਵੰਡ ਕੇ ਲਈਏ।|aao vand ke laiye.', 'ਸ਼ਾਬਾਸ਼!|shaabaash!',
           'ਕਿਰਪਾ ਕਰਕੇ ਰੁਕ ਜਾ!|kirpa karke ruk jaa!',
           'ਕੀ ਤੂੰ ਠੀਕ ਹੈਂ?|ki toon theek hain?', 'ਮੈਨੂੰ ਸੱਟ ਲੱਗੀ ਹੈ।|mainu satt laggi hai.', 'ਮੈਂ ਉਦਾਸ ਹਾਂ।|main udaas haan.',
           'ਮੈਨੂੰ ਨੀਂਦ ਆ ਰਹੀ ਹੈ।|mainu neend aa rahi hai.', 'ਮੈਨੂੰ ਇਹ ਪਸੰਦ ਹੈ!|mainu ih pasand hai!', 'ਮੈਨੂੰ ਡਰ ਲੱਗ ਰਿਹਾ ਹੈ।|mainu dar lagg reha hai.'],
    'ta': ['வணக்கம், டீச்சர்!|vanakkam, teacher!', 'நான் உள்ளே வரலாமா?|naan ulle varalaamaa?',
           'எனக்கு ஒரு கேள்வி இருக்கிறது.|enakku oru kelvi irukkiradhu.', 'நான் கழிவறைக்குப் போகலாமா?|naan kazhivaraikku pogalaamaa?',
           'எனக்கு ஒரு பென்சில் தருவாயா?|enakku oru pencil tharuvaayaa?',
           'நான் முடித்துவிட்டேன்.|naan mudiththuvitten.', 'எனக்குத் தெரியாது.|enakku theriyaadhu.', 'நான் இங்கே இருக்கிறேன்!|naan inge irukkiren!',
           'நான் உன்னுடன் விளையாடலாமா?|naan unnudan vilaiyaadalaamaa?', 'ஆமாம், வா விளையாடலாம்!|aamaam, vaa vilaiyaadalaam!',
           'நாம் நண்பர்களாக இருப்போம்!|naam nanbargalaaga iruppom!', 'இது என் முறை.|idhu en murai.', 'உன் முறை!|un murai!',
           'பகிர்ந்து கொள்வோம்.|pagirndhu kolvom.', 'சபாஷ்!|sabaash!', 'தயவுசெய்து நிறுத்து!|thayavuseydhu niruththu!',
           'நீ நலமா?|nee nalamaa?', 'எனக்கு அடிபட்டுவிட்டது.|enakku adipattuvittadhu.', 'நான் சோகமாக இருக்கிறேன்.|naan sogamaaga irukkiren.',
           'எனக்குத் தூக்கம் வருகிறது.|enakku thookkam varugiradhu.', 'எனக்கு இது பிடிக்கும்!|enakku idhu pidikkum!',
           'எனக்குப் பயமாக இருக்கிறது.|enakku bayamaaga irukkiradhu.'],
    'te': ['నమస్తే, టీచర్!|namaste, teacher!', 'నేను లోపలికి రావచ్చా?|nenu lopaliki raavachchaa?', 'నాకు ఒక ప్రశ్న ఉంది.|naaku oka prashna undi.',
           'నేను టాయిలెట్‌కి వెళ్ళవచ్చా?|nenu toilet-ki vellavachchaa?', 'నాకు ఒక పెన్సిల్ ఇస్తావా?|naaku oka pencil istaavaa?',
           'నేను పూర్తి చేశాను.|nenu poorti chesaanu.', 'నాకు తెలియదు.|naaku teliyadu.', 'నేను ఇక్కడ ఉన్నాను!|nenu ikkada unnaanu!',
           'నేను నీతో ఆడుకోవచ్చా?|nenu neeto aadukovachchaa?', 'అవును, రా ఆడుకుందాం!|avunu, raa aadukundaam!',
           'మనం స్నేహితులుగా ఉందాం!|manam snehituluga undaam!', 'ఇది నా వంతు.|idi naa vantu.', 'నీ వంతు!|nee vantu!', 'పంచుకుందాం.|panchukundaam.',
           'శభాష్!|shabhaash!', 'దయచేసి ఆపు!|dayachesi aapu!',
           'నువ్వు బాగున్నావా?|nuvvu baagunnaavaa?', 'నాకు దెబ్బ తగిలింది.|naaku debba tagilindi.', 'నాకు బాధగా ఉంది.|naaku baadhagaa undi.',
           'నాకు నిద్ర వస్తోంది.|naaku nidra vastondi.', 'నాకు ఇది నచ్చింది!|naaku idi nachchindi!', 'నాకు భయంగా ఉంది.|naaku bhayangaa undi.'],
    'kn': ['ನಮಸ್ಕಾರ, ಟೀಚರ್!|namaskaara, teacher!', 'ನಾನು ಒಳಗೆ ಬರಬಹುದೇ?|naanu olage barabahude?', 'ನನಗೆ ಒಂದು ಪ್ರಶ್ನೆ ಇದೆ.|nanage ondu prashne ide.',
           'ನಾನು ಶೌಚಾಲಯಕ್ಕೆ ಹೋಗಬಹುದೇ?|naanu shauchaalayakke hogabahude?', 'ನನಗೆ ಒಂದು ಪೆನ್ಸಿಲ್ ಕೊಡುತ್ತೀಯಾ?|nanage ondu pencil koduttiyaa?',
           'ನಾನು ಮುಗಿಸಿದೆ.|naanu mugiside.', 'ನನಗೆ ಗೊತ್ತಿಲ್ಲ.|nanage gottilla.', 'ನಾನು ಇಲ್ಲಿದ್ದೇನೆ!|naanu illiddene!',
           'ನಾನು ನಿನ್ನ ಜೊತೆ ಆಡಬಹುದೇ?|naanu ninna jote aadabahude?', 'ಹೌದು, ಬಾ ಆಡೋಣ!|haudu, baa aadona!', 'ನಾವು ಸ್ನೇಹಿತರಾಗೋಣ!|naavu snehitaraagona!',
           'ಇದು ನನ್ನ ಸರದಿ.|idu nanna saradi.', 'ನಿನ್ನ ಸರದಿ!|ninna saradi!', 'ಹಂಚಿಕೊಳ್ಳೋಣ.|hanchikollona.', 'ಭೇಷ್!|bhesh!',
           'ದಯವಿಟ್ಟು ನಿಲ್ಲಿಸು!|dayavittu nillisu!',
           'ನೀನು ಚೆನ್ನಾಗಿದ್ದೀಯಾ?|neenu chennaagiddiyaa?', 'ನನಗೆ ಪೆಟ್ಟಾಯಿತು.|nanage pettaayitu.', 'ನನಗೆ ಬೇಸರವಾಗಿದೆ.|nanage besaravaagide.',
           'ನನಗೆ ನಿದ್ದೆ ಬರುತ್ತಿದೆ.|nanage nidde baruttide.', 'ನನಗೆ ಇದು ಇಷ್ಟ!|nanage idu ishta!', 'ನನಗೆ ಭಯವಾಗುತ್ತಿದೆ.|nanage bhayavaaguttide.'],
    'de': ['Guten Morgen, Frau Lehrerin!', 'Darf ich reinkommen?', 'Ich habe eine Frage.', 'Darf ich auf die Toilette gehen?',
           'Kannst du mir einen Bleistift leihen?',
           'Ich bin fertig.', 'Ich weiß es nicht.', 'Ich bin hier!',
           'Darf ich mitspielen?', 'Ja, komm spielen!', 'Lass uns Freunde sein!', 'Ich bin dran.', 'Du bist dran!', 'Wir teilen.', 'Gut gemacht!',
           'Hör bitte auf!',
           'Geht es dir gut?', 'Ich habe mir wehgetan.', 'Ich bin traurig.', 'Ich bin müde.', 'Das gefällt mir!', 'Ich habe Angst.'],
    'ja': ['せんせい、おはようございます！|sensei, ohayou gozaimasu!', 'はいってもいいですか？|haittemo ii desu ka?', 'しつもんがあります。|shitsumon ga arimasu.',
           'トイレにいってもいいですか？|toire ni ittemo ii desu ka?', 'えんぴつをかしてくれる？|enpitsu o kashite kureru?',
           'おわりました。|owarimashita.', 'しりません。|shirimasen.', 'はい、ここにいます！|hai, koko ni imasu!',
           'いっしょにあそんでもいい？|issho ni asondemo ii?', 'うん、いっしょにあそぼう！|un, issho ni asobou!', 'ともだちになろう！|tomodachi ni narou!',
           'つぎはわたしのばん。|tsugi wa watashi no ban.', 'きみのばんだよ！|kimi no ban da yo!', 'わけっこしよう。|wakekko shiyou.',
           'よくできたね！|yoku dekita ne!', 'やめて、おねがい！|yamete, onegai!',
           'だいじょうぶ？|daijoubu?', 'いたい。|itai.', 'かなしい。|kanashii.', 'ねむい。|nemui.', 'これ、すき！|kore, suki!', 'こわい。|kowai.'],
}
_P = {
    "en": [
        "Hello!", "Good morning!", "How are you?", "I am fine, thank you.", "Goodbye!",
        "What is your name?", "My name is Melo.", "Nice to meet you.", "How old are you?", "I am six years old.",
        "Please.", "Thank you very much!", "Sorry.", "Excuse me.", "You're welcome.",
        "Where is the toilet?", "Turn left.", "Turn right.", "Go straight.", "It is near.",
        "I am hungry.", "I want water, please.", "It is tasty!", "More, please.", "I am full.",
        "Help me, please.", "I don't understand.", "Please say it again.", "Slowly, please.", "I am happy!",
    ],
    "hi": [
        "नमस्ते!|namaste!", "सुप्रभात!|suprabhaat!", "आप कैसे हैं?|aap kaise hain?", "मैं ठीक हूँ, धन्यवाद।|main theek hoon, dhanyavaad.", "फिर मिलेंगे!|phir milenge!",
        "आपका नाम क्या है?|aapka naam kya hai?", "मेरा नाम मेलो है।|mera naam Melo hai.", "आपसे मिलकर खुशी हुई।|aapse milkar khushi hui.",
        "आपकी उम्र क्या है?|aapki umr kya hai?", "मेरी उम्र छह साल है।|meri umr chhah saal hai.",
        "कृपया।|kripya.", "बहुत धन्यवाद!|bahut dhanyavaad!", "माफ़ करना।|maaf karna.", "सुनिए।|suniye.", "कोई बात नहीं।|koi baat nahin.",
        "टॉयलेट कहाँ है?|toilet kahaan hai?", "बाएँ मुड़िए।|baayen mudiye.", "दाएँ मुड़िए।|daayen mudiye.", "सीधे जाइए।|seedhe jaaiye.", "यह पास में है।|yah paas mein hai.",
        "मुझे भूख लगी है।|mujhe bhookh lagi hai.", "मुझे पानी चाहिए, कृपया।|mujhe paani chahiye, kripya.", "यह स्वादिष्ट है!|yah swaadisht hai!",
        "और दीजिए, कृपया।|aur deejiye, kripya.", "मेरा पेट भर गया।|mera pet bhar gaya.",
        "मेरी मदद कीजिए।|meri madad keejiye.", "मुझे समझ नहीं आया।|mujhe samajh nahin aaya.", "कृपया फिर से बोलिए।|kripya phir se boliye.",
        "धीरे-धीरे, कृपया।|dheere-dheere, kripya.", "मैं खुश हूँ!|main khush hoon!",
    ],
    "mr": [
        "नमस्कार!|namaskaar!", "शुभ सकाळ!|shubh sakaal!", "तुम्ही कसे आहात?|tumhi kase aahaat?", "मी ठीक आहे, धन्यवाद.|mi theek aahe, dhanyavaad.", "पुन्हा भेटू!|punha bhetu!",
        "तुमचं नाव काय आहे?|tumcha naav kaay aahe?", "माझं नाव मेलो आहे.|maajha naav Melo aahe.", "तुम्हाला भेटून आनंद झाला.|tumhaala bhetun aanand jhaala.",
        "तुमचं वय काय आहे?|tumcha vay kaay aahe?", "माझं वय सहा वर्षं आहे.|maajha vay saha varsha aahe.",
        "कृपया.|krupaya.", "खूप धन्यवाद!|khoop dhanyavaad!", "माफ करा.|maaf kara.", "जरा ऐका.|jara aika.", "काही हरकत नाही.|kaahi harkat naahi.",
        "टॉयलेट कुठे आहे?|toilet kuthe aahe?", "डावीकडे वळा.|daavikade vala.", "उजवीकडे वळा.|ujavikade vala.", "सरळ जा.|saral ja.", "ते जवळ आहे.|te javal aahe.",
        "मला भूक लागली आहे.|mala bhook laagli aahe.", "मला पाणी हवं आहे, कृपया.|mala paani hava aahe, krupaya.", "हे चविष्ट आहे!|he chavishta aahe!",
        "अजून द्या, कृपया.|ajun dya, krupaya.", "माझं पोट भरलं.|maajha pot bharla.",
        "मला मदत करा.|mala madat kara.", "मला समजलं नाही.|mala samajla naahi.", "कृपया पुन्हा सांगा.|krupaya punha saanga.",
        "हळू, कृपया.|halu, krupaya.", "मी आनंदी आहे!|mi aanandi aahe!",
    ],
    "fr": [
        "Salut !", "Bonjour !", "Comment ça va ?", "Ça va bien, merci.", "Au revoir !",
        "Comment tu t'appelles ?", "Je m'appelle Melo.", "Enchanté !", "Quel âge as-tu ?", "J'ai six ans.",
        "S'il te plaît.", "Merci beaucoup !", "Pardon.", "Excusez-moi.", "De rien.",
        "Où sont les toilettes ?", "Tourne à gauche.", "Tourne à droite.", "Va tout droit.", "C'est tout près.",
        "J'ai faim.", "Je veux de l'eau, s'il te plaît.", "C'est délicieux !", "Encore, s'il te plaît.", "J'ai assez mangé.",
        "Aide-moi, s'il te plaît.", "Je ne comprends pas.", "Tu peux répéter, s'il te plaît ?", "Plus lentement, s'il te plaît.", "Je suis content !",
    ],
    "es": [
        "¡Hola!", "¡Buenos días!", "¿Cómo estás?", "Estoy bien, gracias.", "¡Adiós!",
        "¿Cómo te llamas?", "Me llamo Melo.", "Mucho gusto.", "¿Cuántos años tienes?", "Tengo seis años.",
        "Por favor.", "¡Muchas gracias!", "Lo siento.", "Disculpa.", "De nada.",
        "¿Dónde está el baño?", "Gira a la izquierda.", "Gira a la derecha.", "Sigue recto.", "Está cerca.",
        "Tengo hambre.", "Quiero agua, por favor.", "¡Está rico!", "Más, por favor.", "Ya comí suficiente.",
        "Ayúdame, por favor.", "No entiendo.", "¿Puedes repetirlo, por favor?", "Más despacio, por favor.", "¡Estoy feliz!",
    ],
    "ar": [
        "مرحبا!|marhaban!", "صباح الخير!|sabaah al-khayr!", "كيف حالك؟|kayfa haaluk?", "أنا بخير، شكرا.|ana bikhayr, shukran.", "مع السلامة!|ma'a as-salaama!",
        "ما اسمك؟|ma ismuk?", "اسمي ميلو.|ismi Melo.", "تشرفنا.|tasharrafna.", "كم عمرك؟|kam umruk?", "عمري ست سنوات.|umri sitt sanawaat.",
        "من فضلك.|min fadlik.", "شكرا جزيلا!|shukran jazeelan!", "أنا آسف.|ana aasif.", "لو سمحت.|law samaht.", "عفوا.|afwan.",
        "أين الحمام؟|ayna al-hammaam?", "انعطف يسارا.|in'atif yasaaran.", "انعطف يمينا.|in'atif yameenan.", "امش إلى الأمام.|imshi ila al-amaam.", "إنه قريب.|innahu qareeb.",
        "أنا جائع.|ana jaa'i'.", "أريد ماء من فضلك.|ureedu maa'an min fadlik.", "إنه لذيذ!|innahu ladheedh!", "المزيد من فضلك.|al-mazeed min fadlik.",
        "لقد شبعت.|laqad shabi'tu.",
        "ساعدني من فضلك.|saa'idni min fadlik.", "لا أفهم.|laa afham.", "أعد من فضلك.|a'id min fadlik.", "ببطء من فضلك.|bibut' min fadlik.", "أنا سعيد!|ana sa'eed!",
    ],
    "zh": [
        "你好！|nǐ hǎo!", "早上好！|zǎoshang hǎo!", "你好吗？|nǐ hǎo ma?", "我很好，谢谢。|wǒ hěn hǎo, xièxie.", "再见！|zàijiàn!",
        "你叫什么名字？|nǐ jiào shénme míngzi?", "我叫美乐。|wǒ jiào Měilè.", "很高兴认识你。|hěn gāoxìng rènshi nǐ.", "你几岁了？|nǐ jǐ suì le?", "我六岁。|wǒ liù suì.",
        "请。|qǐng.", "非常感谢！|fēicháng gǎnxiè!", "对不起。|duìbuqǐ.", "打扰一下。|dǎrǎo yíxià.", "不客气。|bú kèqi.",
        "厕所在哪里？|cèsuǒ zài nǎlǐ?", "向左转。|xiàng zuǒ zhuǎn.", "向右转。|xiàng yòu zhuǎn.", "一直走。|yìzhí zǒu.", "很近。|hěn jìn.",
        "我饿了。|wǒ è le.", "请给我水。|qǐng gěi wǒ shuǐ.", "真好吃！|zhēn hǎochī!", "请再来一点。|qǐng zài lái yìdiǎn.", "我吃饱了。|wǒ chī bǎo le.",
        "请帮帮我。|qǐng bāngbang wǒ.", "我不懂。|wǒ bù dǒng.", "请再说一遍。|qǐng zài shuō yí biàn.", "请慢一点。|qǐng màn yìdiǎn.", "我很开心！|wǒ hěn kāixīn!",
    ],
    "yue": [
        "你好！|nei5 hou2!", "早晨！|zou2 san4!", "你好嗎？|nei5 hou2 maa3?", "我好好，多謝。|ngo5 hou2 hou2, do1 ze6.", "再見！|zoi3 gin3!",
        "你叫咩名呀？|nei5 giu3 me1 meng2 aa3?", "我叫美樂。|ngo5 giu3 mei5 lok6.", "好高興認識你。|hou2 gou1 hing3 jing6 sik1 nei5.",
        "你幾多歲呀？|nei5 gei2 do1 seoi3 aa3?", "我六歲。|ngo5 luk6 seoi3.",
        "唔該。|m4 goi1.", "多謝晒！|do1 ze6 saai3!", "對唔住。|deoi3 m4 zyu6.", "唔好意思。|m4 hou2 ji3 si1.", "唔使客氣。|m4 sai2 haak3 hei3.",
        "廁所喺邊度？|ci3 so2 hai2 bin1 dou6?", "轉左。|zyun3 zo2.", "轉右。|zyun3 jau6.", "直行。|zik6 haang4.", "好近。|hou2 kan5.",
        "我肚餓。|ngo5 tou5 ngo6.", "唔該俾水我。|m4 goi1 bei2 seoi2 ngo5.", "好好食！|hou2 hou2 sik6!", "唔該再要多啲。|m4 goi1 zoi3 jiu3 do1 di1.",
        "我食飽喇。|ngo5 sik6 baau2 laa3.",
        "唔該幫幫我。|m4 goi1 bong1 bong1 ngo5.", "我唔明。|ngo5 m4 ming4.", "唔該講多次。|m4 goi1 gong2 do1 ci3.", "唔該講慢啲。|m4 goi1 gong2 maan6 di1.",
        "我好開心！|ngo5 hou2 hoi1 sam1!",
    ],
    "ko": [
        "안녕하세요!|annyeonghaseyo!", "좋은 아침이에요!|joeun achimieyo!", "잘 지내요?|jal jinaeyo?", "잘 지내요, 고마워요.|jal jinaeyo, gomawoyo.",
        "안녕히 가세요!|annyeonghi gaseyo!",
        "이름이 뭐예요?|ireumi mwoyeyo?", "제 이름은 멜로예요.|je ireumeun melloyeyo.", "만나서 반가워요.|mannaseo bangawoyo.", "몇 살이에요?|myeot sarieyo?",
        "여섯 살이에요.|yeoseot sarieyo.",
        "부탁해요.|butakaeyo.", "정말 고마워요!|jeongmal gomawoyo!", "미안해요.|mianhaeyo.", "실례합니다.|sillyehamnida.", "천만에요.|cheonmaneyo.",
        "화장실이 어디예요?|hwajangsiri eodiyeyo?", "왼쪽으로 가세요.|oenjjogeuro gaseyo.", "오른쪽으로 가세요.|oreunjjogeuro gaseyo.", "똑바로 가세요.|ttokbaro gaseyo.",
        "가까워요.|gakkawoyo.",
        "배고파요.|baegopayo.", "물 주세요.|mul juseyo.", "맛있어요!|masisseoyo!", "더 주세요.|deo juseyo.", "배불러요.|baebulleoyo.",
        "도와주세요.|dowajuseyo.", "이해가 안 돼요.|ihaega an dwaeyo.", "다시 말해 주세요.|dasi malhae juseyo.", "천천히 말해 주세요.|cheoncheonhi malhae juseyo.",
        "기뻐요!|gippeoyo!",
    ],
    "ru": [
        "Привет!|privet!", "Доброе утро!|dobroye utro!", "Как дела?|kak dela?", "Хорошо, спасибо.|khorosho, spasibo.", "До свидания!|do svidaniya!",
        "Как тебя зовут?|kak tebya zovut?", "Меня зовут Мело.|menya zovut Melo.", "Приятно познакомиться.|priyatno poznakomit'sya.",
        "Сколько тебе лет?|skol'ko tebe let?", "Мне шесть лет.|mne shest' let.",
        "Пожалуйста.|pozhaluysta.", "Большое спасибо!|bol'shoye spasibo!", "Прости.|prosti.", "Извините.|izvinite.", "Не за что.|ne za chto.",
        "Где туалет?|gde tualet?", "Поверни налево.|poverni nalevo.", "Поверни направо.|poverni napravo.", "Иди прямо.|idi pryamo.", "Это рядом.|eto ryadom.",
        "Я хочу есть.|ya khochu yest'.", "Я хочу воды, пожалуйста.|ya khochu vody, pozhaluysta.", "Очень вкусно!|ochen' vkusno!",
        "Ещё, пожалуйста.|yeshchyo, pozhaluysta.", "Мне хватит.|mne khvatit.",
        "Помоги мне, пожалуйста.|pomogi mne, pozhaluysta.", "Я не понимаю.|ya ne ponimayu.", "Повтори, пожалуйста.|povtori, pozhaluysta.",
        "Помедленнее, пожалуйста.|pomedlenneye, pozhaluysta.", "Мне весело!|mne veselo!",
    ],
    "tr": [
        "Merhaba!", "Günaydın!", "Nasılsın?", "İyiyim, teşekkürler.", "Hoşça kal!",
        "Adın ne?", "Benim adım Melo.", "Tanıştığımıza memnun oldum.", "Kaç yaşındasın?", "Altı yaşındayım.",
        "Lütfen.", "Çok teşekkür ederim!", "Özür dilerim.", "Affedersiniz.", "Rica ederim.",
        "Tuvalet nerede?", "Sola dön.", "Sağa dön.", "Düz git.", "Çok yakın.",
        "Acıktım.", "Su istiyorum, lütfen.", "Çok lezzetli!", "Biraz daha, lütfen.", "Doydum.",
        "Yardım et, lütfen.", "Anlamıyorum.", "Tekrar söyler misin?", "Yavaş, lütfen.", "Mutluyum!",
    ],
    "sa": [
        "नमस्ते!|namaste!", "सुप्रभातम्!|suprabhaatam!", "भवान् कथम् अस्ति?|bhavaan katham asti?", "अहं कुशली, धन्यवादः।|aham kushalee, dhanyavaadah.",
        "पुनर्मिलामः!|punarmilaamah!",
        "भवतः नाम किम्?|bhavatah naama kim?", "मम नाम मेलो।|mama naama Melo.", "भवन्तं मिलित्वा सन्तोषः।|bhavantam militvaa santoshah.",
        "भवतः वयः किम्?|bhavatah vayah kim?", "मम वयः षड् वर्षाणि।|mama vayah shad varshaani.",
        "कृपया।|kripayaa.", "बहु धन्यवादः!|bahu dhanyavaadah!", "क्षम्यताम्।|kshamyataam.", "शृणोतु।|shrinotu.", "स्वागतम्।|svaagatam.",
        "शौचालयः कुत्र अस्ति?|shauchaalayah kutra asti?", "वामतः गच्छतु।|vaamatah gachchhatu.", "दक्षिणतः गच्छतु।|dakshinatah gachchhatu.",
        "ऋजु गच्छतु।|riju gachchhatu.", "तत् समीपे अस्ति।|tat sameepe asti.",
        "मम बुभुक्षा अस्ति।|mama bubhukshaa asti.", "कृपया जलं ददातु।|kripayaa jalam dadaatu.", "एतत् स्वादु अस्ति!|etat svaadu asti!",
        "कृपया पुनः ददातु।|kripayaa punah dadaatu.", "मम उदरं पूर्णम्।|mama udaram poornam.",
        "कृपया साहाय्यं करोतु।|kripayaa saahaayyam karotu.", "मया न अवगतम्।|mayaa na avagatam.", "कृपया पुनः वदतु।|kripayaa punah vadatu.",
        "शनैः शनैः वदतु।|shanaih shanaih vadatu.", "अहं प्रसन्नः अस्मि!|aham prasannah asmi!",
    ],
    "gu": [
        "નમસ્તે!|namaste!", "સુપ્રભાત!|suprabhaat!", "તમે કેમ છો?|tame kem chho?", "હું મજામાં છું, આભાર.|hu majaama chhu, aabhaar.", "આવજો!|aavjo!",
        "તમારું નામ શું છે?|tamaaru naam shu chhe?", "મારું નામ મેલો છે.|maaru naam Melo chhe.", "તમને મળીને આનંદ થયો.|tamne maline aanand thayo.",
        "તમારી ઉંમર કેટલી છે?|tamaari ummar ketli chhe?", "મારી ઉંમર છ વર્ષ છે.|maari ummar chha varsh chhe.",
        "કૃપા કરીને.|krupa karine.", "ખૂબ ખૂબ આભાર!|khoob khoob aabhaar!", "માફ કરજો.|maaf karjo.", "સાંભળો.|saambhlo.", "કંઈ વાંધો નહીં.|kai vaandho nahi.",
        "શૌચાલય ક્યાં છે?|shauchaalay kyaa chhe?", "ડાબી બાજુ વળો.|daabi baaju valo.", "જમણી બાજુ વળો.|jamni baaju valo.", "સીધા જાઓ.|seedha jaao.",
        "તે નજીક છે.|te najeek chhe.",
        "મને ભૂખ લાગી છે.|mane bhookh laagi chhe.", "મને પાણી આપો, કૃપા કરીને.|mane paani aapo, krupa karine.", "આ સ્વાદિષ્ટ છે!|aa swaadisht chhe!",
        "થોડું વધારે આપો.|thodu vadhaare aapo.", "મારું પેટ ભરાઈ ગયું.|maaru pet bharaai gayu.",
        "મારી મદદ કરો.|maari madad karo.", "મને સમજાયું નહીં.|mane samjaayu nahi.", "ફરીથી કહો, કૃપા કરીને.|farithi kaho, krupa karine.",
        "ધીમે ધીમે, કૃપા કરીને.|dheeme dheeme, krupa karine.", "હું ખુશ છું!|hu khush chhu!",
    ],
    "bn": [
        "নমস্কার!|nomoshkar!", "সুপ্রভাত!|suprobhat!", "তুমি কেমন আছ?|tumi kemon achho?", "আমি ভালো আছি, ধন্যবাদ।|ami bhalo achhi, dhonnobad.",
        "আবার দেখা হবে!|abar dekha hobe!",
        "তোমার নাম কী?|tomar naam ki?", "আমার নাম মেলো।|amar naam Melo.", "তোমার সাথে দেখা হয়ে ভালো লাগল।|tomar shathe dekha hoye bhalo laglo.",
        "তোমার বয়স কত?|tomar boyosh koto?", "আমার বয়স ছয় বছর।|amar boyosh chhoy bochhor.",
        "দয়া করে।|doya kore.", "অনেক ধন্যবাদ!|onek dhonnobad!", "দুঃখিত।|dukkhito.", "শুনুন।|shunun.", "কোনো ব্যাপার না।|kono byapar na.",
        "টয়লেট কোথায়?|toilet kothay?", "বাঁদিকে ঘোরো।|bandike ghoro.", "ডানদিকে ঘোরো।|dandike ghoro.", "সোজা যাও।|shoja jao.", "এটা কাছেই।|eta kachhei.",
        "আমার খিদে পেয়েছে।|amar khide peyechhe.", "আমাকে জল দাও, দয়া করে।|amake jol dao, doya kore.", "এটা খুব সুস্বাদু!|eta khub shushwadu!",
        "আরও একটু দাও।|aro ektu dao.", "আমার পেট ভরে গেছে।|amar pet bhore gechhe.",
        "আমাকে সাহায্য করো।|amake shahajjo koro.", "আমি বুঝতে পারিনি।|ami bujhte parini.", "আবার বলো, দয়া করে।|abar bolo, doya kore.",
        "আস্তে আস্তে, দয়া করে।|aste aste, doya kore.", "আমি খুশি!|ami khushi!",
    ],
    "pa": [
        "ਸਤ ਸ੍ਰੀ ਅਕਾਲ!|sat sri akaal!", "ਸ਼ੁਭ ਸਵੇਰ!|shubh saver!", "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?|tusin kiven ho?", "ਮੈਂ ਠੀਕ ਹਾਂ, ਧੰਨਵਾਦ।|main theek haan, dhannvaad.",
        "ਫਿਰ ਮਿਲਾਂਗੇ!|phir milaange!",
        "ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?|tuhaada naan ki hai?", "ਮੇਰਾ ਨਾਂ ਮੇਲੋ ਹੈ।|mera naan Melo hai.", "ਤੁਹਾਨੂੰ ਮਿਲ ਕੇ ਖੁਸ਼ੀ ਹੋਈ।|tuhaanu mil ke khushi hoi.",
        "ਤੁਹਾਡੀ ਉਮਰ ਕਿੰਨੀ ਹੈ?|tuhaadi umar kinni hai?", "ਮੇਰੀ ਉਮਰ ਛੇ ਸਾਲ ਹੈ।|meri umar chhe saal hai.",
        "ਕਿਰਪਾ ਕਰਕੇ।|kirpa karke.", "ਬਹੁਤ ਧੰਨਵਾਦ!|bahut dhannvaad!", "ਮਾਫ਼ ਕਰਨਾ।|maaf karna.", "ਸੁਣੋ ਜੀ।|suno ji.", "ਕੋਈ ਗੱਲ ਨਹੀਂ।|koi gall nahin.",
        "ਟਾਇਲਟ ਕਿੱਥੇ ਹੈ?|toilet kitthe hai?", "ਖੱਬੇ ਮੁੜੋ।|khabbe muro.", "ਸੱਜੇ ਮੁੜੋ।|sajje muro.", "ਸਿੱਧੇ ਜਾਓ।|siddhe jao.", "ਇਹ ਨੇੜੇ ਹੈ।|ih nere hai.",
        "ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ।|mainu bhukkh laggi hai.", "ਮੈਨੂੰ ਪਾਣੀ ਚਾਹੀਦਾ ਹੈ।|mainu paani chaahida hai.", "ਇਹ ਬਹੁਤ ਸੁਆਦੀ ਹੈ!|ih bahut suaadi hai!",
        "ਹੋਰ ਦਿਓ, ਕਿਰਪਾ ਕਰਕੇ।|hor dio, kirpa karke.", "ਮੇਰਾ ਢਿੱਡ ਭਰ ਗਿਆ।|mera dhidd bhar gia.",
        "ਮੇਰੀ ਮਦਦ ਕਰੋ।|meri madad karo.", "ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਇਆ।|mainu samajh nahin aaia.", "ਫਿਰ ਤੋਂ ਦੱਸੋ, ਕਿਰਪਾ ਕਰਕੇ।|phir ton dasso, kirpa karke.",
        "ਹੌਲੀ ਹੌਲੀ, ਕਿਰਪਾ ਕਰਕੇ।|hauli hauli, kirpa karke.", "ਮੈਂ ਖੁਸ਼ ਹਾਂ!|main khush haan!",
    ],
    "ta": [
        "வணக்கம்!|vanakkam!", "காலை வணக்கம்!|kaalai vanakkam!", "எப்படி இருக்கிறீர்கள்?|eppadi irukkireergal?", "நான் நலம், நன்றி.|naan nalam, nanri.",
        "மீண்டும் சந்திப்போம்!|meendum sandhippom!",
        "உங்கள் பெயர் என்ன?|ungal peyar enna?", "என் பெயர் மெலோ.|en peyar Melo.", "உங்களைச் சந்தித்ததில் மகிழ்ச்சி.|ungalai sandhiththadhil magizhchi.",
        "உங்களுக்கு என்ன வயது?|ungalukku enna vayadhu?", "எனக்கு ஆறு வயது.|enakku aaru vayadhu.",
        "தயவுசெய்து.|thayavuseidhu.", "மிக்க நன்றி!|mikka nanri!", "மன்னிக்கவும்.|mannikkavum.", "கொஞ்சம் கேளுங்கள்.|konjam kelungal.", "பரவாயில்லை.|paravaayillai.",
        "கழிப்பறை எங்கே?|kazhipparai enge?", "இடது பக்கம் திரும்புங்கள்.|idadhu pakkam thirumbungal.", "வலது பக்கம் திரும்புங்கள்.|valadhu pakkam thirumbungal.",
        "நேராகச் செல்லுங்கள்.|neraaga sellungal.", "அது அருகில் உள்ளது.|adhu arugil ulladhu.",
        "எனக்குப் பசிக்கிறது.|enakku pasikkiradhu.", "எனக்குத் தண்ணீர் வேண்டும்.|enakku thanneer vendum.", "இது சுவையாக இருக்கிறது!|idhu suvaiyaaga irukkiradhu!",
        "இன்னும் கொஞ்சம், தயவுசெய்து.|innum konjam, thayavuseidhu.", "என் வயிறு நிரம்பிவிட்டது.|en vayiru nirambivittadhu.",
        "எனக்கு உதவுங்கள்.|enakku udhavungal.", "எனக்குப் புரியவில்லை.|enakku puriyavillai.", "மீண்டும் சொல்லுங்கள்.|meendum sollungal.",
        "மெதுவாகச் சொல்லுங்கள்.|medhuvaaga sollungal.", "நான் மகிழ்ச்சியாக இருக்கிறேன்!|naan magizhchiyaaga irukkiren!",
    ],
    "te": [
        "నమస్కారం!|namaskaaram!", "శుభోదయం!|shubhodayam!", "మీరు ఎలా ఉన్నారు?|meeru elaa unnaaru?", "నేను బాగున్నాను, ధన్యవాదాలు.|nenu baagunnaanu, dhanyavaadaalu.",
        "మళ్ళీ కలుద్దాం!|malli kaluddaam!",
        "మీ పేరు ఏమిటి?|mee peru emiti?", "నా పేరు మెలో.|naa peru Melo.", "మిమ్మల్ని కలవడం సంతోషం.|mimmalni kalavadam santosham.",
        "మీ వయసు ఎంత?|mee vayasu enta?", "నా వయసు ఆరు సంవత్సరాలు.|naa vayasu aaru samvatsaraalu.",
        "దయచేసి.|dayachesi.", "చాలా ధన్యవాదాలు!|chaalaa dhanyavaadaalu!", "క్షమించండి.|kshaminchandi.", "ఒక్క నిమిషం.|okka nimisham.", "పర్వాలేదు.|parvaaledu.",
        "టాయిలెట్ ఎక్కడ ఉంది?|toilet ekkada undi?", "ఎడమవైపు తిరగండి.|edamavaipu tiragandi.", "కుడివైపు తిరగండి.|kudivaipu tiragandi.",
        "నేరుగా వెళ్ళండి.|nerugaa vellandi.", "అది దగ్గరలో ఉంది.|adi daggaralo undi.",
        "నాకు ఆకలిగా ఉంది.|naaku aakaligaa undi.", "నాకు నీళ్ళు కావాలి.|naaku neellu kaavaali.", "ఇది రుచిగా ఉంది!|idi ruchigaa undi!",
        "ఇంకొంచెం ఇవ్వండి.|inkonchem ivvandi.", "నా కడుపు నిండింది.|naa kadupu nindindi.",
        "నాకు సహాయం చేయండి.|naaku sahaayam cheyandi.", "నాకు అర్థం కాలేదు.|naaku artham kaaledu.", "మళ్ళీ చెప్పండి.|malli cheppandi.",
        "నెమ్మదిగా చెప్పండి.|nemmadigaa cheppandi.", "నేను సంతోషంగా ఉన్నాను!|nenu santoshamgaa unnaanu!",
    ],
    "kn": [
        "ನಮಸ್ಕಾರ!|namaskaara!", "ಶುಭೋದಯ!|shubhodaya!", "ಹೇಗಿದ್ದೀರಿ?|hegiddeeri?", "ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ, ಧನ್ಯವಾದ.|naanu chennaagiddene, dhanyavaada.",
        "ಮತ್ತೆ ಸಿಗೋಣ!|matte sigona!",
        "ನಿಮ್ಮ ಹೆಸರೇನು?|nimma hesarenu?", "ನನ್ನ ಹೆಸರು ಮೆಲೋ.|nanna hesaru Melo.", "ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿ ಸಂತೋಷವಾಯಿತು.|nimmannu bhetiyaagi santoshavaayitu.",
        "ನಿಮ್ಮ ವಯಸ್ಸು ಎಷ್ಟು?|nimma vayassu eshtu?", "ನನಗೆ ಆರು ವರ್ಷ.|nanage aaru varsha.",
        "ದಯವಿಟ್ಟು.|dayavittu.", "ತುಂಬಾ ಧನ್ಯವಾದಗಳು!|tumbaa dhanyavaadagalu!", "ಕ್ಷಮಿಸಿ.|kshamisi.", "ಸ್ವಲ್ಪ ಕೇಳಿ.|swalpa keli.", "ಪರವಾಗಿಲ್ಲ.|paravaagilla.",
        "ಶೌಚಾಲಯ ಎಲ್ಲಿದೆ?|shauchaalaya ellide?", "ಎಡಕ್ಕೆ ತಿರುಗಿ.|edakke tirugi.", "ಬಲಕ್ಕೆ ತಿರುಗಿ.|balakke tirugi.", "ನೇರವಾಗಿ ಹೋಗಿ.|neravaagi hogi.",
        "ಅದು ಹತ್ತಿರದಲ್ಲಿದೆ.|adu hattiradallide.",
        "ನನಗೆ ಹಸಿವಾಗಿದೆ.|nanage hasivaagide.", "ನನಗೆ ನೀರು ಬೇಕು.|nanage neeru beku.", "ಇದು ರುಚಿಯಾಗಿದೆ!|idu ruchiyaagide!", "ಇನ್ನೂ ಸ್ವಲ್ಪ ಕೊಡಿ.|innoo swalpa kodi.",
        "ನನ್ನ ಹೊಟ್ಟೆ ತುಂಬಿದೆ.|nanna hotte tumbide.",
        "ನನಗೆ ಸಹಾಯ ಮಾಡಿ.|nanage sahaaya maadi.", "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.|nanage arthavaagalilla.", "ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.|mattomme heli.",
        "ನಿಧಾನವಾಗಿ ಹೇಳಿ.|nidhaanavaagi heli.", "ನನಗೆ ಖುಷಿಯಾಗಿದೆ!|nanage khushiyaagide!",
    ],
    "de": [
        "Hallo!", "Guten Morgen!", "Wie geht's?", "Mir geht's gut, danke.", "Tschüss!",
        "Wie heißt du?", "Ich heiße Melo.", "Freut mich!", "Wie alt bist du?", "Ich bin sechs Jahre alt.",
        "Bitte.", "Vielen Dank!", "Tut mir leid.", "Entschuldigung.", "Gern geschehen.",
        "Wo ist die Toilette?", "Geh nach links.", "Geh nach rechts.", "Geh geradeaus.", "Es ist in der Nähe.",
        "Ich habe Hunger.", "Ich möchte Wasser, bitte.", "Das ist lecker!", "Mehr, bitte.", "Ich bin satt.",
        "Hilf mir, bitte.", "Ich verstehe das nicht.", "Sag es bitte noch einmal.", "Langsam, bitte.", "Ich bin glücklich!",
    ],
    "ja": [
        "こんにちは！|konnichiwa!", "おはようございます！|ohayou gozaimasu!", "おげんきですか？|ogenki desu ka?", "げんきです、ありがとう。|genki desu, arigatou.",
        "さようなら！|sayounara!",
        "おなまえは？|onamae wa?", "わたしのなまえはメロです。|watashi no namae wa Mero desu.", "はじめまして。|hajimemashite.", "なんさいですか？|nansai desu ka?",
        "ろくさいです。|rokusai desu.",
        "おねがいします。|onegai shimasu.", "どうもありがとう！|doumo arigatou!", "ごめんなさい。|gomen nasai.", "すみません。|sumimasen.",
        "どういたしまして。|dou itashimashite.",
        "トイレはどこですか？|toire wa doko desu ka?", "ひだりにまがって。|hidari ni magatte.", "みぎにまがって。|migi ni magatte.", "まっすぐいって。|massugu itte.",
        "ちかいです。|chikai desu.",
        "おなかがすいた。|onaka ga suita.", "みずをください。|mizu o kudasai.", "おいしい！|oishii!", "もっとください。|motto kudasai.", "おなかいっぱい。|onaka ippai.",
        "たすけて。|tasukete.", "わかりません。|wakarimasen.", "もういちどいってください。|mou ichido itte kudasai.", "ゆっくりおねがいします。|yukkuri onegai shimasu.",
        "うれしい！|ureshii!",
    ],
}

# Little conversations for the top level: Melo asks the question, the child answers.
# Only pairs that are a natural question and reply in every language taught.
REPLIES: dict[str, str] = {"p_how": "p_fine", "p_name_q": "p_name", "p_age_q": "p_age", "p_thanks": "p_welcome", "p_bye": "p_bye",
                           "p_play_q": "p_play_yes", "p_ok_q": "p_fine"}


def _build(code: str) -> dict[str, Word]:
    rows = _P[code] + _MARKET[code] + _SCHOOL[code] + _MORE[code]
    assert len(rows) == len(PHRASES), (code, len(rows))
    out = {}
    for (pid, _topic, emoji), raw in zip(PHRASES, rows):
        text, _, roman = raw.partition("|")
        out[pid] = Word(pid, emoji, 1, text.strip(), roman.strip() or None)
    return out


PHRASE_WORDS: dict[str, dict[str, Word]] = {code: _build(code) for code in TARGETS}
TOPIC_OF: dict[str, str] = {pid: topic for pid, topic, _ in PHRASES}
# everything a child can practise in a language: picture words and phrases
ITEMS: dict[str, dict[str, Word]] = {code: {**WORDS[code], **PHRASE_WORDS[code]} for code in TARGETS}


# --- topics a parent asked for (made by the AI brain, saved per child in custom_phrases) ---------------
CUSTOM_TOPICS: dict[str, dict] = {}  # topic id -> {"emoji", "title", "child_id", "items": [item ids]}


def register_custom(topic_id: str, title: str, emoji: str, child_id: str, item_id: str, item_emoji: str, texts: dict[str, str]) -> None:
    """Make a parent-requested phrase available to the engine (ids are unique, so they never clash)."""
    t = CUSTOM_TOPICS.setdefault(topic_id, {"emoji": emoji, "title": title, "child_id": child_id, "items": []})
    if item_id not in t["items"]:
        t["items"].append(item_id)
    for code, raw in texts.items():
        if code in ITEMS and raw:
            text, _, roman = raw.partition("|")
            ITEMS[code][item_id] = Word(item_id, item_emoji, 1, text.strip(), roman.strip() or None)


def is_topic(topic: str | None, child_id: str | None = None) -> bool:
    if topic in TOPIC_IDS:
        return True
    t = CUSTOM_TOPICS.get(topic or "")
    return bool(t) and (child_id is None or t["child_id"] == child_id)


def custom_topics_for(child_id: str, lang: str) -> list[dict]:
    return [{"id": tid, "emoji": t["emoji"], "title": t["title"], "items": [i for i in t["items"] if i in ITEMS.get(lang, {})]}
            for tid, t in CUSTOM_TOPICS.items() if t["child_id"] == child_id and any(i in ITEMS.get(lang, {}) for i in t["items"])]


def topic_pool(lang: str, topic: str) -> list[Word]:
    """The phrases of one conversation topic, or all picture words for topic "words"."""
    if topic == "words":
        return list(WORDS[lang].values())
    if topic in CUSTOM_TOPICS:
        return [ITEMS[lang][i] for i in CUSTOM_TOPICS[topic]["items"] if i in ITEMS[lang]]
    return [w for pid, w in PHRASE_WORDS[lang].items() if TOPIC_OF[pid] == topic]
