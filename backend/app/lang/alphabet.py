"""Alphabets of every language Melo teaches, complete, in teaching order, comparable across languages.

Each letter has:
* ``char``   what is written (Latin and Cyrillic show the capital and small letter),
* ``group``  vowel / consonant / letter / extra (borrowed letters) / syllable (kana, Korean blocks) / initial / final,
* ``sound``  a shared sound key ("k", "kh", "ch", "sh", "a", "aa" ...): the same key in two languages means
             (about) the same sound, which is what the comparison view lines up: क ક ক க క ಕ ਕ К K ك ㄱ か,
* ``roman``  how it is said, in Latin letters,
* ``say``    what the voice reads aloud (the letter itself, a syllable, or the letter's name),
* ``example`` a word from Melo's own vocabulary that starts with it (with its picture), when there is one.

Indian scripts share one Unicode layout (ISCII), so their alphabets are generated from the same offsets:
the same row in every script really is the same sound. Chinese and Cantonese have no alphabet: children
learn the sounds with pinyin / Jyutping initials, each with its usual teaching character (玻 坡 摸 佛 ...).
Japanese uses the 46 hiragana, Korean the 14 basic consonants and 10 basic vowels.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass
from functools import lru_cache

from .content import TARGETS

# --- the shared sound keys, with a hint in English for the comparison view ---------------------------------
SOUNDS: dict[str, str] = {
    "a": "a as in about", "aa": "long a as in father", "i": "i as in sit", "ii": "long ee as in see", "u": "u as in put",
    "uu": "long oo as in moon", "ri": "ri as in Krishna", "e": "e / ay as in day", "e_short": "short e as in bed",
    "ai": "ai as in eye", "o": "o as in go", "o_short": "short o", "au": "au as in now", "oe": "ö (rounded e)",
    "ue": "ü (rounded ee)", "eu": "ɨ / ı (unrounded u)", "eo": "eo as in Korean (open o)", "ya": "ya", "yo": "yo", "yu": "yu", "ye": "ye", "yeo": "yeo",
    "k": "k", "kh": "kh (k with a puff of air)", "g": "g", "gh": "gh (g with breath)", "ng": "ng as in sing",
    "ch": "ch as in chair", "chh": "chh (ch with a puff of air)", "j": "j as in jam", "jh": "jh (j with breath)", "ny": "ny as in canyon",
    "tt": "hard t (tongue curled back)", "tth": "hard th (tongue back, with air)", "dd": "hard d (tongue curled back)",
    "ddh": "hard dh (tongue back, with breath)", "nn": "hard n (tongue curled back)",
    "t": "soft t (tongue on the teeth)", "th": "t with a puff of air", "d": "soft d (tongue on the teeth)", "dh": "d with breath", "n": "n",
    "p": "p", "ph": "ph (p with a puff of air)", "b": "b", "bh": "bh (b with breath)", "m": "m",
    "y": "y as in yes", "r": "r", "rr": "trilled / hard r", "l": "l", "ll": "hard l (tongue curled back)", "zha": "Tamil zh (ழ)",
    "v": "v", "w": "w", "f": "f", "s": "s", "sh": "sh as in ship", "ssh": "hard sh (tongue curled back)", "shch": "long soft sh",
    "h": "h", "x": "kh as in Bach (rough h)", "z": "z", "zh": "zh as in measure", "ts": "ts as in cats", "dz": "dz as in kids",
    "q": "deep k (back of the throat)", "hh": "strong breathy h", "ain": "ʿayn (throat sound)", "gh_fric": "gargled g (like a French r)",
    "th_soft": "th as in think", "dh_soft": "th as in this", "s_emph": "heavy s", "d_emph": "heavy d", "t_emph": "heavy t", "z_emph": "heavy z",
    "gw": "gw", "kw": "kw", "silent": "no sound of its own (it changes the sound next to it)",
    "rii": "long ri", "lri": "lri (rare vowel)", "lrii": "long lri (rare vowel)", "ae": "a as in cat", "aw": "o as in ball",
    "am": "humming nasal sound after a vowel (anusvara)", "ah": "soft breathy h after a vowel (visarga)", "nasal": "the vowel through the nose (chandrabindu)",
    "rd": "flapped r (tongue flicks back)", "rdh": "flapped r with breath", "ksh": "ksh (k + sh joined)", "tr": "tr (t + r joined)",
    "gy": "gy / gny (j + ny joined)", "shr": "shr (sh + r joined)", "t_half": "a t with no vowel after it",
    "tense_k": "tight k (no puff of air)", "tense_t": "tight t (no puff of air)", "tense_p": "tight p (no puff of air)",
    "tense_s": "tight s", "tense_ch": "tight ch", "yae": "yae", "wa": "wa", "wae": "wae", "we": "we", "wo": "wo", "wi": "wi", "ui": "ui",
    "glottal": "a little catch in the throat (hamza)",
}


@dataclass(frozen=True)
class Letter:
    i: int
    char: str
    group: str
    sound: str
    roman: str
    say: str
    name: str = ""
    example: dict | None = None

    def public(self) -> dict:
        d = asdict(self)
        d["item"] = item_id(self.i)
        return d


def item_id(i: int) -> str:
    return f"abc{i:02d}"  # abc00 ... abc99, abc100 ...


# --- Indian scripts: generated from the shared Unicode layout ----------------------------------------------
_BLOCK = {"hi": 0x0900, "mr": 0x0900, "sa": 0x0900, "bn": 0x0980, "pa": 0x0A00, "gu": 0x0A80, "ta": 0x0B80, "te": 0x0C00, "kn": 0x0C80}
_SOUTH = {"ta", "te", "kn"}
# offset -> (sound key, roman)
_VOWELS = {0x05: ("a", "a"), 0x06: ("aa", "aa"), 0x07: ("i", "i"), 0x08: ("ii", "ii"), 0x09: ("u", "u"), 0x0A: ("uu", "uu"),
           0x0B: ("ri", "ri"), 0x0E: ("e_short", "e"), 0x0F: ("e", "ē"), 0x10: ("ai", "ai"), 0x12: ("o_short", "o"), 0x13: ("o", "ō"),
           0x14: ("au", "au")}
_CONS = {0x15: ("k", "ka"), 0x16: ("kh", "kha"), 0x17: ("g", "ga"), 0x18: ("gh", "gha"), 0x19: ("ng", "nga"),
         0x1A: ("ch", "cha"), 0x1B: ("chh", "chha"), 0x1C: ("j", "ja"), 0x1D: ("jh", "jha"), 0x1E: ("ny", "nya"),
         0x1F: ("tt", "Ta"), 0x20: ("tth", "Tha"), 0x21: ("dd", "Da"), 0x22: ("ddh", "Dha"), 0x23: ("nn", "Na"),
         0x24: ("t", "ta"), 0x25: ("th", "tha"), 0x26: ("d", "da"), 0x27: ("dh", "dha"), 0x28: ("n", "na"), 0x29: ("n", "ṉa"),
         0x2A: ("p", "pa"), 0x2B: ("ph", "pha"), 0x2C: ("b", "ba"), 0x2D: ("bh", "bha"), 0x2E: ("m", "ma"),
         0x2F: ("y", "ya"), 0x30: ("r", "ra"), 0x31: ("rr", "Ra"), 0x32: ("l", "la"), 0x33: ("ll", "La"), 0x34: ("zha", "zha"),
         0x35: ("v", "va"), 0x36: ("sh", "sha"), 0x37: ("ssh", "Sha"), 0x38: ("s", "sa"), 0x39: ("h", "ha")}
# letters a script has in Unicode but children do not learn in its alphabet
_SKIP = {
    "hi": {0x29, 0x31, 0x33, 0x34, 0x0E, 0x12}, "sa": {0x29, 0x31, 0x33, 0x34, 0x0E, 0x12}, "mr": {0x29, 0x31, 0x34, 0x0E, 0x12},  # added back as "extra" below
    "gu": {0x0E, 0x12}, "bn": {0x0E, 0x12}, "pa": set(), "ta": {0x36}, "te": {0x31, 0x34}, "kn": {0x31, 0x34},
}
# borrowed letters, taught after the main alphabet
_EXTRA = {"ta": {0x1C, 0x37, 0x38, 0x39}, "pa": {0x33, 0x36}}
_VIRAMA = 0x4D
# rare vowels and the vowel-like signs, written with अ: ॠ ऌ ॡ, ऍ ऑ (English words), अं अः अँ
_MORE_VOWELS = {0x60: ("rii", "rī"), 0x0C: ("lri", "ḷ"), 0x61: ("lrii", "ḹ"), 0x0D: ("ae", "æ"), 0x11: ("aw", "ŏ")}
_SIGNS = {0x02: ("am", "aṃ"), 0x03: ("ah", "aḥ"), 0x01: ("nasal", "ã")}
# letters with a dot (nukta) for sounds from Persian, Arabic and English, and the flapped r's
_NUKTA = {"hi": {0x958: ("q", "qa"), 0x959: ("x", "xa"), 0x95A: ("gh_fric", "ġa"), 0x95B: ("z", "za"), 0x95C: ("rd", "ṛa"), 0x95D: ("rdh", "ṛha"),
                 0x95E: ("f", "fa"), 0x95F: ("y", "ẏa")},
          "bn": {0x9DC: ("rd", "ṛa"), 0x9DD: ("rdh", "ṛha"), 0x9DF: ("y", "ẏa"), 0x9CE: ("t_half", "t")},
          "pa": {0xA59: ("x", "xa"), 0xA5A: ("gh_fric", "ġa"), 0xA5B: ("z", "za"), 0xA5C: ("rd", "ṛa"), 0xA5E: ("f", "fa")},
          "ta": {0xB83: ("x", "ḵ (aytham)")}, "kn": {0xCDE: ("zha", "ḻa")}}
_NUKTA["mr"] = _NUKTA["sa"] = {k: v for k, v in _NUKTA["hi"].items() if k in (0x95B, 0x95E)}
# the joined letters children learn with the alphabet (क्ष त्र ज्ञ श्र)
_CONJ = {"hi": [("क्ष", "ksh", "kṣa"), ("त्र", "tr", "tra"), ("ज्ञ", "gy", "jña"), ("श्र", "shr", "śra")],
         "gu": [("ક્ષ", "ksh", "kṣa"), ("જ્ઞ", "gy", "jña"), ("ત્ર", "tr", "tra"), ("શ્ર", "shr", "śra")],
         "bn": [("ক্ষ", "ksh", "kṣa"), ("জ্ঞ", "gy", "jña")], "ta": [("க்ஷ", "ksh", "kṣa"), ("ஸ்ரீ", "shr", "śrī")],
         "te": [("క్ష", "ksh", "kṣa"), ("జ్ఞ", "gy", "jña")], "kn": [("ಕ್ಷ", "ksh", "kṣa"), ("ಜ್ಞ", "gy", "jña")]}
_CONJ["mr"] = _CONJ["sa"] = _CONJ["hi"]


def _indic(code: str) -> list[tuple[str, str, str, str, str]]:
    base = _BLOCK[code]
    out = []
    for kind, table in (("vowel", _VOWELS), ("consonant", _CONS)):
        offs = [o for o in table if not (kind == "vowel" and code not in _SOUTH and o in (0x0E, 0x12))]
        main, extra = [], []
        for o in offs:
            ch = chr(base + o)
            if o in _SKIP.get(code, set()) or not unicodedata.name(ch, ""):
                continue
            if code == "ta" and kind == "consonant" and o in (0x16, 0x17, 0x18, 0x1B, 0x1D, 0x20, 0x21, 0x22, 0x25, 0x26, 0x27, 0x2B, 0x2C, 0x2D):
                continue  # Tamil has one letter for k/kh/g/gh etc.: not in Unicode anyway, guard for safety
            sound, roman = table[o]
            if code == "ta" and kind == "consonant":
                roman = roman.replace("Ra", "ṟa").replace("La", "ḷa")
            (extra if o in _EXTRA.get(code, set()) else main).append((ch, kind, sound, roman, ch))
        out += main + [(c, "extra", s, r, say) for c, _, s, r, say in extra]
    seen = {c for c, *_ in out}
    more: list[tuple] = []

    def add(ch: str, sound: str, roman: str, group: str = "extra") -> None:
        if ch not in seen and all(unicodedata.name(x, "") for x in ch):
            seen.add(ch)
            more.append((ch, group, sound, roman, ch))

    a = chr(base + 0x05) if code != "pa" else "ਅ"
    for o, (sound, roman) in _MORE_VOWELS.items():
        add(chr(base + o), sound, roman)
    for o, (sound, roman) in _SIGNS.items():  # अं अः अँ: taught with the vowels in India (Tamil uses ஃ on its own)
        if code != "ta" and unicodedata.name(chr(base + o), ""):
            add(a + chr(base + o), sound, roman, "vowel")
    for o in range(0x15, 0x3A):  # every other consonant the script has, even if rarely used
        if o in _CONS and code not in ("ta",):
            sound, roman = _CONS[o]
            add(chr(base + o), sound, roman)
    if code == "ta":
        add(chr(base + 0x36), "sh", "śa")
    for cp, (sound, roman) in _NUKTA.get(code, {}).items():
        add(unicodedata.normalize("NFC", chr(cp)), sound, roman)  # क़ is written क + ़ in normal (NFC) text
    for ch, sound, roman in _CONJ.get(code, []):
        add(ch, sound, roman, "joined")
    if code == "pa":
        for ch, sound, roman in (("ੳ", "u", "ū̃ (vowel carrier)"), ("ੲ", "i", "ī̃ (vowel carrier)"), ("ਅੰ", "am", "aṃ (tippi)"), ("ੱ", "silent", "addak (doubles the next sound)")):
            add(ch, sound, roman)
    return out + more


# --- other scripts, written out (char, group, sound, roman, say[, name]) -----------------------------------
def _latin(spec: str, extra: str = "", turkish: bool = False) -> list[tuple]:
    out = []
    for group, part in (("letter", spec), ("extra", extra)):
        for tok in part.split():
            ch, sound, roman = tok.split(":")
            low = {"İ": "i", "I": "ı" if turkish else "i"}.get(ch, ch.lower())
            pair = ch if low == ch or len(low) != 1 or ch == "ß" else f"{ch}{low}"
            out.append((pair, group, sound, roman, low))
    return out


_EN = "A:a:a B:b:b C:k:k D:d:d E:e_short:e F:f:f G:g:g H:h:h I:i:i J:j:j K:k:k L:l:l M:m:m N:n:n O:o_short:o P:p:p Q:k:kw R:r:r S:s:s T:tt:t U:a:u V:v:v W:w:w X:ks:ks Y:y:y Z:z:z"
_FR = "A:a:a B:b:b C:k:k D:d:d E:eu:e F:f:f G:g:g H:silent:- I:ii:i J:zh:zh K:k:k L:l:l M:m:m N:n:n O:o:o P:p:p Q:k:k R:gh_fric:r S:s:s T:t:t U:ue:ü V:v:v W:w:w X:ks:ks Y:ii:i Z:z:z"
_ES = "A:aa:a B:b:b C:k:k D:d:d E:e:e F:f:f G:g:g H:silent:- I:ii:i J:x:kh K:k:k L:l:l M:m:m N:n:n Ñ:ny:ny O:o:o P:p:p Q:k:k R:rr:r S:s:s T:t:t U:uu:u V:b:b W:w:w X:ks:ks Y:y:y Z:th_soft:th"
_DE = "A:aa:a B:b:b C:ts:ts D:d:d E:e:e F:f:f G:g:g H:h:h I:ii:i J:y:y K:k:k L:l:l M:m:m N:n:n O:o:o P:p:p Q:kw:kw R:gh_fric:r S:z:z T:t:t U:uu:u V:f:f W:v:v X:ks:ks Y:ue:ü Z:ts:ts"
_TR = ("A:a:a B:b:b C:j:j Ç:ch:ch D:d:d E:e_short:e F:f:f G:g:g Ğ:silent:- H:h:h I:eu:ı İ:ii:i J:zh:zh K:k:k L:l:l M:m:m N:n:n "
       "O:o:o Ö:oe:ö P:p:p R:r:r S:s:s Ş:sh:sh T:t:t U:uu:u Ü:ue:ü V:v:v Y:y:y Z:z:z")
_SOUNDS_FIX = {"ks": "k"}  # X = k + s: compared with k

_RU = [("Аа", "a", "a", "а"), ("Бб", "b", "b", "бэ"), ("Вв", "v", "v", "вэ"), ("Гг", "g", "g", "гэ"), ("Дд", "d", "d", "дэ"),
       ("Ее", "ye", "ye", "е"), ("Ёё", "yo", "yo", "ё"), ("Жж", "zh", "zh", "жэ"), ("Зз", "z", "z", "зэ"), ("Ии", "ii", "i", "и"),
       ("Йй", "y", "y", "и краткое"), ("Кк", "k", "k", "ка"), ("Лл", "l", "l", "эль"), ("Мм", "m", "m", "эм"), ("Нн", "n", "n", "эн"),
       ("Оо", "o", "o", "о"), ("Пп", "p", "p", "пэ"), ("Рр", "rr", "r", "эр"), ("Сс", "s", "s", "эс"), ("Тт", "t", "t", "тэ"),
       ("Уу", "uu", "u", "у"), ("Фф", "f", "f", "эф"), ("Хх", "x", "kh", "ха"), ("Цц", "ts", "ts", "цэ"), ("Чч", "ch", "ch", "че"),
       ("Шш", "sh", "sh", "ша"), ("Щщ", "shch", "shch", "ща"), ("Ъъ", "silent", "-", "твёрдый знак"), ("Ыы", "eu", "y", "ы"),
       ("Ьь", "silent", "'", "мягкий знак"), ("Ээ", "e_short", "e", "э"), ("Юю", "yu", "yu", "ю"), ("Яя", "ya", "ya", "я")]

_AR = [("ا", "aa", "alif", "ألف"), ("ب", "b", "baa", "باء"), ("ت", "t", "taa", "تاء"), ("ث", "th_soft", "thaa", "ثاء"), ("ج", "j", "jiim", "جيم"),
       ("ح", "hh", "Haa", "حاء"), ("خ", "x", "khaa", "خاء"), ("د", "d", "daal", "دال"), ("ذ", "dh_soft", "dhaal", "ذال"), ("ر", "rr", "raa", "راء"),
       ("ز", "z", "zaay", "زاي"), ("س", "s", "siin", "سين"), ("ش", "sh", "shiin", "شين"), ("ص", "s_emph", "Saad", "صاد"), ("ض", "d_emph", "Daad", "ضاد"),
       ("ط", "t_emph", "Taa", "طاء"), ("ظ", "z_emph", "Zaa", "ظاء"), ("ع", "ain", "ʿayn", "عين"), ("غ", "gh_fric", "ghayn", "غين"), ("ف", "f", "faa", "فاء"),
       ("ق", "q", "qaaf", "قاف"), ("ك", "k", "kaaf", "كاف"), ("ل", "l", "laam", "لام"), ("م", "m", "miim", "ميم"), ("ن", "n", "nuun", "نون"),
       ("ه", "h", "haa", "هاء"), ("و", "w", "waaw", "واو"), ("ي", "y", "yaa", "ياء")]

# Korean: the letter, its sound, romanisation, the syllable the voice says (ㄱ -> 가), its name
_KO = [("ㄱ", "consonant", "g", "g/k", "가", "기역"), ("ㄴ", "consonant", "n", "n", "나", "니은"), ("ㄷ", "consonant", "d", "d/t", "다", "디귿"),
       ("ㄹ", "consonant", "r", "r/l", "라", "리을"), ("ㅁ", "consonant", "m", "m", "마", "미음"), ("ㅂ", "consonant", "b", "b/p", "바", "비읍"),
       ("ㅅ", "consonant", "s", "s", "사", "시옷"), ("ㅇ", "consonant", "ng", "ng (silent at the start)", "아", "이응"), ("ㅈ", "consonant", "j", "j", "자", "지읒"),
       ("ㅊ", "consonant", "chh", "ch", "차", "치읓"), ("ㅋ", "consonant", "kh", "k", "카", "키읔"), ("ㅌ", "consonant", "th", "t", "타", "티읕"),
       ("ㅍ", "consonant", "ph", "p", "파", "피읖"), ("ㅎ", "consonant", "h", "h", "하", "히읗"),
       ("ㅏ", "vowel", "aa", "a", "아", ""), ("ㅑ", "vowel", "ya", "ya", "야", ""), ("ㅓ", "vowel", "eo", "eo", "어", ""), ("ㅕ", "vowel", "yeo", "yeo", "여", ""),
       ("ㅗ", "vowel", "o", "o", "오", ""), ("ㅛ", "vowel", "yo", "yo", "요", ""), ("ㅜ", "vowel", "uu", "u", "우", ""), ("ㅠ", "vowel", "yu", "yu", "유", ""),
       ("ㅡ", "vowel", "eu", "eu", "으", ""), ("ㅣ", "vowel", "ii", "i", "이", "")]
_KO_INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"

_JA_ROWS = [("", "あいうえお"), ("k", "かきくけこ"), ("s", "さしすせそ"), ("t", "たちつてと"), ("n", "なにぬねの"), ("h", "はひふへほ"),
            ("m", "まみむめも"), ("y", "や ゆ よ"), ("r", "らりるれろ"), ("w", "わ   を"), ("n", "ん")]
_JA_VOW = "aiueo"
_JA_SPECIAL = {"し": ("sh", "shi"), "ち": ("ch", "chi"), "つ": ("ts", "tsu"), "ふ": ("f", "fu"), "を": ("w", "o"), "ん": ("n", "n")}
_VKEY = {"a": "a", "i": "ii", "u": "uu", "e": "e", "o": "o"}

# Mandarin: pinyin initials and simple finals, with the usual teaching character
_ZH = [("b", "b", "玻", "bō"), ("p", "ph", "坡", "pō"), ("m", "m", "摸", "mō"), ("f", "f", "佛", "fó"), ("d", "d", "得", "dé"), ("t", "th", "特", "tè"),
       ("n", "n", "讷", "nè"), ("l", "l", "勒", "lè"), ("g", "g", "哥", "gē"), ("k", "kh", "科", "kē"), ("h", "x", "喝", "hē"), ("j", "j", "基", "jī"),
       ("q", "chh", "欺", "qī"), ("x", "sh", "希", "xī"), ("zh", "dd", "知", "zhī"), ("ch", "ch", "蚩", "chī"), ("sh", "ssh", "诗", "shī"), ("r", "r", "日", "rì"),
       ("z", "dz", "资", "zī"), ("c", "ts", "雌", "cí"), ("s", "s", "思", "sī")]
_ZH_FINALS = [("a", "aa", "啊", "ā"), ("o", "o", "喔", "ō"), ("e", "eu", "鹅", "é"), ("i", "ii", "衣", "yī"), ("u", "uu", "乌", "wū"), ("ü", "ue", "迂", "yū")]
# Cantonese: Jyutping initials
_YUE = [("b", "b", "巴", "baa1"), ("p", "ph", "爬", "paa4"), ("m", "m", "媽", "maa1"), ("f", "f", "花", "faa1"), ("d", "d", "打", "daa2"), ("t", "th", "他", "taa1"),
        ("n", "n", "拿", "naa4"), ("l", "l", "啦", "laa1"), ("g", "g", "家", "gaa1"), ("k", "kh", "卡", "kaa1"), ("ng", "ng", "牙", "ngaa4"), ("h", "h", "蝦", "haa1"),
        ("gw", "gw", "瓜", "gwaa1"), ("kw", "kw", "誇", "kwaa1"), ("w", "w", "蛙", "waa1"), ("z", "dz", "渣", "zaa1"), ("c", "ts", "茶", "caa4"), ("s", "s", "沙", "saa1"),
        ("j", "y", "也", "jaa5")]
_YUE_FINALS = [("aa", "aa", "亞", "aa3"), ("i", "ii", "衣", "ji1"), ("u", "uu", "烏", "wu1"), ("e", "e_short", "誒", "e1"), ("o", "o", "柯", "o1"), ("yu", "ue", "於", "jyu1")]


_AR_EXTRA = [("ء", "glottal", "hamza", "همزة"), ("أ", "glottal", "alif hamza", "ألف همزة"), ("إ", "glottal", "alif hamza (below)", "ألف همزة تحت"),
             ("آ", "aa", "alif madda", "ألف مدّ"), ("ؤ", "glottal", "waaw hamza", "واو همزة"), ("ئ", "glottal", "yaa hamza", "ياء همزة"),
             ("ة", "t", "taa marbuuTa", "تاء مربوطة"), ("ى", "aa", "alif maqSuura", "ألف مقصورة")]
_KO_EXTRA = [("ㄲ", "consonant", "tense_k", "kk", "까", "쌍기역"), ("ㄸ", "consonant", "tense_t", "tt", "따", "쌍디귿"), ("ㅃ", "consonant", "tense_p", "pp", "빠", "쌍비읍"),
             ("ㅆ", "consonant", "tense_s", "ss", "싸", "쌍시옷"), ("ㅉ", "consonant", "tense_ch", "jj", "짜", "쌍지읒"),
             ("ㅐ", "vowel", "ae", "ae", "애", ""), ("ㅒ", "vowel", "yae", "yae", "얘", ""), ("ㅔ", "vowel", "e", "e", "에", ""), ("ㅖ", "vowel", "ye", "ye", "예", ""),
             ("ㅘ", "vowel", "wa", "wa", "와", ""), ("ㅙ", "vowel", "wae", "wae", "왜", ""), ("ㅚ", "vowel", "we", "oe", "외", ""), ("ㅝ", "vowel", "wo", "wo", "워", ""),
             ("ㅞ", "vowel", "we", "we", "웨", ""), ("ㅟ", "vowel", "wi", "wi", "위", ""), ("ㅢ", "vowel", "ui", "ui", "의", "")]
_JA_DAKU = [("g", "がぎぐげご"), ("z", "ざじずぜぞ"), ("d", "だぢづでど"), ("b", "ばびぶべぼ"), ("p", "ぱぴぷぺぽ")]
_JA_DAKU_SPECIAL = {"じ": ("j", "ji"), "ぢ": ("j", "ji"), "づ": ("dz", "zu")}
_ZH_MORE = [("y", "y", "衣", "yī"), ("w", "w", "乌", "wū"), ("ai", "ai", "哀", "āi"), ("ei", "e", "诶", "ēi"), ("ao", "au", "熬", "áo"), ("ou", "o", "欧", "ōu"),
            ("an", "an", "安", "ān"), ("en", "en", "恩", "ēn"), ("ang", "ang", "昂", "áng"), ("eng", "eng", "亨", "hēng"), ("ong", "ong", "轰", "hōng"),
            ("er", "er", "儿", "ér"), ("ia", "ya", "呀", "yā"), ("ie", "ye", "耶", "yē"), ("iao", "yau", "腰", "yāo"), ("iu", "yo", "优", "yōu"),
            ("ian", "yen", "烟", "yān"), ("in", "in", "因", "yīn"), ("iang", "yang", "央", "yāng"), ("ing", "ing", "英", "yīng"), ("iong", "yong", "雍", "yōng"),
            ("ua", "wa", "蛙", "wā"), ("uo", "wo", "窝", "wō"), ("uai", "wai", "歪", "wāi"), ("ui", "wei", "威", "wēi"), ("uan", "wan", "弯", "wān"),
            ("un", "wen", "温", "wēn"), ("uang", "wang", "汪", "wāng"), ("ueng", "weng", "翁", "wēng"), ("üe", "yue", "约", "yuē"), ("üan", "yuan", "冤", "yuān"),
            ("ün", "yun", "晕", "yūn")]
_YUE_MORE = [("aai", "ai", "街", "gaai1"), ("aau", "au", "交", "gaau1"), ("ai", "ai_short", "雞", "gai1"), ("au", "au_short", "溝", "kau1"),
             ("aam", "aam", "衫", "saam1"), ("aan", "aan", "山", "saan1"), ("aang", "aang", "橙", "caang2"), ("am", "am_yue", "心", "sam1"),
             ("an", "an", "新", "san1"), ("ang", "ang", "生", "sang1"), ("ei", "e", "四", "sei3"), ("eng", "eng", "鏡", "geng3"),
             ("oi", "oi", "愛", "oi3"), ("on", "on", "安", "on1"), ("ong", "ong", "江", "gong1"), ("ou", "o", "好", "hou2"),
             ("oe", "oe", "靴", "hoe1"), ("eoi", "eoi", "水", "seoi2"), ("eon", "eon", "春", "ceon1"), ("oeng", "oeng", "香", "hoeng1"),
             ("ui", "ui", "杯", "bui1"), ("un", "un", "碗", "wun2"), ("ung", "ung", "東", "dung1"), ("yun", "yun", "完", "jyun4"),
             ("m", "m", "唔", "m4"), ("ng", "ng", "五", "ng5")]


def _rows(code: str) -> list[tuple]:
    """(char, group, sound, roman, say[, name]) in teaching order."""
    if code in _BLOCK:
        return _indic(code)
    if code in ("en", "fr", "es", "de", "tr"):
        extra = {"fr": "É:e:é È:e_short:è Ê:e_short:ê Ë:e_short:ë À:a:à Â:aa:â Æ:e_short:æ Ç:s:ç Î:ii:î Ï:ii:ï Ô:o:ô Œ:oe:œ Ù:ue:ù Û:ue:û Ü:ue:ü Ÿ:ii:ÿ",
                 "de": "Ä:e_short:ä Ö:oe:ö Ü:ue:ü ß:s:ss",
                 "es": "Á:aa:á É:e:é Í:ii:í Ó:o:ó Ú:uu:ú Ü:w:ü"}.get(code, "")
        return [(c, g, _SOUNDS_FIX.get(s, s), r, say) for c, g, s, r, say in _latin({"en": _EN, "fr": _FR, "es": _ES, "de": _DE, "tr": _TR}[code], extra, code == "tr")]
    if code == "ru":
        return [(c, "letter", s, r, c[1], name) for c, s, r, name in _RU]
    if code == "ar":
        return [(c, "letter", s, r, name, name) for c, s, r, name in _AR] + [(c, "extra", s, r, name, name) for c, s, r, name in _AR_EXTRA]
    if code == "ko":
        return [(c, g, s, r, say, name) for c, g, s, r, say, name in _KO] + [(c, "extra", s, r, say, name) for c, g, s, r, say, name in _KO_EXTRA]
    if code == "ja":
        out = []
        for cons, row in _JA_ROWS:
            for k, ch in enumerate(row):
                if ch == " ":
                    continue
                v = _JA_VOW[k] if cons != "n" or ch != "ん" else ""
                sound, roman = _JA_SPECIAL.get(ch, (cons or _VKEY[v], (cons + v) if ch != "ん" else "n"))
                out.append((ch, "syllable", sound, roman, ch))
        hira = [(c, s, r) for c, _, s, r, _ in out]
        for cons, row in _JA_DAKU:  # が ぎ ... ぱ: the same kana with two dots or a circle
            for k, ch in enumerate(row):
                v = _JA_VOW[k]
                sound, roman = _JA_DAKU_SPECIAL.get(ch, (cons, cons + v))
                out.append((ch, "voiced", sound, roman, ch))
        for c, sound, roman in hira:  # katakana: the same sounds, for words from other languages
            kata = chr(ord(c) + 0x60)
            out.append((kata, "katakana", sound, roman, kata))
        return out
    if code in ("zh", "yue"):
        ini, fin = (_ZH, _ZH_FINALS) if code == "zh" else (_YUE, _YUE_FINALS)
        more = _ZH_MORE if code == "zh" else _YUE_MORE
        return ([(f"{p} {ch}", "initial", s, r, ch, p) for p, s, ch, r in ini] + [(f"{p} {ch}", "final", s, r, ch, p) for p, s, ch, r in fin]
                + [(f"{p} {ch}", "final", s, r, ch, p) for p, s, ch, r in more])
    raise KeyError(code)


# --- example words from Melo's own vocabulary --------------------------------------------------------------
def _starts(code: str, char: str, roman: str, text: str, wroman: str | None) -> bool:
    if not text:
        return False
    first = text[0]
    if code in _BLOCK:
        return first == char
    if code in ("en", "fr", "es", "de", "tr", "ru"):
        low = char[-1] if len(char) == 2 else char.lower()
        return first.lower() == low if code != "tr" else first.replace("İ", "i").replace("I", "ı").lower() == low
    if code == "ar":
        return {"أ": "ا", "إ": "ا", "آ": "ا"}.get(first, first) == char
    if code == "ko":
        if "가" <= first <= "힣":
            return _KO_INITIALS[(ord(first) - 0xAC00) // 588] == char if char in _KO_INITIALS else \
                (ord(first) - 0xAC00) % 588 // 28 == "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".index(char) and _KO_INITIALS[(ord(first) - 0xAC00) // 588] == "ㅇ"
        return False
    if code == "ja":
        return first == char
    if code in ("zh", "yue") and wroman:
        r = wroman.lower().split()[0]
        p = char.split()[0]
        inits = sorted({x[0] for x in (_ZH if code == "zh" else _YUE)}, key=len, reverse=True)
        got = next((x for x in inits if r.startswith(x)), "")
        return got == p
    return False


def _example(code: str, char: str, roman: str) -> dict | None:
    from .content import WORDS
    from .phrases import ITEMS

    pool = list(WORDS.get(code, {}).values()) + [w for w in ITEMS.get(code, {}).values() if " " not in w.text.strip() and len(w.text) <= 12]
    for w in pool:
        if _starts(code, char, roman, w.text, w.roman):
            return {"word": w.text, "roman": w.roman, "emoji": w.emoji, "meaning": w.id.removeprefix("p_").replace("_", " ")}
    return None


@lru_cache(maxsize=None)
def alphabet(code: str) -> tuple[Letter, ...]:
    out = []
    for row in _rows(code):
        SOUNDS.setdefault(row[2], row[3])
    for i, row in enumerate(r for r in _rows(code)):
        char, group, sound, roman, say = row[:5]
        name = row[5] if len(row) > 5 else ""
        out.append(Letter(i, char, group, sound, roman, say, name, _example(code, char, roman)))
    return tuple(out)


def is_item(code: str, item: str) -> bool:
    m = re.fullmatch(r"abc(\d{2,3})", item)
    return bool(m) and code in TARGETS and int(m.group(1)) < len(alphabet(code))


def say_text(code: str, item: str) -> str:
    return alphabet(code)[int(item[3:])].say


def item_ids(code: str) -> list[str]:
    return [item_id(x.i) for x in alphabet(code)]


def compare(codes: list[str]) -> list[dict]:
    """Rows by sound: for each sound key, the letters that make it in each language (in the order of the
    first language, then sounds only the others have)."""
    order: list[str] = []
    cells: dict[str, dict[str, list[dict]]] = {}
    for code in codes:
        for x in alphabet(code):
            if x.sound == "silent":
                continue
            if x.sound not in cells:
                order.append(x.sound)
                cells[x.sound] = {}
            cells[x.sound].setdefault(code, []).append({"char": x.char, "roman": x.roman, "item": item_id(x.i), "say": x.say})
    return [{"sound": s, "hint": SOUNDS.get(s, s), "cells": cells[s]} for s in order]
