"""Deeper player insights computed from cached matches.

Pure functions only (no I/O), so everything here is covered by
tests/test_insights.py. The HTTP endpoint in api/index.py loads the rows from
Supabase and passes them in.

Presentation rules (Riot's developer policies): these numbers are meant to
help a player review their own games. The front end shows them neutrally and
never labels anyone negatively.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Summoner's Rift queues where "lane opponent" is meaningful.
LANING_QUEUE_IDS = {400, 420, 430, 440, 480, 490, 700}
POSITIONS = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")
TREND_METRICS = ("kda", "cs_per_min", "damage_per_min", "gold_per_min", "vision_per_min")
ROLLING_WINDOW = 5
SESSION_GAP = timedelta(minutes=60)
MAX_MATCHUPS = 10
MAX_TEAMMATES = 8
MIN_GAMES_TOGETHER = 2


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TrendPoint(CamelModel):
    match_id: str
    game_start: str
    win: bool
    champion_id: int
    champion_name: str
    kda: float
    cs_per_min: float
    damage_per_min: float
    gold_per_min: float
    vision_per_min: float
    rolling: dict[str, float]  # rolling average of each metric over the last ROLLING_WINDOW games


class MetricChange(CamelModel):
    earlier: float
    recent: float
    change: float  # recent minus earlier


class Laning(CamelModel):
    games: int
    gold_diff_10: float | None
    cs_diff_10: float | None
    xp_diff_10: float | None
    gold_diff_15: float | None
    cs_diff_15: float | None
    xp_diff_15: float | None
    ahead_at_15_share: float | None  # share of games with a gold lead at 15 minutes
    pending_games: int  # laning games whose timeline has not been downloaded yet


class Matchup(CamelModel):
    champion_id: int
    champion_name: str
    games: int
    wins: int
    win_rate: float
    gold_diff_15: float | None


class Bucket(CamelModel):
    label: str
    games: int
    wins: int
    win_rate: float


class PatchStats(CamelModel):
    patch: str
    games: int
    wins: int
    win_rate: float
    kda: float | None


class Teammate(CamelModel):
    puuid: str
    game_name: str | None
    tag_line: str | None
    games: int
    wins: int
    win_rate: float


class PlayerInsights(CamelModel):
    puuid: str
    sample_size: int
    trends: list[TrendPoint]
    changes: dict[str, MetricChange]
    laning: Laning
    matchups: list[Matchup]
    patches: list[PatchStats]
    time_of_day: list[Bucket]
    session_position: list[Bucket]
    teammates: list[Teammate]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def per_minute(total: float, duration_secs: float) -> float:
    return round(total / (duration_secs / 60), 2) if duration_secs > 0 else 0.0


def game_kda(game: dict[str, Any]) -> float:
    return round((game["kills"] + game["assists"]) / max(1, game["deaths"]), 2)


def win_rate(wins: int, games: int) -> float:
    return round(wins / games, 4) if games else 0.0


def average(values: list[float]) -> float | None:
    return round(mean(values), 1) if values else None


def resolve_zone(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name) if tz_name else ZoneInfo("UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def patch_of(game: dict[str, Any]) -> str | None:
    match = game.get("matches") or {}
    version = match.get("game_version") if isinstance(match, dict) else None
    if not version:
        return None
    parts = version.split(".")
    return ".".join(parts[:2]) if len(parts) >= 2 else None


def patch_sort_key(patch: str) -> tuple[int, ...]:
    return tuple(int(part) if part.isdigit() else 0 for part in patch.split("."))


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------


def build_trends(games_oldest_first: list[dict[str, Any]]) -> list[TrendPoint]:
    points: list[TrendPoint] = []
    history: dict[str, list[float]] = defaultdict(list)

    for game in games_oldest_first:
        duration = game["duration_secs"]
        values = {
            "kda": game_kda(game),
            "cs_per_min": per_minute(game["cs"], duration),
            "damage_per_min": per_minute(game["damage_to_champs"], duration),
            "gold_per_min": per_minute(game["gold_earned"], duration),
            "vision_per_min": per_minute(game["vision_score"], duration),
        }
        rolling = {}
        for metric, value in values.items():
            history[metric].append(value)
            window = history[metric][-ROLLING_WINDOW:]
            rolling[to_camel(metric)] = round(mean(window), 2)

        points.append(
            TrendPoint(
                match_id=game["match_id"],
                game_start=game["game_start"],
                win=game["win"],
                champion_id=game["champion_id"],
                champion_name=game["champion_name"],
                rolling=rolling,
                **values,
            )
        )
    return points


def build_changes(points: list[TrendPoint]) -> dict[str, MetricChange]:
    """Compares the older half of the sample with the newer half."""
    if len(points) < 6:
        return {}
    half = len(points) // 2
    earlier, recent = points[:half], points[half:]
    changes = {}
    for metric in TREND_METRICS:
        earlier_avg = mean(getattr(point, metric) for point in earlier)
        recent_avg = mean(getattr(point, metric) for point in recent)
        changes[to_camel(metric)] = MetricChange(
            earlier=round(earlier_avg, 2),
            recent=round(recent_avg, 2),
            change=round(recent_avg - earlier_avg, 2),
        )
    return changes


# ---------------------------------------------------------------------------
# Laning and matchups
# ---------------------------------------------------------------------------


def find_lane_opponent(game: dict[str, Any], lobby: list[dict[str, Any]]) -> dict[str, Any] | None:
    position = game.get("team_position") or ""
    if game["queue_id"] not in LANING_QUEUE_IDS or position not in POSITIONS:
        return None
    for player in lobby:
        if player["team_id"] != game["team_id"] and player.get("team_position") == position:
            return player
    return None


def build_laning_and_matchups(
    puuid: str,
    games: list[dict[str, Any]],
    lobbies: dict[str, list[dict[str, Any]]],
    timelines: dict[tuple[str, str], dict[str, Any]],
) -> tuple[Laning, list[Matchup]]:
    diffs: dict[str, list[float]] = defaultdict(list)
    ahead_at_15: list[bool] = []
    laning_games = 0
    pending = 0
    matchup_games: dict[int, list[dict[str, Any]]] = defaultdict(list)
    matchup_names: dict[int, str] = {}
    matchup_gold_15: dict[int, list[float]] = defaultdict(list)

    for game in games:
        opponent = find_lane_opponent(game, lobbies.get(game["match_id"], []))
        if not opponent:
            continue

        champion_id = opponent["champion_id"]
        matchup_games[champion_id].append(game)
        matchup_names[champion_id] = opponent["champion_name"]

        mine = timelines.get((game["match_id"], puuid))
        theirs = timelines.get((game["match_id"], opponent["puuid"]))
        if not mine or not theirs:
            pending += 1
            continue

        laning_games += 1
        for stat in ("gold", "cs", "xp"):
            for minute in (10, 15):
                key = f"{stat}_{minute}"
                if mine.get(key) is not None and theirs.get(key) is not None:
                    diffs[key].append(mine[key] - theirs[key])
        if mine.get("gold_15") is not None and theirs.get("gold_15") is not None:
            gold_diff = mine["gold_15"] - theirs["gold_15"]
            ahead_at_15.append(gold_diff > 0)
            matchup_gold_15[champion_id].append(gold_diff)

    laning = Laning(
        games=laning_games,
        gold_diff_10=average(diffs["gold_10"]),
        cs_diff_10=average(diffs["cs_10"]),
        xp_diff_10=average(diffs["xp_10"]),
        gold_diff_15=average(diffs["gold_15"]),
        cs_diff_15=average(diffs["cs_15"]),
        xp_diff_15=average(diffs["xp_15"]),
        ahead_at_15_share=round(sum(ahead_at_15) / len(ahead_at_15), 4) if ahead_at_15 else None,
        pending_games=pending,
    )

    matchups = []
    for champion_id, champion_games in matchup_games.items():
        wins = sum(1 for game in champion_games if game["win"])
        matchups.append(
            Matchup(
                champion_id=champion_id,
                champion_name=matchup_names[champion_id],
                games=len(champion_games),
                wins=wins,
                win_rate=win_rate(wins, len(champion_games)),
                gold_diff_15=average(matchup_gold_15[champion_id]),
            )
        )
    matchups.sort(key=lambda matchup: (-matchup.games, -matchup.win_rate, matchup.champion_name))
    return laning, matchups[:MAX_MATCHUPS]


# ---------------------------------------------------------------------------
# Patches, time of day, sessions
# ---------------------------------------------------------------------------


def build_patches(games: list[dict[str, Any]]) -> list[PatchStats]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for game in games:
        patch = patch_of(game)
        if patch:
            grouped[patch].append(game)

    patches = []
    for patch, patch_games in grouped.items():
        wins = sum(1 for game in patch_games if game["win"])
        kills = sum(game["kills"] for game in patch_games)
        deaths = sum(game["deaths"] for game in patch_games)
        assists = sum(game["assists"] for game in patch_games)
        patches.append(
            PatchStats(
                patch=patch,
                games=len(patch_games),
                wins=wins,
                win_rate=win_rate(wins, len(patch_games)),
                kda=round((kills + assists) / deaths, 2) if deaths else None,
            )
        )
    patches.sort(key=lambda stats: patch_sort_key(stats.patch), reverse=True)
    return patches


TIME_OF_DAY = (
    ("Morning", range(5, 12)),
    ("Afternoon", range(12, 17)),
    ("Evening", range(17, 22)),
    ("Late night", list(range(22, 24)) + list(range(0, 5))),
)


def build_time_of_day(games: list[dict[str, Any]], zone: ZoneInfo) -> list[Bucket]:
    counts = {label: [0, 0] for label, _ in TIME_OF_DAY}
    for game in games:
        hour = parse_time(game["game_start"]).astimezone(zone).hour
        for label, hours in TIME_OF_DAY:
            if hour in hours:
                counts[label][0] += 1
                counts[label][1] += 1 if game["win"] else 0
                break
    return [
        Bucket(label=label, games=games_played, wins=wins, win_rate=win_rate(wins, games_played))
        for label, (games_played, wins) in counts.items()
        if games_played > 0
    ]


SESSION_LABELS = ("1st game", "2nd game", "3rd game", "4th game or later")


def build_session_position(games_oldest_first: list[dict[str, Any]]) -> list[Bucket]:
    """Win rate by how many games into a play session a game was. A new session
    starts when more than an hour passes between games."""
    counts = {label: [0, 0] for label in SESSION_LABELS}
    position = 0
    previous_end: datetime | None = None

    for game in games_oldest_first:
        start = parse_time(game["game_start"])
        if previous_end is None or start - previous_end > SESSION_GAP:
            position = 0
        label = SESSION_LABELS[min(position, len(SESSION_LABELS) - 1)]
        counts[label][0] += 1
        counts[label][1] += 1 if game["win"] else 0
        position += 1
        previous_end = start + timedelta(seconds=game["duration_secs"])

    return [
        Bucket(label=label, games=games_played, wins=wins, win_rate=win_rate(wins, games_played))
        for label, (games_played, wins) in counts.items()
        if games_played > 0
    ]


# ---------------------------------------------------------------------------
# Teammates
# ---------------------------------------------------------------------------


def build_teammates(puuid: str, games: list[dict[str, Any]], lobbies: dict[str, list[dict[str, Any]]]) -> list[Teammate]:
    together: dict[str, dict[str, Any]] = {}
    # Games are newest first, so the first name seen is the most recent one.
    for game in games:
        for player in lobbies.get(game["match_id"], []):
            if player["puuid"] == puuid or player["team_id"] != game["team_id"]:
                continue
            entry = together.setdefault(
                player["puuid"],
                {"game_name": player.get("riot_id_name"), "tag_line": player.get("riot_id_tag"), "games": 0, "wins": 0},
            )
            entry["games"] += 1
            entry["wins"] += 1 if game["win"] else 0

    teammates = [
        Teammate(
            puuid=teammate_puuid,
            game_name=entry["game_name"],
            tag_line=entry["tag_line"],
            games=entry["games"],
            wins=entry["wins"],
            win_rate=win_rate(entry["wins"], entry["games"]),
        )
        for teammate_puuid, entry in together.items()
        if entry["games"] >= MIN_GAMES_TOGETHER
    ]
    teammates.sort(key=lambda teammate: (-teammate.games, -teammate.wins))
    return teammates[:MAX_TEAMMATES]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def compute_insights(
    puuid: str,
    player_rows: list[dict[str, Any]],
    lobby_rows: list[dict[str, Any]],
    timeline_rows: list[dict[str, Any]],
    tz_name: str | None = None,
) -> PlayerInsights:
    """player_rows: the player's games, newest first. lobby_rows: every player in
    those games. timeline_rows: early-game snapshots for those games."""
    games = [row for row in player_rows if not row["remake"]]
    oldest_first = list(reversed(games))

    lobbies: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in lobby_rows:
        lobbies[row["match_id"]].append(row)
    timelines = {(row["match_id"], row["puuid"]): row for row in timeline_rows}

    trends = build_trends(oldest_first)
    laning, matchups = build_laning_and_matchups(puuid, games, lobbies, timelines)

    return PlayerInsights(
        puuid=puuid,
        sample_size=len(games),
        trends=trends,
        changes=build_changes(trends),
        laning=laning,
        matchups=matchups,
        patches=build_patches(games),
        time_of_day=build_time_of_day(games, resolve_zone(tz_name)),
        session_position=build_session_position(oldest_first),
        teammates=build_teammates(puuid, games, lobbies),
    )
