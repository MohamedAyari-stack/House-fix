"""Matching a free-text need ("fuite sous l'évier", "leaking pipe", "تسرب الماء") with prestataire profiles.

TF-IDF on character n-grams (3-5) tolerates typos, plurals and conjugations
("fuites", "fuyait"), and a domain lexicon links everyday words to trades
("disjoncteur" -> électricité) so a need can match a profile that never uses the same word.
Profiles are written in French: the lexicon also maps English and Arabic (including Tunisian)
words to the French trade vocabulary, so a need in any of the app's three languages matches them.
"""

import re
import unicodedata

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Everyday words -> trade vocabulary appended to the need before matching.
LEXIQUE: dict[str, str] = {
    "fuite": "plomberie plombier canalisation sanitaire",
    "robinet": "plomberie plombier sanitaire",
    "evier": "plomberie plombier canalisation",
    "wc": "plomberie plombier sanitaire",
    "toilette": "plomberie plombier sanitaire",
    "chauffe": "plomberie chauffe-eau",
    "canalisation": "plomberie plombier debouchage",
    "bouche": "plomberie debouchage canalisation",
    "courant": "electricite electricien",
    "disjoncteur": "electricite electricien tableau",
    "prise": "electricite electricien",
    "lumiere": "electricite electricien eclairage",
    "lampe": "electricite electricien eclairage",
    "cable": "electricite electricien",
    "clim": "climatisation climatiseur",
    "climatiseur": "climatisation entretien",
    "chaud": "climatisation chauffage",
    "froid": "climatisation climatiseur",
    "serrure": "serrurerie serrurier",
    "cle": "serrurerie serrurier",
    "porte": "serrurerie menuiserie",
    "bloque": "serrurerie serrurier ouverture",
    "meuble": "menuiserie menuisier bois",
    "placard": "menuiserie menuisier bois",
    "fenetre": "menuiserie menuisier aluminium vitrerie",
    "bois": "menuiserie menuisier",
    "mur": "peinture peintre",
    "peindre": "peinture peintre",
    "jardin": "jardinage jardinier",
    "gazon": "jardinage jardinier",
    "arbre": "jardinage taille",
    "menage": "nettoyage",
    "nettoyer": "nettoyage",
    "sale": "nettoyage",
    "etanch": "etancheite toit terrasse",
    "infiltration": "etancheite humidite",
    "humidite": "etancheite humidite",
    "toit": "etancheite toit terrasse",
    "terrasse": "etancheite toit terrasse",
    "pluie": "etancheite toit terrasse",
    "carrel": "maconnerie carrelage",
    "faience": "maconnerie carrelage",
    "dalle": "maconnerie carrelage",
    "macon": "maconnerie carrelage",
    "ciment": "maconnerie carrelage",
    "fissure": "maconnerie carrelage",
    "electromenager": "electromenager reparation",
    "machine laver": "electromenager reparation",
    "lave linge": "electromenager reparation",
    "lave vaisselle": "electromenager reparation",
    "frigo": "electromenager reparation",
    "refrigerateur": "electromenager reparation",
    "congelateur": "electromenager reparation",
    "micro onde": "electromenager reparation",
    "alumin": "aluminium vitrerie",
    "vitre": "aluminium vitrerie",
    "verre": "aluminium vitrerie",
    "baie vitree": "aluminium vitrerie",
    "grille": "ferronnerie soudure",
    "portail": "ferronnerie soudure",
    "rampe": "ferronnerie soudure",
    "soud": "ferronnerie soudure",
    "fer forge": "ferronnerie soudure",
    "pompe": "pompes baches eau surpresseur",
    "surpresseur": "pompes baches eau surpresseur",
    "citerne": "pompes baches eau citerne",
    "bache": "pompes baches eau citerne",
    "pression": "pompes baches eau surpresseur",
    # "gaz" alone would also catch "gazon".
    "chauffage": "chauffage gaz chaudiere",
    "chaudiere": "chauffage gaz chaudiere",
    "radiateur": "chauffage gaz radiateur",
    "gaz naturel": "chauffage gaz",
    "solaire": "energie solaire",
    "photovolta": "energie solaire photovoltaique",
    "prosol": "energie solaire",
    # English
    "leak": "plomberie plombier canalisation sanitaire",
    "pipe": "plomberie plombier canalisation sanitaire",
    "tap": "plomberie plombier canalisation sanitaire",
    "faucet": "plomberie plombier canalisation sanitaire",
    "sink": "plomberie plombier canalisation sanitaire",
    "toilet": "plomberie plombier canalisation sanitaire",
    "plumb": "plomberie plombier canalisation sanitaire",
    "drain": "plomberie plombier canalisation sanitaire debouchage",
    "clog": "plomberie plombier canalisation sanitaire debouchage",
    "water heater": "plomberie chauffe-eau",
    "boiler": "plomberie chauffe-eau",
    "electric": "electricite electricien",
    "power": "electricite electricien",
    "breaker": "electricite electricien tableau",
    "fuse": "electricite electricien tableau",
    "outlet": "electricite electricien",
    "socket": "electricite electricien",
    "light": "electricite electricien eclairage",
    "lamp": "electricite electricien eclairage",
    "wiring": "electricite electricien",
    "wire": "electricite electricien",
    "air con": "climatisation climatiseur",
    "aircon": "climatisation climatiseur",
    "conditioning": "climatisation climatiseur",
    "cooling": "climatisation climatiseur",
    "heating": "climatisation chauffage gaz chaudiere",
    "lock": "serrurerie serrurier",
    "key": "serrurerie serrurier",
    "door": "serrurerie menuiserie",
    "locksmith": "serrurerie serrurier",
    "furniture": "menuiserie menuisier bois",
    "cupboard": "menuiserie menuisier bois",
    "wardrobe": "menuiserie menuisier bois",
    "window": "menuiserie menuisier aluminium vitrerie",
    "wood": "menuiserie menuisier bois",
    "carpent": "menuiserie menuisier bois",
    "paint": "peinture peintre",
    "wall": "peinture peintre",
    "garden": "jardinage jardinier",
    "lawn": "jardinage jardinier",
    "grass": "jardinage jardinier",
    "tree": "jardinage taille",
    "hedge": "jardinage taille",
    "clean": "nettoyage",
    "dirty": "nettoyage",
    "housekeep": "nettoyage",
    "waterproof": "etancheite toit terrasse",
    "roof": "etancheite toit terrasse",
    "damp": "etancheite humidite",
    "rain": "etancheite toit terrasse",
    "tile": "maconnerie carrelage",
    "tiling": "maconnerie carrelage",
    "mason": "maconnerie carrelage",
    "brick": "maconnerie carrelage",
    "concrete": "maconnerie carrelage",
    "crack": "maconnerie carrelage",
    "appliance": "electromenager reparation",
    "washing machine": "electromenager reparation",
    "fridge": "electromenager reparation",
    "refrigerator": "electromenager reparation",
    "freezer": "electromenager reparation",
    "dishwasher": "electromenager reparation",
    "oven": "electromenager reparation",
    "microwave": "electromenager reparation",
    "glass": "aluminium vitrerie",
    "glazing": "aluminium vitrerie",
    "gate": "ferronnerie soudure",
    "railing": "ferronnerie soudure",
    "weld": "ferronnerie soudure",
    "wrought iron": "ferronnerie soudure",
    "pump": "pompes baches eau surpresseur",
    "pressure": "pompes baches eau surpresseur",
    "water tank": "pompes baches eau citerne",
    "cistern": "pompes baches eau citerne",
    "radiator": "chauffage gaz radiateur",
    "gas": "chauffage gaz",
    "solar": "energie solaire",
    # Arabic, normalized like the need (ة->ه, أ/إ/آ->ا, ى->ي), Tunisian words included
    "تسرب": "plomberie plombier canalisation sanitaire",
    "تسريب": "plomberie plombier canalisation sanitaire",
    "ماء": "plomberie plombier canalisation sanitaire",
    "مياه": "plomberie plombier canalisation sanitaire",
    "حنفيه": "plomberie plombier canalisation sanitaire",
    "روبيني": "plomberie plombier canalisation sanitaire",
    "مغسله": "plomberie plombier canalisation sanitaire",
    "بالوعه": "plomberie plombier canalisation sanitaire debouchage",
    "مرحاض": "plomberie plombier canalisation sanitaire",
    "سخان": "plomberie chauffe-eau",
    "قنوات": "plomberie plombier canalisation sanitaire",
    "انسداد": "plomberie plombier canalisation sanitaire debouchage",
    "سباك": "plomberie plombier canalisation sanitaire",
    "بلومبي": "plomberie plombier canalisation sanitaire",
    "كهرباء": "electricite electricien",
    "كهربا": "electricite electricien",
    "تيار": "electricite electricien",
    "قاطع": "electricite electricien tableau",
    "ديجونكتور": "electricite electricien tableau",
    "مقبس": "electricite electricien",
    "بريز": "electricite electricien",
    "ضوء": "electricite electricien eclairage",
    "اضاءه": "electricite electricien eclairage",
    "لمبه": "electricite electricien eclairage",
    "سلك": "electricite electricien",
    "اسلاك": "electricite electricien",
    "مكيف": "climatisation climatiseur",
    "تكييف": "climatisation climatiseur",
    "كليماتيزور": "climatisation climatiseur",
    "كليما": "climatisation climatiseur",
    "تبريد": "climatisation climatiseur",
    "تدفئه": "climatisation chauffage gaz chaudiere",
    "قفل": "serrurerie serrurier",
    "اقفال": "serrurerie serrurier",
    "مفتاح": "serrurerie serrurier",
    "مفاتيح": "serrurerie serrurier",
    "باب": "serrurerie menuiserie",
    "سرير": "menuiserie menuisier bois",
    "اثاث": "menuiserie menuisier bois",
    "خزانه": "menuiserie menuisier bois",
    "نافذه": "menuiserie menuisier aluminium vitrerie",
    "شباك": "menuiserie menuisier bois",
    "خشب": "menuiserie menuisier bois",
    "نجار": "menuiserie menuisier bois",
    "طلاء": "peinture peintre",
    "دهان": "peinture peintre",
    "صباغه": "peinture peintre",
    "حائط": "peinture peintre",
    "جدار": "peinture peintre",
    "حديقه": "jardinage jardinier",
    "جنينه": "jardinage jardinier",
    "عشب": "jardinage jardinier",
    "شجره": "jardinage taille",
    "اشجار": "jardinage taille",
    "تنظيف": "nettoyage",
    "نظافه": "nettoyage",
    "عزل": "etancheite toit terrasse",
    "سطح": "etancheite toit terrasse",
    "رطوبه": "etancheite humidite",
    "مطر": "etancheite toit terrasse",
    "جليز": "maconnerie carrelage",
    "بلاط": "maconnerie carrelage",
    "بناء": "maconnerie carrelage",
    "اسمنت": "maconnerie carrelage",
    "سيمان": "maconnerie carrelage",
    "تشقق": "maconnerie carrelage",
    "شقوق": "maconnerie carrelage",
    "غساله": "electromenager reparation",
    "ثلاجه": "electromenager reparation",
    "فريجيدار": "electromenager reparation",
    "فرن": "electromenager reparation",
    "منيوم": "aluminium vitrerie",
    "بلور": "aluminium vitrerie",
    "زجاج": "aluminium vitrerie",
    "حديد": "ferronnerie soudure",
    "حداد": "ferronnerie soudure",
    "بوابه": "ferronnerie soudure",
    "لحام": "ferronnerie soudure",
    "مضخه": "pompes baches eau surpresseur",
    "بومبه": "pompes baches eau surpresseur",
    "ضغط": "pompes baches eau surpresseur",
    # Not "خزان": it would also catch "خزانه" (cupboard).
    "ماجل": "pompes baches eau citerne",
    "صهريج": "pompes baches eau citerne",
    "شوفاج": "chauffage gaz chaudiere",
    "غاز": "chauffage gaz",
    "راديتور": "chauffage gaz radiateur",
    "شمس": "energie solaire",
    "بروسول": "energie solaire",
}

STOPWORDS = {
    # English
    "the", "my", "is", "it", "in", "of", "and", "to", "on", "under", "keeps", "not", "no", "i", "need",
    # Arabic
    "في", "من", "على", "الى", "عن", "لا", "ما", "مع", "هذا", "هذه", "عندي", "يوجد",
    # French
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au", "aux", "en", "dans", "sur",
    "sous", "pour", "par", "avec", "mon", "ma", "mes", "ne", "pas", "plus", "qui", "que", "est", "il", "elle",
    "j", "je", "l", "d", "y", "me", "tres", "depuis", "besoin",
}

# Below this best similarity, the need says nothing useful about any candidate (measured: unrelated trades
# score 0.00-0.12, the right trade 0.54-0.77 with char n-grams + the lexicon).
MIN_SIGNAL = 0.15
# Raw cosine at which a profile counts as a full match. A fixed scale (not "relative to the best candidate")
# keeps the feature identical whether one candidate is scored (training) or many (recommendation).
FULL_MATCH = 0.50


# Arabic letter variants written interchangeably.
ARABIC_FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ـ": None})


def normalize(text: str | None) -> str:
    """Lowercase, strip accents and Arabic diacritics, unify Arabic letter variants, drop punctuation and stop words."""
    text = unicodedata.normalize("NFKD", (text or "").lower())
    text = "".join(c for c in text if not unicodedata.combining(c)).translate(ARABIC_FOLD)
    words = re.findall(r"[a-z0-9]+|[ء-ي]+", text)
    return " ".join(w for w in words if w not in STOPWORDS)


def _arabic(word: str) -> bool:
    return "ء" <= word[0] <= "ي"


def _mentions(text: str, words: list[str], key: str) -> bool:
    """Latin keys match a word prefix ("leaking" ~ "leak"); multi-word keys match the phrase;
    Arabic keys match inside a word, which absorbs prefixes such as ال (the) and و (and)."""
    if " " in key:
        return key in text
    if _arabic(key):
        return any(key in w for w in words if _arabic(w))
    return any(w.startswith(key) for w in words)


def expand(need: str) -> str:
    """Appends the (French) trade vocabulary of every lexicon word found in the need."""
    text = normalize(need)
    words = text.split()
    extra = [trade for key, trade in LEXIQUE.items() if _mentions(text, words, key)]
    return " ".join([*words, *extra])


def similarities(need: str | None, documents: list[str]) -> list[float] | None:
    """Similarity in [0, 1] of the need with each document (1 = full match), or None without a usable need."""
    query = expand(need or "")
    if not query.strip() or not documents:
        return None

    corpus = [normalize(d) for d in documents]
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
    matrix = vectorizer.fit_transform([*corpus, query])
    raw = cosine_similarity(matrix[-1], matrix[:-1]).ravel()

    if float(raw.max()) < MIN_SIGNAL:
        return None
    return [min(1.0, float(s) / FULL_MATCH) for s in raw]
