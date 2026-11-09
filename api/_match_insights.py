"""Insights for a single match, from its stored Riot data and timeline details.

Pure functions only (covered by tests/test_match_insights.py). The endpoint in
api/index.py loads the match and its timeline details from Supabase.

Inputs:
  match:   the stored Match-V5 payload (camelCase keys, as saved by the site)
  details: the compact timeline saved by the site (see toTimelineDetails in
           src/lib/riot/transform.ts): frameMs, stats, kills, objectives
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

POSITIONS = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")

DRAGON_NAMES = {
    "FIRE_DRAGON": "Infernal Drake",
    "WATER_DRAGON": "Ocean Drake",
    "EARTH_DRAGON": "Mountain Drake",
    "AIR_DRAGON": "Cloud Drake",
    "HEXTECH_DRAGON": "Hextech Drake",
    "CHEMTECH_DRAGON": "Chemtech Drake",
}
OBJECTIVE_NAMES = {
    "elder": "Elder Dragon",
    "baron": "Baron Nashor",
    "herald": "Rift Herald",
    "grubs": "Voidgrub",
    "atakhan": "Atakhan",
}
LANE_NAMES = {"TOP_LANE": "top", "MID_LANE": "mid", "BOT_LANE": "bottom"}


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class GoldPoint(CamelModel):
    minute: int
    lead: int  # blue team gold minus red team gold


class Lead(CamelModel):
    value: int
    minute: int


class GoldSummary(CamelModel):
    biggest_blue_lead: Lead | None
    biggest_red_lead: Lead | None
    lead_changes: int
    final_lead: int


class Moment(CamelModel):
    seconds: int
    kind: str  # first_blood, dragon, elder, baron, herald, grubs, atakhan, tower, inhibitor
    team_id: int
    label: str


class PlayerInsight(CamelModel):
    participant_id: int
    team_id: int
    lane_opponent_id: int | None
    gold_diff_10: int | None
    cs_diff_10: int | None
    xp_diff_10: int | None
    gold_diff_15: int | None
    cs_diff_15: int | None
    xp_diff_15: int | None
    damage_share: float
    gold_share: float
    kill_participation: float | None
    cs_per_min: float
    deaths_before_15: int | None


class MatchInsights(CamelModel):
    match_id: str
    has_timeline: bool
    gold: list[GoldPoint]
    gold_summary: GoldSummary | None
    moments: list[Moment]
    players: list[PlayerInsight]


def frame_index_at(frame_ms: list[int], minute: int) -> int | None:
    target = minute * 60_000
    for index, timestamp in enumerate(frame_ms):
        if timestamp >= target:
            return index
    return None


def team_key(player: dict[str, Any]) -> int:
    subteam = player.get("playerSubteamId") or 0
    return subteam if subteam > 0 else player["teamId"]


def build_gold(participants: list[dict[str, Any]], details: dict[str, Any]) -> tuple[list[GoldPoint], GoldSummary | None]:
    teams = {team_key(player) for player in participants}
    if teams != {100, 200}:
        return [], None  # Arena and other modes have no blue/red gold race

    team_of = {str(player["participantId"]): player["teamId"] for player in participants}
    points: list[GoldPoint] = []
    for index, timestamp in enumerate(details.get("frameMs", [])):
        blue = red = 0
        for pid, stats in details.get("stats", {}).items():
            gold = stats["gold"][index] if index < len(stats["gold"]) else 0
            if team_of.get(pid) == 100:
                blue += gold
            elif team_of.get(pid) == 200:
                red += gold
        points.append(GoldPoint(minute=round(timestamp / 60_000), lead=blue - red))

    if not points:
        return [], None

    blue_best = max(points, key=lambda point: point.lead)
    red_best = min(points, key=lambda point: point.lead)
    changes = 0
    previous_sign = 0
    for point in points:
        sign = (point.lead > 0) - (point.lead < 0)
        if sign != 0:
            if previous_sign != 0 and sign != previous_sign:
                changes += 1
            previous_sign = sign

    summary = GoldSummary(
        biggest_blue_lead=Lead(value=blue_best.lead, minute=blue_best.minute) if blue_best.lead > 0 else None,
        biggest_red_lead=Lead(value=-red_best.lead, minute=red_best.minute) if red_best.lead < 0 else None,
        lead_changes=changes,
        final_lead=points[-1].lead,
    )
    return points, summary


def describe_objective(objective: dict[str, Any]) -> str:
    kind = objective["kind"]
    detail = objective.get("detail")
    if kind == "dragon":
        return DRAGON_NAMES.get(detail or "", "Dragon")
    if kind in ("tower", "inhibitor"):
        lane = LANE_NAMES.get(detail or "")
        noun = "Tower" if kind == "tower" else "Inhibitor"
        return f"{noun} ({lane})" if lane else noun
    return OBJECTIVE_NAMES.get(kind, kind.title())


def build_moments(participants: list[dict[str, Any]], details: dict[str, Any]) -> list[Moment]:
    team_of = {player["participantId"]: player["teamId"] for player in participants}
    moments: list[Moment] = []

    kills = sorted(details.get("kills", []), key=lambda kill: kill["t"])
    first_kill = next((kill for kill in kills if kill.get("killer")), None)
    if first_kill and first_kill["killer"] in team_of:
        moments.append(Moment(seconds=first_kill["t"] // 1000, kind="first_blood", team_id=team_of[first_kill["killer"]], label="First blood"))

    for objective in details.get("objectives", []):
        moments.append(
            Moment(seconds=objective["t"] // 1000, kind=objective["kind"], team_id=objective["teamId"], label=describe_objective(objective))
        )
    moments.sort(key=lambda moment: moment.seconds)
    return moments


def stat_at(details: dict[str, Any], pid: int, stat: str, index: int | None) -> int | None:
    if index is None:
        return None
    values = details.get("stats", {}).get(str(pid), {}).get(stat, [])
    return values[index] if index < len(values) else None


def diff(mine: int | None, theirs: int | None) -> int | None:
    return mine - theirs if mine is not None and theirs is not None else None


def build_players(participants: list[dict[str, Any]], details: dict[str, Any] | None, duration_secs: int) -> list[PlayerInsight]:
    team_damage: dict[int, int] = {}
    team_gold: dict[int, int] = {}
    team_kills: dict[int, int] = {}
    for player in participants:
        key = team_key(player)
        team_damage[key] = team_damage.get(key, 0) + player["totalDamageDealtToChampions"]
        team_gold[key] = team_gold.get(key, 0) + player["goldEarned"]
        team_kills[key] = team_kills.get(key, 0) + player["kills"]

    frame_ms = details.get("frameMs", []) if details else []
    index_10 = frame_index_at(frame_ms, 10)
    index_15 = frame_index_at(frame_ms, 15)
    deaths_before_15: dict[int, int] = {}
    if details:
        for kill in details.get("kills", []):
            if kill["t"] < 15 * 60_000:
                deaths_before_15[kill["victim"]] = deaths_before_15.get(kill["victim"], 0) + 1

    minutes = duration_secs / 60 if duration_secs > 0 else 1
    insights = []
    for player in participants:
        pid = player["participantId"]
        key = team_key(player)
        position = player.get("teamPosition") or ""
        opponent = next(
            (
                other
                for other in participants
                if position in POSITIONS and team_key(other) != key and other.get("teamPosition") == position
            ),
            None,
        )
        opponent_id = opponent["participantId"] if opponent else None

        def lane_diff(stat: str, index: int | None) -> int | None:
            if not details or opponent_id is None:
                return None
            return diff(stat_at(details, pid, stat, index), stat_at(details, opponent_id, stat, index))

        cs = player["totalMinionsKilled"] + player.get("neutralMinionsKilled", 0)
        insights.append(
            PlayerInsight(
                participant_id=pid,
                team_id=key,
                lane_opponent_id=opponent_id,
                gold_diff_10=lane_diff("gold", index_10),
                cs_diff_10=lane_diff("cs", index_10),
                xp_diff_10=lane_diff("xp", index_10),
                gold_diff_15=lane_diff("gold", index_15),
                cs_diff_15=lane_diff("cs", index_15),
                xp_diff_15=lane_diff("xp", index_15),
                damage_share=round(player["totalDamageDealtToChampions"] / team_damage[key], 4) if team_damage[key] else 0.0,
                gold_share=round(player["goldEarned"] / team_gold[key], 4) if team_gold[key] else 0.0,
                kill_participation=round(min(1.0, (player["kills"] + player["assists"]) / team_kills[key]), 4)
                if team_kills[key]
                else None,
                cs_per_min=round(cs / minutes, 1),
                deaths_before_15=deaths_before_15.get(pid, 0) if details else None,
            )
        )
    return insights


def match_duration_secs(info: dict[str, Any]) -> int:
    duration = info.get("gameDuration", 0)
    return int(duration if info.get("gameEndTimestamp") else duration / 1000)


def compute_match_insights(match_id: str, match: dict[str, Any], details: dict[str, Any] | None) -> MatchInsights:
    info = match["info"]
    participants = info["participants"]
    gold, summary = build_gold(participants, details) if details else ([], None)
    return MatchInsights(
        match_id=match_id,
        has_timeline=details is not None,
        gold=gold,
        gold_summary=summary,
        moments=build_moments(participants, details) if details else [],
        players=build_players(participants, details, match_duration_secs(info)),
    )
