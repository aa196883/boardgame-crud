import os
import re

try:  # pragma: no cover - optional dependency
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - tests may not have python-dotenv
    def load_dotenv(*_args, **_kwargs):
        return False

try:  # pragma: no cover - import guard for optional dependency
    import openai
    from openai import OpenAI
except ModuleNotFoundError:  # pragma: no cover - handled at runtime when used
    openai = None

# Load environment variables from .env file
load_dotenv()
if openai is not None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY introuvable. Vérifie backend/.env ou tes variables d'environnement."
        )

    client = OpenAI(api_key=api_key)

def generate_sql_from_question(question: str) -> str:
    if openai is None:
        raise RuntimeError("OpenAI client is not available. Install openai to enable text-to-SQL.")
    # 1. Define schema description
    schema_description = """
    Tu es un assistant SQL. Tu écris uniquement du SQL SQLite.
    Base de données des jeux : table `jeux`.

    Colonnes de la table `jeux` :
    - nom_du_jeu TEXT : le nom du jeu
    - temps_de_jeu TEXT : durée lisible, ex "10 - 20 min"
    - duree_min_minutes INTEGER : durée minimum en minutes
    - duree_max_minutes INTEGER : durée maximum en minutes
    - nombre_de_joueurs TEXT : ex "2 à 4"
    - joueurs_min INTEGER : nombre minimum de joueurs
    - joueurs_max INTEGER : nombre maximum de joueurs
    - en_equipe TEXT : "OUI" si jeu en équipes, "AU CHOIX" si en équipes possibles, "NON" sinon
    - support_particulier TEXT : ex "Cartes, Dés"
    - type_de_jeu TEXT : ex "Connaissances, Rapidité", "Compétitif"
    - tout_le_monde_peut_jouer TEXT : "oui" si accessible à tout le monde, "non" sinon, ou indique un élément spécifique (ex "calculs", "Réflexion, culture précise")

    Règles :
    - Réponds avec UNE SEULE requête SELECT valide pour SQLite.
    - Utilise uniquement la table `jeux`.
    - Utilise uniquement les colonnes données ci-dessus.
    - Ne modifie pas la base de données.
    - Pas de point-virgule final.
    - Inclue un ORDER BY nom_du_jeu.
    - Retourne toutes les colonnes avec SELECT *.
    - Pour les filtres de texte, utilise toujours LIKE avec des % et des guillemets simples, jamais =.
    - Pour les jeux en équipes, "OUI" et "AU CHOIX" sont acceptables si on veut inclure les jeux en équipes.
    - Ne réponds pas avec du texte, uniquement la requête SQL.
    """

    # 2. Add examples (few-shot prompting)
    examples = """
    Exemple 1 :
    Question : "je veux tous les jeux coopératifs pour 2 joueurs"
    Réponse :
    SELECT *
    FROM jeux
    WHERE type_de_jeu LIKE '%Coopératif%'
    AND joueurs_min <= 2
    AND joueurs_max >= 2
    ORDER BY nom_du_jeu

    Exemple 2 :
    Question : "jeux de culture générale de moins de 15 minutes"
    Réponse :
    SELECT *
    FROM jeux
    WHERE type_de_jeu LIKE '%Culture générale%'
    AND (duree_min_minutes <= 15 OR duree_max_minutes <= 15)
    ORDER BY nom_du_jeu

    Exemple 3 :
    Question : "nom = Citadelles"
    Réponse :
    SELECT *
    FROM jeux
    WHERE nom_du_jeu = 'Citadelles'
    ORDER BY nom_du_jeu
    """

    # 3. Final prompt with user's question
    final_prompt = f"""{schema_description}

    {examples}

    Maintenant, écris uniquement la requête SQL pour :
    Question : "{question}"
    Réponse :
    """

    # Call OpenAI
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Tu es un assistant qui génère du SQL SQLite."},
            {"role": "user", "content": final_prompt},
        ],
        temperature=0,
    )

    sql = completion.choices[0].message.content.strip()
    return sql

ALLOWED_COLUMNS = {
    "nom_du_jeu",
    "temps_de_jeu",
    "duree_min_minutes",
    "duree_max_minutes",
    "nombre_de_joueurs",
    "joueurs_min",
    "joueurs_max",
    "en_equipe",
    "support_particulier",
    "type_de_jeu",
    "tout_le_monde_peut_jouer",
}

SQL_KEYWORDS = {
    "select", "from", "where", "and", "or", "order", "by",
    "asc", "desc", "like", "in", "between", "is", "null",
    "not", "group", "having", "limit", "case", "when",
    "then", "end", "else", "as", "distinct", "on", "inner",
    "left", "right", "join", "outer"
}

FORBIDDEN_PATTERNS = [
    r"\binsert\b",
    r"\bupdate\b",
    r"\bdelete\b",
    r"\bdrop\b",
    r"\balter\b",
    r"\bcreate\b",
    r";",  # no statement chaining
]


def is_sql_safe(sql: str) -> bool:
    if not isinstance(sql, str):
        print("SQL is not a string")
        return False

    # 1. Basic shape checks
    lowered = sql.strip().lower()

    # must start with SELECT
    if not lowered.startswith("select"):
        print("SQL does not start with SELECT")
        return False

    # must read FROM jeux (we'll accept aliases later if needed,
    # but for now we keep it strict)
    if "from jeux" not in lowered:
        print("SQL does not read FROM jeux")
        return False

    # forbid dangerous stuff
    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, lowered):
            print(f"Forbidden pattern found: {pat}")
            return False

    # 2. Remove all single-quoted strings so we don't accidentally think
    #    'Citadelles' is an identifier.
    #    This regex removes 'anything inside quotes', including accents/spaces.
    sql_no_strings = re.sub(r"'[^']*'", "''", sql)

    # 3. Extract candidate identifiers
    #    We'll grab all tokens that look like barewords: letters/underscores/digits
    #    (this will catch column names, table names, keywords, etc.)
    candidates = set(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", sql_no_strings))

    # 4. Filter out known SQL keywords and numbers and the table name itself
    cleaned = {
        ident
        for ident in candidates
        if ident.lower() not in SQL_KEYWORDS
        and ident.lower() != "jeux"
        and not ident.isdigit()
    }

    # 5. Now, any remaining identifiers MUST either:
    #    - be "*"  (select *)
    #    - or be one of our allowed columns.
    # Note: "*" won't be captured by the regex above, so we don't need to handle it here.

    for ident in cleaned:
        # example: ORDER, BY etc are filtered already; now we check columns
        if ident not in ALLOWED_COLUMNS:
            print(f"Unsafe identifier found: {ident}")
            return False

    return True


if __name__ == "__main__":
    # # Simple test
    # questions = [
    #     "je veux tous les jeux coopératifs pour 2 joueurs",
    #     "jeux de culture générale de moins de 15 minutes",
    #     "nom = Citadelles",
    # ]
    # for question in questions:
    #     sql = generate_sql_from_question(question)
    #     print(f"Question: {question}\nSQL: {sql}\nSafe: {is_sql_safe(sql)}\n")

    # # safety test
    # safe_sql = """
    # SELECT *
    # FROM jeux
    # WHERE nom_du_jeu LIKE 'Citadelles'
    # ORDER BY nom_du_jeu
    # """
    # unsafe_sql = """
    # DROP TABLE jeux;
    # """

    # print(f"Safe SQL is safe: {is_sql_safe(safe_sql)}")
    # # print(f"Unsafe SQL is safe: {is_sql_safe(unsafe_sql)}")

    pass
