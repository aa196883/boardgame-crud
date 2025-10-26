#!/usr/bin/env python3
"""
Clean the board-game CSV and populate the SQLite database.

Usage:
    python backend/prepare_games_db.py

Options:
    --csv <path> : source CSV path (default backend/games_DB.csv)
    --db  <path> : target SQLite file (default backend/games.db)
"""

from __future__ import annotations

import argparse
import csv
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional, Sequence, Tuple


COL_NOM_DU_JEU = "Nom du jeu"
COL_TEMPS_DE_JEU = "Temps de jeu"
COL_NOMBRE_DE_JOUEURS = "Nombre de joueurs"
COL_EN_EQUIPE = "En \u00e9quipe ?"
COL_SUPPORT = "Support particulier suppl\u00e9mentaire"
COL_TYPE_DE_JEU = "Type de jeu"
COL_TOUT_LE_MONDE = "Tout le monde peut jouer ?"

HEADER_NORMALIZATION = {
    "": COL_NOM_DU_JEU,
    COL_NOM_DU_JEU: COL_NOM_DU_JEU,
    "Nom du jeu": COL_NOM_DU_JEU,
    COL_TEMPS_DE_JEU: COL_TEMPS_DE_JEU,
    "Temps de jeu": COL_TEMPS_DE_JEU,
    COL_NOMBRE_DE_JOUEURS: COL_NOMBRE_DE_JOUEURS,
    "Nombre de joueurs": COL_NOMBRE_DE_JOUEURS,
    COL_EN_EQUIPE: COL_EN_EQUIPE,
    "En \u01f8quipe ?": COL_EN_EQUIPE,
    "En Ǹquipe ?": COL_EN_EQUIPE,
    "En équipe ?": COL_EN_EQUIPE,
    COL_SUPPORT: COL_SUPPORT,
    "Support particulier supplémentaire": COL_SUPPORT,
    "Support particulier supplementaire": COL_SUPPORT,
    "Support particulier\nsupplémentaire": COL_SUPPORT,
    "Support particulier suppl\u01f8mentaire": COL_SUPPORT,
    COL_TYPE_DE_JEU: COL_TYPE_DE_JEU,
    "Type de jeu": COL_TYPE_DE_JEU,
    COL_TOUT_LE_MONDE: COL_TOUT_LE_MONDE,
    "Tout le monde  peut jouer ?": COL_TOUT_LE_MONDE,
    "Tout le monde \npeut jouer ?": COL_TOUT_LE_MONDE,
}

NULL_MARKERS = {"", "∅", "Ø"}

TABLE_NAME = "jeux"


@dataclass(frozen=True)
class Jeu:
    nom_du_jeu: str
    temps_de_jeu: Optional[str]
    duree_min_minutes: Optional[int]
    duree_max_minutes: Optional[int]
    nombre_de_joueurs: Optional[str]
    joueurs_min: Optional[int]
    joueurs_max: Optional[int]
    en_equipe: Optional[str]
    support_particulier: Optional[str]
    type_de_jeu: Optional[str]
    tout_le_monde_peut_jouer: str


def clean_header(value: Optional[str]) -> str:
    if value is None:
        return ""
    sanitized = (
        value.replace("\ufeff", "")
        .replace("\r", " ")
        .replace("\n", " ")
    )
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return HEADER_NORMALIZATION.get(sanitized, sanitized)


def clean_cell(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    sanitized = (
        value.replace("\xa0", " ")
        .replace("\r", " ")
        .replace("\n", " ")
        .replace("\u2013", "-")
    )
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    if sanitized in NULL_MARKERS:
        return None
    return sanitized


def parse_duree(value: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    if not value:
        return None, None

    text = value.lower()
    text = re.sub(r"\(.*?\)", "", text)
    text = text.replace("\u2013", "-").replace("à", "-").replace("~", "-")
    tokens = [token.strip() for token in text.split("-") if token.strip()]
    unit_hint = "min" if "min" in text else ("h" if "h" in text else None)

    minutes: list[int] = []
    for token in tokens:
        match = re.search(r"(\d+)", token)
        if not match:
            continue
        number = int(match.group(1))
        unit = (
            "h"
            if "h" in token
            else ("min" if "min" in token else unit_hint)
        )
        if unit == "h":
            number *= 60
        minutes.append(number)

    if not minutes:
        return None, None
    if len(minutes) == 1:
        return minutes[0], minutes[0]
    return min(minutes), max(minutes)


def parse_joueurs(value: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    if not value:
        return None, None

    text = value.lower()
    text = (
        text.replace("joueurs", "")
        .replace("joueur", "")
        .replace("\u2013", "-")
        .replace("à", "-")
        .replace("~", "-")
    )
    tokens = [token.strip() for token in text.split("-") if token.strip()]

    joueurs: list[int] = []
    for token in tokens:
        match = re.search(r"(\d+)", token)
        if not match:
            continue
        joueurs.append(int(match.group(1)))

    if not joueurs:
        return None, None
    if len(joueurs) == 1:
        return joueurs[0], joueurs[0]
    return min(joueurs), max(joueurs)


def normalize_support(value: Optional[str]) -> Optional[str]:
    return clean_cell(value)


def normalize_tout_le_monde(value: Optional[str]) -> str:
    nettoyee = clean_cell(value)
    if nettoyee is None:
        return "oui"
    if nettoyee.lower() == "oui":
        return "oui"
    return nettoyee


def iter_clean_rows(csv_path: Path) -> Iterator[Jeu]:
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        try:
            raw_headers = next(reader)
        except StopIteration as exc:
            raise ValueError("Le fichier CSV est vide.") from exc

        headers = [clean_header(name) for name in raw_headers]
        index = {name: idx for idx, name in enumerate(headers)}

        expected_columns = [
            COL_NOM_DU_JEU,
            COL_TEMPS_DE_JEU,
            COL_NOMBRE_DE_JOUEURS,
            COL_EN_EQUIPE,
            COL_SUPPORT,
            COL_TYPE_DE_JEU,
            COL_TOUT_LE_MONDE,
        ]
        manquants = [name for name in expected_columns if name not in index]
        if manquants:
            raise ValueError(f"Colonnes manquantes dans le CSV: {', '.join(manquants)}")

        def raw_value(row: Sequence[str], column: str) -> Optional[str]:
            pos = index[column]
            return row[pos] if pos < len(row) else None

        for line_number, raw_row in enumerate(reader, start=2):
            nom_jeu = clean_cell(raw_value(raw_row, COL_NOM_DU_JEU))
            if not nom_jeu:
                raise ValueError(f"Ligne {line_number}: le nom du jeu est manquant.")

            temps_de_jeu = clean_cell(raw_value(raw_row, COL_TEMPS_DE_JEU))
            nombre_de_joueurs = clean_cell(raw_value(raw_row, COL_NOMBRE_DE_JOUEURS))
            en_equipe = clean_cell(raw_value(raw_row, COL_EN_EQUIPE))
            support_particulier = normalize_support(raw_value(raw_row, COL_SUPPORT))
            type_de_jeu = clean_cell(raw_value(raw_row, COL_TYPE_DE_JEU))
            tout_le_monde = normalize_tout_le_monde(raw_value(raw_row, COL_TOUT_LE_MONDE))

            duree_min, duree_max = parse_duree(temps_de_jeu)
            joueurs_min, joueurs_max = parse_joueurs(nombre_de_joueurs)

            yield Jeu(
                nom_du_jeu=nom_jeu,
                temps_de_jeu=temps_de_jeu,
                duree_min_minutes=duree_min,
                duree_max_minutes=duree_max,
                nombre_de_joueurs=nombre_de_joueurs,
                joueurs_min=joueurs_min,
                joueurs_max=joueurs_max,
                en_equipe=en_equipe,
                support_particulier=support_particulier,
                type_de_jeu=type_de_jeu,
                tout_le_monde_peut_jouer=tout_le_monde,
            )


def create_database(db_path: Path, jeux: Sequence[Jeu]) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.cursor()
        cursor.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")
        cursor.execute(
            f"""
            CREATE TABLE {TABLE_NAME} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom_du_jeu TEXT NOT NULL UNIQUE,
                temps_de_jeu TEXT,
                duree_min_minutes INTEGER,
                duree_max_minutes INTEGER,
                nombre_de_joueurs TEXT,
                joueurs_min INTEGER,
                joueurs_max INTEGER,
                en_equipe TEXT,
                support_particulier TEXT,
                type_de_jeu TEXT,
                tout_le_monde_peut_jouer TEXT
            )
            """
        )

        cursor.executemany(
            f"""
            INSERT INTO {TABLE_NAME} (
                nom_du_jeu,
                temps_de_jeu,
                duree_min_minutes,
                duree_max_minutes,
                nombre_de_joueurs,
                joueurs_min,
                joueurs_max,
                en_equipe,
                support_particulier,
                type_de_jeu,
                tout_le_monde_peut_jouer
            ) VALUES (
                :nom_du_jeu,
                :temps_de_jeu,
                :duree_min_minutes,
                :duree_max_minutes,
                :nombre_de_joueurs,
                :joueurs_min,
                :joueurs_max,
                :en_equipe,
                :support_particulier,
                :type_de_jeu,
                :tout_le_monde_peut_jouer
            )
            """,
            [jeu.__dict__ for jeu in jeux],
        )
        connection.commit()
    finally:
        connection.close()


def run(csv_path: Path, db_path: Path) -> int:
    jeux = list(iter_clean_rows(csv_path))
    create_database(db_path, jeux)
    print(f"{len(jeux)} jeux importés dans {db_path}.")
    return len(jeux)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Nettoie le CSV des jeux de société et instancie la base SQLite."
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path("backend/games_DB.csv"),
        help="Chemin vers le fichier CSV source.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("backend/games.db"),
        help="Chemin vers la base SQLite à créer.",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    csv_path: Path = args.csv
    db_path: Path = args.db

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV introuvable : {csv_path}")

    run(csv_path, db_path)


if __name__ == "__main__":
    main()
