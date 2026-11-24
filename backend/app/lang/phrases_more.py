"""More everyday conversations (2026-11-24): every topic grows to at least 10 phrases, and five new day-to-day
scenarios (at home, getting around, at the doctor, celebrations, time and weather) with 10 phrases each.

Same format as phrases.py: "native text|romanisation" (romanisation only for non-Latin scripts). The lists in
phrases_more_*.py follow MORE_PHRASES in order, one list per language.
NOTE: written by the model; a native-speaking teacher should review them before classroom use.
First-person sentences use gender-neutral forms where the language allows: Hindi / Marathi / Punjabi /
Gujarati "mujhe ... hai" (dative) constructions, Arabic "ash'uru bi..." (I feel...), French and Spanish
phrasings without a gendered adjective, Russian present-tense verbs. Routines are said as "let's..." so they
fit every child.
"""
from __future__ import annotations

# (topic id, picture, English title): the five new scenarios
MORE_TOPICS: list[tuple[str, str, str]] = [
    ("home", "🏠", "At home"), ("travel", "🚌", "Getting around"), ("doctor", "🩺", "At the doctor"),
    ("celebrate", "🎈", "Celebrations"), ("weather", "🌦️", "Time and weather"),
]

# (id, topic, picture, English): the English is also the meaning shown to the child
MORE_PHRASES: list[tuple[str, str, str, str]] = [
    # greetings +5
    ("p_afternoon", "greetings", "🌤️", "Good afternoon!"), ("p_evening", "greetings", "🌆", "Good evening!"),
    ("p_night", "greetings", "🌃", "Good night!"), ("p_see_you", "greetings", "📅", "See you tomorrow!"),
    ("p_nice_day", "greetings", "🌈", "Have a nice day!"),
    # meeting +5
    ("p_from_q", "meeting", "🗺️", "Where are you from?"), ("p_live", "meeting", "🏘️", "My home is near here."),
    ("p_this_friend", "meeting", "👭", "This is my friend."), ("p_little", "meeting", "🤏", "I know a little."),
    ("p_class_q", "meeting", "🎒", "Which class are you in?"),
    # polite +5
    ("p_no_thanks", "polite", "🙅", "No, thank you."), ("p_yes_please", "polite", "🙆", "Yes, please."),
    ("p_may_i", "polite", "🤲", "May I?"), ("p_after_you", "polite", "🫴", "After you."), ("p_bless", "polite", "🤧", "Bless you!"),
    # directions +5
    ("p_where_q", "directions", "🔎", "Where is it?"), ("p_far", "directions", "🏔️", "It is far."),
    ("p_here_it", "directions", "👇", "It is here."), ("p_upstairs", "directions", "🪜", "Go upstairs."),
    ("p_stop_here", "directions", "🚏", "Stop here, please."),
    # food +5
    ("p_thirsty", "food", "🥤", "I am thirsty."), ("p_not_spicy", "food", "🌶️", "Not spicy, please."),
    ("p_like_food", "food", "🍲", "I like this food."), ("p_eat_q", "food", "🍱", "What are we eating?"),
    ("p_milk", "food", "🍼", "Milk, please."),
    # help +5
    ("p_lost", "help", "😟", "I can't find my way."), ("p_call_mum", "help", "📞", "Please call my mother."),
    ("p_mean_q", "help", "🧐", "What does this mean?"), ("p_cant_find", "help", "🔦", "I can't find it."),
    ("p_wait", "help", "⏳", "Please wait."),
    # market +5
    ("p_this_one", "market", "☝️", "This one, please."), ("p_how_many", "market", "🔢", "How many?"),
    ("p_cheap", "market", "🪙", "It is cheap."), ("p_change", "market", "💱", "Here is your change."),
    ("p_take_it", "market", "🛒", "I will take it."),
    # school +2, friends +2, feelings +4
    ("p_open_book", "school", "📚", "Open your book."), ("p_listen", "school", "👂", "Please listen."),
    ("p_come_here", "friends", "🏃", "Come here!"), ("p_hide_seek", "friends", "🙈", "Let's play hide and seek!"),
    ("p_angry", "feelings", "😠", "I am angry."), ("p_excited", "feelings", "🤩", "I am so excited!"),
    ("p_miss_you", "feelings", "💌", "I miss you."), ("p_love_you", "feelings", "❤️", "I love you."),
    # at home
    ("p_we_home", "home", "🏡", "We are home!"), ("p_brush", "home", "🪥", "Let's brush our teeth."),
    ("p_wash_hands", "home", "🧼", "Wash your hands."), ("p_bath", "home", "🛁", "Bath time!"),
    ("p_dress", "home", "👕", "Let's get dressed."), ("p_tidy", "home", "🧹", "Let's tidy the room."),
    ("p_can_help", "home", "🥄", "May I help?"), ("p_dinner", "home", "🍛", "Dinner is ready!"),
    ("p_tv_q", "home", "📺", "May I watch TV?"), ("p_bedtime", "home", "🛏️", "Time for bed."),
    # getting around
    ("p_bus", "travel", "🚌", "The bus is coming."), ("p_sit", "travel", "💺", "Sit down, please."),
    ("p_belt", "travel", "🚗", "Wear your seat belt."), ("p_cross", "travel", "🚸", "Let's cross the road."),
    ("p_green", "travel", "🚦", "Wait for the green light."), ("p_train", "travel", "🚆", "We are going by train."),
    ("p_arrived", "travel", "🎯", "We have arrived."), ("p_ticket", "travel", "🎫", "One ticket, please."),
    ("p_how_long", "travel", "⏱️", "How long will it take?"), ("p_hold_hand", "travel", "🫶", "Hold my hand."),
    # at the doctor
    ("p_sick", "doctor", "🤒", "I don't feel well."), ("p_head", "doctor", "🤕", "My head hurts."),
    ("p_tummy", "doctor", "🤢", "My tummy hurts."), ("p_cough", "doctor", "😷", "I have a cough."),
    ("p_fever", "doctor", "🌡️", "I have a fever."), ("p_medicine", "doctor", "💊", "Take this medicine."),
    ("p_open_mouth", "doctor", "👄", "Open your mouth."), ("p_breath", "doctor", "🫁", "Take a deep breath."),
    ("p_better", "doctor", "💪", "I feel better now."), ("p_rest", "doctor", "🛌", "Rest today."),
    # celebrations
    ("p_birthday", "celebrate", "🎈", "Happy birthday!"), ("p_party", "celebrate", "🥳", "Come to my party!"),
    ("p_gift", "celebrate", "🎁", "This is for you."), ("p_wow", "celebrate", "😍", "Wow, thank you!"),
    ("p_cake", "celebrate", "🍰", "Let's cut the cake."), ("p_sing", "celebrate", "🎤", "Let's sing a song."),
    ("p_dance", "celebrate", "💃", "Let's dance!"), ("p_new_year", "celebrate", "🎆", "Happy New Year!"),
    ("p_congrats", "celebrate", "🏆", "Congratulations!"), ("p_photo", "celebrate", "📸", "Let's take a photo!"),
    # time and weather
    ("p_time_q", "weather", "🕒", "What time is it?"), ("p_monday", "weather", "🗓️", "Today is Monday."),
    ("p_holiday", "weather", "🏖️", "Tomorrow is a holiday."), ("p_raining", "weather", "🌧️", "It is raining."),
    ("p_sunny", "weather", "😎", "It is sunny."), ("p_cold", "weather", "🥶", "It is cold."),
    ("p_hot", "weather", "🥵", "It is hot."), ("p_windy", "weather", "🌬️", "It is windy."),
    ("p_late", "weather", "⏰", "We are late!"), ("p_early", "weather", "🐓", "It is early."),
]
