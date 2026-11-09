"""Hextech Insight analytics service.

A small FastAPI app that turns the matches cached in Supabase into player
statistics: overall performance, per-champion and per-role breakdowns, and
recent form. It only reads from the database and never calls the Riot API,
so it cannot use up the Riot rate limit.

Locally it runs with uvicorn on port 8000 (npm run dev). On Vercel this file
becomes a Python serverless function, and next.config.ts forwards
/api/py/* requests to it.
"""

from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path
from typing import Annotated, Any

import httpx
from fastapi import FastAPI, HTTPException, Path as PathParam, Query, Response
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

try:  # Imported as a package locally (uvicorn api.index:app) and in tests
    from api._insights import PlayerInsights, compute_insights
    from api._match_insights import MatchInsights, compute_match_insights
except ImportError:  # Loaded directly from the api/ directory on Vercel
    from _insights import PlayerInsights, compute_insights  # type: ignore[no-redef]
    from _match_insights import MatchInsights, compute_match_insights  # type: ignore[no-redef]

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def load_local_env() -> None:
    """Reads .env.local during local development (Vercel injects env vars itself)."""
    if os.environ.get("VERCEL"):
        return
    env_file = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()

PARTICIPANT_COLUMNS = ",".join(
    [
        "match_id",
        "game_start",
        "duration_secs",
        "queue_id",
        "team_position",
        "champion_id",
        "champion_name",
        "win",
        "remake",
        "kills",
        "deaths",
        "assists",
        "cs",
        "gold_earned",
        "damage_to_champs",
        "vision_score",
        "kill_participation",
        "double_kills",
        "triple_kills",
        "quadra_kills",
        "penta_kills",
    ]
)

POSITIONS = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")
MAX_CHAMPIONS = 10
RECENT_FORM_SIZE = 10

# ---------------------------------------------------------------------------
# Response models (sent as camelCase JSON to match the TypeScript front end)
# ---------------------------------------------------------------------------


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Multikills(CamelModel):
    double: int = 0
    triple: int = 0
    quadra: int = 0
    penta: int = 0


class OverallStats(CamelModel):
    games: int
    wins: int
    losses: int
    win_rate: float
    avg_kills: float
    avg_deaths: float
    avg_assists: float
    kda: float | None  # None means no deaths (perfect KDA)
    cs_per_min: float
    gold_per_min: float
    damage_per_min: float
    vision_per_min: float
    kill_participation: float | None
    multikills: Multikills


class ChampionStats(CamelModel):
    champion_id: int
    champion_name: str
    games: int
    wins: int
    win_rate: float
    avg_kills: float
    avg_deaths: float
    avg_assists: float
    kda: float | None
    cs_per_min: float


class RoleStats(CamelModel):
    position: str
    games: int
    wins: int
    win_rate: float
    share: float


class Streak(CamelModel):
    kind: str  # "win" or "loss"
    count: int


class PlayerStats(CamelModel):
    puuid: str
    sample_size: int
    remakes_excluded: int
    overall: OverallStats | None
    champions: list[ChampionStats]
    roles: list[RoleStats]
    recent_form: list[bool]  # newest first, True = win
    streak: Streak | None


# ---------------------------------------------------------------------------
# Analytics (pure functions, covered by tests/test_stats.py)
# ---------------------------------------------------------------------------


def safe_ratio(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def kda_ratio(kills: float, deaths: float, assists: float) -> float | None:
    return None if deaths == 0 else round((kills + assists) / deaths, 2)


def summarize_overall(games: list[dict[str, Any]]) -> OverallStats | None:
    if not games:
        return None

    count = len(games)
    wins = sum(1 for game in games if game["win"])
    kills = sum(game["kills"] for game in games)
    deaths = sum(game["deaths"] for game in games)
    assists = sum(game["assists"] for game in games)
    minutes = sum(game["duration_secs"] for game in games) / 60
    participation = [game["kill_participation"] for game in games if game["kill_participation"] is not None]

    return OverallStats(
        games=count,
        wins=wins,
        losses=count - wins,
        win_rate=round(wins / count, 4),
        avg_kills=round(kills / count, 1),
        avg_deaths=round(deaths / count, 1),
        avg_assists=round(assists / count, 1),
        kda=kda_ratio(kills, deaths, assists),
        cs_per_min=round(safe_ratio(sum(game["cs"] for game in games), minutes), 1),
        gold_per_min=round(safe_ratio(sum(game["gold_earned"] for game in games), minutes)),
        damage_per_min=round(safe_ratio(sum(game["damage_to_champs"] for game in games), minutes)),
        vision_per_min=round(safe_ratio(sum(game["vision_score"] for game in games), minutes), 2),
        kill_participation=round(sum(participation) / len(participation), 4) if participation else None,
        multikills=Multikills(
            double=sum(game["double_kills"] for game in games),
            triple=sum(game["triple_kills"] for game in games),
            quadra=sum(game["quadra_kills"] for game in games),
            penta=sum(game["penta_kills"] for game in games),
        ),
    )


def summarize_champions(games: list[dict[str, Any]]) -> list[ChampionStats]:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for game in games:
        grouped[game["champion_id"]].append(game)

    champions = []
    for champion_id, champion_games in grouped.items():
        count = len(champion_games)
        wins = sum(1 for game in champion_games if game["win"])
        kills = sum(game["kills"] for game in champion_games)
        deaths = sum(game["deaths"] for game in champion_games)
        assists = sum(game["assists"] for game in champion_games)
        minutes = sum(game["duration_secs"] for game in champion_games) / 60
        champions.append(
            ChampionStats(
                champion_id=champion_id,
                champion_name=champion_games[0]["champion_name"],
                games=count,
                wins=wins,
                win_rate=round(wins / count, 4),
                avg_kills=round(kills / count, 1),
                avg_deaths=round(deaths / count, 1),
                avg_assists=round(assists / count, 1),
                kda=kda_ratio(kills, deaths, assists),
                cs_per_min=round(safe_ratio(sum(game["cs"] for game in champion_games), minutes), 1),
            )
        )

    # Most played first, then best win rate, then name for a stable order.
    champions.sort(key=lambda champion: (-champion.games, -champion.win_rate, champion.champion_name))
    return champions[:MAX_CHAMPIONS]


def summarize_roles(games: list[dict[str, Any]]) -> list[RoleStats]:
    role_games = [game for game in games if game["team_position"] in POSITIONS]
    total = len(role_games)
    if total == 0:
        return []

    roles = []
    for position in POSITIONS:
        position_games = [game for game in role_games if game["team_position"] == position]
        if not position_games:
            continue
        wins = sum(1 for game in position_games if game["win"])
        roles.append(
            RoleStats(
                position=position,
                games=len(position_games),
                wins=wins,
                win_rate=round(wins / len(position_games), 4),
                share=round(len(position_games) / total, 4),
            )
        )
    roles.sort(key=lambda role: -role.games)
    return roles


def current_streak(games: list[dict[str, Any]]) -> Streak | None:
    """Games must be ordered newest first."""
    if not games:
        return None
    latest_result = games[0]["win"]
    count = 0
    for game in games:
        if game["win"] != latest_result:
            break
        count += 1
    return Streak(kind="win" if latest_result else "loss", count=count)


def compute_player_stats(puuid: str, rows: list[dict[str, Any]]) -> PlayerStats:
    """Builds every statistic from a player's participant rows (newest first)."""
    games = [row for row in rows if not row["remake"]]
    return PlayerStats(
        puuid=puuid,
        sample_size=len(games),
        remakes_excluded=len(rows) - len(games),
        overall=summarize_overall(games),
        champions=summarize_champions(games),
        roles=summarize_roles(games),
        recent_form=[game["win"] for game in games[:RECENT_FORM_SIZE]],
        streak=current_streak(games),
    )


# ---------------------------------------------------------------------------
# Data access (Supabase REST API)
# ---------------------------------------------------------------------------


class ConfigurationError(Exception):
    pass


def supabase_headers(secret_key: str) -> dict[str, str]:
    headers = {"apikey": secret_key, "Accept": "application/json"}
    # Legacy service_role keys are JWTs and also go in the Authorization header.
    if secret_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {secret_key}"
    return headers


def supabase_get(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not supabase_url or not secret_key:
        raise ConfigurationError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set")

    response = httpx.get(
        f"{supabase_url}/rest/v1/{table}",
        params=params,
        headers=supabase_headers(secret_key),
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()


def queue_filter(queue_ids: list[int]) -> dict[str, str]:
    return {"queue_id": f"in.({','.join(str(queue_id) for queue_id in queue_ids)})"} if queue_ids else {}


def fetch_participant_rows(puuid: str, queue_ids: list[int], limit: int) -> list[dict[str, Any]]:
    return supabase_get(
        "match_participants",
        {
            "select": PARTICIPANT_COLUMNS,
            "puuid": f"eq.{puuid}",
            "order": "game_start.desc",
            "limit": str(limit),
            **queue_filter(queue_ids),
        },
    )


INSIGHT_GAME_LIMIT = 60  # 60 games x up to 16 players stays under Supabase's 1,000-row page

INSIGHT_PLAYER_COLUMNS = ",".join(
    [
        "match_id",
        "game_start",
        "duration_secs",
        "queue_id",
        "team_id",
        "team_position",
        "champion_id",
        "champion_name",
        "win",
        "remake",
        "kills",
        "deaths",
        "assists",
        "cs",
        "gold_earned",
        "damage_to_champs",
        "vision_score",
        "matches(game_version)",
    ]
)
LOBBY_COLUMNS = "match_id,puuid,team_id,team_position,champion_id,champion_name,riot_id_name,riot_id_tag"
TIMELINE_COLUMNS = "match_id,puuid,gold_10,cs_10,xp_10,gold_15,cs_15,xp_15"


def fetch_insight_rows(
    puuid: str, queue_ids: list[int]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    player_rows = supabase_get(
        "match_participants",
        {
            "select": INSIGHT_PLAYER_COLUMNS,
            "puuid": f"eq.{puuid}",
            "order": "game_start.desc",
            "limit": str(INSIGHT_GAME_LIMIT),
            **queue_filter(queue_ids),
        },
    )
    if not player_rows:
        return [], [], []

    match_filter = f"in.({','.join(row['match_id'] for row in player_rows)})"
    lobby_rows = supabase_get("match_participants", {"select": LOBBY_COLUMNS, "match_id": match_filter, "limit": "1000"})
    timeline_rows = supabase_get(
        "participant_timeline", {"select": TIMELINE_COLUMNS, "match_id": match_filter, "limit": "1000"}
    )
    return player_rows, lobby_rows, timeline_rows


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Hextech Insight Analytics",
    docs_url="/api/py/docs",
    openapi_url="/api/py/openapi.json",
)

PuuidParam = Annotated[str, PathParam(pattern=r"^[A-Za-z0-9_-]{40,100}$")]


@app.get("/api/py/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/py/stats/{puuid}", response_model=PlayerStats)
def player_stats(
    puuid: PuuidParam,
    response: Response,
    queue: Annotated[list[int], Query(max_length=10)] = [],  # noqa: B006 (FastAPI copies defaults)
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> PlayerStats:
    try:
        rows = fetch_participant_rows(puuid, queue, limit)
    except ConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Could not load matches from the database") from error

    # Let Vercel's CDN reuse the answer briefly; stats only change when new matches arrive.
    response.headers["Cache-Control"] = "public, s-maxage=60, stale-while-revalidate=300"
    return compute_player_stats(puuid, rows)


@app.get("/api/py/insights/{puuid}", response_model=PlayerInsights)
def player_insights(
    puuid: PuuidParam,
    response: Response,
    queue: Annotated[list[int], Query(max_length=10)] = [],  # noqa: B006 (FastAPI copies defaults)
    tz: Annotated[str | None, Query(max_length=64, pattern=r"^[A-Za-z0-9_+\-/]+$")] = None,
) -> PlayerInsights:
    """Trends, early-game lane stats, matchups, patches, schedule and teammates."""
    try:
        player_rows, lobby_rows, timeline_rows = fetch_insight_rows(puuid, queue)
    except ConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Could not load matches from the database") from error

    response.headers["Cache-Control"] = "public, s-maxage=60, stale-while-revalidate=300"
    return compute_insights(puuid, player_rows, lobby_rows, timeline_rows, tz)


MatchIdParam = Annotated[str, PathParam(pattern=r"^[A-Z0-9]{2,5}_[0-9]{5,15}$")]


def fetch_match_rows(match_id: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    match_rows = supabase_get("matches", {"select": "raw_data", "match_id": f"eq.{match_id}", "limit": "1"})
    if not match_rows:
        return None, None
    detail_rows = supabase_get("match_timeline_details", {"select": "details", "match_id": f"eq.{match_id}", "limit": "1"})
    return match_rows[0]["raw_data"], (detail_rows[0]["details"] if detail_rows else None)


@app.get("/api/py/match/{match_id}/insights", response_model=MatchInsights)
def match_insights(match_id: MatchIdParam, response: Response) -> MatchInsights:
    """Gold lead over time, key moments, and each player's lane diffs and team shares."""
    try:
        match, details = fetch_match_rows(match_id)
    except ConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Could not load the match from the database") from error
    if match is None:
        raise HTTPException(status_code=404, detail="Match not stored yet")

    # A finished match never changes; cache longer once its timeline is stored.
    response.headers["Cache-Control"] = (
        "public, s-maxage=86400, stale-while-revalidate=604800" if details else "public, s-maxage=30"
    )
    return compute_match_insights(match_id, match, details)
