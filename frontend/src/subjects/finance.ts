// Money & finance for children, built to last a lifetime: what money is, needs and wants, saving, spending
// wisely, earning and business, sharing, staying safe from scams, borrowing, interest and how money grows,
// and money through every stage of life. Real-life situations first, numbers with worked steps.
import type { Text } from "../i18n";
import { numChoices, pick, ri, shuffle, T, type Card, type Exercise, type Rng } from "./maths";
import { subSteps } from "./worked";

export type FinStrand = "basics" | "save" | "earn" | "smart" | "grow";
export const FIN_STRANDS: { id: FinStrand; icon: string; title: Text }[] = [
  { id: "basics", icon: "🪙", title: T("Money basics", "पैसे की बुनियाद", "Paise ki basics") },
  { id: "save", icon: "🐷", title: T("Saving & spending", "बचत और ख़र्च", "Bachat aur kharch") },
  { id: "earn", icon: "💼", title: T("Earning & business", "कमाई और व्यापार", "Kamaai aur business") },
  { id: "smart", icon: "🛡️", title: T("Smart & safe with money", "पैसे में समझदारी और सुरक्षा", "Paise mein samajhdaari aur safety") },
  { id: "grow", icon: "📈", title: T("Growing money, for life", "पैसा बढ़ाना, जीवन भर", "Paisa badhana, zindagi bhar") },
];
export interface FinTopic { id: string; strand: FinStrand; icon: string; title: Text; grades: [number, number]; cards: Card[]; make: (d: number, rng: Rng) => Exercise }

type Q = [string, string, string[], string, boolean?];
const ask = (rng: Rng, pool: Q[]): Exercise => {
  const [p, a, o, why, apply] = pick(rng, pool);
  return { prompt: T(p), choices: shuffle(rng, [a, ...o]), answer: a, why: T(why), apply: !!apply };
};
const J = { type: "shloka" as const, id: "jalabindu" };

const whyMoney: FinTopic = {
  id: "why_money", strand: "basics", icon: "🔄", title: T("Why we have money", "पैसा क्यों है", "Paisa kyun hai"), grades: [1, 3],
  cards: [{ title: T("Before money: swapping"), say: T("Long ago people SWAPPED (barter): 'I give you 5 mangoes for your pot.' But what if the potter didn't want mangoes? Money solved it: everyone accepts it, so you can sell mangoes to anyone and buy a pot from anyone. Money is a promise of value.", "बहुत पहले लोग अदला-बदली करते थे: 'मैं 5 आम दूँगा, तुम घड़ा दो।' पर कुम्हार को आम न चाहिए तो? पैसे ने हल किया: सब इसे लेते हैं, तो आम किसी को भी बेचो, घड़ा किसी से भी ख़रीदो।", "Bahut pehle log adla-badli karte the: 'Main 5 aam doonga, tum ghada do.' Par kumhaar ko aam na chahiye toh? Paise ne solve kiya: sab ise lete hain, toh aam kisi ko bhi becho, ghada kisi se bhi khareedo.") }],
  make: (_d, rng) => ask(rng, [
    ["What was swapping things without money called?", "barter", ["banking", "saving"], "Barter means trading one thing directly for another."],
    ["Why is money easier than swapping?", "everyone accepts it", ["it is shiny", "it is heavy"], "With money you don't need to find someone who wants exactly what you have."],
    ["A farmer has rice and needs shoes, but the shoemaker doesn't want rice. What helps?", "sell rice for money, then buy shoes", ["throw the rice away", "make shoes from rice"], "Money connects all buyers and sellers.", true],
  ]),
};

const coins: FinTopic = {
  id: "coins_notes", strand: "basics", icon: "💵", title: T("Coins and notes", "सिक्के और नोट", "Sikke aur note"), grades: [1, 3],
  cards: [{ title: T("Different values"), say: T("Indian money is the rupee (₹). Coins: ₹1, ₹2, ₹5, ₹10, ₹20. Notes: ₹10, ₹20, ₹50, ₹100, ₹200, ₹500. One ₹10 note is worth the same as ten ₹1 coins: it's the VALUE that matters, not how many pieces!", "भारतीय पैसा रुपया (₹) है। सिक्के: ₹1, ₹2, ₹5, ₹10, ₹20। नोट: ₹10 से ₹500। एक ₹10 का नोट दस ₹1 सिक्कों के बराबर: गिनती नहीं, क़ीमत मायने रखती है!", "Indian paisa rupaya (₹) hai. Sikke: ₹1, ₹2, ₹5, ₹10, ₹20. Note: ₹10 se ₹500. Ek ₹10 ka note das ₹1 sikkon ke barabar: ginti nahi, keemat maayne rakhti hai!"), visual: { type: "coins", coins: [10, 5, 2, 1] } }],
  make: (d, rng) => {
    const note = pick(rng, d <= 2 ? [10, 20] : [50, 100, 200]), coin = pick(rng, [1, 2, 5, 10].filter((c) => c < note && note % c === 0));
    return { prompt: T(`How many ₹${coin} coins make one ₹${note} note?`), choices: numChoices(rng, note / coin, 3), answer: String(note / coin), numeric: true,
      why: T(`₹${note} ÷ ₹${coin} = ${note / coin} coins.`), steps: [T(`Count up in ${coin}s until you reach ${note}.`), T(`${note} ÷ ${coin} = ${note / coin}.`)], apply: true };
  },
};

const needsWants: FinTopic = {
  id: "needs_wants", strand: "basics", icon: "🍚", title: T("Needs and wants", "ज़रूरतें और इच्छाएँ", "Zaroorat aur ichha"), grades: [1, 4],
  cards: [{ title: T("Need it or want it?"), say: T("A NEED is something you can't live well without: food, water, a home, clothes, medicine, school. A WANT is nice to have: toys, sweets, games, new shoes when yours still fit. Smart families pay for needs FIRST, then some wants, and save the rest.", "ज़रूरत वह है जिसके बिना अच्छे से नहीं जी सकते: खाना, पानी, घर, कपड़े, दवा, स्कूल। इच्छा अच्छी लगने वाली: खिलौने, मिठाई, गेम। समझदार परिवार पहले ज़रूरतें, फिर कुछ इच्छाएँ, बाक़ी बचत।", "Zaroorat woh hai jiske bina achhe se nahi jee sakte: khaana, paani, ghar, kapde, dawa, school. Ichha achhi lagne wali: khilone, mithai, game. Samajhdaar parivaar pehle zaroorat, phir kuch ichha, baaki bachat.") }],
  make: (_d, rng) => ask(rng, [
    ["Is a school bag for a student a need or a want?", "need", ["want"], "You need it to carry books for school."],
    ["Is a third toy car a need or a want?", "want", ["need"], "Nice to have, but you can live well without it."],
    ["Is drinking water a need or a want?", "need", ["want"], "Water is essential for life."],
    ["You have ₹50. You need a notebook (₹30) and want a chocolate (₹40). What is wise?", "Buy the notebook, save the rest", ["Buy the chocolate only", "Borrow to buy both"], "Needs first. ₹50 − ₹30 = ₹20 left to save for a want later.", true],
    ["Your shoes are too small and hurt. Are new shoes a need or a want?", "need", ["want"], "Shoes that fit protect your feet: a need. (A fancy extra pair would be a want.)", true],
  ]),
};

const compare: FinTopic = {
  id: "best_buy", strand: "basics", icon: "🏷️", title: T("Comparing prices", "क़ीमतों की तुलना", "Keemat compare karna"), grades: [3, 5],
  cards: [{ title: T("Price for ONE"), say: T("A bigger pack isn't always cheaper. Find the price for ONE: 4 pencils for ₹20 = ₹5 each; 6 pencils for ₹24 = ₹4 each. The second is the better buy, IF you need that many!", "बड़ा पैकेट हमेशा सस्ता नहीं। एक की क़ीमत निकालो: 4 पेंसिल ₹20 = ₹5 एक; 6 पेंसिल ₹24 = ₹4 एक। दूसरा बेहतर, अगर उतनी चाहिए!", "Bada packet hamesha sasta nahi. Ek ki keemat nikalo: 4 pencil ₹20 = ₹5 ek; 6 pencil ₹24 = ₹4 ek. Doosra better, agar utni chahiye!") }],
  make: (_d, rng) => {
    const a = ri(rng, 2, 6), pa = ri(rng, 3, 9), b = a + ri(rng, 1, 4); let pb = ri(rng, 3, 9); if (pb === pa) pb += 1;
    const A = `${a} for ₹${a * pa}`, B = `${b} for ₹${b * pb}`, best = pa < pb ? A : B;
    return { prompt: T(`Which pack of 🍪 is the better buy: ${A} or ${B}?`), choices: [A, B], answer: best, apply: true,
      why: T(`Price for one: ${A} → ₹${pa} each; ${B} → ₹${pb} each. ₹${Math.min(pa, pb)} is less.`),
      steps: [T("Find the price of ONE cookie in each pack."), T(`${a * pa} ÷ ${a} = ₹${pa} each.`), T(`${b * pb} ÷ ${b} = ₹${pb} each.`), T(`Cheaper each: ${best}. (Only a good buy if you will really eat them all!)`)] };
  },
};

const saving: FinTopic = {
  id: "saving_goal", strand: "save", icon: "🐷", title: T("Saving for a goal", "लक्ष्य के लिए बचत", "Goal ke liye bachat"), grades: [1, 5],
  cards: [{ title: T("Drop by drop"), say: T("Want something that costs more than you have? SAVE a little each week. Saving ₹10 a week, in 10 weeks you have ₹100! Write your goal, put a picture on your piggy bank, and watch it fill. Grown-ups save the same way for a house or for old age.", "जो चीज़ तुम्हारे पैसों से महँगी है? हर हफ़्ते थोड़ा बचाओ। हर हफ़्ते ₹10, 10 हफ़्ते में ₹100! लक्ष्य लिखो, गुल्लक पर चित्र लगाओ। बड़े भी घर या बुढ़ापे के लिए ऐसे ही बचाते हैं।", "Jo cheez tumhare paison se mehngi hai? Har hafte thoda bachao. Har hafte ₹10, 10 hafte mein ₹100! Goal likho, gullak pe picture lagao. Bade bhi ghar ya budhaape ke liye aise hi bachate hain."), visual: J }],
  make: (d, rng) => {
    const per = pick(rng, d <= 2 ? [5, 10] : [10, 20, 25, 50]), weeks = ri(rng, 2, d <= 2 ? 5 : 12), goal = per * weeks, have = d >= 4 ? per * ri(rng, 1, weeks - 1) : 0;
    const need = (goal - have) / per;
    return { prompt: T(have ? `A toy costs ₹${goal}. You have ₹${have} and save ₹${per} a week. How many more weeks?` : `A toy costs ₹${goal}. You save ₹${per} every week. How many weeks until you can buy it?`),
      choices: numChoices(rng, need, 2), answer: String(need), numeric: true, apply: true,
      why: T(`${have ? `Still needed: ₹${goal} − ₹${have} = ₹${goal - have}. ` : ""}₹${goal - have} ÷ ₹${per} = ${need} weeks.`),
      steps: [...(have ? [T(`How much is still missing? ₹${goal} − ₹${have} = ₹${goal - have}.`)] : []), T(`Each week adds ₹${per}.`), T(`Count in ${per}s to ${goal - have}: ${Array.from({ length: need }, (_, i) => (i + 1) * per).join(", ")}.`), T(`That's ${need} weeks.`)] };
  },
};

const jars: FinTopic = {
  id: "three_jars", strand: "save", icon: "🫙", title: T("Spend, save, share jars", "ख़र्च, बचत, दान के डिब्बे", "Kharch, bachat, daan ke dabbe"), grades: [2, 5],
  cards: [{ title: T("Split every rupee"), say: T("Keep three jars. SPEND jar: for small things now. SAVE jar: for big goals later. SHARE jar: to help others (dāna). A simple rule: half to spend, a bit less than half to save, a little to share. Grown-ups make a BUDGET the same way for their salary.", "तीन डिब्बे रखो। ख़र्च: अभी की छोटी चीज़ें। बचत: बाद के बड़े लक्ष्य। दान: दूसरों की मदद। आसान नियम: आधा ख़र्च, आधे से थोड़ा कम बचत, थोड़ा दान। बड़े अपनी तनख़्वाह का बजट ऐसे ही बनाते हैं।", "Teen dabbe rakho. Kharch: abhi ki chhoti cheezein. Bachat: baad ke bade goal. Daan: doosron ki madad. Easy rule: aadha kharch, aadhe se thoda kam bachat, thoda daan. Bade apni salary ka budget aise hi banate hain.") }],
  make: (d, rng) => {
    const total = pick(rng, d <= 2 ? [20, 40, 100] : [100, 200, 500, 1000]), save = total * 0.4, share = total * 0.1, spend = total - save - share;
    const q = pick(rng, ["spend", "save", "share"] as const), ans = { spend, save, share }[q];
    return { prompt: T(`You get ₹${total}. Half goes to SPEND, 4 parts of 10 to SAVE and 1 part of 10 to SHARE. How much goes to ${q.toUpperCase()}?`),
      choices: numChoices(rng, ans, total / 10), answer: String(ans), numeric: true, apply: true,
      why: T(`Spend ₹${spend} + save ₹${save} + share ₹${share} = ₹${total}.`),
      steps: [T(`1 part of 10 = ₹${total} ÷ 10 = ₹${total / 10}.`), T(`Save = 4 parts = ₹${save}. Share = 1 part = ₹${share}.`), T(`Spend = half = ₹${spend}.`), T(`${q}: ₹${ans}.`)] };
  },
};

const wiseSpend: FinTopic = {
  id: "spend_wisely", strand: "save", icon: "🛒", title: T("Spending wisely", "समझदारी से ख़र्च", "Samajhdaari se kharch"), grades: [2, 5],
  cards: [{ title: T("Wait, compare, then decide"), say: T("Before buying: 1. Do I NEED it, or just want it right now? 2. WAIT a day: do I still want it? 3. COMPARE prices. 4. Can I pay without borrowing? Adverts are made to make you want things: think for yourself!", "ख़रीदने से पहले: 1. ज़रूरत है या बस अभी इच्छा? 2. एक दिन रुको: क्या अब भी चाहिए? 3. क़ीमत मिलाओ। 4. बिना उधार के दे सकते हो? विज्ञापन इच्छा जगाने के लिए बनते हैं: ख़ुद सोचो!", "Khareedne se pehle: 1. Zaroorat hai ya bas abhi ichha? 2. Ek din ruko: kya ab bhi chahiye? 3. Keemat milao. 4. Bina udhaar ke de sakte ho? Advertisement ichha jagaane ke liye bante hain: khud socho!") }],
  make: (_d, rng) => ask(rng, [
    ["You see an advert for a new toy and suddenly want it badly. What's smart?", "Wait a day and think if you really need it", ["Buy it immediately", "Cry until someone buys it"], "Adverts create sudden wants. Waiting shows whether the want is real.", true],
    ["A shop says 'Buy 2, get 1 free' on biscuits you don't like. Is it a good deal for you?", "No, you'd waste money on things you won't use", ["Yes, free is always good", "Yes, buy 10"], "A deal is only good if you need the thing.", true],
    ["Your friend has expensive shoes. You feel you must have them too. What's wise?", "Your shoes are fine; you don't need to copy", ["Spend all your savings", "Borrow money"], "Buying to impress others empties your pocket and doesn't make you happier.", true],
  ]),
};

const earning: FinTopic = {
  id: "earning", strand: "earn", icon: "👩‍🌾", title: T("How people earn money", "लोग पैसे कैसे कमाते हैं", "Log paise kaise kamaate hain"), grades: [1, 3],
  cards: [{ title: T("Money comes from work"), say: T("Money doesn't grow on trees! Grown-ups EARN money by doing work that helps others: a farmer grows food, a doctor heals, a teacher teaches, a driver carries people. The more useful your skills, the more you can earn. That's why learning matters!", "पैसा पेड़ पर नहीं उगता! बड़े ऐसा काम करके कमाते हैं जो दूसरों की मदद करे: किसान अनाज उगाता, डॉक्टर इलाज करता, शिक्षक पढ़ाता। जितने उपयोगी कौशल, उतनी कमाई। इसीलिए सीखना ज़रूरी है!", "Paisa ped pe nahi ugta! Bade aisa kaam karke kamaate hain jo doosron ki madad kare: kisaan anaaj ugaata, doctor ilaaj karta, teacher padhata. Jitne useful skills, utni kamaai. Isiliye seekhna zaroori hai!") }],
  make: (d, rng) => {
    if (d >= 3 && rng() < 0.5) {
      const rate = pick(rng, [50, 100, 150]), hours = ri(rng, 2, 8);
      return { prompt: T(`A gardener earns ₹${rate} an hour and works ${hours} hours. How much does she earn?`), choices: numChoices(rng, rate * hours, rate), answer: String(rate * hours), numeric: true, apply: true,
        why: T(`₹${rate} × ${hours} = ₹${rate * hours}.`), steps: [T(`Each hour adds ₹${rate}.`), T(`${hours} hours × ₹${rate} = ₹${rate * hours}.`)] };
    }
    return ask(rng, [
      ["Where does a family's money mostly come from?", "work done by the grown-ups", ["the money tree", "the TV"], "People earn by doing useful work."],
      ["Which helps you earn more when you grow up?", "learning useful skills", ["watching more videos", "sleeping late"], "Skills (reading, maths, a craft, a trade) make your work valuable.", true],
      ["You help a neighbour carry shopping and they offer ₹10. What is this?", "earning by helping", ["a gift for nothing", "borrowing"], "You did useful work, so you earned it.", true],
    ]);
  },
};

const business: FinTopic = {
  id: "lemonade_business", strand: "earn", icon: "🍋", title: T("A little business: profit", "छोटा व्यापार: मुनाफ़ा", "Chhota business: profit"), grades: [3, 5],
  cards: [{ title: T("Sales minus costs"), say: T("Running a lemonade stall: you SPEND money on lemons, sugar and cups (COSTS), and you GET money from customers (SALES). PROFIT = sales − costs. If costs are more than sales, it's a LOSS. Every business, small or big, works like this.", "नींबू पानी की दुकान: नींबू, चीनी, कप पर पैसे ख़र्च (लागत), ग्राहकों से पैसे मिलते (बिक्री)। मुनाफ़ा = बिक्री − लागत। लागत ज़्यादा हो तो घाटा। हर व्यापार ऐसे ही चलता है।", "Nimbu paani ki dukaan: nimbu, cheeni, cup pe paise kharch (cost), customers se paise milte (sales). Profit = sales − cost. Cost zyada ho toh loss. Har business aise hi chalta hai.") }],
  make: (d, rng) => {
    const price = pick(rng, [5, 10, 15, 20]), cups = ri(rng, 5, d <= 3 ? 20 : 50), cost = ri(rng, 20, price * cups - 5);
    const sales = price * cups, profit = sales - cost;
    return { prompt: T(`You sell ${cups} cups of lemonade at ₹${price} each. Lemons, sugar and cups cost ₹${cost}. What is your profit?`),
      choices: numChoices(rng, profit, 10), answer: String(profit), numeric: true, apply: true,
      why: T(`Sales ₹${price} × ${cups} = ₹${sales}. Profit = ₹${sales} − ₹${cost} = ₹${profit}.`),
      steps: [T(`Step 1, sales: ${cups} cups × ₹${price} = ₹${sales}.`), T(`Step 2, profit = sales − costs.`), ...subSteps(sales, cost), T(`Profit: ₹${profit}.`)] };
  },
};

const sharing: FinTopic = {
  id: "sharing_dana", strand: "earn", icon: "🤲", title: T("Sharing and giving (dāna)", "बाँटना और दान", "Baantna aur daan"), grades: [1, 5],
  cards: [{ title: T("Giving makes money meaningful"), say: T("The Īśa Upaniṣad says: enjoy by sharing, and don't be greedy. Giving a part of what you have, money, food, time or help, to those in need is called DĀNA. It makes communities strong and makes the giver happy too.", "ईश उपनिषद कहता है: बाँटकर भोगो, लालच मत करो। जो है उसका एक हिस्सा, पैसा, खाना, समय या मदद, ज़रूरतमंद को देना दान है। इससे समाज मज़बूत और देने वाला भी ख़ुश होता है।", "Isha Upanishad kehta hai: baant ke bhogo, laalach mat karo. Jo hai uska ek hissa, paisa, khaana, time ya madad, zaroorat-mand ko dena DAAN hai. Isse samaaj mazboot aur dene wala bhi khush hota hai."), visual: { type: "shloka", id: "isha_vasyam" } }],
  make: (_d, rng) => ask(rng, [
    ["Your share jar has ₹30. What is a good use?", "Buy notebooks for a child who needs them", ["Buy yourself sweets", "Lose it"], "Sharing helps someone in need: that's dāna.", true],
    ["You have no money to give. Can you still share?", "Yes: time, help, toys or kind words", ["No, only money counts", "No, sharing is for adults"], "Giving time and help is dāna too.", true],
    ["Why give a little even when you have only a little?", "It builds a kind habit and helps others", ["It makes you poor", "It's a rule for rich people only"], "Small, regular giving, like saving, grows into a big difference."],
  ]),
};

const safety: FinTopic = {
  id: "money_safety", strand: "smart", icon: "🔐", title: T("Staying safe from tricks", "धोखे से बचना", "Dhokhe se bachna"), grades: [2, 5],
  cards: [{ title: T("Secret numbers stay secret"), say: T("A PIN, a password or an OTP (the code that comes by SMS) is like the key to the family's money. NEVER tell it to anyone: not on the phone, not in a message, not to a 'bank officer' or a 'prize' caller. Real banks never ask for it. If someone asks, tell a grown-up you trust at once.", "PIN, पासवर्ड या OTP (SMS से आने वाला कोड) परिवार के पैसे की चाबी है। कभी किसी को मत बताओ: फ़ोन पर, मैसेज में, 'बैंक अधिकारी' या 'इनाम' वाले को भी नहीं। असली बैंक कभी नहीं पूछते। कोई पूछे तो तुरंत भरोसेमंद बड़े को बताओ।", "PIN, password ya OTP (SMS se aane wala code) parivaar ke paise ki chaabi hai. KABHI kisi ko mat batao: phone pe, message mein, 'bank officer' ya 'prize' wale ko bhi nahi. Asli bank kabhi nahi poochhte. Koi pooche toh turant bharosemand bade ko batao.") }],
  make: (_d, rng) => ask(rng, [
    ["A caller says 'You won a prize! Tell me the OTP on your mother's phone.' What do you do?", "Don't tell; hang up and tell a parent", ["Read out the OTP", "Ask for a bigger prize"], "OTPs unlock money. Real prizes never need your OTP: it's a trick.", true],
    ["Who should know your family's bank PIN?", "only the account holder", ["any caller who says they're from the bank", "your friends"], "A PIN is secret. Banks never ask for it.", true],
    ["A game asks you to enter a card number to get free coins. What's safe?", "Close it and ask a grown-up", ["Type in the card number", "Share it with friends"], "Free offers asking for card numbers are often scams.", true],
    ["Someone online you don't know asks for money for a 'sad story'. What do you do?", "Don't send; tell a trusted adult", ["Send all your savings", "Give them your address"], "Strangers online can trick people. Check with an adult first.", true],
  ]),
};

const borrowing: FinTopic = {
  id: "borrowing", strand: "smart", icon: "🤝", title: T("Borrowing and paying back", "उधार और वापसी", "Udhaar aur wapsi"), grades: [3, 5],
  cards: [{ title: T("Borrowed money must come back, often with extra"), say: T("When you BORROW, you promise to give it back. Banks lend money too, but they charge INTEREST: you pay back MORE than you borrowed. Borrowing for wants can trap people in debt, so it's best to save first and borrow only for big needs, like a house or education, with a clear plan to repay.", "उधार लेने का मतलब लौटाने का वादा। बैंक भी उधार देते हैं, पर ब्याज लेते हैं: लिए से ज़्यादा लौटाना पड़ता है। इच्छाओं के लिए उधार क़र्ज़ में फँसा सकता है, तो पहले बचाओ और सिर्फ़ बड़ी ज़रूरतों के लिए, साफ़ योजना से उधार लो।", "Udhaar lene ka matlab lautaane ka vaada. Bank bhi udhaar dete hain, par interest lete hain: liye se zyada lautaana padta hai. Ichhaon ke liye udhaar karz mein phansa sakta hai, toh pehle bachao aur sirf badi zaroorat ke liye, saaf plan se udhaar lo.") }],
  make: (_d, rng) => {
    if (rng() < 0.5) {
      const loan = pick(rng, [100, 200, 500, 1000]), rate = pick(rng, [5, 10, 20]), extra = loan * rate / 100;
      return { prompt: T(`You borrow ₹${loan} and must pay ${rate}% interest. How much do you pay back in total?`), choices: numChoices(rng, loan + extra, extra), answer: String(loan + extra), numeric: true, apply: true,
        why: T(`${rate}% of ₹${loan} = ₹${extra}. Total: ₹${loan} + ₹${extra} = ₹${loan + extra}.`),
        steps: [T(`${rate}% means ${rate} out of every 100.`), T(`₹${loan} has ${loan / 100} hundred${loan > 100 ? "s" : ""}: ${loan / 100} × ${rate} = ₹${extra} interest.`), T(`Pay back ₹${loan} + ₹${extra} = ₹${loan + extra}.`)] };
    }
    return ask(rng, [
      ["You borrowed a friend's pencil box. What's right?", "Return it on time, in good condition", ["Keep it", "Return it broken"], "Borrowing is a promise: keeping it builds trust.", true],
      ["Why is borrowing to buy a want risky?", "You pay back more and may get into debt", ["Because it's free", "Because shops close"], "Interest makes it cost more, and debts can pile up.", true],
    ]);
  },
};

const interest: FinTopic = {
  id: "bank_interest", strand: "grow", icon: "🏦", title: T("Banks and interest", "बैंक और ब्याज", "Bank aur interest"), grades: [3, 5],
  cards: [{ title: T("Money that earns money"), say: T("A bank keeps money SAFE and pays you a little extra, called INTEREST, for keeping it there (the bank lends it to others). Put ₹1000 in at 5% a year, and after a year you have ₹1050, without doing anything!", "बैंक पैसा सुरक्षित रखता है और रखने के लिए थोड़ा अतिरिक्त देता है, जिसे ब्याज कहते हैं। ₹1000 पर 5% सालाना, एक साल बाद ₹1050, बिना कुछ किए!", "Bank paisa safe rakhta hai aur rakhne ke liye thoda extra deta hai, jise INTEREST kehte hain. ₹1000 pe 5% saal ka, ek saal baad ₹1050, bina kuch kiye!") }],
  make: (d, rng) => {
    const p = pick(rng, [100, 200, 500, 1000, 2000]), r = pick(rng, [5, 10]), y = d >= 4 ? ri(rng, 2, 3) : 1, i = p * r / 100 * y;
    return { prompt: T(`You keep ₹${p} in a bank at ${r}% a year (simple interest). How much interest after ${y} year${y > 1 ? "s" : ""}?`),
      choices: numChoices(rng, i, Math.max(5, i / 2)), answer: String(i), numeric: true, apply: true,
      why: T(`${r}% of ₹${p} = ₹${p * r / 100} a year × ${y} = ₹${i}.`),
      steps: [T(`${r}% of ₹${p}: (₹${p} ÷ 100) × ${r} = ₹${p * r / 100} each year.`), T(`For ${y} year${y > 1 ? "s" : ""}: ₹${p * r / 100} × ${y} = ₹${i}.`)] };
  },
};

const compound: FinTopic = {
  id: "compound_growth", strand: "grow", icon: "🌳", title: T("Growth on growth (compounding)", "चक्रवृद्धि: बढ़त पर बढ़त", "Compounding: badhat pe badhat"), grades: [4, 5],
  cards: [
    { title: T("A snowball of money"), say: T("With COMPOUND interest, next year's interest is paid on the money AND last year's interest: growth on growth, like a snowball rolling and getting bigger. ₹100 at 10%: 110, then 121, then 133… The earlier you start saving, the bigger it grows. That's why saving young matters!", "चक्रवृद्धि ब्याज में अगले साल ब्याज पैसे और पिछले ब्याज, दोनों पर मिलता है: बढ़त पर बढ़त, लुढ़कती बर्फ़ की गेंद जैसी। ₹100 पर 10%: 110, 121, 133… जितनी जल्दी बचत शुरू, उतनी बड़ी बढ़त!", "Compound interest mein agle saal interest paise aur pichhle interest, dono pe milta hai: badhat pe badhat, ludhakti barf ki gend jaisi. ₹100 pe 10%: 110, 121, 133… Jitni jaldi bachat shuru, utni badi badhat!") },
    { title: T("The rule of 72"), say: T("A quick trick: divide 72 by the yearly interest rate to find about how many years money takes to DOUBLE. At 8%, 72 ÷ 8 = 9 years. At 12%, 6 years.", "आसान तरकीब: 72 को ब्याज दर से भाग दो, पता चलेगा पैसा लगभग कितने साल में दुगना होगा। 8% पर 72 ÷ 8 = 9 साल।", "Easy trick: 72 ko interest rate se bhaag do, pata chalega paisa lagbhag kitne saal mein double hoga. 8% pe 72 ÷ 8 = 9 saal.") },
  ],
  make: (_d, rng) => {
    if (rng() < 0.5) {
      const r = pick(rng, [6, 8, 9, 12, 18]);
      return { prompt: T(`Using the rule of 72, about how many years does money take to double at ${r}% a year?`), choices: numChoices(rng, 72 / r, 2), answer: String(72 / r), numeric: true, apply: true,
        why: T(`72 ÷ ${r} = ${72 / r} years.`), steps: [T("Rule of 72: years to double ≈ 72 ÷ rate."), T(`72 ÷ ${r} = ${72 / r}.`)] };
    }
    const y1 = 110, y2 = 121;
    return { prompt: T("₹100 grows at 10% a year, compounded. How much after 2 years?"), choices: shuffle(rng, ["121", "120", "110"]), answer: "121", apply: true,
      why: T(`Year 1: 100 + 10 = ${y1}. Year 2: 10% of ${y1} = 11, so ${y1} + 11 = ${y2}. (Simple interest would give only 120.)`),
      steps: [T("Year 1: 10% of 100 = 10 → 110."), T("Year 2: 10% of 110 = 11 (interest on interest too!) → 121."), T("Simple interest gives 120; compounding gives 121, and the gap grows every year.")] };
  },
};

const inflation: FinTopic = {
  id: "prices_rise", strand: "grow", icon: "🎈", title: T("Why prices go up (inflation)", "क़ीमतें क्यों बढ़ती हैं", "Keematein kyun badhti hain"), grades: [4, 5],
  cards: [{ title: T("Grandpa's ₹1 ice cream"), say: T("Your grandparents may remember ice cream for ₹1! Over the years most prices slowly rise: this is INFLATION. So money kept in a box loses buying power, while money that grows (like bank interest) keeps up. That's why grown-ups save AND invest wisely.", "दादा-दादी को ₹1 की आइसक्रीम याद होगी! सालों में ज़्यादातर क़ीमतें धीरे-धीरे बढ़ती हैं: यही महँगाई है। तो डिब्बे में रखा पैसा कम ख़रीद पाता है, जबकि बढ़ने वाला पैसा (जैसे बैंक ब्याज) साथ चलता है।", "Dada-dadi ko ₹1 ki ice cream yaad hogi! Saalon mein zyadatar keematein dheere-dheere badhti hain: yahi inflation hai. Toh dabbe mein rakha paisa kam khareed paata hai, jabki badhne wala paisa (jaise bank interest) saath chalta hai.") }],
  make: (_d, rng) => {
    const price = pick(rng, [20, 50, 100, 200]), r = pick(rng, [5, 10]), newp = price + price * r / 100;
    return rng() < 0.5
      ? { prompt: T(`A book costs ₹${price}. Prices rise ${r}% this year. What will it cost next year?`), choices: numChoices(rng, newp, r), answer: String(newp), numeric: true, apply: true,
        why: T(`${r}% of ₹${price} = ₹${price * r / 100}; ₹${price} + ₹${price * r / 100} = ₹${newp}.`), steps: [T(`${r}% of ${price} = ${price / 100} × ${r} = ${price * r / 100}.`), T(`New price: ${price} + ${price * r / 100} = ${newp}.`)] }
      : ask(rng, [["Why does money kept in a box for 20 years buy less later?", "prices rise over time (inflation)", ["coins shrink", "shops close"], "Inflation slowly raises prices, so the same money buys less.", true],
        ["Which keeps up better with rising prices?", "savings that earn interest", ["cash under the bed", "spending everything now"], "Money that grows can keep pace with rising prices.", true]]);
  },
};

const lifeMoney: FinTopic = {
  id: "money_for_life", strand: "grow", icon: "🧓", title: T("Money through life", "जीवन भर पैसा", "Zindagi bhar paisa"), grades: [3, 5],
  cards: [{ title: T("Every stage has its money job"), say: T("CHILD: learn to save, share, and tell needs from wants. STUDENT: learn skills that will earn. FIRST JOB: budget, save part of every salary, avoid debt for wants. FAMILY: emergency fund, insurance to protect the family, save for children's education. OLDER AGE: savings and pension let you live without worry, and you can help the next generation.", "बच्चा: बचाना, बाँटना, ज़रूरत-इच्छा पहचानना। विद्यार्थी: कमाने वाले कौशल। पहली नौकरी: बजट, हर तनख़्वाह से बचत, इच्छाओं के लिए क़र्ज़ नहीं। परिवार: आपात कोष, बीमा, बच्चों की पढ़ाई के लिए बचत। बुढ़ापा: बचत और पेंशन से बेफ़िक्र जीवन।", "Bachcha: bachana, baantna, zaroorat-ichha pehchaanna. Student: kamaane wale skills. Pehli naukri: budget, har salary se bachat, ichhaon ke liye karz nahi. Parivaar: emergency fund, insurance, bachchon ki padhai ke liye bachat. Budhaapa: bachat aur pension se befikr jeevan.") }],
  make: (_d, rng) => ask(rng, [
    ["Why do grown-ups keep an 'emergency fund'?", "to pay for surprises like illness or repairs", ["to buy toys", "to show friends"], "Life has surprises; savings set aside protect the family from debt.", true],
    ["What does insurance do?", "helps pay big costs if something bad happens", ["makes money grow fast", "pays for holidays"], "Many people pay a little each year, and the fund helps whoever faces a big loss.", true],
    ["Why should someone start saving for old age when they are young?", "money has more years to grow", ["old people don't need money", "it's too late to start young"], "Compounding works best over many years.", true],
    ["At your age, which money habit matters most?", "saving a little and telling needs from wants", ["borrowing for toys", "spending everything quickly"], "Habits learned young last a lifetime.", true],
  ]),
};

export const FIN_TOPICS: FinTopic[] = [whyMoney, coins, needsWants, saving, sharing, earning, wiseSpend, jars, safety, compare, business, borrowing, interest, lifeMoney, compound, inflation];
