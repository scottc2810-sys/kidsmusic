// More concept cards, so the "Learn it" part of a topic teaches everything its questions ask about
// (checked by teachfirst.test.ts and coverage.test.ts). Before this, many topics had one card about the first
// idea while the questions covered five to twenty facts. Each card is one small idea, said simply, with the why.
// Melo still teaches any single fact the first time it is asked (teachfirst.ts); these cards give the big picture.
import type { Text } from "../i18n";
import type { Card } from "./maths";

const T = (en: string): Text => ({ en });
const C = (title: string, say: string, visual?: Card["visual"]): Card => ({ title: T(title), say: T(say), ...(visual ? { visual } : {}) });

export const MORE_CARDS: Record<string, Card[]> = {
  // ---------------- maths ----------------
  shapes: [
    C("Oval: a stretched circle", "An OVAL is round like a circle that has been stretched, like an egg or a cricket ball's face from the side. It has no corners and no straight sides.", { type: "shape", sides: 0, kind: "oval" }),
    C("Pentagon: 5 sides", "'Penta' means five. A PENTAGON has 5 straight sides and 5 corners. Count them with your finger: 1, 2, 3, 4, 5!", { type: "shape", sides: 5, label: "pentagon" }),
    C("Hexagon: 6 sides", "'Hexa' means six. A HEXAGON has 6 straight sides and 6 corners, like a cell in a bees' honeycomb. Sides and corners: always the same number!", { type: "shape", sides: 6, label: "hexagon" }),
  ],
  symmetry: [
    C("Check square by square", "To check a picture, look at each coloured square on one side. Count how far it is from the dotted line. Its twin must be the SAME distance away on the other side. If every square has a twin: YES, symmetrical.",
      { type: "symmetry", cells: [[true, false, false, true], [false, true, true, false], [true, true, true, true]], axis: "v", half: false }),
    C("One missing twin means NO", "If even ONE coloured square has no twin in the mirror place, the halves don't match when you fold: NOT symmetrical.",
      { type: "symmetry", cells: [[true, false, false, false], [false, true, true, false], [true, true, true, true]], axis: "v", half: false }),
  ],
  solids_3d: [
    C("Cuboid: a box shape", "A CUBOID is like a brick, a book or a lunch box: 6 flat faces that are rectangles, 12 edges, 8 corners. A CUBE is a cuboid whose faces are all equal squares, like a dice.", { type: "solid", kind: "cuboid" }),
    C("Pyramid: a pointed top", "A PYRAMID has a square bottom and 4 triangle faces meeting at a point on top, like the pyramids of Egypt: 5 faces, 8 edges, 5 corners.", { type: "solid", kind: "pyramid" }),
    C("Cylinder and cone", "A CYLINDER is like a tin can: 2 round flat faces and 1 curved face (3 faces), 2 edges, no corners. A CONE is like an ice-cream cone: 1 round flat face and 1 curved face (2 faces), 1 edge and 1 pointy corner.", { type: "solid", kind: "cylinder" }),
  ],
  calendar: [
    C("The 12 months in order", "January, February, March, April, May, June, July, August, September, October, November, December. After December comes January again: a new year starts!"),
    C("Counting days and months", "To find '3 days after Friday', count forward one at a time: Saturday (1), Sunday (2), Monday (3). For 'before', count backwards. The same works for months."),
  ],
  weight_capacity: [
    C("Bigger and fuller is usually heavier", "An elephant is heavier than a mouse, a car heavier than a bicycle, a watermelon heavier than a grape, a brick heavier than a feather: they have much more stuff packed in. Heavy things push a balance DOWN."),
    C("Mixed units: change the big part", "2 kg 100 g in grams: 2 kg = 2 × 1000 = 2000 g, then add 100 g: 2100 g. 3 L 800 mL = 3000 + 800 = 3800 mL."),
  ],
  roman: [
    C("Building numbers", "Write the biggest part first: 38 = 30 + 8 = XXX + VIII = XXXVIII. 62 = 50 + 10 + 2 = L + X + II = LXII. Read them back by adding: L (50) X (10) I I (2) = 62."),
    C("The tricky ones: 4, 9, 40", "Instead of four I's, write IV (one before five). 9 = IX, 14 = XIV, 19 = XIX, 24 = XXIV, 40 = XL, 44 = XLIV. When a small letter is BEFORE a big one, subtract it."),
  ],
  div_9: [
    C("Write it as 'quotient r remainder'", "21 ÷ 9: 9 goes in 2 times (that's the first digit, 2) and 3 is left over (2 + 1 = 3). We write 2 r 3. Check: 9 × 2 + 3 = 21. ✓"),
    C("Why it works", "Every ten is one nine plus one extra. 3 tens = 3 nines + 3 extra. So 34 = 3 nines + 3 + 4 left over = 3 r 7. That's why the remainder is the digit sum!"),
  ],
  divisibility: [
    C("Yes or no, step by step", "Is 126 divisible by 3? Add the digits: 1 + 2 + 6 = 9. Is 9 in the 3 times table? Yes, so 126 IS divisible by 3. Is 125 divisible by 2? It ends in 5, which is odd: NO."),
    C("Which test for which number", "÷2: look at the LAST digit (even?). ÷5: last digit 0 or 5. ÷10: last digit 0. ÷3 and ÷9: ADD all the digits and check the sum."),
  ],
  digit_sum_check: [
    C("Correct or wrong?", "Check 12 × 11 = 132. 12 → 3, 11 → 2, 3 × 2 = 6. 132 → 1 + 3 + 2 = 6. Same: CORRECT. If 12 × 11 = 142: 1 + 4 + 2 = 7, not 6: WRONG. For + questions, ADD the digit sums instead of multiplying."),
  ],
  // ---------------- science ----------------
  plant_parts: [
    C("Find each part", "Look at a plant from the bottom up: ROOTS under the soil, the STEM standing up, a LEAF (many are called leaves) growing from the stem, a FLOWER at the top, and a FRUIT where the flower was."),
  ],
  seeds: [
    C("Where seeds come from", "Seeds are made in the FLOWER. After a bee carries pollen, the flower turns into a fruit with seeds inside. Plant a seed with water, air and warmth and a new plant grows!"),
  ],
  animal_homes: [
    C("Who lives where", "A bee lives in a HIVE. A bird lives in a NEST. A rabbit lives in a BURROW under the ground. A lion rests in a DEN. A spider lives in a WEB it spins. People keep a cow in a SHED, a horse in a stable, a dog in a kennel."),
  ],
  weather: [
    C("Clothes for each day", "Rainy day: a RAINCOAT (and umbrella) keeps us dry. Hot sunny day: light COTTON clothes and a cap keep us cool. Very cold day: a woollen SWEATER, cap and socks keep us warm, because wool traps warm air."),
  ],
  life_cycle: [
    C("From egg to frog", "A frog lays EGGS in water. A TADPOLE hatches: it has a tail and lives in water like a fish. It grows legs and becomes a FROGLET, a tiny frog with a short tail. The tail goes, and it is a FROG that can live on land too."),
  ],
  hygiene: [
    C("When to wash, and sneezing", "Wash hands BEFORE EATING and AFTER the toilet, with soap: SOAP BREAKS UP GERMS AND GREASE so water washes them away. Wash after playing outside and after touching animals. When you sneeze or cough, cover it with your elbow or a tissue, to stop germs spreading to others."),
  ],
  air: [
    C("Wind dries clothes", "Moving air is WIND. Wet clothes dry when their water turns into WATER VAPOUR in the air. On a windy day the WIND CARRIES THE WATER VAPOUR AWAY, so more water can go: clothes dry faster."),
    C("An 'empty' glass is full of air", "Push an upside-down glass into water: the water can't get in, because the glass is already full of AIR. Air takes up space, even if we can't see it."),
  ],
  teeth: [
    C("Sugar, germs and holes", "Germs on our teeth eat leftover sugar and turn it into ACID. Acid slowly makes holes called cavities. So brush TWICE a day, morning and night, and rinse your mouth after sweets."),
  ],
  bones_muscles: [
    C("Food for strong bones", "Bones are made with CALCIUM. MILK, curd, cheese, green leafy vegetables and ragi have lots of it. Sunshine helps your body use it, and running and jumping make bones stronger."),
  ],
  sound: [
    C("All sounds are vibrations", "Every sound is made by VIBRATIONS (SHAKING): a string, a drum skin or your throat shakes back and forth very fast."),
    C("Louder and softer", "Hit a drum HARDER: it shakes more, so the sound is LOUDER. Tap it gently: small shakes, a SOFT sound."),
    C("No air, no sound", "Sound travels by shaking the air (or water, or a wall) next to it. In space there is no air, so there is nothing to shake: space is SILENT, even when things crash."),
    C("Big things shake slowly", "A big drum is heavy, so it vibrates SLOWLY: a LOW sound. A short thin string vibrates FAST: a HIGH sound."),
  ],
  magnets: [
    C("Yes or no: will it stick?", "A magnet pulls things made of IRON or STEEL: an iron nail, a paper clip, a sewing needle, a steel pin. It does NOT pull wood (a wooden spoon), paper, plastic (a plastic toy), glass or cloth."),
  ],
  light_shadow: [
    C("Dark, light or no shadow", "Things light can't pass through, like a BOOK, wood or your body, are OPAQUE: they make dark shadows. Glass and clear water let light through: almost no shadow. Tracing paper lets some light through: a pale shadow."),
    C("Long and short shadows", "When the Sun is HIGH (at noon), shadows are SHORT. When the Sun is LOW (morning and evening), shadows are LONG. Your shadow is always on the side AWAY from the light: Sun in front, shadow behind."),
  ],
  digestion: [
    C("Chew well, eat fibre, drink water", "CHEWING breaks food into small soft bits, which are easier to digest. FIBRE (fruits, vegetables, whole grains) and WATER help the waste move out of the body easily."),
  ],
  heart_lungs: [
    C("The heart pumps, the lungs take in air", "The HEART pumps blood around the body. The LUNGS take in air, and give its OXYGEN to the blood. When you run, your muscles need more oxygen, so your heart beats faster and you breathe faster."),
  ],
  habitats: [
    C("Body parts that fit the home", "Polar bear: THICK FUR AND FAT keep it warm on the ice. Camel: WIDE, PADDED FEET don't sink in sand. Fish: GILLS take oxygen from water. Duck: WEBBED FEET paddle in water. Cactus: lives in the DESERT and stores water in its thick stem."),
  ],
  soil_rocks: [
    C("What soil is made of", "Soil is BROKEN ROCKS AND ROTTED LEAVES: tiny bits of rock mixed with decayed plants and animals. CLAY soil holds the most water, SANDY soil lets water run through fast, LOAMY soil is best for plants."),
    C("Earthworms help", "Earthworms help because THEY MAKE TUNNELS FOR AIR AND WATER to reach the roots, and their waste feeds the soil. Farmers love earthworms!"),
  ],
  moon_phases: [
    C("New moon and full moon", "The Moon shines because IT REFLECTS THE SUN'S LIGHT. It goes around the Earth in ABOUT A MONTH. At NEW MOON we can't see it at all; at FULL MOON its whole round face is bright."),
  ],
  simple_machines: [
    C("Ramps and wheels", "A RAMP: pushing a box UP A SLOPE NEEDS LESS FORCE than lifting it straight up. A WHEEL AND AXLE (in a bicycle, a cart, a car) lets things roll instead of drag. A see-saw is a LEVER; a well's rope-wheel is a PULLEY."),
  ],
  heat: [
    C("Conductors and insulators", "METAL LETS HEAT THROUGH QUICKLY (a conductor): that's why cooking pots are metal. Plastic and wood are insulators: THEY DON'T LET HEAT THROUGH EASILY: that's why pot handles are plastic or wood."),
    C("Which way heat goes", "Heat goes from HOT to COLD. Hold ice: heat goes FROM YOUR HAND TO THE ICE, so the ice melts and your hand feels cold. A THERMOMETER measures how hot something is."),
  ],
  circuit: [
    C("Open switch: no light", "When the switch is OPEN there is a gap, so electricity can't flow: the bulb does NOT glow. Close the switch, the loop is complete, the bulb lights.", { type: "diagram", name: "circuit", show: "names" }),
    C("Conductors and safety", "Metals like a COPPER WIRE let electricity flow (conductors). Rubber, plastic and wood don't (insulators). Wires are covered in plastic TO KEEP US SAFE from shocks. Never touch sockets!"),
  ],
  // ---------------- vedas & wisdom ----------------
  four_vedas: [
    C("Learned by heart", "Before books, the Vedas were LEARNED BY HEART, TEACHER TO STUDENT. Students repeated every verse in special patterns, forwards and in pairs, so not one sound changed for thousands of years. The RIG Veda is the oldest."),
  ],
  gita_karma: [
    C("Using it every day", "Worried about a test? FOCUS ON STUDYING WELL, STEP BY STEP. Came 4th after practising hard? YOU DID YOUR PART WELL; KEEP PRACTISING. Won a game? STAY HUMBLE AND KIND. Wrong answer? STAY CALM, LEARN FROM IT, TRY AGAIN. 'Samatvam' means STAYING CALM AND BALANCED IN SUCCESS AND FAILURE."),
  ],
  gita_self: [
    C("Using it every day", "Thinking 'I'm bad at maths'? SAY 'I CAN'T DO IT YET' AND KEEP TRYING. Rain spoiled your picnic? THE SAD FEELING WILL PASS; FIND SOMETHING ELSE FUN. Scared to go on stage? BREATHE, REMEMBER YOU PRACTISED, DO YOUR BEST. Who can be your best friend or your worst enemy? YOURSELF."),
  ],
  gita_balance: [
    C("Using it every day", "Want the tablet all evening? BALANCE: SOME PLAY, THEN HOMEWORK, DINNER AND SLEEP ON TIME. A friend's drawing is messy? Say SOMETHING TRUE AND KIND, LIKE 'I LIKE YOUR COLOURS!'. A little cousin copies you? BE A GOOD EXAMPLE. Before speaking ask: IS IT TRUE? IS IT KIND? IS IT HELPFUL?"),
  ],
  honesty_gratitude: [
    C("What honesty and thanks look like", "Too much change from the shopkeeper? GIVE IT BACK. Broke something and no one saw? TELL THE TRUTH AND SAY SORRY. Your teacher helped you? SAY 'THANK YOU' AND KEEP PRACTISING. A guest comes? WELCOME THEM WARMLY, OFFER WATER. A friend wants to copy your homework? HELP THEM UNDERSTAND, NOT COPY."),
  ],
  kindness_teamwork: [
    C("What kindness looks like", "A new child speaks another language? SMILE, HELP, AND PLAY WITH THEM. Your team disagrees? LISTEN TO EACH OTHER AND DECIDE TOGETHER. A friend is sad? SIT WITH THEM AND ASK WHAT HAPPENED. A street dog is thirsty? ASK AN ADULT TO HELP GIVE IT WATER."),
  ],
  care_earth: [
    C("What caring for the Earth looks like", "A tap is running? CLOSE IT. No bin in the park? KEEP THE WRAPPER AND THROW IT IN A BIN LATER. Going shopping? CARRY YOUR OWN CLOTH BAG: it's used for years, while a plastic bag pollutes for hundreds of years."),
  ],
  health_routine: [
    C("Healthy choices", "10 pm and you want one more episode? SWITCH OFF AND SLEEP: the body grows and the brain stores learning while you sleep. Best breakfast? FRUIT, MILK AND A ROTI OR POHA. Why move every day? IT KEEPS THE HEART, BONES AND MIND STRONG."),
  ],
  emotions: [
    C("What to do with big feelings", "Angry because someone took your toy? STOP AND TAKE 5 SLOW BREATHS, then say 'Please ask first'. A friend broke your toy by mistake? STAY CALM, TELL THEM IT'S OKAY, FIX IT TOGETHER. Lost a match? IT'S OKAY TO FEEL SAD; IT WILL PASS; PRACTISE FOR NEXT TIME."),
  ],
  effort_time: [
    C("Little and often", "Want to play the keyboard well? PRACTISE A LITTLE EVERY DAY. Homework or play? HOMEWORK FIRST, THEN PLAY. Why daily practice? THE BRAIN LEARNS BEST IN SMALL, REGULAR STEPS, like drops filling a pot."),
  ],
  life_stages: [
    C("Skills for each stage", "You are a STUDENT (BRAHMACHARYA) now: learn and build habits. A grown-up householder should WORK HONESTLY AND CARE FOR THE FAMILY. Grandparents telling stories are SHARING WISDOM (VĀNAPRASTHA). MANAGING MONEY WISELY helps at every stage."),
  ],
  sama_music: [
    C("Exact sounds", "In Vedic chanting EACH SOUND MUST BE EXACT, LIKE NOTES IN MUSIC: the right pitch and the right pronunciation. That is how the Vedas stayed unchanged for thousands of years, and why music practice needs care with every note."),
  ],
  shulba_geometry: [
    C("The 3-4-5 rope trick", "Tie a rope into 3 + 4 + 5 equal parts and pull it into a triangle: you get A SQUARE CORNER (RIGHT ANGLE). For a garden bed: MARK 3 AND 4 STEPS ON THE SIDES AND MAKE THE DIAGONAL 5. The Shulba Sutras were used for BUILDING ALTARS OF EXACT SHAPES."),
  ],
  four_aims: [
    C("The aims in daily life", "ARTHA is earning money and security. Someone who gets rich by cheating forgot DHARMA. Got ₹100 as a gift? SAVE SOME, SPEND SOME WISELY, SHARE A LITTLE: that follows all the aims."),
  ],
  // ---------------- money & finance ----------------
  why_money: [
    C("More about barter and money", "In barter, 5 mangoes could buy A CLAY POT. The biggest problem: THE OTHER PERSON MAY NOT WANT WHAT YOU HAVE. Money, like A ₹10 COIN, is a promise of VALUE: you can buy bread with a real note because EVERYONE TRUSTS THE REAL NOTE. A fisher who wants milk can SELL FISH FOR MONEY, THEN BUY MILK."),
    C("Money connects everyone", "Before money there was BARTER: swapping. A farmer with rice who needs shoes, when the shoemaker doesn't want rice? SELL RICE FOR MONEY, THEN BUY SHOES. Money is easier because EVERYONE ACCEPTS IT."),
  ],
  needs_wants: [
    C("Need or want? More examples", "NEEDS: medicine when you are ill, a warm blanket in winter, a pencil for school, food. WANTS: a video game, sweets every day, a birthday cake. With ₹100 for the week, FOOD FIRST: IT IS A NEED."),
    C("Needs first, then save", "Drinking water, shoes that fit, a school bag: NEEDS. A third toy car: a WANT. You have ₹50, need a notebook (₹30) and want a chocolate (₹40)? BUY THE NOTEBOOK, SAVE THE REST (₹20) for a want later."),
  ],
  earning: [
    C("Who earns for what", "A farmer earns for GROWING FOOD, a doctor for HELPING SICK PEOPLE GET WELL, a teacher for TEACHING CHILDREN, a carpenter FOR MAKING USEFUL FURNITURE. SELLING COOKIES YOU BAKED is earning; a gift or a coin you find is not. Does money grow on trees? NO, PEOPLE EARN IT BY WORKING."),
    C("Ways money is earned", "A family's money mostly comes from WORK DONE BY THE GROWN-UPS. LEARNING USEFUL SKILLS helps you earn more later. Helping a neighbour carry shopping and being given ₹10 is EARNING BY HELPING. Pay per hour × hours = what you earn: ₹100 × 2 hours = ₹200."),
  ],
  spend_wisely: [
    C("Five smart-shopper habits", "1. Ask: DO I NEED IT, OR JUST WANT IT RIGHT NOW? 2. Compare PRICES IN DIFFERENT SHOPS. 3. CHECK IF IT IS WELL MADE BEFORE BUYING. 4. Short of money? SAVE A LITTLE MORE, THEN BUY IT. 5. Remember: NO: ADVERTS ARE MADE TO MAKE YOU WANT THINGS. And a daily snack? BUY IT ONLY SOMETIMES AND SAVE THE REST."),
    C("Smart choices", "Saw an advert and want it badly? WAIT A DAY AND THINK IF YOU REALLY NEED IT. 'Buy 2 get 1 free' on biscuits you don't like? NO, YOU'D WASTE MONEY ON THINGS YOU WON'T USE. A friend has expensive shoes? YOUR SHOES ARE FINE; YOU DON'T NEED TO COPY."),
  ],
  sharing_dana: [
    C("Dāna every day", "Dāna means GIVING TO PEOPLE WHO NEED IT, and it makes the giver HAPPY. A friend forgot lunch? SHARE SOME OF YOUR LUNCH. Books too easy now? GIVE THEM TO A YOUNGER CHILD. Money for giving goes in THE SHARE JAR. The Īśa Upaniṣad says: ENJOY BY SHARING, DON'T BE GREEDY."),
    C("Ways to share", "Your share jar has ₹30? BUY NOTEBOOKS FOR A CHILD WHO NEEDS THEM. No money? You can still share: YES: TIME, HELP, TOYS OR KIND WORDS. Why give a little? IT BUILDS A KIND HABIT AND HELPS OTHERS."),
  ],
  money_safety: [
    C("More safety rules", "An OTP is A SECRET CODE SENT BY SMS. Does a real bank ask for your PIN? NEVER. A 'win ₹10,000' link? DON'T CLICK; SHOW A GROWN-UP. Your game password? KEEP IT SECRET, EVEN FROM FRIENDS. A parent's card on the table? GIVE IT BACK TO THEM, NEVER USE IT ALONE. Someone online wants your address? DON'T SHARE; TELL A TRUSTED ADULT."),
    C("What to do", "A caller asks for an OTP? DON'T TELL; HANG UP AND TELL A PARENT. The bank PIN is known ONLY BY THE ACCOUNT HOLDER. A game asks for a card number? CLOSE IT AND ASK A GROWN-UP. A stranger online asks for money? DON'T SEND; TELL A TRUSTED ADULT."),
  ],
  best_buy: [
    C("Compare two packs", "3 for ₹9 or 7 for ₹28? Divide each: ₹9 ÷ 3 = ₹3 each; ₹28 ÷ 7 = ₹4 each. ₹3 is less, so '3 for ₹9' is the better buy. Always find the price for ONE, then pick the smaller."),
  ],
  borrowing: [
    C("Borrowing in real life", "Why is borrowing for a want risky? YOU PAY BACK MORE AND MAY GET INTO DEBT. Borrowed a friend's pencil box? RETURN IT ON TIME, IN GOOD CONDITION. Interest: borrow ₹100 at 20% and pay back ₹100 + ₹20 = ₹120."),
  ],
  money_for_life: [
    C("Money words for life", "A BUDGET is A PLAN FOR HOW MONEY WILL BE SPENT AND SAVED. With a first job, SAVE part of every salary. Parents save for education because SCHOOL AND COLLEGE COST A LOT OVER MANY YEARS. The biggest family cost is usually A HOME. A PENSION is MONEY PAID TO PEOPLE IN OLD AGE AFTER THEY STOP WORKING, and OLDER FAMILY MEMBERS help the next generation."),
    C("Why grown-ups plan", "An emergency fund is TO PAY FOR SURPRISES LIKE ILLNESS OR REPAIRS. Insurance HELPS PAY BIG COSTS IF SOMETHING BAD HAPPENS. Start saving young because MONEY HAS MORE YEARS TO GROW. At your age the habit that matters most: SAVING A LITTLE AND TELLING NEEDS FROM WANTS."),
  ],
  prices_rise: [
    C("Keeping up with prices", "Money in a box buys less later because PRICES RISE OVER TIME (INFLATION). SAVINGS THAT EARN INTEREST keep up better. A ₹20 book with prices rising 10%: 10% of ₹20 = ₹2, so next year ₹22."),
  ],
  coins_notes: [
    C("Making the same amount", "Ten ₹1 coins = one ₹10 note. Two ₹5 coins = ₹10. Five ₹20 notes = ₹100. To find how many: divide the big value by the small one: ₹50 ÷ ₹10 = 5 notes."),
  ],
  saving_goal: [
    C("How many weeks?", "A toy costs ₹160, you have ₹140, you save ₹20 a week. First find what is still needed: ₹160 − ₹140 = ₹20. Then divide by the weekly saving: ₹20 ÷ ₹20 = 1 week."),
  ],
  three_jars: [
    C("Splitting money", "₹20: HALF to spend = ₹10. 4 parts of 10 to save: one tenth of ₹20 is ₹2, so 4 × ₹2 = ₹8. 1 part of 10 to share = ₹2. Check: ₹10 + ₹8 + ₹2 = ₹20."),
  ],
  lemonade_business: [
    C("Working out profit", "6 cups at ₹5 each: sales = ₹5 × 6 = ₹30. Costs ₹25. Profit = ₹30 − ₹25 = ₹5. If costs had been ₹35, it would be a LOSS of ₹5."),
  ],
  bank_interest: [
    C("Interest for more years", "₹200 at 5% a year: 5% of ₹200 = ₹10 each year (5% means 5 for every 100). After 2 years: ₹10 × 2 = ₹20 of interest."),
  ],
};
