"""Tests for the Python analytics service (run with: npm run test:python)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

import api.index as service

PUUID = "a" * 78


def game(**overrides: Any) -> dict[str, Any]:
    row = {
        "match_id": "NA1_1",
        "game_start": "2026-11-01T00:00:00+00:00",
        "duration_secs": 1800,  # 30 minutes
        "queue_id": 420,
        "team_position": "MIDDLE",
        "champion_id": 103,
        "champion_name": "Ahri",
        "win": True,
        "remake": False,
        "kills": 6,
        "deaths": 2,
        "assists": 8,
        "cs": 240,
        "gold_earned": 12000,
        "damage_to_champs": 24000,
        "vision_score": 30,
        "kill_participation": 0.6,
        "double_kills": 0,
        "triple_kills": 0,
        "quadra_kills": 0,
        "penta_kills": 0,
    }
    row.update(overrides)
    return row


def test_overall_stats_use_totals_not_averages_of_ratios() -> None:
    rows = [
        game(win=True, kills=10, deaths=0, assists=5, double_kills=1),
        game(win=False, kills=2, deaths=6, assists=3, kill_participation=None),
    ]
    stats = service.compute_player_stats(PUUID, rows)

    assert stats.overall is not None
    assert stats.overall.games == 2
    assert stats.overall.win_rate == 0.5
    # (10 + 5 + 2 + 3) / (0 + 6) = 3.33
    assert stats.overall.kda == pytest.approx(3.33)
    # 480 CS over 60 minutes
    assert stats.overall.cs_per_min == 8.0
    # Only the game with a known value counts.
    assert stats.overall.kill_participation == 0.6
    assert stats.overall.multikills.double == 1


def test_perfect_kda_is_none() -> None:
    stats = service.compute_player_stats(PUUID, [game(deaths=0)])
    assert stats.overall is not None
    assert stats.overall.kda is None


def test_remakes_are_excluded() -> None:
    stats = service.compute_player_stats(PUUID, [game(), game(remake=True, win=False)])
    assert stats.sample_size == 1
    assert stats.remakes_excluded == 1
    assert stats.recent_form == [True]


def test_champions_sorted_by_games_then_win_rate() -> None:
    rows = [
        game(champion_id=1, champion_name="Annie", win=False),
        game(champion_id=103, champion_name="Ahri", win=True),
        game(champion_id=103, champion_name="Ahri", win=False),
        game(champion_id=22, champion_name="Ashe", win=True),
    ]
    champions = service.compute_player_stats(PUUID, rows).champions
    assert [champion.champion_name for champion in champions] == ["Ahri", "Ashe", "Annie"]
    assert champions[0].games == 2
    assert champions[0].win_rate == 0.5


def test_roles_skip_blank_positions() -> None:
    rows = [game(team_position="TOP"), game(team_position="TOP", win=False), game(team_position="")]
    roles = service.compute_player_stats(PUUID, rows).roles
    assert len(roles) == 1
    assert roles[0].position == "TOP"
    assert roles[0].share == 1.0
    assert roles[0].win_rate == 0.5


def test_streak_counts_from_newest_game() -> None:
    rows = [game(win=False), game(win=False), game(win=True)]
    streak = service.compute_player_stats(PUUID, rows).streak
    assert streak is not None
    assert (streak.kind, streak.count) == ("loss", 2)


def test_empty_history() -> None:
    stats = service.compute_player_stats(PUUID, [])
    assert stats.overall is None
    assert stats.champions == []
    assert stats.streak is None


# ---------- HTTP layer ----------

client = TestClient(service.app)


def test_stats_endpoint_returns_camel_case(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def fake_fetch(puuid: str, queue_ids: list[int], limit: int, champion_id: int | None = None) -> list[dict[str, Any]]:
        captured.update(puuid=puuid, queue_ids=queue_ids, limit=limit, champion_id=champion_id)
        return [game()]

    monkeypatch.setattr(service, "fetch_participant_rows", fake_fetch)
    response = client.get(f"/api/py/stats/{PUUID}", params={"queue": [420, 440], "limit": 50})

    assert response.status_code == 200
    body = response.json()
    assert body["sampleSize"] == 1
    assert body["overall"]["winRate"] == 1.0
    assert body["champions"][0]["championName"] == "Ahri"
    assert captured == {"puuid": PUUID, "queue_ids": [420, 440], "limit": 50, "champion_id": None}

    client.get(f"/api/py/stats/{PUUID}", params={"champion": 103})
    assert captured["champion_id"] == 103
    assert "s-maxage" in response.headers["cache-control"]


def test_stats_endpoint_rejects_bad_puuid() -> None:
    assert client.get("/api/py/stats/not-a-puuid").status_code == 422


def test_stats_endpoint_reports_missing_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    response = client.get(f"/api/py/stats/{PUUID}")
    assert response.status_code == 503


def test_health() -> None:
    assert client.get("/api/py/health").json() == {"status": "ok"}
