# Melo: honest review, SWOT and go-to-market plan (USA and India)

As of 2026-11-24.

Melo is not ready to sell today; a narrow first paid version is about 12 weeks away. Lead with Indian heritage
learning for Indian-American families in the USA, and with schools and music academies in India.

## Honest verdict

The teaching product is strong and unusually broad. Five problems would hurt a paid launch, and ads would mostly
send people into them. None needs a rewrite.

**What is ready**

- Music on the child's own instrument, with microphone listening and coaching; step-by-step lessons that explain the why.
- 20 languages with 150 everyday phrases each, and real native-speaker recordings where they exist.
- Maths with Vedic tricks, science, money and finance, Vedas and Gita lessons; teach-before-ask, no repeated questions, revision.
- Progress charts, a parent chat, offline use, data kept on the family's own computer.
- Engineering: about 400 automated tests, a security sweep, installers for Windows, macOS and Linux built automatically.

**What blocks a paid launch**

| Blocker | Why it matters | Fix |
| --- | --- | --- |
| Desktop only | Children aged 3 to 8 mostly use phones and tablets; Indian families mostly use Android | Hosted web version that installs from the browser, then an Android app |
| AI brain licence | Claude Code login is for personal use; Melo's own README says families need an API key | Hosted AI paid by subscription, or a free local model (Ollama), or offline teacher only |
| Computer voices | Shipped clips come from edge-tts and gTTS, unofficial use of Microsoft and Google voices | Licensed voice service (Azure or Google Cloud) or an openly licensed voice model |
| Unreviewed content | All phrases, Vedas, Gita, shlokas and missions were written by the AI | Native speakers for launch languages; a teacher of Indian traditions for the Vedas lessons |
| No real children yet | Tested with simulated children and generated voices only | Beta with 20 to 50 real families |

Also missing: payments and licence keys, accounts, automatic updates, privacy policy, terms, parental consent, and
signed installers (Windows and macOS warn on install).

## SWOT

Melo's edge is Indian heritage learning that no large competitor offers. Its weaknesses are fixable product and
licensing gaps; its biggest outside risks are free giants and children's-data law.

| | Helpful | Harmful |
| --- | --- | --- |
| **Internal** | **Strengths:** music on the child's own instrument with coaching; 20 languages incl. 10 Indian ones, Hinglish; Vedic maths, Vedas, Gita, money in rupees; teach-before-ask, no repeats, revision, the why behind every answer; offline and private by default; well tested, installers for 3 systems | **Weaknesses:** desktop only; no licensed AI plan for customers; unofficial computer voices; AI-written content not yet reviewed; never used by real children; message too wide for a 15-second ad; no payments, accounts, updates or support process; Malayalam and Urdu missing |
| **External** | **Opportunities:** Indian-American parents who want language, music and values kept alive (pay more, poorly served); schools, music academies and tuition centres in India on Windows PCs; heritage classes abroad (Bal Vihar, Bal Gokulam, temples); free Microsoft Store listing that removes install warnings; Diwali, summer and birthday gifting | **Threats:** free or bundled giants (Khan Academy Kids, Duolingo music and maths); children's-data law (COPPA in the USA, DPDP in India); ad platforms ban targeting children; high cost per paying family at Indian prices; sensitivity of religious content; AI providers' prices and terms can change |

## All changes needed

Twenty-two changes, grouped by workstream; the eleven marked P1 must be done before anyone pays. Effort is a rough
estimate for one developer working with Claude.

| # | Workstream | Change | Priority | Effort |
| --- | --- | --- | --- | --- |
| 1 | AI | Choose the customer AI plan: hosted AI through an API key on your server (paid by subscription), plus free local model and offline teacher as fallbacks; remove Claude Code login for customers | P1 | 1 week |
| 2 | Voices | Re-record shipped computer voices with a licensed service (Azure or Google Cloud text-to-speech) or an openly licensed model; keep native recordings | P1 | 1 week |
| 3 | Content | Native-speaker review of the launch languages: English, Hindi, Gujarati, Telugu, Tamil, Marathi | P1 | 3 to 4 weeks, in parallel |
| 4 | Content | Review of Vedas, Gita, shlokas and missions by a teacher of Indian traditions | P1 | 2 weeks, in parallel |
| 5 | Product | Licence keys and a free tier vs paid plan inside the app | P1 | 1 week |
| 6 | Payments | Card payments (USA) and UPI (India) through a payment provider | P1 | 1 week |
| 7 | Legal | Privacy policy, terms of use, parental consent screen, data deletion | P1 | 1 week + lawyer review |
| 8 | Distribution | Microsoft Store package (MSIX); Microsoft signs it, so no install warning | P1 | 3 to 5 days |
| 9 | Distribution | macOS: Apple Developer ID, signing and notarization (already wired in CI) | P1 | 1 day + Apple approval |
| 10 | Research | Beta with 20 to 50 real families and 2 or 3 Indian centres; fix what they struggle with | P1 | 4 weeks |
| 11 | Marketing | Landing page per market, 30-second demo video with a real child, 3 to 5 parent quotes | P1 | 2 weeks |
| 12 | Product | Malayalam (and possibly Urdu): words, 150 phrases, voices | P2 | 1 to 2 weeks |
| 13 | Product | Automatic updates inside the app | P2 | 3 to 5 days |
| 14 | Product | Hosted web version that installs from the browser (needed for tablets and Android) | P2 | 4 to 6 weeks |
| 15 | Product | Accounts and optional cloud sync between devices | P2 | 2 to 3 weeks |
| 16 | Product | Centre mode for India: many children, teacher view, printable progress reports | P2 | 2 weeks |
| 17 | Product | Android app on Google Play (wrap of the web version), Families policy compliance | P2 | 2 to 3 weeks |
| 18 | Product | Shareable progress card for WhatsApp | P2 | 2 to 3 days |
| 19 | Product | Native recordings: keep filling `voice-tracker.csv` for the launch languages | P2 | ongoing |
| 20 | Brand | Trademark search for the name Melo in the USA and India; logo and store art | P2 | 1 week |
| 21 | Support | Help page, contact email, crash reports with parent consent | P2 | 3 to 5 days |
| 22 | Product | iPad: the hosted web version works in Safari; a native iOS app only if demand shows | P3 | later |

## Platforms

Start with your own website plus the Microsoft Store in both markets, add direct sales to centres in India, and add
Google Play once the web version exists.

| Platform | Market | Use it for | Cost | Notes |
| --- | --- | --- | --- | --- |
| Own website + payment provider | USA, India | Main sales page, trials, licence keys | Payment fees | USA: a merchant of record (Paddle, Polar, Dodo Payments) handles sales tax; Stripe directly if you have a US company. India: Razorpay or Cashfree for UPI and cards; you register for GST. One source says Lemon Squeezy is closing: avoid it ([1](https://gauravtiwari.org/lemon-squeezy-alternatives/), [2](https://dodopayments.com/blogs/top-merchant-of-record-for-saas-india)) |
| Microsoft Store | USA, India | Trusted Windows install, discovery, Store payments | Free to join | Microsoft signs MSIX packages, so no warning ([1](https://learn.microsoft.com/en-us/windows/apps/publish/faq/get-started-with-the-microsoft-store), [2](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)) |
| Direct download for macOS | USA | Mac families | Apple Developer Program, USD 99 a year | Signed and notarized download; the Mac App Store sandbox would clash with Melo's local server and AI |
| Direct sales to centres | India first | Schools, music academies, tuition centres | Your time | One sale covers many children; demo in person |
| Community partners | USA | Bal Vihar, Bal Gokulam, temples, cultural associations | Discounts or revenue share | Group licences for weekend heritage classes |
| Google Play | India first, then USA | Android families (largest group in India) | USD 25 one-time (from memory; confirm) | Needs the web version first; Families policy rules for children's apps; Teacher Approved badge later ([policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en), [Teacher Approved](https://play.google.com/intl/it/console/about/teacherapproved/)) |
| Apple App Store | USA, later | iPad and iPhone | USD 99 a year | Only if demand shows; the web version covers iPad first |

## USA go-to-market

Sell to Indian-American parents of children aged 3 to 10 as a heritage-learning app. The mainstream US kids' music
market is crowded, so music alone is not the pitch.

- **Customer:** Indian-American parents who want their child to keep Hindi, Gujarati, Telugu, Tamil or Marathi, plus Indian music and values. Laptops are common; iPads are everywhere.
- **Promise for ads:** "Your child speaks with grandma, sings a shloka and plays a song on their own keyboard, at home, 15 minutes a day."
- **Lead features:** heritage languages with native voices and grandparents' recordings; Vedas, shlokas and Gita for children; Vedic maths; music on the child's own instrument.
- **Channels, in order:**
    1. Community: Bal Vihar and Bal Gokulam classes, temples, Indian cultural associations; group licences and a teacher demo.
    2. Google Search: high-intent phrases such as "Hindi classes for kids online", "learn Telugu for kids", "Gujarati for kids app", "Vedic maths for kids".
    3. Meta and YouTube video: a real child singing a shloka or answering grandma in Gujarati.
    4. Parent WhatsApp and Facebook groups; referral offer (one month free per family referred).
- **Where:** metros with large Indian communities: New Jersey, the San Francisco Bay Area, Dallas, Houston, Chicago, Seattle, Atlanta.
- **Seasons:** Diwali gifting, summer break, the start of the school year, birthdays.
- **Compliance (COPPA):** verifiable parental consent before collecting a child's personal information, and a child's voice recording counts. One secondary source says the amended rule's compliance date was 22 April 2026; confirm with the FTC or a lawyer. Local-only storage helps; cloud AI or a hosted version needs the full consent flow and no third-party ad or tracking code.
- **Ads rules:** never target children. Meta no longer allows targeting by ethnicity, so use interests (Indian festivals, Indian cooking, Bollywood) and lookalikes built from your own beta parents' emails.

## India go-to-market

Start with schools, music academies and tuition centres, which run Windows PCs and buy for many children at once.
Sell to families once the Android version exists.

- **First customer:** small private schools, music academies, after-school and tuition centres in cities. **Later:** urban parents on Android.
- **Promise:** "Music, Vedic maths and your child's own language in one app, works offline, with progress reports for parents."
- **Lead features:** music on the child's own instrument (keyboard, harmonium, xylophone); Vedic maths; Hindi and regional languages; money lessons in rupees; progress reports.
- **Channels, in order:**
    1. Direct sales: in-person demos to centres in one or two cities first; a free pilot term, then a per-child or per-centre licence.
    2. Centre referrals and parent WhatsApp sharing of progress cards.
    3. Instagram Reels and YouTube Shorts: a child playing a song on a toy keyboard with Melo's coaching.
    4. Google Search: "Vedic maths for kids", "keyboard classes for kids at home", "Hindi rhymes for kids". Clicks are cheap, but so is what families pay.
- **Product needs specific to India:** UPI payments and GST invoices; centre mode (many children, teacher view, printable reports); Android for families; Malayalam.
- **Market size, for context:** India's school-age edtech market is estimated at about USD 4.74 billion in 2026, and parents compare app prices with tuition fees ([Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/india-k-12-edtech-market)).
- **Compliance (DPDP):** anyone under 18 is a child; you need verifiable parental consent and cannot use personalised ads or behavioural tracking. Most duties reportedly apply about 18 months after the November 2025 rules, so around mid-2027; build it in now. Schools will want a short data-processing agreement ([LiveLaw](https://www.livelaw.in/articles/dpdp-child-data-rules-demand-edtech-platforms-555317), [Baker Botts](https://ourtake.bakerbotts.com/post/102lund/india-notifies-final-rules-for-digital-data-protection-act)).

## Pricing to test

Starting points to test in the beta, not market-tested prices. Check Simply Piano, Yousician and PlanetSpark prices
in their own apps before you set yours.

| Plan | USA | India |
| --- | --- | --- |
| Free | Core lessons, 1 child, offline teacher | Core lessons, 1 child, offline teacher |
| Family | USD 7.99 a month or USD 59 to 79 a year, up to 4 children | INR 149 to 299 a month or INR 999 to 1,999 a year |
| Centre | Group licence for heritage classes (per class per year) | Per child per year (test INR 300 to 600) or a flat centre licence |
| AI features | In the yearly plan if hosted AI costs allow; else a paid add-on | Add-on, or a free local model |

Cost to watch: the hosted AI and licensed voices are paid per use, so measure cost per active child in the beta
before fixing prices.

## Roadmap

Twelve weeks to a soft launch, with three gates; nothing moves to the next phase until its gate is met.

| Phase | Weeks | What happens | Gate to move on |
| --- | --- | --- | --- |
| Fix blockers | 1 to 3 | AI plan chosen; licensed voices; licence keys and payments; privacy and consent; Microsoft Store and Mac signing | **Beta ready:** P1 product items done |
| Review and beta | 3 to 8 | Native-speaker review; Vedas content review; 20 to 50 US families; 2 or 3 Indian centres; fix what they hit | **Sell ready:** content reviewed, beta problems fixed |
| Launch kit | 8 to 10 | Landing pages; real-child demo video; parent quotes; Malayalam; in-app updates | **Ads ready:** video, quotes and pages live |
| Soft launch | 10 to 12 | Website and Microsoft Store; centre sales in India; small ad tests; start the web app and Android | **Scale:** cost per paying family below 12-month revenue |

Content review runs in parallel with the beta. The web app and Android version start at launch and take about 6 to
9 more weeks.

## Ads

Start paid ads only after the beta, the demo video and parent quotes exist (about week 9). Before that, ads buy
installs that will not convert.

- **Gate to start:** all P1 changes done; at least 20 beta families active for 2 weeks; one real-child demo video; 3 to 5 parent quotes; landing pages with privacy policy and consent.
- **Test budget:** about INR 500 to 1,000 (India) or USD 15 to 30 (USA) a day per channel for 2 weeks; stop what doesn't convert, scale what does.
- **USA:** Google Search on heritage-language and Vedic maths phrases in the metros listed above; Meta and YouTube video to parents (interests and lookalikes, adults only).
- **India:** Instagram Reels and YouTube Shorts of a child playing with Melo; Google Search on Vedic maths and keyboard lessons; centre sales stay the main channel.
- **Measure:** cost per trial, trial-to-paid rate, cost per paying family, and what a family pays over 12 months. Scale only where cost per paying family is clearly below 12-month revenue.
- **Rules:** never target children on any platform; all ads speak to parents ([Meta age-restricted ads](https://conductatlas.com/platform/meta-ads/meta-advertising-policies/age-restricted-advertising-requirements/), [Meta Advertising Standards](https://transparency.meta.com/policies/ad-standards/)).

## Open questions

- [ ] Do you have, or will you form, a company in the USA, in India, or both? This decides payments, tax and app-store accounts.
- [ ] Which AI plan: hosted AI paid by subscription, or offline plus free local model only?
- [ ] Who reviews the launch languages and the Vedas content?
- [ ] Is the name Melo free to trademark in both countries?

The market figures, policy dates and prices above come from search results and third-party summaries, several of
them secondary; confirm the legal points with a lawyer before launch.

## Sources

- [Microsoft Store: free individual registration](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)
- [Microsoft Store: free company registration (May 2026)](https://blogs.windows.com/windowsdeveloper/2026/05/07/publish-to-microsoft-store-as-a-company-now-with-free-registration-and-faster-onboarding/)
- [Microsoft Store FAQ: signing](https://learn.microsoft.com/en-us/windows/apps/publish/faq/get-started-with-the-microsoft-store)
- [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)
- [Google Play Teacher Approved](https://play.google.com/intl/it/console/about/teacherapproved/)
- [Meta: age-restricted advertising](https://conductatlas.com/platform/meta-ads/meta-advertising-policies/age-restricted-advertising-requirements/)
- [Meta Advertising Standards](https://transparency.meta.com/policies/ad-standards/)
- [Mordor Intelligence: India K-12 edtech market](https://www.mordorintelligence.com/industry-reports/india-k-12-edtech-market)
- [LiveLaw: DPDP child-data rules for edtech](https://www.livelaw.in/articles/dpdp-child-data-rules-demand-edtech-platforms-555317)
- [Baker Botts: India's final DPDP rules](https://ourtake.bakerbotts.com/post/102lund/india-notifies-final-rules-for-digital-data-protection-act)
- [Lemon Squeezy alternatives after the shutdown](https://gauravtiwari.org/lemon-squeezy-alternatives/)
- [Dodo Payments: merchant of record for India](https://dodopayments.com/blogs/top-merchant-of-record-for-saas-india)

## Progress on the master branch (2026-11-24)

Done in code (tested):

- [x] #1 Customer AI plan: families' copies (retail edition) never use or offer a personal Claude Code login; offline teacher, local Ollama or the family's own API key. Your copy keeps Claude Code (`KM_EDITION=dev` in Melo/.env).
- [x] #5 Licence keys and a free tier: offline-signed family plan keys; free plan = 1 child, first 5 songs, 1 language, first 2 topics per strand; Parent → ⭐ Plan.
- [x] #7 (drafts) Privacy policy, terms of use, parent agreement at sign-up; data deletion was already there.
- [x] #8 Microsoft Store package (MSIX) built in CI; the Store signs it on upload.
- [x] #13 Update check: a banner when a newer release is out.
- [x] #21 (part) Help and feedback page.
- [~] #2 Licensed voices: 2,318 clips re-recorded with openly licensed Piper voices (commercial use allowed: CC0, public domain, CC BY, CC BY-SA) in English, German, Spanish, French, Russian (male), Telugu, Marathi (female) and Bengali. Still edge-tts: Hindi, Tamil, Gujarati, Kannada, Punjabi and the other non-Indian languages (see PROGRESS.md).
- [x] Engagement: Note Rain falling-notes game (worlds, stars, USB keyboards), soft background music, 16 life-skills stories.

Only you can do these (launch checklist):

1. **Back up the licence private key** `C:\Users\<you>\.melo\licence_private.key` (password manager or an encrypted USB drive). Without it no new keys can be issued for copies already sold. Never share or commit it.
2. Issue keys: `python backend/scripts/licence_keys.py issue --to "<buyer>"` (add `--days 365` for a yearly plan). Gumroad, Payhip and similar shops can email a key from a list you upload.
3. Fill `SUPPORT_EMAIL`, `SELLER` and `BUY_URL` in `frontend/src/pages/Legal.tsx`.
4. Have a lawyer review the Privacy Policy and Terms (`frontend/src/pages/Legal.tsx`); bump the versions there and in `backend/app/legal.py` after changes.
5. Microsoft Store: register in Partner Center (free), reserve the name "Melo", then set the GitHub repository variables `MSIX_IDENTITY_NAME`, `MSIX_PUBLISHER`, `MSIX_PUBLISHER_DISPLAY` from its Product identity page; upload `Melo-<version>.msix` from the CI run.
6. Publish a release (tag `v1.5.1` or later) so the update check has something to point to.
7. Still open from the plan: licensed voices (#2), content review (#3, #4), the beta (#10), landing pages and video (#11).

