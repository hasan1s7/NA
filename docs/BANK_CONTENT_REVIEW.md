# Expanded bank: editorial scope and review queue

The new bank contains 900 word meanings, 90 practical phrases and 36 expressions. The expansion adds 600 / 60 / 24 respectively. Content is AI-assisted, originally authored draft material; it is not a scraped corpus and no native-speaker approval is claimed.

## Representation

- Word records link selected senses, not every possible dictionary meaning. Noun/verb and device/animal ambiguities have separate concept IDs.
- Natural phrase forms may use different grammar or question polarity across languages. For example, the seat-availability note warns that the Japanese wording asks whether the seat is free rather than occupied. The sample reply avoids a misleading bare yes/no.
- Phrase `literalGlosses` are English wording explanations keyed by the language being explained. They are not exact word-alignment annotations or literal translations in every target language.
- Expression `terms[origin]` contains the source expression; other forms express its meaning. `meaningTerms` supplies plain meanings for every language; `literalTerms` supplies the source image. Literal renderings are only presented as source-specific when translating out of the expression's supplied language.
- `origin` identifies the supplied expression language, not etymology. Similar metaphors may exist elsewhere.
- Usage is currently explained in English. Examples and possible replies are supplied in all twelve languages. Examples are fictional learning sentences, not provider or user conversations.

## Prioritized native review

Review original and new material, not just the added entries. Check Arabic MSA versus conversational use, gender and verb inflection; simplified Chinese classifier and kinship specificity; Japanese/Korean register, idiom use and dictionary forms; Portuguese regional variants; Russian gender/aspect; and morphology/register across the European languages and Turkish.

Kinship entries deliberately warn when a dictionary form specifies paternal/maternal branches or relative age. A few alternate branches are lookup aliases, but the canonical result still requires choosing the correct branch in actual speech. Italian nipote and other broad forms remain sense-disambiguated. Do not present these as universally interchangeable family terms.

Food/allergy-related phrases are not certified safety communication. Words and phrase templates outside the bank still require context and a configured provider or manual translation. Standard word forms and example inflection do not constitute a full morphology engine.

## Source-sense references

The following were consulted for selected source-expression meanings only. No long quotations are included; multilingual forms, literal guides, examples and replies are authored drafts. These references do not count as native review of the bank.

- Cambridge Dictionary, spill the beans: https://dictionary.cambridge.org/us/dictionary/english/spill-the-beans
- Dictionary.com, break the ice: https://www.dictionary.com/browse/break-the-ice
- KBS World, Korean idioms involving hands and feet: https://world.kbs.co.kr/service/contents_view.htm?board_seq=369320
- DAS Akademie, German idioms: https://dasakademie.com/de/sprache-und-kultur/redewendungen/
- Larousse French-Spanish, pied idioms: https://www.larousse.fr/dictionnaires/francais-espagnol/pied/60391
- Observatorio da Lingua Portuguesa, expressions list: https://observalinguaportuguesa.org/lista-de-expressoes-idiomaticas/

## Updating the content

Keep concept IDs stable unless a sense is genuinely different. Change expansion inputs and rebuild; do not hand-edit generated JS/HTML. New corrections belong in `data/expansion/corrections.json`. Preserve provenance, reviewer identity/date and the distinction between a source consulted and a translation actually reviewed. Do not set `humanReviewed: true` or change draft status just because automated tests pass.
