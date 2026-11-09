"""Tests for single-match insights (api/_match_insights.py) and its endpoint."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

import api.index as service
from api._match_insights import compute_match_insights

POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]


def build_match() -> dict[str, Any]:
    participants = []
    for index in range(10):
        team = 100 if index < 5 else 200
        participants.append({
            "participantId": index + 1,
            "teamId": team,
            "teamPosition": POSITIONS[index % 5],
            "playerSubteamId": 0,
            "kills": 4 if index == 0 else 1,
            "deaths": 1,
            "assists": 2,
            "totalDamageDealtToChampions": 20000 if index == 0 else 10000,
            "goldEarned": 12000,
            "totalMinionsKilled": 180,
            "neutralMinionsKilled": 0,
        })
    return {"info": {"gameDuration": 1800, "gameEndTimestamp": 1, "participants": participants}}


def build_details() -> dict[str, Any]:
    # Blue mid (pid 3) gains 100 gold a minute on red mid (pid 8); red leads early.
    frames = list(range(0, 21))
    stats = {}
    for pid in range(1, 11):
        base = 500
        if pid == 3:
            gold = [base + minute * 500 for minute in frames]
        elif pid == 8:
            gold = [base + minute * 400 for minute in frames]
        elif pid == 6:
            gold = [base + minute * 400 + (600 if minute <= 3 else 0) for minute in frames]
        else:
            gold = [base + minute * 400 for minute in frames]
        stats[str(pid)] = {"gold": gold, "xp": [minute * 300 for minute in frames], "cs": [minute * 7 for minute in frames]}
    return {
        "frameMs": [minute * 60_000 + (15 if minute else 0) for minute in frames],
        "stats": stats,
        "items": [],
        "skills": {},
        "kills": [
            {"t": 200_000, "killer": 0, "victim": 4, "assists": []},
            {"t": 240_000, "killer": 8, "victim": 3, "assists": [7]},
            {"t": 1_000_000, "killer": 3, "victim": 8, "assists": []},
        ],
        "objectives": [
            {"t": 400_000, "kind": "dragon", "teamId": 100, "detail": "FIRE_DRAGON"},
            {"t": 300_000, "kind": "tower", "teamId": 200, "detail": "MID_LANE"},
            {"t": 1_500_000, "kind": "baron", "teamId": 100, "detail": None},
        ],
    }


def test_gold_lead_and_summary() -> None:
    insights = compute_match_insights("NA1_1", build_match(), build_details())
    assert insights.gold[0].lead == -600  # red's early bonus
    assert insights.gold[10].lead == 1000  # blue mid +100/min
    assert insights.gold_summary is not None
    assert insights.gold_summary.biggest_red_lead.value == 600
    assert insights.gold_summary.biggest_blue_lead.value == 2000
    assert insights.gold_summary.lead_changes == 1


def test_moments_sorted_with_first_blood_ignoring_executions() -> None:
    moments = compute_match_insights("NA1_1", build_match(), build_details()).moments
    assert [(m.label, m.team_id) for m in moments] == [
        ("First blood", 200),
        ("Tower (mid)", 200),
        ("Infernal Drake", 100),
        ("Baron Nashor", 100),
    ]
    assert moments[0].seconds == 240


def test_lane_diffs_and_shares() -> None:
    players = {p.participant_id: p for p in compute_match_insights("NA1_1", build_match(), build_details()).players}
    mid = players[3]
    assert mid.lane_opponent_id == 8
    assert (mid.gold_diff_10, mid.gold_diff_15) == (1000, 1500)
    assert mid.cs_diff_10 == 0
    assert mid.deaths_before_15 == 1
    top = players[1]
    assert top.damage_share == round(20000 / 60000, 4)
    assert top.kill_participation == round(6 / 8, 4)
    assert top.cs_per_min == 6.0


def test_without_timeline_still_returns_shares() -> None:
    insights = compute_match_insights("NA1_1", build_match(), None)
    assert insights.has_timeline is False
    assert insights.gold == [] and insights.moments == []
    assert insights.players[0].gold_diff_10 is None
    assert insights.players[0].damage_share > 0


def test_arena_has_no_gold_race() -> None:
    match = build_match()
    for index, player in enumerate(match["info"]["participants"]):
        player["playerSubteamId"] = index // 2 + 1
    insights = compute_match_insights("NA1_1", match, build_details())
    assert insights.gold == [] and insights.gold_summary is None


client = TestClient(service.app)


def test_match_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "fetch_match_rows", lambda match_id: (build_match(), build_details()))
    response = client.get("/api/py/match/NA1_5012345678/insights")
    assert response.status_code == 200
    body = response.json()
    assert body["goldSummary"]["leadChanges"] == 1
    assert body["players"][2]["goldDiff15"] == 1500
    assert "86400" in response.headers["cache-control"]


def test_match_endpoint_not_stored(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "fetch_match_rows", lambda match_id: (None, None))
    assert client.get("/api/py/match/NA1_5012345678/insights").status_code == 404
    assert client.get("/api/py/match/bad-id/insights").status_code == 422
