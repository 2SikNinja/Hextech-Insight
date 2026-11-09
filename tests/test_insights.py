"""Tests for the insights calculations (api/_insights.py) and endpoint."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

import api.index as service
from api._insights import compute_insights

ME = "me" + "x" * 76
ALLY = "ally" + "x" * 74
FOE = "foe" + "x" * 75
START = datetime(2026, 11, 2, 18, 0, tzinfo=timezone.utc)  # 10:00 in Los Angeles


def game(index: int, *, minutes_after: int | None = None, **overrides: Any) -> dict[str, Any]:
    """The player's row for game `index` (higher index = later game)."""
    start = START + timedelta(minutes=minutes_after if minutes_after is not None else index * 40)
    row = {
        "match_id": f"NA1_{index}",
        "game_start": start.isoformat(),
        "duration_secs": 1800,
        "queue_id": 420,
        "team_id": 100,
        "team_position": "MIDDLE",
        "champion_id": 103,
        "champion_name": "Ahri",
        "win": True,
        "remake": False,
        "kills": 5,
        "deaths": 2,
        "assists": 5,
        "cs": 210,
        "gold_earned": 12000,
        "damage_to_champs": 21000,
        "vision_score": 30,
        "matches": {"game_version": "15.21.715.1234"},
    }
    row.update(overrides)
    return row


def lobby(match_id: str, *, foe_champion: tuple[int, str] = (61, "Orianna")) -> list[dict[str, Any]]:
    return [
        {"match_id": match_id, "puuid": ME, "team_id": 100, "team_position": "MIDDLE", "champion_id": 103,
         "champion_name": "Ahri", "riot_id_name": "Me", "riot_id_tag": "NA1"},
        {"match_id": match_id, "puuid": ALLY, "team_id": 100, "team_position": "UTILITY", "champion_id": 412,
         "champion_name": "Thresh", "riot_id_name": "Buddy", "riot_id_tag": "NA1"},
        {"match_id": match_id, "puuid": FOE, "team_id": 200, "team_position": "MIDDLE", "champion_id": foe_champion[0],
         "champion_name": foe_champion[1], "riot_id_name": "Rival", "riot_id_tag": "EUW"},
    ]


def timeline(match_id: str, puuid: str, gold_15: int, cs_10: int = 80) -> dict[str, Any]:
    return {"match_id": match_id, "puuid": puuid, "gold_10": gold_15 - 2000, "cs_10": cs_10, "xp_10": 4000,
            "gold_15": gold_15, "cs_15": cs_10 + 45, "xp_15": 6500}


def test_trends_are_oldest_first_with_rolling_averages() -> None:
    rows = [game(i, kills=i) for i in range(3, -1, -1)]  # newest first, like the database returns
    insights = compute_insights(ME, rows, [], [])

    assert [point.match_id for point in insights.trends] == ["NA1_0", "NA1_1", "NA1_2", "NA1_3"]
    # KDA = (kills + 5) / 2 -> 2.5, 3.0, 3.5, 4.0; rolling mean of the last 5
    assert insights.trends[-1].kda == 4.0
    assert insights.trends[-1].rolling["kda"] == 3.25
    assert insights.trends[0].cs_per_min == 7.0


def test_changes_compare_older_and_newer_halves() -> None:
    rows = [game(i, cs=150 if i < 3 else 240) for i in range(5, -1, -1)]
    change = compute_insights(ME, rows, [], []).changes["csPerMin"]
    assert (change.earlier, change.recent, change.change) == (5.0, 8.0, 3.0)


def test_changes_need_enough_games() -> None:
    assert compute_insights(ME, [game(1), game(0)], [], []).changes == {}


def test_laning_diffs_against_same_position_opponent() -> None:
    rows = [game(1), game(0)]
    lobbies = lobby("NA1_1") + lobby("NA1_0")
    timelines = [
        timeline("NA1_1", ME, 6000), timeline("NA1_1", FOE, 5000),
        timeline("NA1_0", ME, 5000, cs_10=70), timeline("NA1_0", FOE, 5400),
    ]
    laning = compute_insights(ME, rows, lobbies, timelines).laning

    assert laning.games == 2
    assert laning.gold_diff_15 == 300  # (+1000 - 400) / 2
    assert laning.cs_diff_10 == -5  # (0 + -10) / 2
    assert laning.ahead_at_15_share == 0.5
    assert laning.pending_games == 0


def test_laning_counts_games_waiting_for_timelines() -> None:
    laning = compute_insights(ME, [game(0)], lobby("NA1_0"), []).laning
    assert laning.games == 0
    assert laning.pending_games == 1
    assert laning.gold_diff_15 is None


def test_laning_ignores_aram_and_missing_positions() -> None:
    rows = [game(1, queue_id=450), game(0, team_position="")]
    laning = compute_insights(ME, rows, lobby("NA1_1") + lobby("NA1_0"), []).laning
    assert (laning.games, laning.pending_games) == (0, 0)


def test_matchups_group_by_opponent_champion() -> None:
    rows = [game(2, win=False), game(1), game(0)]
    lobbies = lobby("NA1_2", foe_champion=(238, "Zed")) + lobby("NA1_1") + lobby("NA1_0")
    matchups = compute_insights(ME, rows, lobbies, []).matchups
    assert [(m.champion_name, m.games, m.win_rate) for m in matchups] == [("Orianna", 2, 1.0), ("Zed", 1, 0.0)]


def test_patches_newest_first() -> None:
    rows = [
        game(2, matches={"game_version": "15.9.1.1"}),
        game(1, matches={"game_version": "15.21.700.1"}, win=False),
        game(0, matches={"game_version": "15.21.700.1"}),
    ]
    patches = compute_insights(ME, rows, [], []).patches
    assert [(p.patch, p.games, p.win_rate) for p in patches] == [("15.21", 2, 0.5), ("15.9", 1, 1.0)]


def test_time_of_day_uses_viewer_timezone() -> None:
    insights = compute_insights(ME, [game(0, minutes_after=0)], [], [], tz_name="America/Los_Angeles")
    assert [bucket.label for bucket in insights.time_of_day] == ["Morning"]
    utc = compute_insights(ME, [game(0, minutes_after=0)], [], [], tz_name="Not/AZone")
    assert [bucket.label for bucket in utc.time_of_day] == ["Evening"]


def test_session_position_splits_after_an_hour_break() -> None:
    # Two games back to back, then a break of several hours, then one game.
    rows = [game(2, minutes_after=600), game(1, minutes_after=35), game(0, minutes_after=0, win=False)]
    buckets = {bucket.label: (bucket.games, bucket.wins) for bucket in compute_insights(ME, rows, [], []).session_position}
    assert buckets == {"1st game": (2, 1), "2nd game": (1, 1)}


def test_teammates_need_two_games_together() -> None:
    rows = [game(1), game(0, win=False)]
    lobbies = lobby("NA1_1") + lobby("NA1_0")
    teammates = compute_insights(ME, rows, lobbies, []).teammates
    assert [(t.game_name, t.games, t.wins) for t in teammates] == [("Buddy", 2, 1)]
    assert compute_insights(ME, [game(0)], lobby("NA1_0"), []).teammates == []


def test_remakes_are_left_out() -> None:
    insights = compute_insights(ME, [game(1, remake=True), game(0)], [], [])
    assert insights.sample_size == 1


# ---------- HTTP layer ----------

client = TestClient(service.app)


def test_insights_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_fetch(puuid: str, queue_ids: list[int], champion_id: int | None = None):
        captured.update(puuid=puuid, queue_ids=queue_ids, champion_id=champion_id)
        return [game(1), game(0)], lobby("NA1_1") + lobby("NA1_0"), []

    monkeypatch.setattr(service, "fetch_insight_rows", fake_fetch)
    response = client.get(f"/api/py/insights/{ME}", params={"queue": [420], "tz": "America/Los_Angeles"})

    assert response.status_code == 200
    body = response.json()
    assert body["sampleSize"] == 2
    assert body["laning"]["pendingGames"] == 2
    assert body["teammates"][0]["gameName"] == "Buddy"
    assert body["trends"][0]["rolling"]["csPerMin"] == 7.0
    assert captured == {"puuid": ME, "queue_ids": [420], "champion_id": None}


def test_insights_endpoint_rejects_bad_timezone_text() -> None:
    assert client.get(f"/api/py/insights/{ME}", params={"tz": "<script>"}).status_code == 422
