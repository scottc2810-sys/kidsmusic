"""Curated, reviewed teacher lines in English, Hindi and Hinglish.

These are used instantly for per-attempt feedback (no network round-trip) and as the offline
provider. Hindi lines avoid gendered first-person verbs so "Melo" stays gender-neutral and
second-person forms use the generic "तुम … हो" register suitable for young children.
"""
from __future__ import annotations

import random

P: dict[str, dict[str, list[str]]] = {
    "greeting": {
        "en": ["Hello {name}! I'm Melo. Let's play with music today!", "Hi {name}! Melo is here. Ready for a music game?"],
        "hi": ["नमस्ते {name}! मैं मेलो हूँ। चलो आज संगीत से खेलते हैं!", "हैलो {name}! मेलो यहाँ है। संगीत का खेल खेलें?"],
        "hinglish": ["Hello {name}! Main Melo hoon. Chalo, aaj hum ek musical game khelenge!", "Hi {name}! Melo yahan hai. Music khelne ke liye ready?"],
    },
    "theme.animals": {"en": ["Today our sounds are animals: big elephants and tiny birds!"], "hi": ["आज हमारी आवाज़ें जानवर हैं: बड़े हाथी और छोटी चिड़िया!"], "hinglish": ["Aaj hamari sounds animals hain: bada haathi aur chhoti chidiya!"]},
    "theme.rain": {"en": ["Today we make music like the rain: drip, drop, splash!"], "hi": ["आज हम बारिश जैसा संगीत बनाएँगे: टप, टप, छपाक!"], "hinglish": ["Aaj hum baarish jaisa music banayenge: tap, tap, chhapaak!"]},
    "theme.space": {"en": ["Today we fly to the stars with music!"], "hi": ["आज हम संगीत के साथ तारों तक उड़ेंगे!"], "hinglish": ["Aaj hum music ke saath taaron tak udenge!"]},
    "theme.jungle": {"en": ["Today we explore the music jungle!"], "hi": ["आज हम संगीत के जंगल की सैर करेंगे!"], "hinglish": ["Aaj hum music jungle explore karenge!"]},
    "intro.high_low.higher": {
        "en": ["Listen to two sounds. Which one is higher, like a tiny bird? Tap it!"],
        "hi": ["दो आवाज़ें सुनो। कौन सी आवाज़ ऊँची है, छोटी चिड़िया जैसी? उसे छुओ!"],
        "hinglish": ["Do sounds suno. Kaunsi sound oonchi hai, chhoti chidiya jaisi? Usse tap karo!"],
    },
    "intro.high_low.lower": {
        "en": ["Listen to two sounds. Which one is lower, like a big elephant? Tap it!"],
        "hi": ["दो आवाज़ें सुनो। कौन सी आवाज़ नीची है, बड़े हाथी जैसी? उसे छुओ!"],
        "hinglish": ["Do sounds suno. Kaunsi sound neechi hai, bade haathi jaisi? Usse tap karo!"],
    },
    "intro.loud_soft.louder": {
        "en": ["Listen carefully. Which sound is louder, like a lion's roar?"],
        "hi": ["ध्यान से सुनो। कौन सी आवाज़ ज़्यादा तेज़ है, शेर की दहाड़ जैसी?"],
        "hinglish": ["Dhyaan se suno. Kaunsi sound zyada loud hai, sher ki dahaad jaisi?"],
    },
    "intro.loud_soft.softer": {
        "en": ["Listen carefully. Which sound is softer, like a sleepy kitten?"],
        "hi": ["ध्यान से सुनो। कौन सी आवाज़ धीमी है, सोती हुई बिल्ली जैसी?"],
        "hinglish": ["Dhyaan se suno. Kaunsi sound soft hai, soti hui billi jaisi?"],
    },
    "intro.instrument_guess": {
        "en": ["Listen! Which instrument is playing?"],
        "hi": ["सुनो! कौन सा बाजा बज रहा है?"],
        "hinglish": ["Suno! Kaunsa instrument baj raha hai?"],
    },
    "intro.rhythm_tap": {
        "en": ["Listen to my drum. Now you tap the same rhythm!"],
        "hi": ["मेरा ढोल सुनो। अब तुम भी वैसी ही ताल बजाओ!"],
        "hinglish": ["Mera drum suno. Ab tum bhi same rhythm tap karo!"],
    },
    "intro.find_note": {
        "en": ["Listen to this note. Can you find the same sound on your keyboard?"],
        "hi": ["यह सुर सुनो। क्या तुम कीबोर्ड पर यही आवाज़ ढूँढ सकते हो?"],
        "hinglish": ["Yeh note suno. Kya tum keyboard par same sound dhoondh sakte ho?"],
    },
    "intro.same_different": {
        "en": ["Listen to two little tunes. Are they the same, or different?"],
        "hi": ["दो छोटी धुनें सुनो। क्या वे एक जैसी हैं, या अलग?"],
        "hinglish": ["Do chhoti tunes suno. Kya woh same hain, ya different?"],
    },
    "intro.echo_melody": {
        "en": ["First listen to this little tune. Then you play it back!"],
        "hi": ["पहले यह छोटी धुन सुनो। फिर तुम वही धुन बजाओ!"],
        "hinglish": ["Pehle yeh chhoti tune suno. Phir tum wahi tune bajao!"],
    },
    "intro.play_song": {
        "en": ["Let's play {song}! Follow the glowing keys."],
        "hi": ["चलो {song} बजाते हैं! चमकती कुंजियों के साथ बजाओ।"],
        "hinglish": ["Chalo {song} bajate hain! Chamakti keys ko follow karo."],
    },
    "intro.free_play": {
        "en": ["You are the composer now! Play any keys you like and make your own song."],
        "hi": ["अब तुम संगीतकार हो! जो कुंजियाँ मन करे, बजाओ और अपना गाना बनाओ।"],
        "hinglish": ["Ab tum composer ho! Jo keys pasand hain bajao aur apna gaana banao."],
    },
    "success": {
        "en": ["Wow! That was wonderful!", "Yay, you did it!", "Super listening!", "Beautiful music!"],
        "hi": ["वाह! बहुत बढ़िया!", "शाबाश! तुमने कर दिखाया!", "कमाल कर दिया!", "कितना सुंदर संगीत!"],
        "hinglish": ["Waah! Bahut badhiya!", "Shabaash! Tumne kar dikhaya!", "Kamaal kar diya!", "Kitna sundar music!"],
    },
    "partial": {
        "en": ["Lovely try! You got most of it.", "So close! Just a tiny bit more."],
        "hi": ["बहुत अच्छी कोशिश! ज़्यादातर सही था।", "बस थोड़ा सा और!"],
        "hinglish": ["Bahut achhi koshish! Zyada tar sahi tha.", "Bas thoda sa aur!"],
    },
    "miss": {
        "en": ["That was a lovely try! Let's listen one more time.", "Good try! Music takes practice, and you are practising."],
        "hi": ["बहुत प्यारी कोशिश! चलो एक बार और सुनते हैं।", "अच्छी कोशिश! संगीत अभ्यास से आता है।"],
        "hinglish": ["Bahut pyaari koshish! Chalo ek baar aur sunte hain.", "Achhi koshish! Music practice se aata hai."],
    },
    "hint.higher": {"en": ["Try a key a little higher, towards the bird side!"], "hi": ["थोड़ा ऊपर, चिड़िया की तरफ़ वाली कुंजी आज़माओ!"], "hinglish": ["Thoda upar, chidiya wali side ki key try karo!"]},
    "hint.lower": {"en": ["Try a key a little lower, towards the elephant side!"], "hi": ["थोड़ा नीचे, हाथी की तरफ़ वाली कुंजी आज़माओ!"], "hinglish": ["Thoda neeche, haathi wali side ki key try karo!"]},
    "hint.faster": {"en": ["Next time let's go a little slower, like a turtle."], "hi": ["अगली बार थोड़ा धीरे, कछुए की तरह।"], "hinglish": ["Next time thoda slow, kachhue ki tarah."]},
    "hint.slower": {"en": ["Next time a little quicker, like a bunny."], "hi": ["अगली बार थोड़ा जल्दी, खरगोश की तरह।"], "hinglish": ["Next time thoda jaldi, khargosh ki tarah."]},
    "uncertain": {
        "en": ["Hmm, I couldn't hear that clearly. Let's play the same note one more time!"],
        "hi": ["मुझे ठीक से सुनाई नहीं दिया। चलो वही सुर एक बार और बजाते हैं!"],
        "hinglish": ["Hmm, mujhe clearly sunai nahi diya. Chalo same note ek baar aur bajate hain!"],
    },
    "skipped": {
        "en": ["That's okay! Let's do something fun."],
        "hi": ["कोई बात नहीं! चलो कुछ मज़ेदार करते हैं।"],
        "hinglish": ["Koi baat nahi! Chalo kuch mazedaar karte hain."],
    },
    "harder": {
        "en": ["You're doing so well! Here's a new little challenge."],
        "hi": ["तुम बहुत अच्छा कर रहे हो! अब एक नई छोटी चुनौती।"],
        "hinglish": ["Tum bahut achha kar rahe ho! Ab ek nayi chhoti challenge."],
    },
    "easier": {
        "en": ["Let's make this one a little easier."],
        "hi": ["चलो इसे थोड़ा आसान बनाते हैं।"],
        "hinglish": ["Chalo isse thoda easy banate hain."],
    },
    "break_offer": {
        "en": ["Shall we take a little break, or play an easy game?"],
        "hi": ["थोड़ा आराम करें, या कोई आसान खेल खेलें?"],
        "hinglish": ["Thoda break lein, ya koi easy game khelein?"],
    },
    "game_switch": {
        "en": ["Let's play a quick music game!"],
        "hi": ["चलो एक छोटा सा संगीत खेल खेलते हैं!"],
        "hinglish": ["Chalo ek chhota sa music game khelte hain!"],
    },
    "song_school.intro": {
        "en": ["Let's learn {song} together, {name}! First listen, then you play. One little part at a time."],
        "hi": ["{name}, चलो साथ में {song} सीखते हैं! पहले सुनो, फिर तुम बजाओ। एक-एक छोटा हिस्सा।"],
        "hinglish": ["{name}, chalo saath mein {song} seekhte hain! Pehle suno, phir tum bajao. Ek-ek chhota hissa."],
    },
    "song_school.phrase_done": {
        "en": ["You learned this part! On to the next one."],
        "hi": ["यह हिस्सा तुमने सीख लिया! अब अगला।"],
        "hinglish": ["Yeh part tumne seekh liya! Ab agla."],
    },
    "song_school.try_again": {
        "en": ["Let's listen once more."],
        "hi": ["चलो एक बार और सुनते हैं।"],
        "hinglish": ["Chalo ek baar aur sunte hain."],
    },
    "song_school.whole_done": {
        "en": ["Wow! You played all of {song}! That's real music!"],
        "hi": ["वाह! तुमने पूरा {song} बजा दिया! यह सच्चा संगीत है!"],
        "hinglish": ["Wah! Tumne poora {song} baja diya! Yeh asli music hai!"],
    },
    "level_up": {
        "en": ["Hooray! A new level is open for you: {level}!"],
        "hi": ["हुर्रे! तुम्हारे लिए नया लेवल खुल गया: {level}!"],
        "hinglish": ["Hurray! Tumhare liye naya level khul gaya: {level}!"],
    },
    "wrap_up": {
        "en": ["What a fun music time! You earned {stars} stars today. See you soon!"],
        "hi": ["आज का संगीत बहुत मज़ेदार था! तुमने {stars} सितारे कमाए। फिर मिलेंगे!"],
        "hinglish": ["Aaj ka music time bahut mazedaar tha! Tumne {stars} stars kamaaye. Phir milenge!"],
    },
    "tired": {
        "en": ["Okay, time to rest. You did great music today!"],
        "hi": ["ठीक है, अब आराम करो। आज तुमने बहुत अच्छा संगीत बजाया!"],
        "hinglish": ["Theek hai, ab aaraam karo. Aaj tumne bahut achha music bajaya!"],
    },
    "check_mic": {
        "en": ["I can't hear very well. A grown-up can check the microphone, or we can play on the screen."],
        "hi": ["मुझे ठीक से सुनाई नहीं दे रहा। कोई बड़ा माइक देख ले, या हम स्क्रीन पर खेल सकते हैं।"],
        "hinglish": ["Mujhe theek se sunai nahi de raha. Koi bada mic check kar le, ya hum screen par khel sakte hain."],
    },
    "chat.fallback": {
        "en": ["That's a great question! Let's find out with music. Shall we play a game?"],
        "hi": ["बहुत अच्छा सवाल! चलो संगीत से पता लगाते हैं। खेल खेलें?"],
        "hinglish": ["Bahut achha sawaal! Chalo music se pata lagate hain. Game khelein?"],
    },
    "chat.note": {
        "en": ["A note is one musical sound. Some notes are high like a bird, some are low like an elephant!"],
        "hi": ["सुर एक संगीत की आवाज़ है। कुछ सुर चिड़िया जैसे ऊँचे होते हैं, कुछ हाथी जैसे नीचे!"],
        "hinglish": ["Note ek musical sound hai. Kuch notes chidiya jaise oonche hote hain, kuch haathi jaise neeche!"],
    },
    "chat.rhythm": {
        "en": ["Rhythm is the beat of music, like your heart going boom, boom, boom!"],
        "hi": ["ताल संगीत की धड़कन है, जैसे तुम्हारा दिल धक, धक, धक!"],
        "hinglish": ["Rhythm music ki dhadkan hai, jaise tumhara dil dhak, dhak, dhak!"],
    },
    "chat.hello": {
        "en": ["Hello, my music friend! What shall we play?"],
        "hi": ["नमस्ते, मेरे संगीत दोस्त! क्या बजाएँ?"],
        "hinglish": ["Hello, mere music dost! Kya bajayein?"],
    },
    "chat.tired": {
        "en": ["It's okay to rest. You can press the moon button to stop any time."],
        "hi": ["आराम करना ठीक है। तुम कभी भी चाँद वाला बटन दबाकर रुक सकते हो।"],
        "hinglish": ["Aaraam karna theek hai. Tum kabhi bhi moon button daba kar ruk sakte ho."],
    },
    "chat.song": {
        "en": ["I love songs! Let's play one together in our lesson."],
        "hi": ["मुझे गाने बहुत पसंद हैं! चलो पाठ में साथ में एक गाना बजाते हैं।"],
        "hinglish": ["Mujhe songs bahut pasand hain! Chalo lesson mein saath mein ek gaana bajate hain."],
    },
}


# --- More natural variety: a real teacher never says the exact same sentence every time -----------
_MORE: dict[str, dict[str, list[str]]] = {
    "success": {
        "en": ["Yes! You heard it perfectly!", "Ooh, I loved that! High five!", "That's it! Your ears are super strong.", "Perfect! You're a real musician."],
        "hi": ["हाँ! तुमने एकदम सही सुना!", "वाह, बहुत प्यारा! ताली!", "बिल्कुल सही! तुम्हारे कान बहुत तेज़ हैं।", "शानदार! तुम सच्चे संगीतकार हो।"],
        "hinglish": ["Haan! Tumne ekdum sahi suna!", "Wah, bahut pyaara! High five!", "Bilkul sahi! Tumhare kaan bahut tez hain.", "Shandaar! Tum sachche musician ho."],
    },
    "partial": {
        "en": ["So close! Most of it was just right.", "Nearly there! Your fingers are learning.", "Good job! One more try and it will be perfect.", "Almost! I heard lots of right notes."],
        "hi": ["बस थोड़ा सा बाकी! ज़्यादातर बिल्कुल सही था।", "लगभग हो गया! तुम्हारी उँगलियाँ सीख रही हैं।", "अच्छा! एक बार और, फिर एकदम सही।", "करीब-करीब! बहुत सारे सुर सही थे।"],
        "hinglish": ["Bas thoda sa baaki! Zyaadatar bilkul sahi tha.", "Lagbhag ho gaya! Tumhari ungliyan seekh rahi hain.", "Accha! Ek baar aur, phir ekdum sahi.", "Kareeb-kareeb! Bahut saare notes sahi the."],
    },
    "miss": {
        "en": ["Oops, that's okay! Mistakes help us learn.", "Hmm, not quite. Let's listen together again.", "Good trying! Let's do it slowly this time.", "No worries! Even big musicians practise lots."],
        "hi": ["अरे, कोई बात नहीं! कोशिश करने से ही सीखते हैं।", "हम्म, थोड़ा अलग था। चलो साथ में फिर से सुनें।", "अच्छी कोशिश! इस बार धीरे-धीरे करते हैं।", "चिंता मत करो! बड़े संगीतकार भी खूब अभ्यास करते हैं।"],
        "hinglish": ["Arre, koi baat nahi! Koshish karne se hi seekhte hain.", "Hmm, thoda alag tha. Chalo saath mein phir se sunein.", "Acchi koshish! Is baar dheere-dheere karte hain.", "Chinta mat karo! Bade musicians bhi khoob practice karte hain."],
    },
    "uncertain": {
        "en": ["Oh, I couldn't quite hear. Can you play it a bit louder?", "My ears missed that one! Let's try again."],
        "hi": ["अरे, ठीक से सुनाई नहीं दिया। थोड़ा ज़ोर से बजाओ?", "यह वाला सुनाई नहीं दिया! चलो फिर से।"],
        "hinglish": ["Arre, theek se sunai nahi diya. Thoda zor se bajao?", "Yeh wala sunai nahi diya! Chalo phir se."],
    },
    "skipped": {
        "en": ["No problem! Let's try something else.", "That's fine! Here's a different game.", "Okay! Let's pick a new one together."],
        "hi": ["कोई बात नहीं! कुछ और करते हैं।", "ठीक है! यह रहा दूसरा खेल।", "अच्छा! साथ में नया खेल चुनते हैं।"],
        "hinglish": ["Koi baat nahi! Kuch aur karte hain.", "Theek hai! Yeh raha doosra game.", "Accha! Saath mein naya game chunte hain."],
    },
    "harder": {
        "en": ["You're getting so good! Let's try a trickier one.", "Wow, that was easy for you! Ready for a bigger challenge?"],
        "hi": ["तुम बहुत अच्छे हो रहे हो! अब थोड़ा मुश्किल वाला।", "वाह, यह तो आसान था! बड़ी चुनौती के लिए तैयार?"],
        "hinglish": ["Tum bahut acche ho rahe ho! Ab thoda mushkil wala.", "Wah, yeh toh aasaan tha! Badi challenge ke liye ready?"],
    },
    "easier": {
        "en": ["Let's make it a bit easier, step by step.", "We'll go slower together. Nice and easy."],
        "hi": ["चलो इसे थोड़ा आसान करते हैं, धीरे-धीरे।", "साथ में धीरे चलते हैं। आराम से।"],
        "hinglish": ["Chalo ise thoda aasaan karte hain, dheere-dheere.", "Saath mein dheere chalte hain. Aaraam se."],
    },
    "break_offer": {
        "en": ["Music is tiring work! Want a little break or a fun game?", "Let's wiggle our fingers and rest. Or shall we play a game?"],
        "hi": ["संगीत में मेहनत लगती है! थोड़ा आराम करें या मज़ेदार खेल?", "चलो उँगलियाँ हिलाकर आराम करें। या कोई खेल खेलें?"],
        "hinglish": ["Music mein mehnat lagti hai! Thoda aaraam karein ya mazedaar game?", "Chalo ungliyan hilaakar aaraam karein. Ya koi game khelein?"],
    },
    # specific, musical correction (song school / echo): {expected} and {played} are note names
    "hint.note_up": {
        "en": ["You played {played}. Try {expected}, a little to the right!", "Close! The next note is {expected}, just to the right of {played}."],
        "hi": ["तुमने {played} बजाया। अब {expected} बजाओ, थोड़ा दाईं ओर!", "करीब! अगला सुर {expected} है, {played} के दाईं तरफ़।"],
        "hinglish": ["Tumne {played} bajaya. Ab {expected} bajao, thoda right side!", "Kareeb! Agla note {expected} hai, {played} ke right mein."],
    },
    "hint.note_down": {
        "en": ["You played {played}. Try {expected}, a little to the left!", "Close! The next note is {expected}, just to the left of {played}."],
        "hi": ["तुमने {played} बजाया। अब {expected} बजाओ, थोड़ा बाईं ओर!", "करीब! अगला सुर {expected} है, {played} के बाईं तरफ़।"],
        "hinglish": ["Tumne {played} bajaya. Ab {expected} bajao, thoda left side!", "Kareeb! Agla note {expected} hai, {played} ke left mein."],
    },
    "hint.note_missing": {
        "en": ["Let's keep going! The next note is {expected}.", "Keep playing! After that comes {expected}."],
        "hi": ["आगे बजाते रहो! अगला सुर {expected} है।", "बजाते रहो! उसके बाद {expected} आता है।"],
        "hinglish": ["Aage bajate raho! Agla note {expected} hai.", "Bajate raho! Uske baad {expected} aata hai."],
    },
    "song_school.welcome_back": {
        "en": ["Welcome back, {name}! You already know {count} parts of {song}. Let's learn the next one!"],
        "hi": ["{name}, फिर से स्वागत है! तुम्हें {song} के {count} हिस्से आते हैं। चलो अगला सीखें!"],
        "hinglish": ["{name}, welcome back! Tumhe {song} ke {count} parts aate hain. Chalo agla seekhein!"],
    },
}
for _k, _langs in _MORE.items():
    for _l, _lines in _langs.items():
        P.setdefault(_k, {}).setdefault(_l, [])
        P[_k][_l].extend(x for x in _lines if x not in P[_k][_l])

_BASICS: dict[str, dict[str, list[str]]] = {
    "intro.fast_slow.faster": {
        "en": ["Listen to the tune two times. Which one is faster, like a running rabbit?"],
        "hi": ["धुन दो बार सुनो। कौन सी तेज़ है, दौड़ते खरगोश जैसी?"],
        "hinglish": ["Dhun do baar suno. Kaunsi fast hai, daudte khargosh jaisi?"],
    },
    "intro.fast_slow.slower": {
        "en": ["Listen to the tune two times. Which one is slower, like a sleepy tortoise?"],
        "hi": ["धुन दो बार सुनो। कौन सी धीमी है, सुस्त कछुए जैसी?"],
        "hinglish": ["Dhun do baar suno. Kaunsi slow hai, sust kachhue jaisi?"],
    },
    "basics.swars": {
        "en": ["Hi {name}! Let's practise our swars: Sa Re Ga Ma Pa Dha Ni!"],
        "hi": ["{name}, चलो स्वरों का अभ्यास करें: सा रे ग म प ध नि!"],
        "hinglish": ["{name}, chalo swaron ki practice karein: Sa Re Ga Ma Pa Dha Ni!"],
    },
    "basics.rhythm": {
        "en": ["Hi {name}! Let's practise rhythm. Listen to the beat, then tap it back!"],
        "hi": ["{name}, चलो ताल का अभ्यास करें। ताल सुनो, फिर वैसे ही बजाओ!"],
        "hinglish": ["{name}, chalo rhythm ki practice karein. Beat suno, phir waise hi bajao!"],
    },
    "basics.high_low": {
        "en": ["Hi {name}! High like a bird, low like an elephant. Let's practise!"],
        "hi": ["{name}! चिड़िया जैसी ऊँची, हाथी जैसी नीची। चलो अभ्यास करें!"],
        "hinglish": ["{name}! Chidiya jaisi oonchi, haathi jaisi neechi. Chalo practice karein!"],
    },
    "basics.loud_soft": {
        "en": ["Hi {name}! Loud like a lion, soft like a kitten. Let's practise!"],
        "hi": ["{name}! शेर जैसी तेज़, बिल्ली जैसी धीमी। चलो अभ्यास करें!"],
        "hinglish": ["{name}! Sher jaisi loud, billi jaisi soft. Chalo practice karein!"],
    },
    "basics.fast_slow": {
        "en": ["Hi {name}! Fast like a rabbit, slow like a tortoise. Let's practise!"],
        "hi": ["{name}! खरगोश जैसा तेज़, कछुए जैसा धीमा। चलो अभ्यास करें!"],
        "hinglish": ["{name}! Khargosh jaisa fast, kachhue jaisa slow. Chalo practice karein!"],
    },
    "basics.instruments": {
        "en": ["Hi {name}! Let's listen to instruments and guess who is playing!"],
        "hi": ["{name}, चलो बाजे सुनें और पहचानें कौन बज रहा है!"],
        "hinglish": ["{name}, chalo instruments sunein aur pehchaanein kaun baj raha hai!"],
    },
    "basics.ear": {
        "en": ["Hi {name}! Let's train our music ears. Listen very carefully!"],
        "hi": ["{name}, चलो अपने संगीत वाले कान तेज़ करें। बहुत ध्यान से सुनो!"],
        "hinglish": ["{name}, chalo apne music wale kaan tez karein. Bahut dhyaan se suno!"],
    },
}
for _k, _langs in _BASICS.items():
    P.setdefault(_k, {}).update(_langs)

# --- A teacher who listens: re-teaching, specific praise, coaching on how it was played ---------------
_TEACH: dict[str, dict[str, list[str]]] = {
    "retry": {
        "en": ["Let's try that one again, together. I'll help you this time.", "One more go at the same one. Watch and listen, I'm helping."],
        "hi": ["चलो वही एक बार फिर, साथ में। इस बार हम मदद करेंगे।", "वही वाला एक बार और। देखो और सुनो, मदद साथ है।"],
        "hinglish": ["Chalo wahi ek baar phir, saath mein. Is baar main help karunga.", "Wahi wala ek baar aur. Dekho aur suno, help saath hai."],
    },
    "stretch": {
        "en": ["You are doing so well! Here is something from the next level. Let's see!", "That was easy for you! Try this new one from the next level."],
        "hi": ["तुम बहुत अच्छा कर रहे हो! यह अगले लेवल से है। देखें!", "यह तो आसान था! अगले लेवल का यह नया वाला आज़माओ।"],
        "hinglish": ["Tum bahut achha kar rahe ho! Yeh agle level se hai. Dekhein!", "Yeh toh easy tha! Agle level ka yeh naya wala try karo."],
    },
    "teach.high_low.higher": {"en": ["Sound {n} was the higher one. Listen again!"], "hi": ["आवाज़ {n} ऊँची थी। फिर से सुनो!"], "hinglish": ["Sound {n} oonchi thi. Phir se suno!"]},
    "teach.high_low.lower": {"en": ["Sound {n} was the lower one. Listen again!"], "hi": ["आवाज़ {n} नीची थी। फिर से सुनो!"], "hinglish": ["Sound {n} neechi thi. Phir se suno!"]},
    "teach.loud_soft.louder": {"en": ["Sound {n} was the louder one. Listen again!"], "hi": ["आवाज़ {n} ज़्यादा तेज़ थी। फिर से सुनो!"], "hinglish": ["Sound {n} zyada loud thi. Phir se suno!"]},
    "teach.loud_soft.softer": {"en": ["Sound {n} was the softer one. Listen again!"], "hi": ["आवाज़ {n} धीमी थी। फिर से सुनो!"], "hinglish": ["Sound {n} soft thi. Phir se suno!"]},
    "teach.fast_slow.faster": {"en": ["Tune {n} was the faster one. Listen again!"], "hi": ["धुन {n} तेज़ थी। फिर से सुनो!"], "hinglish": ["Dhun {n} fast thi. Phir se suno!"]},
    "teach.fast_slow.slower": {"en": ["Tune {n} was the slower one. Listen again!"], "hi": ["धुन {n} धीमी थी। फिर से सुनो!"], "hinglish": ["Dhun {n} slow thi. Phir se suno!"]},
    "teach.same_different.same": {"en": ["Those two tunes were the same. Listen again!"], "hi": ["दोनों धुनें एक जैसी थीं। फिर से सुनो!"], "hinglish": ["Dono dhunein same thi. Phir se suno!"]},
    "teach.same_different.different": {"en": ["One note was different. Listen for it!"], "hi": ["एक सुर अलग था। ध्यान से सुनो!"], "hinglish": ["Ek note alag tha. Dhyaan se suno!"]},
    "teach.instrument_guess": {"en": ["Listen to its voice once more."], "hi": ["इसकी आवाज़ एक बार और सुनो।"], "hinglish": ["Iski awaaz ek baar aur suno."]},
    "detail.find_first": {
        "en": ["You found {note} on the very first try!"], "hi": ["तुमने पहली ही बार में {note} ढूँढ लिया!"], "hinglish": ["Tumne pehli hi baar mein {note} dhoondh liya!"],
    },
    "detail.find_later": {"en": ["You found {note}! Next time, on the first try."], "hi": ["तुमने {note} ढूँढ लिया! अगली बार पहली बार में।"], "hinglish": ["Tumne {note} dhoondh liya! Agli baar pehli baar mein."]},
    "detail.rhythm_all": {"en": ["You tapped every beat!"], "hi": ["तुमने हर मात्रा बजाई!"], "hinglish": ["Tumne har beat bajayi!"]},
    "detail.rhythm_some": {"en": ["You got {matched} of {expected} beats."], "hi": ["{expected} में से {matched} मात्राएँ सही थीं।"], "hinglish": ["{expected} mein se {matched} beats sahi thi."]},
    "detail.notes_all": {"en": ["Every note was right!"], "hi": ["हर सुर सही था!"], "hinglish": ["Har note sahi tha!"]},
    "detail.name": {"en": ["Well done, {name}!", "{name}, that was lovely!"], "hi": ["शाबाश, {name}!", "{name}, बहुत सुंदर!"], "hinglish": ["Shabaash, {name}!", "{name}, bahut sundar!"]},
    "coach.hesitation": {
        "en": ["You stopped to look for {note}. Let's practise just that little bit.", "Finding {note} took a moment. We'll practise that jump."],
        "hi": ["{note} ढूँढने में तुम रुके। चलो बस वही छोटा हिस्सा बजाएँ।", "{note} ढूँढने में थोड़ा समय लगा। वही छलाँग का अभ्यास करें।"],
        "hinglish": ["{note} dhoondhne mein tum ruke. Chalo bas wahi chhota hissa bajayein.", "{note} dhoondhne mein thoda time laga. Wahi jump practice karein."],
    },
    "coach.hold_long": {
        "en": ["Hold {note} longer. Count {beats} before you move on!"], "hi": ["{note} को लंबा रोको। आगे बढ़ने से पहले {beats} तक गिनो!"],
        "hinglish": ["{note} ko lamba hold karo. Aage badhne se pehle {beats} tak gino!"],
    },
    "coach.rushing": {"en": ["That was quick! Now slowly, with the beat."], "hi": ["यह तो जल्दी था! अब धीरे, ताल के साथ।"], "hinglish": ["Yeh toh jaldi tha! Ab dheere, beat ke saath."]},
    "coach.dragging": {"en": ["Let's keep up with the beat this time."], "hi": ["इस बार ताल के साथ-साथ चलें।"], "hinglish": ["Is baar beat ke saath-saath chalein."]},
    "coach.uneven": {
        "en": ["Make every note the same length, like walking steps: one, two, one, two."], "hi": ["हर सुर बराबर लंबा रखो, चलते कदमों जैसा: एक, दो, एक, दो।"],
        "hinglish": ["Har note barabar lamba rakho, chalte kadmon jaisa: ek, do, ek, do."],
    },
    "coach.steady": {"en": ["Your beat was so steady, like a clock!"], "hi": ["तुम्हारी ताल घड़ी जैसी बराबर थी!"], "hinglish": ["Tumhari beat ghadi jaisi steady thi!"]},
    "coach.louder": {
        "en": ["I could hardly hear your keyboard. Play a little louder, or bring it closer."], "hi": ["तुम्हारा कीबोर्ड मुश्किल से सुनाई दिया। थोड़ा ज़ोर से बजाओ, या पास ले आओ।"],
        "hinglish": ["Tumhara keyboard mushkil se sunai diya. Thoda zor se bajao, ya paas le aao."],
    },
    "coach.cam_hands": {
        "en": ["I can't see your hands. A grown-up can point the camera at the keys."], "hi": ["तुम्हारे हाथ नहीं दिख रहे। कोई बड़ा कैमरा कुंजियों की ओर कर दे।"],
        "hinglish": ["Tumhare haath nahi dikh rahe. Koi bada camera keys ki taraf kar de."],
    },
    "coach.cam_curve": {
        "en": ["Curve your fingers, like holding a little ball."], "hi": ["उँगलियाँ गोल रखो, जैसे छोटी गेंद पकड़ी हो।"], "hinglish": ["Ungliyan gol rakho, jaise chhoti ball pakdi ho."],
    },
    "coach.cam_fingers": {
        "en": ["Try more fingers: one finger for each key, like little steps."], "hi": ["और उँगलियाँ चलाओ: हर कुंजी के लिए एक उँगली, छोटे कदमों जैसी।"],
        "hinglish": ["Aur ungliyan chalao: har key ke liye ek ungli, chhote kadmon jaisi."],
    },
    "drill.intro": {"en": ["Just these notes: {notes}. Slowly!"], "hi": ["बस ये सुर: {notes}। धीरे-धीरे!"], "hinglish": ["Bas yeh notes: {notes}. Dheere-dheere!"]},
    "recall.stars": {"en": ["Last time you earned {stars} stars!"], "hi": ["पिछली बार तुमने {stars} सितारे कमाए थे!"], "hinglish": ["Pichhli baar tumne {stars} stars kamaaye the!"]},
    "recall.skill": {"en": ["Last time {skill} was a little tricky. Today we'll play with it again, slowly. You'll see!",
                            "I remember {skill} felt hard last time. Let's try it together, in tiny steps."],
                     "hi": ["पिछली बार {skill} थोड़ा कठिन लगा था। आज फिर से धीरे-धीरे खेलेंगे!",
                            "मुझे याद है, पिछली बार {skill} मुश्किल लगा था। आज छोटे-छोटे कदमों में करेंगे।"],
                     "hinglish": ["Pichhli baar {skill} thoda tricky tha. Aaj phir se dheere-dheere khelenge!",
                                  "Mujhe yaad hai, pichhli baar {skill} mushkil laga tha. Aaj chhote steps mein karenge."]},
    "recall.song": {"en": ["You are learning {song}. We'll play it again soon!"], "hi": ["तुम {song} सीख रहे हो। जल्दी फिर बजाएँगे!"], "hinglish": ["Tum {song} seekh rahe ho. Jaldi phir bajayenge!"]},
}
for _k, _langs in _TEACH.items():
    P.setdefault(_k, {}).update(_langs)

# --- Language lessons (spoken in the child's own language; the new word is said in the language being learned) ---
_LANG: dict[str, dict[str, list[str]]] = {
    "lang.intro.listen_pick": {"en": ["Listen! Which picture is it?", "Listen carefully and tap the picture."],
                               "hi": ["सुनो! यह कौन सी तस्वीर है?", "ध्यान से सुनो और तस्वीर छुओ।"], "hinglish": ["Suno! Yeh kaunsi picture hai?", "Dhyaan se suno aur picture tap karo."]},
    "lang.intro.read_pick": {"en": ["Read the word. Which one matches?", "Look at the word and find its match."],
                             "hi": ["शब्द पढ़ो। कौन सा मिलता है?", "शब्द देखो और उसका जोड़ ढूँढो।"], "hinglish": ["Word padho. Kaunsa match karta hai?", "Word dekho aur uska match dhoondho."]},
    "lang.intro.letter_sound": {"en": ["Listen to the sound. Which letter is it?"], "hi": ["आवाज़ सुनो। यह कौन सा अक्षर है?"], "hinglish": ["Sound suno. Yeh kaunsa letter hai?"]},
    "lang.intro.say_word": {"en": ["Now you say it! Press the microphone and speak.", "Your turn to say it. I'm listening!"],
                            "hi": ["अब तुम बोलो! माइक दबाओ और बोलो।", "अब तुम्हारी बारी। हम सुन रहे हैं!"], "hinglish": ["Ab tum bolo! Mic dabao aur bolo.", "Ab tumhari baari. Main sun raha hoon!"]},
    "lang.intro.trace": {"en": ["Trace the letter with your finger. Slowly!", "Draw over the letter, nice and slow."],
                         "hi": ["उँगली से अक्षर पर चलो। धीरे-धीरे!", "अक्षर के ऊपर लिखो, आराम से।"], "hinglish": ["Ungli se letter trace karo. Dheere-dheere!", "Letter ke upar likho, aaraam se."]},
    "lang.intro.spell": {"en": ["Put the letters in order to make the word."], "hi": ["अक्षरों को सही क्रम में लगाकर शब्द बनाओ।"], "hinglish": ["Letters ko sahi order mein lagakar word banao."]},
    "lang.new_word": {"en": ["Here is a new word!", "Ooh, a new word for you!"], "hi": ["यह रहा एक नया शब्द!", "वाह, तुम्हारे लिए नया शब्द!"], "hinglish": ["Yeh raha ek naya word!", "Wah, tumhare liye naya word!"]},
    "lang.new_phrase": {"en": ["Here is something new to say!", "A new sentence for you!"], "hi": ["यह रहा बोलने के लिए कुछ नया!", "तुम्हारे लिए एक नया वाक्य!"],
                        "hinglish": ["Yeh raha bolne ke liye kuch naya!", "Tumhare liye ek naya sentence!"]},
    "lang.reveal": {"en": ["Look, it was this one. Listen again.", "Here it is. Let's hear it once more."],
                    "hi": ["देखो, यह वाला था। फिर से सुनो।", "यह रहा। एक बार और सुनते हैं।"], "hinglish": ["Dekho, yeh wala tha. Phir se suno.", "Yeh raha. Ek baar aur sunte hain."]},
    "lang.unheard": {"en": ["I couldn't hear you well. Let's say it together once more.", "My ears missed that. A little louder, please!"],
                     "hi": ["ठीक से सुनाई नहीं दिया। चलो साथ में एक बार और बोलें।", "यह सुनाई नहीं दिया। थोड़ा ज़ोर से बोलो!"],
                     "hinglish": ["Theek se sunai nahi diya. Chalo saath mein ek baar aur bolein.", "Yeh sunai nahi diya. Thoda zor se bolo!"]},
    "lang.almost": {"en": ["Good trying! Listen once more, then say it again.", "Nearly! Let's hear it again and say it together."],
                    "hi": ["अच्छी कोशिश! एक बार और सुनो, फिर बोलो।", "लगभग! फिर से सुनते हैं और साथ में बोलते हैं।"],
                    "hinglish": ["Acchi koshish! Ek baar aur suno, phir bolo.", "Lagbhag! Phir se sunte hain aur saath mein bolte hain."]},
    "lang.comfort": {"en": ["That one was tricky, and that's okay. Take your time. Here's one you know.", "No hurry at all. Let's do an easy one together."],
                     "hi": ["वह थोड़ा कठिन था, कोई बात नहीं। आराम से। यह वाला तुम्हें आता है।", "कोई जल्दी नहीं। चलो एक आसान वाला साथ में करें।"],
                     "hinglish": ["Woh thoda tricky tha, koi baat nahi. Aaraam se. Yeh wala tumhe aata hai.", "Koi jaldi nahi. Chalo ek easy wala saath mein karein."]},
    "lang.new_words": {"en": ["You know so many words now! New words are open for you."], "hi": ["अब तुम्हें कितने सारे शब्द आते हैं! नए शब्द खुल गए।"],
                       "hinglish": ["Ab tumhe kitne saare words aate hain! Naye words khul gaye."]},
    "lang.stage_up": {"en": ["Hooray! You reached stage {n}!"], "hi": ["हुर्रे! तुम स्टेज {n} पर पहुँच गए!"], "hinglish": ["Hurray! Tum stage {n} par pahunch gaye!"]},
    # --- emotional, specific reactions (see teacher/emotion.py) ---
    "lang.praise.listen": {"en": ["Yes! Your ears are so sharp!", "You heard it perfectly!", "Super listening, {name}!"],
                           "hi": ["हाँ! तुम्हारे कान कितने तेज़ हैं!", "तुमने बिल्कुल सही सुना!", "बहुत बढ़िया सुना, {name}!"],
                           "hinglish": ["Haan! Tumhare kaan kitne tez hain!", "Tumne bilkul sahi suna!", "Super listening, {name}!"]},
    "lang.praise.read": {"en": ["You read that all by yourself!", "Wow, you are reading!", "Look at you reading, {name}!"],
                         "hi": ["तुमने खुद पढ़ लिया!", "वाह, तुम पढ़ रहे हो!", "देखो, {name} पढ़ रहा है!"],
                         "hinglish": ["Tumne khud padh liya!", "Wah, tum padh rahe ho!", "Dekho, {name} padh raha hai!"]},
    "lang.praise.write": {"en": ["Beautiful writing! So careful.", "What neat letters!", "You wrote it just right!"],
                          "hi": ["कितना सुंदर लिखा! बहुत ध्यान से।", "कितने सुंदर अक्षर!", "तुमने बिल्कुल सही लिखा!"],
                          "hinglish": ["Kitna sundar likha! Bahut dhyaan se.", "Kitne neat letters!", "Tumne bilkul sahi likha!"]},
    "lang.praise.speak": {"en": ["I understood you perfectly!", "You said it like a real speaker!", "Lovely clear voice!"],
                          "hi": ["मैं बिल्कुल समझ गया!", "तुमने बिल्कुल सही बोला!", "कितनी साफ़ आवाज़!"],
                          "hinglish": ["Main bilkul samajh gaya!", "Tumne ekdum sahi bola!", "Kitni saaf awaaz!"]},
    "lang.streak3": {"en": ["Three in a row! You're on fire!", "One, two, three right! Amazing!"],
                     "hi": ["लगातार तीन सही! क्या बात है!", "एक, दो, तीन, सब सही! कमाल!"],
                     "hinglish": ["Lagaatar teen sahi! Kya baat hai!", "Ek, do, teen, sab sahi! Kamaal!"]},
    "lang.streak5": {"en": ["Five in a row! Let's have a little party!", "Wow, wow, wow! Five right in a row!"],
                     "hi": ["लगातार पाँच सही! चलो, छोटी सी पार्टी!", "वाह, वाह, वाह! पाँच सही!"],
                     "hinglish": ["Lagaatar paanch sahi! Chalo, chhoti si party!", "Wah, wah, wah! Paanch sahi!"]},
    "lang.comeback": {"en": ["See? You kept trying and you got it! That's how real learners do it.", "Yes! You didn't give up, and look!"],
                      "hi": ["देखा? तुमने कोशिश जारी रखी और सही कर दिया! असली सीखने वाले ऐसे ही करते हैं।", "हाँ! तुमने हार नहीं मानी, और देखो!"],
                      "hinglish": ["Dekha? Tumne koshish jaari rakhi aur sahi kar diya! Real learners aise hi karte hain.", "Haan! Tumne haar nahi maani, aur dekho!"]},
    "lang.oops": {"en": ["Oopsie! That one was sneaky.", "Oh ho! Tricky one, wasn't it?"],
                  "hi": ["उप्स! यह थोड़ा चालाक था।", "ओहो! थोड़ा मुश्किल था ना?"],
                  "hinglish": ["Oops! Yeh thoda chalaak tha.", "Oho! Thoda tricky tha na?"]},
    "lang.empathy": {"en": ["Aww, this is a hard one. I find it hard too sometimes. We'll do it together.", "It's okay to find this tricky. I'm right here with you."],
                     "hi": ["अरे, यह कठिन है। मुझे भी कभी-कभी कठिन लगता है। हम साथ में करेंगे।", "मुश्किल लगना ठीक है। मैं तुम्हारे साथ हूँ।"],
                     "hinglish": ["Aww, yeh mushkil hai. Mujhe bhi kabhi kabhi mushkil lagta hai. Hum saath mein karenge.", "Mushkil lagna theek hai. Main tumhare saath hoon."]},
    "lang.conversation_ok": {"en": ["You just had a real conversation!", "That's exactly how you answer! Like a real speaker."],
                             "hi": ["तुमने अभी सच में बातचीत की!", "बिल्कुल ऐसे ही जवाब देते हैं!"],
                             "hinglish": ["Tumne abhi sach mein baat-cheet ki!", "Bilkul aise hi jawaab dete hain!"]},
    "lang.intro.reply_pick": {"en": ["I'll ask you something. Which answer fits?", "Let's chat! Listen to my question and pick your answer."],
                              "hi": ["मैं तुमसे कुछ पूछूँगा। कौन सा जवाब सही है?", "चलो बात करें! मेरा सवाल सुनो और जवाब चुनो।"],
                              "hinglish": ["Main tumse kuch poochhunga. Kaunsa jawaab sahi hai?", "Chalo baat karein! Mera sawaal suno aur jawaab chuno."]},
    "lang.intro.say_reply": {"en": ["I'll ask you a question. Answer me out loud!", "Let's talk! Listen, then answer me."],
                             "hi": ["मैं एक सवाल पूछूँगा। ज़ोर से जवाब दो!", "चलो बात करें! सुनो, फिर जवाब दो।"],
                             "hinglish": ["Main ek sawaal poochhunga. Zor se jawaab do!", "Chalo baat karein! Suno, phir jawaab do."]},
    "lang.intro.barakhadi": {"en": ["Same letter, different sounds! Listen: which one is it?"],
                             "hi": ["एक ही अक्षर, अलग-अलग मात्रा! सुनो, कौन सा है?"], "hinglish": ["Ek hi akshar, alag-alag maatra! Suno, kaunsa hai?"]},
    "lang.welcome_back": {"en": ["Welcome back, {name}! You already know {n} words. Let's warm up with one you know.",
                                 "Hello again! I remember you know {n} words. First, an easy one!"],
                          "hi": ["फिर से स्वागत है, {name}! तुम्हें {n} शब्द आते हैं। पहले एक जाना-पहचाना शब्द।",
                                 "फिर मिले! मुझे याद है तुम्हें {n} शब्द आते हैं। पहले एक आसान वाला!"],
                          "hinglish": ["Welcome back, {name}! Tumhe {n} words aate hain. Pehle ek jaana-pehchaana word.",
                                       "Phir mile! Mujhe yaad hai tumhe {n} words aate hain. Pehle ek easy wala!"]},
    "lang.welcome_back_new": {"en": ["Welcome back, {name}! Let's pick up where we stopped."],
                              "hi": ["फिर से स्वागत है, {name}! जहाँ रुके थे, वहीं से शुरू करते हैं।"],
                              "hinglish": ["Welcome back, {name}! Jahan ruke the, wahin se shuru karte hain."]},
    "lang.errorless": {"en": ["Let's do this one together. Look, I'll show you the way!", "I'll help you. Watch the glowing one!"],
                       "hi": ["यह वाला साथ में करते हैं। देखो, मैं रास्ता दिखाता हूँ!", "मैं मदद करूँगा। चमकने वाले को देखो!"],
                       "hinglish": ["Yeh wala saath mein karte hain. Dekho, main raasta dikhata hoon!", "Main help karunga. Chamakne wale ko dekho!"]},
    "lang.challenge": {"en": ["You know so much now! I found new, harder sentences for you. Ready?", "Challenge time! Here is something harder."],
                       "hi": ["अब तुम्हें बहुत कुछ आता है! तुम्हारे लिए नए, कठिन वाक्य लाया हूँ। तैयार?", "चुनौती का समय! यह थोड़ा कठिन है।"],
                       "hinglish": ["Ab tumhe bahut kuch aata hai! Tumhare liye naye, mushkil sentences laaya hoon. Ready?", "Challenge time! Yeh thoda mushkil hai."]},
    "lang.intro.sentence": {"en": ["Let's build a whole sentence! Put the words in order."],
                            "hi": ["चलो पूरा वाक्य बनाएँ! शब्दों को सही क्रम में लगाओ।"], "hinglish": ["Chalo poora sentence banayein! Words ko sahi order mein lagao."]},
}
for _k, _langs in _LANG.items():
    P.setdefault(_k, {}).update(_langs)

# --- Language packs: backend/app/teacher/locales/<code>.json maps a phrase key to its lines ----------
_packs: dict[str, dict[str, list[str]]] = {}


def pack(lang: str) -> dict[str, list[str]]:
    """Lines for a language that is not built in (es, fr, zh, ar ...). Missing keys fall back to English."""
    if lang not in _packs:
        import json
        from pathlib import Path

        path = Path(__file__).parent / "locales" / f"{lang}.json"
        data: dict[str, list[str]] = {}
        if lang.isalnum() and path.is_file():
            raw = json.loads(path.read_text(encoding="utf-8"))
            data = {k: [x for x in ([v] if isinstance(v, str) else v) if isinstance(x, str) and x.strip()]
                    for k, v in raw.items() if not k.startswith("_")}
        _packs[lang] = {k: v for k, v in data.items() if v}
    return _packs[lang]


# The last line used per (key, language): never say the very same sentence twice in a row.
_last: dict[tuple[str, str], str] = {}


def line(key: str, lang: str, rng: random.Random | None = None, **fmt: object) -> str:
    variants = P.get(key, {}).get(lang) or pack(lang).get(key) or P.get(key, {}).get("en") or [""]
    fresh = [v for v in variants if v != _last.get((key, lang))] or variants
    text = (rng or random).choice(fresh)
    _last[(key, lang)] = text
    try:
        return text.format(**fmt) if fmt else text
    except (KeyError, IndexError):
        return text
