// Teacher personas: the parent picks who teaches each subject (maths, science, music, languages), with
// the device voice, speed and pitch. A persona changes how the teacher sounds and talks (greeting, praise,
// encouragement), never what is taught. The default is Melo for everything.
import { useEffect, useState } from "react";
import { api } from "../api";
import { setTeacherVoice } from "../audio/speech";
import { L, type Text } from "../i18n";
import type { Language } from "../languages";

export type Subject = "maths" | "science" | "music" | "languages" | "vedas" | "finance";
export type PersonaId = "melo" | "professor_pi" | "captain_science" | "dadi" | "coach_zoom" | "maestro" | "guruji" | "money_mitra";
export interface TeacherChoice { persona: PersonaId; voice?: string | null; rate: number; pitch: number }
export interface Prefs { grade: number; grade_auto: boolean; teachers: Partial<Record<Subject, TeacherChoice>> }

export interface Persona {
  id: PersonaId; name: string; emoji: string; about: string; rate: number; pitch: number;
  hello: Text; praise: Text[]; encourage: Text[];
}

export const PERSONAS: Persona[] = [
  { id: "melo", name: "Melo", emoji: "🦉", about: "Gentle, patient owl. Calm and warm, for every subject.", rate: 1, pitch: 1,
    hello: { en: "Hello {name}! Let's learn something new together.", hi: "नमस्ते {name}! चलो साथ में कुछ नया सीखते हैं।", hinglish: "Hello {name}! Chalo saath mein kuch naya seekhte hain." },
    praise: [{ en: "Well done!", hi: "बहुत बढ़िया!", hinglish: "Bahut badhiya!" }, { en: "You got it!", hi: "तुमने कर दिखाया!", hinglish: "Tumne kar dikhaya!" }],
    encourage: [{ en: "Let's look again, slowly.", hi: "चलो फिर से, धीरे-धीरे देखते हैं।", hinglish: "Chalo phir se, dheere-dheere dekhte hain." }] },
  { id: "professor_pi", name: "Professor Pi", emoji: "🧮", about: "Curious maths professor who loves patterns and puzzles.", rate: 0.95, pitch: 0.95,
    hello: { en: "Greetings, {name}! Professor Pi has a number puzzle for you.", hi: "नमस्ते {name}! प्रोफ़ेसर पाई के पास तुम्हारे लिए एक पहेली है।", hinglish: "Namaste {name}! Professor Pi ke paas tumhare liye ek puzzle hai." },
    praise: [{ en: "Marvellous! Your brain found the pattern!", hi: "शानदार! तुम्हारे दिमाग़ ने पैटर्न पकड़ लिया!", hinglish: "Shaandaar! Tumhare dimaag ne pattern pakad liya!" }, { en: "Exactly right, little mathematician!", hi: "बिल्कुल सही, छोटे गणितज्ञ!", hinglish: "Bilkul sahi, chhote mathematician!" }],
    encourage: [{ en: "Hmm, interesting! Let's think it through step by step.", hi: "हम्म, दिलचस्प! चलो एक-एक क़दम सोचते हैं।", hinglish: "Hmm, interesting! Chalo step by step sochte hain." }] },
  { id: "captain_science", name: "Captain Science", emoji: "🧑‍🚀", about: "Explorer who asks 'why?' about everything. Great for science.", rate: 1.05, pitch: 1.05,
    hello: { en: "Explorer {name}, ready for a science mission?", hi: "खोजी {name}, विज्ञान मिशन के लिए तैयार?", hinglish: "Explorer {name}, science mission ke liye ready?" },
    praise: [{ en: "Mission complete! Great observing!", hi: "मिशन पूरा! बढ़िया देखा!", hinglish: "Mission complete! Badhiya observe kiya!" }],
    encourage: [{ en: "Scientists try again! Let's look at the clue.", hi: "वैज्ञानिक फिर कोशिश करते हैं! सुराग देखो।", hinglish: "Scientists phir try karte hain! Clue dekho." }] },
  { id: "dadi", name: "Dadi", emoji: "👵", about: "A loving grandmother who explains with little stories. Slow and soft.", rate: 0.85, pitch: 1.05,
    hello: { en: "Come, {name}, sit with me. Let me tell you something lovely.", hi: "आओ {name}, मेरे पास बैठो। एक प्यारी बात बताती हूँ।", hinglish: "Aao {name}, mere paas baitho. Ek pyaari baat batati hoon." },
    praise: [{ en: "Shabaash, my dear!", hi: "शाबाश, मेरे बच्चे!", hinglish: "Shabaash, mere bachche!" }],
    encourage: [{ en: "No hurry, beta. Let's try once more together.", hi: "कोई जल्दी नहीं, बेटा। चलो एक बार और साथ में।", hinglish: "Koi jaldi nahi, beta. Chalo ek baar aur saath mein." }] },
  { id: "coach_zoom", name: "Coach Zoom", emoji: "🏃", about: "Energetic coach: quick rounds, lots of cheering. For kids who like speed.", rate: 1.12, pitch: 1.08,
    hello: { en: "Hey champ {name}! Warm up your brain, let's go!", hi: "अरे चैंपियन {name}! दिमाग़ गरम करो, चलो!", hinglish: "Hey champ {name}! Dimaag warm up karo, let's go!" },
    praise: [{ en: "Boom! Super fast and right!", hi: "धमाका! तेज़ और सही!", hinglish: "Boom! Super fast aur sahi!" }, { en: "Champion move!", hi: "चैंपियन वाली चाल!", hinglish: "Champion move!" }],
    encourage: [{ en: "Shake it off, champ! Next one's yours.", hi: "कोई बात नहीं, चैंपियन! अगला तुम्हारा है।", hinglish: "Koi baat nahi, champ! Agla tumhara hai." }] },
  { id: "maestro", name: "Maestro", emoji: "🎼", about: "A musician who hears music in everything. For music.", rate: 0.95, pitch: 1.02,
    hello: { en: "Bravo, {name}! Shall we make some music?", hi: "वाह {name}! चलो संगीत बनाएँ?", hinglish: "Wah {name}! Chalo music banayein?" },
    praise: [{ en: "Bravissimo!", hi: "वाह, क्या बात है!", hinglish: "Wah, kya baat hai!" }],
    encourage: [{ en: "Listen once more, the music will guide you.", hi: "एक बार और सुनो, संगीत रास्ता दिखाएगा।", hinglish: "Ek baar aur suno, music raasta dikhayega." }] },
  { id: "guruji", name: "Guruji", emoji: "🧘", about: "A calm, wise teacher of the Vedas, the Gita and life skills. Speaks slowly with stories.", rate: 0.88, pitch: 0.95,
    hello: { en: "Namaste {name}. Come, let us learn something that will help you all your life.", hi: "नमस्ते {name}। आओ, कुछ ऐसा सीखें जो जीवन भर काम आए।", hinglish: "Namaste {name}. Aao, kuch aisa seekhein jo zindagi bhar kaam aaye." },
    praise: [{ en: "Sādhu! Well understood.", hi: "साधु! बहुत अच्छे से समझा।", hinglish: "Saadhu! Bahut achhe se samjha." }],
    encourage: [{ en: "Patience, my child. Let us think about it together.", hi: "धैर्य रखो, बच्चे। साथ में सोचते हैं।", hinglish: "Dhairya rakho, bachche. Saath mein sochte hain." }] },
  { id: "money_mitra", name: "Money Mitra", emoji: "🪙", about: "A friendly money coach who loves smart choices and saving goals.", rate: 1.0, pitch: 1.02,
    hello: { en: "Hi {name}! Ready to be smart with money today?", hi: "हाय {name}! आज पैसे में समझदार बनने को तैयार?", hinglish: "Hi {name}! Aaj paise mein smart banne ko ready?" },
    praise: [{ en: "Smart choice! Your future self says thank you.", hi: "समझदार फ़ैसला! तुम्हारा भविष्य धन्यवाद कहता है।", hinglish: "Smart choice! Tumhara future thank you bolta hai." }],
    encourage: [{ en: "Let's count it out step by step.", hi: "चलो एक-एक क़दम गिनते हैं।", hinglish: "Chalo step by step ginte hain." }] },
];
export const DEFAULT_PERSONA: Record<Subject, PersonaId> = { maths: "melo", science: "melo", music: "melo", languages: "melo", vedas: "melo", finance: "melo" };
export const personaById = (id: string | undefined) => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

let prefsCache: Record<string, Prefs> = {};
export const forgetPrefs = (childId: string) => { delete prefsCache[childId]; };

/**
 * The teacher of this subject for this child: loads the parent's choice and makes the voice speak that way
 * while the page is open. Returns the persona, the child's class and helpers for persona lines.
 */
export function useTeacher(childId: string, subject: Subject) {
  const [prefs, setPrefs] = useState<Prefs | null>(prefsCache[childId] ?? null);
  useEffect(() => {
    let live = true;
    api.prefs(childId).then((p) => { prefsCache[childId] = p; if (live) setPrefs(p); }).catch(() => {});
    return () => { live = false; };
  }, [childId]);
  const choice = prefs?.teachers?.[subject];
  const persona = personaById(choice?.persona ?? DEFAULT_PERSONA[subject]);
  useEffect(() => {
    setTeacherVoice({ voice: choice?.voice ?? null, rate: (choice?.rate ?? 1) * persona.rate, pitch: (choice?.pitch ?? 1) * persona.pitch });
    return () => setTeacherVoice(null);
  }, [choice?.voice, choice?.rate, choice?.pitch, persona]);
  return {
    persona, prefs, grade: prefs?.grade ?? null,
    hello: (name: string, lang: Language) => L(persona.hello, lang).replace("{name}", name),
    praise: (lang: Language) => L(persona.praise[Math.floor(Math.random() * persona.praise.length)], lang),
    encourage: (lang: Language) => L(persona.encourage[Math.floor(Math.random() * persona.encourage.length)], lang),
  };
}
