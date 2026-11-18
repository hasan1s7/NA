# Nabu: a one-page collaborator brief for London

**What Nabu is:** A reader and learning system built around the media people actually care about: a poem, a message, an article, a dialogue, or a video transcript. A learner can encounter language, understand a phrase in context, save it with its source, and return later. Nabu's aim is not to replace real media with a lessons conveyor belt.

**What the person experiences:** They open a piece. If the text has a recurring written pattern, one **optional**, plain-language preflight can point it out. They can ignore it, read normally, tap a phrase, ask for a meaning, save it, and try a trustworthy later check. Assistance is always distinguished from independent performance. The result feels like a useful reader, not a probabilistic dashboard.

**Why analyze media ahead of time?** Two texts can contain exactly the same words but present them very differently: one repeats an accessible frame with changing nouns, another varies word order and context. A general-purpose media profile records source features once and later supports a learner-specific decision without reprocessing the whole piece for everyone. This can highlight genuinely useful opportunities while still letting the learner choose their own media.

**What runs already:** The inspected Nabu 1.18 main branch contains a curated encounter-to-return reader, word support and saving, authored tasks, versioned progress and evidence, a language graph, learner and intent infrastructure, and twelve registered learning languages. Only bounded authored analyses and tasks can claim reliable scoring. The new local **surface preflight** implementation counts exact written forms and repeated phrase frames, validates simple anchors, abstains when segmentation is unsupported, and inserts an optional note into existing reader code using a guarded installer. Its isolated unit tests pass. It has **not** been pushed or verified as an integrated release.

**What it does not know yet:** Repeated spelling is not repeated meaning. The profile does not infer a person's vocabulary, handle morphology comprehensively, parse arbitrary syntax, predict learning gains or generate scored tasks for anything clicked. These are research questions and later capabilities, not secretly operational ones. We also do not claim uniform linguistic quality across all twelve languages.

**How the architecture scales:** Six independently versioned objects -- source, occurrence, linguistic analysis, task, encounter, trajectory -- let source analysis be reusable, private learner evidence remain private, and recommendations be changed without rewriting history. The language graph proposes relationships; it does not manufacture evidence of learner knowledge. Keep graph inference, memory transitions and learning interventions separate.

**What the first slice demonstrates:** A learner-independent analysis can identify recurrence and variation, render it quietly, and leave accounts, cards, assessments and reviews untouched. It demonstrates technical feasibility for **descriptive** pre-analysis, not an experimentally measured learning benefit. We have 11 local unit-test passes and an isolated Chromium demonstration; the full Nabu browser and native regression suite remains a release gate.

**What to test with collaborators:** Does optional preflight improve **delayed unaided comprehension in unseen contexts**, over the same Nabu reader without preflight? Does stable-versus-varied repetition work differently for beginners and advanced learners? Can a transparent goal-aware recommendation outperform an accessibility-only baseline without increasing frustration? Can dependent recognition/recall/production models be better calibrated than independent ones on identical histories?

**The ask:** Collaborate on language reviewed sources, prospective user studies, defensible tasks and calibration, not on a mystical 'AI teacher knows what you know' pitch. Workshop slides 21-23 were referenced but not available for verified review.

**One-sentence proposition:** *Nabu turns the language someone chooses to encounter into source-grounded, assistance-aware opportunities to understand more independently next time -- and tests whether that actually happens.*

**Learner-facing explanation:** `public/nabu-ux-whitepaper.html` is a shareable mobile-responsive page that explains the seven-step Nabu UX circuit without Bayesian notation. It distinguishes what is already coded from an isolated prototype and from unvalidated learning hypotheses. It is not deployed to GitHub Pages yet.
