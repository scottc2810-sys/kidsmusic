// Science / EVS for school classes 1-5: living things, plants, animals, our body, food, water, matter, earth
// and space, forces, magnets, light, weather. Each topic opens with concept cards built around a drawn diagram,
// then questions that ask the child to observe, sort, sequence and explain, and every answer gives the reason
// ("a lion eats only meat, so it is a carnivore"). Covers the usual NCERT EVS / CBSE and K-5 science topics.
import type { Text } from "../i18n";
import { pick, ri, shuffle, type Card, type Exercise, type Rng, type Topic } from "./maths";

const T = (en: string, hi?: string, hinglish?: string): Text => ({ en, ...(hi ? { hi } : {}), ...(hinglish ? { hinglish } : {}) });
const D = (name: string, show: "names" | "numbers" = "names") => ({ type: "diagram" as const, name, show });

export type SciStrand = "living" | "body" | "materials" | "earth" | "forces";
export const SCI_STRANDS: { id: SciStrand; icon: string; title: Text }[] = [
  { id: "living", icon: "🌱", title: T("Plants & animals", "पौधे और जानवर", "Paudhe aur jaanwar") },
  { id: "body", icon: "🧒", title: T("Our body & food", "हमारा शरीर और भोजन", "Hamara shareer aur khaana") },
  { id: "materials", icon: "🧊", title: T("Water & materials", "पानी और पदार्थ", "Paani aur padarth") },
  { id: "earth", icon: "🌍", title: T("Earth, sky & weather", "पृथ्वी, आकाश और मौसम", "Prithvi, aakaash aur mausam") },
  { id: "forces", icon: "🧲", title: T("Forces, magnets & light", "बल, चुंबक और प्रकाश", "Force, magnet aur light") },
];
export interface SciTopic extends Omit<Topic, "strand"> { strand: SciStrand }

/** A "which one" question from a list of [thing, answer, reason]. */
function sortQ(rng: Rng, prompt: (x: string) => Text, rows: [string, string, string][], answers: string[]): Exercise {
  const [thing, ans, reason] = pick(rng, rows);
  return { prompt: prompt(thing), choices: answers, answer: ans, why: T(reason) };
}
/** Which number on the diagram points to a part. */
function labelQ(rng: Rng, diagram: string, parts: { n: number; name: string; does: string }[]): Exercise {
  const p = pick(rng, parts);
  return { prompt: T(`Which number shows the ${p.name}?`, `कौन सा नंबर ${p.name} दिखाता है?`, `Kaunsa number ${p.name} dikhata hai?`), visual: D(diagram, "numbers"),
    choices: shuffle(rng, parts.map((x) => String(x.n))),
    answer: String(p.n), why: T(`Number ${p.n} is the ${p.name}. ${p.does}`) };
}
function orderQ(rng: Rng, steps: string[], why: string, visual?: Exercise["visual"]): Exercise {
  const i = ri(rng, 0, steps.length - 2);
  return { prompt: T(`What comes after "${steps[i]}"?`, `"${steps[i]}" के बाद क्या आता है?`, `"${steps[i]}" ke baad kya aata hai?`), visual,
    choices: shuffle(rng, steps.filter((_, k) => k !== i)), answer: steps[i + 1], why: T(`The order is ${steps.join(" → ")}. ${why}`) };
}

const living: SciTopic = {
  id: "living", strand: "living", icon: "🐞", title: T("Living and non-living", "सजीव और निर्जीव", "Sajeev aur nirjeev"), grades: [1, 2],
  cards: [{ title: T("Signs of life"), say: T("Living things GROW, BREATHE, need FOOD and WATER, and make young ones like themselves. A stone does none of these, so it is non-living.", "सजीव चीज़ें बढ़ती हैं, साँस लेती हैं, भोजन-पानी चाहिए, और अपने जैसे बच्चे बनाती हैं। पत्थर ऐसा कुछ नहीं करता, इसलिए निर्जीव है।", "Sajeev cheezein badhti hain, saans leti hain, khaana-paani chahiye, aur apne jaise bachche banati hain. Patthar aisa kuch nahi karta, isliye nirjeev hai.") }],
  make: (_d, rng) => sortQ(rng, (x) => T(`Is ${x} living or non-living?`, `${x} सजीव है या निर्जीव?`, `${x} sajeev hai ya nirjeev?`), [
    ["🐶 a dog", "living", "A dog grows, breathes and eats: living."], ["🌳 a tree", "living", "A tree grows, takes in air and water, and makes seeds: living."],
    ["🪨 a stone", "non-living", "A stone never grows, eats or breathes: non-living."], ["🚗 a car", "non-living", "A car moves, but only with fuel and a driver; it doesn't grow or breathe: non-living."],
    ["🐟 a fish", "living", "A fish breathes in water, eats and grows: living."], ["🧸 a teddy", "non-living", "A teddy never grows or eats: non-living."],
    ["🌻 a flower plant", "living", "It grows towards the sun and makes seeds: living."], ["☁️ a cloud", "non-living", "A cloud changes shape but doesn't eat, breathe or grow by itself: non-living."],
  ], ["living", "non-living"]),
};

const PLANT = [
  { n: 1, name: "flower", does: "Flowers make seeds so new plants can grow." }, { n: 2, name: "leaf", does: "Leaves make food for the plant using sunlight, air and water." },
  { n: 3, name: "stem", does: "The stem holds the plant up and carries water from the roots to the leaves." },
  { n: 4, name: "roots", does: "Roots hold the plant in the soil and drink water from it." }, { n: 5, name: "fruit", does: "The fruit protects the seeds inside." },
];
const plantParts: SciTopic = {
  id: "plant_parts", strand: "living", icon: "🌿", title: T("Parts of a plant", "पौधे के भाग", "Paudhe ke bhaag"), grades: [1, 3],
  cards: [
    { title: T("Every part has a job"), say: T("Roots drink water and hold the plant. The stem is like a straw, carrying water up. Leaves are the plant's kitchen: they make food from sunlight. Flowers make seeds, and fruits keep the seeds safe.", "जड़ें पानी पीती और पौधे को थामती हैं। तना स्ट्रॉ जैसा, पानी ऊपर ले जाता है। पत्तियाँ पौधे की रसोई हैं: धूप से भोजन बनाती हैं। फूल बीज बनाते हैं, फल बीजों को बचाते हैं।", "Jadein paani peeti aur paudhe ko thaamti hain. Tana straw jaisa, paani upar le jaata hai. Pattiyan paudhe ki kitchen hain: dhoop se khaana banati hain. Phool beej banate hain, phal beejon ko bachaate hain."), visual: D("plant") },
  ],
  make: (d, rng) => (d <= 2 || rng() < 0.6 ? labelQ(rng, "plant", PLANT) : (() => {
    const p = pick(rng, PLANT);
    return { prompt: T(`Which part does this job? "${p.does.split(" ").slice(1).join(" ")}"`), visual: D("plant"), choices: shuffle(rng, [p.name, ...shuffle(rng, PLANT.filter((x) => x !== p)).slice(0, 2).map((x) => x.name)]), answer: p.name, why: T(p.does) };
  })()),
};

const plantNeeds: SciTopic = {
  id: "plant_needs", strand: "living", icon: "☀️", title: T("What plants need", "पौधों को क्या चाहिए", "Paudhon ko kya chahiye"), grades: [2, 4],
  cards: [{ title: T("Sunlight, water, air"), say: T("Plants make their own food in their leaves. For that they need SUNLIGHT, WATER from the roots and AIR (carbon dioxide). Then they give out the oxygen we breathe! This is called photosynthesis.", "पौधे पत्तियों में अपना भोजन ख़ुद बनाते हैं। इसके लिए धूप, जड़ों से पानी और हवा चाहिए। फिर वे ऑक्सीजन छोड़ते हैं जो हम साँस में लेते हैं! इसे प्रकाश संश्लेषण कहते हैं।", "Paudhe pattiyon mein apna khaana khud banate hain. Iske liye dhoop, jadon se paani aur hawa chahiye. Phir woh oxygen chhodte hain jo hum saans mein lete hain! Ise photosynthesis kehte hain."), visual: D("photosynthesis") }],
  make: (_d, rng) => pick(rng, [
    { prompt: T("A plant kept in a dark cupboard for many days becomes pale and weak. Why?"), choices: ["no sunlight", "too much water", "no music"], answer: "no sunlight", why: T("Leaves need sunlight to make food. In the dark the plant can't make food, so it gets weak and pale.") },
    { prompt: T("Which gas do plants give out that we breathe in?"), choices: ["oxygen", "smoke", "steam"], answer: "oxygen", why: T("While making food, leaves give out oxygen. That's why trees keep our air fresh!") },
    { prompt: T("Which part of the plant drinks water from the soil?"), choices: ["roots", "flower", "leaf"], answer: "roots", why: T("Roots take water from the soil, and the stem carries it up to the leaves.") },
    { prompt: T("Where does a plant make its food?"), choices: ["leaves", "roots", "seeds"], answer: "leaves", why: T("Leaves are the plant's kitchen: they use sunlight, water and air to make food.") },
  ] as Exercise[]),
};

const animalsFood: SciTopic = {
  id: "animal_food", strand: "living", icon: "🦁", title: T("What animals eat", "जानवर क्या खाते हैं", "Jaanwar kya khaate hain"), grades: [1, 3],
  cards: [{ title: T("Plant-eaters, meat-eaters, both"), say: T("HERBIVORES eat only plants (cow, rabbit). CARNIVORES eat other animals (lion, tiger). OMNIVORES eat both (bear, crow, and us!). Look at teeth: flat teeth grind plants, sharp teeth tear meat.", "शाकाहारी सिर्फ़ पौधे खाते हैं (गाय, ख़रगोश)। मांसाहारी दूसरे जानवर खाते हैं (शेर, बाघ)। सर्वाहारी दोनों (भालू, कौआ, और हम!)। दाँत देखो: चपटे दाँत पौधे पीसते हैं, नुकीले दाँत मांस फाड़ते हैं।", "Herbivores sirf paudhe khaate hain (gaay, khargosh). Carnivores doosre jaanwar khaate hain (sher, baagh). Omnivores dono (bhaalu, kauwa, aur hum!). Daant dekho: chapte daant paudhe peeste hain, nukeele daant maas phaadte hain.") }],
  make: (_d, rng) => sortQ(rng, (x) => T(`${x}: herbivore, carnivore or omnivore?`), [
    ["🐄 cow", "herbivore", "A cow eats only grass and plants, with flat teeth for grinding: herbivore."], ["🐇 rabbit", "herbivore", "A rabbit eats carrots, grass and leaves: herbivore."],
    ["🦁 lion", "carnivore", "A lion hunts other animals and has sharp teeth for tearing meat: carnivore."], ["🐅 tiger", "carnivore", "A tiger eats only meat: carnivore."],
    ["🐻 bear", "omnivore", "A bear eats fish, honey, fruits and roots: both plants and animals, so omnivore."], ["🐦‍⬛ crow", "omnivore", "A crow eats grains, fruits and insects: omnivore."],
    ["🐘 elephant", "herbivore", "Elephants eat grass, leaves and fruit: herbivore."], ["🦅 eagle", "carnivore", "An eagle catches fish and small animals: carnivore."],
  ], ["herbivore", "carnivore", "omnivore"]),
};

const homes: SciTopic = {
  id: "animal_homes", strand: "living", icon: "🏠", title: T("Animal homes", "जानवरों के घर", "Jaanwaron ke ghar"), grades: [1, 2],
  cards: [{ title: T("A home keeps them safe"), say: T("Animals need homes for shelter from rain, heat and cold, and to keep their babies safe. A bird builds a nest, bees make a hive, a rabbit digs a burrow.", "जानवरों को बारिश, गर्मी, ठंड से बचने और बच्चों को सुरक्षित रखने के लिए घर चाहिए। चिड़िया घोंसला बनाती है, मधुमक्खी छत्ता, ख़रगोश बिल।", "Jaanwaron ko baarish, garmi, thand se bachne aur bachchon ko safe rakhne ke liye ghar chahiye. Chidiya ghonsla banati hai, madhumakkhi chhatta, khargosh bil.") }],
  make: (_d, rng) => {
    const rows: [string, string, string][] = [["🐦 bird", "nest", "Birds weave nests of twigs to keep their eggs safe high up."], ["🐝 bee", "hive", "Bees build hives of wax and store honey there."],
      ["🐇 rabbit", "burrow", "Rabbits dig burrows under the ground to hide from danger."], ["🦁 lion", "den", "Lions rest in a den, a cave or thick bushes."],
      ["🕷️ spider", "web", "A spider spins a web, its home and its trap for insects."], ["🐄 cow", "shed", "People keep cows in a shed to protect them from rain."]];
    const [a, home, why] = pick(rng, rows);
    return { prompt: T(`Where does a ${a} live?`, `${a} कहाँ रहता है?`, `${a} kahan rehta hai?`), choices: shuffle(rng, [home, ...shuffle(rng, rows.filter((r) => r[1] !== home)).slice(0, 2).map((r) => r[1])]), answer: home, why: T(why) };
  },
};

const senses: SciTopic = {
  id: "senses", strand: "body", icon: "👀", title: T("Our five senses", "हमारी पाँच इंद्रियाँ", "Hamari paanch indriyan"), grades: [1, 2],
  cards: [{ title: T("Five windows to the world"), say: T("We see with our EYES, hear with our EARS, smell with our NOSE, taste with our TONGUE and feel with our SKIN. Our brain puts it all together.", "हम आँखों से देखते, कानों से सुनते, नाक से सूँघते, जीभ से स्वाद लेते और त्वचा से छूकर महसूस करते हैं। दिमाग़ सब जोड़ता है।", "Hum aankhon se dekhte, kaanon se sunte, naak se soonghte, jeebh se swaad lete aur skin se chhoo ke mehsoos karte hain. Dimaag sab jodta hai."), visual: D("senses") }],
  make: (_d, rng) => {
    const rows: [string, string, string][] = [["see a rainbow 🌈", "eyes", "We see colours and light with our eyes."], ["hear a bell 🔔", "ears", "Sounds travel through the air into our ears."],
      ["smell a flower 🌸", "nose", "Smells float in the air into our nose."], ["taste a sweet 🍬", "tongue", "Our tongue has tiny taste buds for sweet, salty, sour and bitter."],
      ["feel a soft kitten 🐱", "skin", "Our skin feels soft, hard, hot and cold."]];
    const [what, organ, why] = pick(rng, rows);
    return { prompt: T(`What do we use to ${what}?`), choices: shuffle(rng, [organ, ...shuffle(rng, ["eyes", "ears", "nose", "tongue", "skin"].filter((x) => x !== organ)).slice(0, 2)]), answer: organ, why: T(why) };
  },
};

const food: SciTopic = {
  id: "food_groups", strand: "body", icon: "🥗", title: T("Healthy food", "पौष्टिक भोजन", "Healthy khaana"), grades: [2, 4],
  cards: [{ title: T("Three jobs of food"), say: T("ENERGY foods (rice, roti, bread, potato) give us power to run and play. BODY-BUILDING foods (dal, milk, eggs, paneer) help us grow strong. PROTECTIVE foods (fruits and vegetables) keep us from falling ill. A healthy plate has all three!", "ऊर्जा देने वाला भोजन (चावल, रोटी) खेलने की ताक़त देता है। शरीर बनाने वाला (दाल, दूध, अंडा, पनीर) मज़बूत बनाता है। रक्षा करने वाला (फल, सब्ज़ी) बीमारी से बचाता है। अच्छी थाली में तीनों!", "Energy wala khaana (chawal, roti) khelne ki taakat deta hai. Body-building wala (dal, doodh, anda, paneer) mazboot banata hai. Protective wala (phal, sabzi) beemari se bachaata hai. Achhi thaali mein teeno!"), visual: D("plate") }],
  make: (_d, rng) => sortQ(rng, (x) => T(`${x} is mostly which kind of food?`), [
    ["🍚 rice", "energy", "Rice is full of starch that gives energy."], ["🫓 roti", "energy", "Wheat roti gives us energy to play."], ["🥔 potato", "energy", "Potatoes give lots of energy."],
    ["🥛 milk", "body-building", "Milk has protein and calcium for growing bones and muscles."], ["🥚 egg", "body-building", "Eggs have protein, which builds muscles."], ["🍲 dal", "body-building", "Dal is full of protein that helps us grow."],
    ["🥕 carrot", "protective", "Carrots have vitamins that protect our eyes and help fight illness."], ["🍊 orange", "protective", "Oranges have vitamin C that helps us fight colds."], ["🥦 broccoli", "protective", "Green vegetables have vitamins and minerals that protect us."],
  ], ["energy", "body-building", "protective"]),
};

const WATER_STEPS = ["evaporation", "condensation", "precipitation", "collection"];
const waterCycle: SciTopic = {
  id: "water_cycle", strand: "materials", icon: "💧", title: T("The water cycle", "जल चक्र", "Jal chakra"), grades: [3, 5],
  cards: [
    { title: T("Water goes round and round"), say: T("1. The sun heats water in seas and rivers and it rises as invisible vapour: EVAPORATION. 2. High up it cools into tiny drops that make clouds: CONDENSATION. 3. The drops join, get heavy and fall as rain: PRECIPITATION. 4. Rain flows back into rivers and seas: COLLECTION. And again!", "1. सूरज समुद्र-नदियों का पानी गर्म करता है, वह भाप बनकर ऊपर उठता है: वाष्पीकरण। 2. ऊपर ठंडा होकर बादल बनता है: संघनन। 3. बूँदें भारी होकर बारिश बनती हैं: वर्षण। 4. पानी वापस नदी-समुद्र में: संग्रह। और फिर से!", "1. Suraj samundar-nadi ka paani garam karta hai, woh bhaap ban ke upar uthta hai: evaporation. 2. Upar thanda ho ke baadal banta hai: condensation. 3. Boondein bhaari ho ke baarish banti hain: precipitation. 4. Paani wapas nadi-samundar mein: collection. Aur phir se!"), visual: D("water_cycle") },
    { title: T("Why does it never run out?"), say: T("The same water keeps going around this circle. The water you drink today may once have been in a cloud over the ocean!", "वही पानी इस चक्र में घूमता रहता है। आज जो पानी पीते हो, वह कभी समुद्र के ऊपर बादल में रहा होगा!", "Wahi paani is chakra mein ghoomta rehta hai. Aaj jo paani peete ho, woh kabhi samundar ke upar baadal mein raha hoga!") },
  ],
  make: (_d, rng) => (rng() < 0.5 ? orderQ(rng, WATER_STEPS, "It is a circle: after collection, evaporation starts again.", D("water_cycle", "numbers"))
    : pick(rng, [
      { prompt: T("Wet clothes dry in the sun. Which part of the water cycle is this?"), choices: ["evaporation", "condensation", "precipitation"], answer: "evaporation", why: T("The sun's heat turns the water in the clothes into vapour that goes into the air: evaporation.") },
      { prompt: T("Drops form on the outside of a cold glass of water. What is this?"), choices: ["condensation", "evaporation", "collection"], answer: "condensation", why: T("Vapour in the air touches the cold glass, cools and turns back into drops: condensation, just like clouds forming.") },
      { prompt: T("Rain, snow and hail are all called…"), choices: ["precipitation", "evaporation", "condensation"], answer: "precipitation", why: T("Any water falling from clouds is precipitation.") },
    ] as Exercise[])),
};

const matter: SciTopic = {
  id: "states_matter", strand: "materials", icon: "🧊", title: T("Solid, liquid, gas", "ठोस, द्रव, गैस", "Solid, liquid, gas"), grades: [3, 5],
  cards: [
    { title: T("Three states"), say: T("A SOLID keeps its shape (ice, stone): its tiny particles are packed tight. A LIQUID flows and takes the shape of its cup (water, milk): particles slide past each other. A GAS spreads everywhere (air, steam): particles fly far apart.", "ठोस अपना आकार रखता है (बर्फ़, पत्थर): कण कसकर भरे। द्रव बहता है और बर्तन का आकार लेता है (पानी, दूध): कण फिसलते हैं। गैस हर जगह फैलती है (हवा, भाप): कण दूर-दूर उड़ते हैं।", "Solid apna shape rakhta hai (barf, patthar): particles tight packed. Liquid behta hai aur bartan ka shape leta hai (paani, doodh): particles slide karte hain. Gas har jagah phailti hai (hawa, bhaap): particles door-door udte hain."), visual: D("matter") },
    { title: T("Heat changes the state"), say: T("Heat ice and it MELTS into water. Heat water and it BOILS into steam. Cool steam and it becomes water; freeze water and it becomes ice. The same stuff, just different states!", "बर्फ़ गर्म करो तो पिघलकर पानी। पानी गर्म करो तो उबलकर भाप। भाप ठंडी करो तो पानी, पानी जमाओ तो बर्फ़। वही चीज़, बस अलग अवस्था!", "Barf garam karo toh pighal ke paani. Paani garam karo toh ubal ke bhaap. Bhaap thandi karo toh paani, paani jamao toh barf. Wahi cheez, bas alag state!") },
  ],
  make: (_d, rng) => sortQ(rng, (x) => T(`Is ${x} a solid, a liquid or a gas?`), [
    ["🧊 ice", "solid", "Ice keeps its shape: solid."], ["🪨 a stone", "solid", "A stone keeps its shape: solid."], ["🥛 milk", "liquid", "Milk flows and takes the shape of the glass: liquid."],
    ["💧 water", "liquid", "Water flows and fills its container from the bottom: liquid."], ["♨️ steam", "gas", "Steam spreads out into the air: gas."], ["🎈 the air in a balloon", "gas", "Air fills the whole balloon, whatever its shape: gas."],
    ["🍯 honey", "liquid", "Honey flows slowly, but it still flows and takes the jar's shape: liquid."], ["🧱 a brick", "solid", "A brick keeps its shape: solid."],
  ], ["solid", "liquid", "gas"]),
};

const PLANETS = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
const space: SciTopic = {
  id: "solar_system", strand: "earth", icon: "🪐", title: T("Sun, Earth & planets", "सूरज, पृथ्वी और ग्रह", "Suraj, prithvi aur grah"), grades: [3, 5],
  cards: [
    { title: T("Our solar system"), say: T("The Sun is a star in the middle. Eight planets go around it: My Very Educated Mother Just Served Us Noodles: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.", "सूरज बीच में एक तारा है। आठ ग्रह उसके चारों ओर घूमते हैं: बुध, शुक्र, पृथ्वी, मंगल, बृहस्पति, शनि, अरुण, वरुण।", "Suraj beech mein ek taara hai. Aath grah uske chaaron taraf ghoomte hain: Budh, Shukra, Prithvi, Mangal, Brihaspati, Shani, Arun, Varun."), visual: D("solar") },
    { title: T("Day and night"), say: T("The Earth spins like a top. The side facing the Sun has DAY, the side facing away has NIGHT. One full spin takes 24 hours: one day.", "पृथ्वी लट्टू की तरह घूमती है। सूरज की ओर वाला हिस्सा दिन, दूसरी ओर रात। एक पूरा चक्कर 24 घंटे: एक दिन।", "Prithvi lattu ki tarah ghoomti hai. Suraj ki taraf wala hissa din, doosri taraf raat. Ek poora chakkar 24 ghante: ek din."), visual: D("day_night") },
  ],
  make: (d, rng) => (rng() < 0.5 ? orderQ(rng, PLANETS.slice(0, d <= 3 ? 5 : 8), "Remember: My Very Educated Mother Just Served Us Noodles.", D("solar"))
    : pick(rng, [
      { prompt: T("Why do we have day and night?"), choices: ["the Earth spins", "the Sun switches off", "clouds cover the Sun"], answer: "the Earth spins", why: T("The Earth spins once every 24 hours. Our side faces the Sun (day), then turns away (night).") },
      { prompt: T("Which is the biggest planet?"), choices: ["Jupiter", "Earth", "Mars"], answer: "Jupiter", why: T("Jupiter is so big that more than 1,000 Earths could fit inside it!") },
      { prompt: T("What does the Earth go around?"), choices: ["the Sun", "the Moon", "Mars"], answer: "the Sun", why: T("The Earth goes around the Sun once a year; the Moon goes around the Earth.") },
    ] as Exercise[])),
};

const lifeCycle: SciTopic = {
  id: "life_cycle", strand: "living", icon: "🦋", title: T("Life cycles", "जीवन चक्र", "Jeevan chakra"), grades: [2, 4],
  cards: [{ title: T("From egg to butterfly"), say: T("A butterfly lays an EGG. A hungry CATERPILLAR hatches and eats leaves. It wraps itself in a PUPA (chrysalis) and changes completely. Out comes a BUTTERFLY, which lays eggs again. A circle of life!", "तितली अंडा देती है। उससे भूखी इल्ली निकलती है और पत्ते खाती है। वह प्यूपा में लिपटकर पूरी बदल जाती है। फिर तितली निकलती है, जो फिर अंडे देती है। जीवन का चक्र!", "Titli anda deti hai. Usse bhookhi illi nikalti hai aur patte khaati hai. Woh pupa mein lipat ke poori badal jaati hai. Phir titli nikalti hai, jo phir ande deti hai. Jeevan ka chakra!"), visual: D("butterfly") }],
  make: (_d, rng) => (rng() < 0.6 ? orderQ(rng, ["egg", "caterpillar", "pupa", "butterfly"], "Then the butterfly lays eggs and it starts again.", D("butterfly"))
    : orderQ(rng, ["egg", "tadpole", "froglet", "frog"], "A tadpole lives in water with a tail; it grows legs, loses the tail and becomes a frog.")),
};

const magnets: SciTopic = {
  id: "magnets", strand: "forces", icon: "🧲", title: T("Magnets", "चुंबक", "Magnet"), grades: [3, 4],
  cards: [{ title: T("Magnets pull iron"), say: T("A magnet pulls (attracts) things made of IRON or steel, like pins and nails. It does not pull wood, plastic, paper or glass. Two magnets can push each other away if the same ends face each other!", "चुंबक लोहे या स्टील की चीज़ें खींचता है, जैसे पिन, कील। लकड़ी, प्लास्टिक, काग़ज़, काँच नहीं खींचता। दो चुंबक के एक जैसे सिरे आमने-सामने हों तो एक-दूसरे को धकेलते हैं!", "Magnet lohe ya steel ki cheezein kheenchta hai, jaise pin, keel. Lakdi, plastic, kaagaz, kaanch nahi kheenchta. Do magnet ke same sire aamne-saamne hon toh ek-doosre ko dhakelte hain!"), visual: D("magnet") }],
  make: (_d, rng) => sortQ(rng, (x) => T(`Will a magnet pull ${x}?`, `क्या चुंबक ${x} को खींचेगा?`, `Kya magnet ${x} ko kheenchega?`), [
    ["📎 a paper clip", "yes", "Paper clips are made of steel (iron), so the magnet pulls them."], ["🔩 an iron nail", "yes", "Nails are iron: attracted."],
    ["🥄 a wooden spoon", "no", "Wood has no iron, so a magnet can't pull it."], ["🧸 a plastic toy", "no", "Plastic is not attracted to magnets."],
    ["📄 paper", "no", "Paper has no iron: not attracted."], ["🪡 a sewing needle", "yes", "Needles are steel: attracted."],
  ], ["yes", "no"]),
};

const forces: SciTopic = {
  id: "push_pull", strand: "forces", icon: "🛒", title: T("Push and pull", "धक्का और खिंचाव", "Push aur pull"), grades: [2, 3],
  cards: [{ title: T("Forces make things move"), say: T("A force is a PUSH or a PULL. Pushing moves something away from you, pulling brings it closer. Forces can start, stop, speed up or turn moving things.", "बल एक धक्का या खिंचाव है। धक्का चीज़ को दूर ले जाता है, खिंचाव पास लाता है। बल चीज़ों को चला, रोक, तेज़ या मोड़ सकता है।", "Force ek push ya pull hai. Push cheez ko door le jaata hai, pull paas laata hai. Force cheezon ko chala, rok, tez ya mod sakta hai.") }],
  make: (_d, rng) => sortQ(rng, (x) => T(`${x}: push or pull?`), [
    ["🚪 opening a drawer", "pull", "You bring the drawer towards you: pull."], ["🛒 moving a shopping cart forward", "push", "You move it away from you: push."],
    ["⚽ kicking a ball", "push", "Your foot pushes the ball away."], ["🪁 flying a kite with its string", "pull", "You pull the string towards you."],
    ["🔔 ringing a doorbell", "push", "You press (push) the button."], ["🪣 lifting a bucket from a well", "pull", "You pull the rope up towards you."],
  ], ["push", "pull"]),
};

const light: SciTopic = {
  id: "light_shadow", strand: "forces", icon: "🔦", title: T("Light and shadows", "प्रकाश और छाया", "Light aur chhaaya"), grades: [3, 5],
  cards: [{ title: T("Light travels in straight lines"), say: T("Light goes in straight lines. When something blocks it, a dark shape forms behind: a SHADOW. That's why your shadow is always on the side away from the light.", "प्रकाश सीधी रेखा में चलता है। जब कोई चीज़ उसे रोके, पीछे एक काली आकृति बनती है: छाया। इसीलिए छाया हमेशा प्रकाश के उलटी तरफ़ होती है।", "Light seedhi line mein chalta hai. Jab koi cheez use roke, peeche ek kaali shape banti hai: chhaaya. Isiliye chhaaya hamesha light ke ulti taraf hoti hai."), visual: D("shadow") }],
  make: (_d, rng) => pick(rng, [
    { prompt: T("The Sun is in front of you. Where is your shadow?"), choices: ["behind me", "in front of me", "on my head"], answer: "behind me", why: T("Your body blocks the light going straight, so the shadow falls on the side away from the Sun: behind you.") },
    { prompt: T("At noon, when the Sun is high above, is your shadow long or short?"), choices: ["short", "long"], answer: "short", why: T("Light comes from right above, so very little ground is blocked: a short shadow. In the evening the Sun is low and shadows are long.") },
    { prompt: T("Which makes the darkest shadow?"), choices: ["a book", "clear glass", "thin paper"], answer: "a book", why: T("A book lets no light through (opaque), so the shadow is dark. Glass lets light through, so almost no shadow.") },
  ] as Exercise[]),
};

const weather: SciTopic = {
  id: "weather", strand: "earth", icon: "🌦️", title: T("Weather & seasons", "मौसम और ऋतुएँ", "Mausam aur ritu"), grades: [1, 2],
  cards: [{ title: T("Dress for the weather"), say: T("Weather is what the sky and air are like today: sunny, rainy, windy, cloudy or cold. We choose clothes for the weather: cotton when it's hot, a raincoat when it rains, wool when it's cold.", "मौसम मतलब आज आकाश और हवा कैसे हैं: धूप, बारिश, हवा, बादल या ठंड। हम मौसम के हिसाब से कपड़े पहनते हैं: गर्मी में सूती, बारिश में रेनकोट, ठंड में ऊनी।", "Mausam matlab aaj aasmaan aur hawa kaise hain: dhoop, baarish, hawa, baadal ya thand. Hum mausam ke hisaab se kapde pehente hain: garmi mein cotton, baarish mein raincoat, thand mein woollen.") }],
  make: (_d, rng) => sortQ(rng, (x) => T(`${x}: what should we wear?`), [
    ["🌧️ a rainy day", "raincoat", "A raincoat keeps the rain off and keeps us dry."], ["❄️ a very cold day", "sweater", "Wool traps warm air close to the body."],
    ["☀️ a hot sunny day", "cotton clothes", "Cotton lets air through and soaks up sweat, keeping us cool."],
  ], ["raincoat", "sweater", "cotton clothes"]),
};

const circuit: SciTopic = {
  id: "circuit", strand: "forces", icon: "💡", title: T("A simple circuit", "सरल परिपथ", "Simple circuit"), grades: [4, 5],
  cards: [{ title: T("A closed loop"), say: T("Electricity needs a complete loop to flow: from the battery, through a wire, through the bulb, and back to the battery. If there's a gap anywhere, the bulb stays dark. A switch makes or breaks the gap.", "बिजली को बहने के लिए पूरा घेरा चाहिए: बैटरी से तार, बल्ब और वापस बैटरी तक। कहीं भी गैप हो तो बल्ब नहीं जलता। स्विच गैप बनाता या जोड़ता है।", "Bijli ko behne ke liye poora loop chahiye: battery se taar, bulb aur wapas battery tak. Kahin bhi gap ho toh bulb nahi jalta. Switch gap banata ya jodta hai."), visual: D("circuit") }],
  make: (_d, rng) => pick(rng, [
    { prompt: T("The switch is open (there's a gap). Will the bulb glow?"), visual: D("circuit"), choices: ["no", "yes"], answer: "no", why: T("Electricity can't jump the gap, so the loop isn't complete: no light.") },
    { prompt: T("Which of these lets electricity flow through it?"), choices: ["a copper wire", "a rubber band", "a wooden stick"], answer: "a copper wire", why: T("Metals like copper are conductors: electricity flows through them. Rubber and wood are insulators.") },
    { prompt: T("Why are electric wires covered in plastic?"), choices: ["to keep us safe", "to make them shiny", "to make them heavy"], answer: "to keep us safe", why: T("Plastic doesn't let electricity through, so we can touch the wire without getting a shock.") },
  ] as Exercise[]),
};

export const SCIENCE_TOPICS: SciTopic[] = [living, plantParts, plantNeeds, animalsFood, homes, lifeCycle, senses, food, waterCycle, matter, weather, space, forces, magnets, light, circuit];
export const scienceTopic = (id: string) => SCIENCE_TOPICS.find((t) => t.id === id);
export type { Card };
