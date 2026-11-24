// "Your mission": every money and Vedas & wisdom topic ends with one small thing to DO in the child's own life
// this week, said with their name. When the child taps "I did it!", it is written to their learning graph, so
// the AI teacher and the results see the lesson being used in real life, not only answered on screen.
// Missions are safe, small and need at most a grown-up's help; none needs money to be spent.

/** `{name}` is replaced by the child's name. */
export const MISSIONS: Record<string, string> = {
  // money & finance
  why_money: "{name}, play 'barter' at home: swap a toy with someone for a little while. Then ask: was money easier?",
  coins_notes: "{name}, ask a grown-up to show you real coins and notes. Sort them from smallest to biggest value.",
  needs_wants: "{name}, at the next shop visit, point at three things and say 'need' or 'want' for each.",
  best_buy: "{name}, with a grown-up, compare two packs of the same thing in a shop: which costs less for ONE?",
  saving_goal: "{name}, choose one thing you'd like to save for. Draw it and stick the picture on your money box.",
  three_jars: "{name}, make three jars or boxes at home and label them SPEND, SAVE and SHARE.",
  spend_wisely: "{name}, next time you really want something new, wait one whole day before asking for it.",
  earning: "{name}, ask a grown-up in your family: what work do you do, and how does it help people?",
  lemonade_business: "{name}, plan a pretend stall: what would you sell, what would it cost to make, and what price would you ask?",
  sharing_dana: "{name}, share something this week: a toy, your time, or help for someone who needs it.",
  money_safety: "{name}, tell a grown-up the rule you learned: we never tell anyone a PIN or OTP. Ask them if they agree!",
  borrowing: "{name}, if you borrow something this week, give it back on time and in good condition.",
  bank_interest: "{name}, ask a grown-up: does our family's bank pay interest on savings? How much?",
  compound_growth: "{name}, with a grown-up, write how ₹100 grows at 10% for 3 years: 100, 110, 121, then?",
  prices_rise: "{name}, ask a grandparent what one thing cost when they were your age, and what it costs now.",
  money_for_life: "{name}, ask a grown-up: what are you saving for, and why does it matter to our family?",
  // Vedas & wisdom
  four_vedas: "{name}, teach someone at home the four Veda actions: recite 🙏, sing 🗣️, do 🫗, heal 💚!",
  rig_veda: "{name}, at dinner, thank the farmer, the sun and the rain for your food, out loud.",
  sama_veda: "{name}, learn the first line of a song by heart: listen, repeat slowly, a little every day.",
  yajur_veda: "{name}, choose one job (making your bed, packing your bag) and do it step by step, from start to finish.",
  atharva_veda: "{name}, look at a rupee note with a grown-up and find 'satyameva jayate' under the four lions.",
  shloka_meaning: "{name}, say one shloka you learned to someone at home and tell them what it means.",
  gita_karma: "{name}, before your next test or match, say: 'I'll do my best; the result will come.'",
  gita_self: "{name}, when something feels hard this week, say 'I can't do it YET' and try once more.",
  gita_balance: "{name}, before you speak to someone this week, ask yourself: is it true? is it kind? is it helpful?",
  honesty_gratitude: "{name}, say a real 'thank you' to a teacher or someone at home, and tell them why.",
  kindness_teamwork: "{name}, invite someone who is alone to play with you.",
  care_earth: "{name}, close a running tap or switch off a light nobody is using, every day this week.",
  health_routine: "{name}, go to bed on time three nights in a row, and tell your grown-up how you felt.",
  emotions: "{name}, when you feel angry or sad this week, stop and take 5 slow breaths first.",
  effort_time: "{name}, practise one thing for 10 minutes every day this week: a song, reading or drawing.",
  life_stages: "{name}, ask a grandparent or an elder about one skill that helped them all their life.",
  sama_music: "{name}, sing Sa Re Ga Ma Pa Dha Ni Sa slowly, and then play it on your instrument.",
  shulba_geometry: "{name}, with a grown-up, mark 3 steps and 4 steps on the floor and check the diagonal is 5.",
  sanskrit_sounds: "{name}, say ka, kha, ga, gha, ṅa and feel where in your mouth each sound is made.",
  vedic_sky: "{name}, look at the Moon tonight. Is it growing or shrinking? Check again in 3 days.",
  four_aims: "{name}, if you get some money, split it: some to save, some to spend wisely, a little to share.",
};

export const missionFor = (topic: string, name: string): string | null =>
  MISSIONS[topic] ? MISSIONS[topic].replaceAll("{name}", name) : null;
