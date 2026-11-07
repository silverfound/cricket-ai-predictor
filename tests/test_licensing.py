import os
import uuid

import psycopg
import pytest
from fastapi import HTTPException

import licensing


@pytest.fixture(autouse=True)
def database():
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
    os.environ["ADMIN_API_KEY"] = "ci-test-admin-key"
    licensing.init_db()
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        conn.execute("TRUNCATE match_prediction_permissions, app_licenses RESTART IDENTITY")
    yield


def make_license(leagues=None):
    result = licensing.create(
        licensing.CreateLicense(
            label="CI customer",
            duration_days=30,
            count=1,
            subscribed_leagues=leagues or ["Premier League"]
        ),
        "ci-test-admin-key",
    )
    return result["licenses"][0]["code"]


def activate(code, device=None):
    device = device or str(uuid.uuid4())
    result = licensing.activate(licensing.Activation(code=code, device_id=device))
    assert result["active"] is True
    return device


def test_activation_binds_code_to_first_device():
    code = make_license()
    device = activate(code)
    with pytest.raises(HTTPException) as error:
        licensing.activate(licensing.Activation(code=code, device_id=str(uuid.uuid4())))
    assert error.value.status_code == 409
    assert licensing.active_license(device)["expires_at"] is not None


def test_prediction_requires_both_league_and_admin_match_approval():
    code = make_license(["Premier League"])
    device = activate(code)
    license_row = licensing.active_license(device)
    permission = licensing.MatchPermission(
        match_id="match-123",
        competition="Premier League",
        match_title="Team A v Team B",
        enabled=True,
    )
    licensing.save_match_permission(permission, "ci-test-admin-key")
    licensing.require_match_permission(license_row, "match-123", "Premier League")

    with pytest.raises(HTTPException) as wrong_league:
        licensing.require_match_permission(license_row, "match-123", "Other League")
    assert wrong_league.value.status_code == 403

    with pytest.raises(HTTPException) as unknown_match:
        licensing.require_match_permission(license_row, "not-approved", "Premier League")
    assert unknown_match.value.status_code == 403


def test_disabled_match_is_not_predictable():
    code = make_license()
    device = activate(code)
    permission = licensing.MatchPermission(
        match_id="match-disabled",
        competition="Premier League",
        enabled=False,
    )
    licensing.save_match_permission(permission, "ci-test-admin-key")
    with pytest.raises(HTTPException) as error:
        licensing.require_match_permission(licensing.active_license(device), "match-disabled", "Premier League")
    assert error.value.status_code == 403


def test_blocked_license_cannot_access_api():
    code = make_license()
    device = activate(code)
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        conn.execute("UPDATE app_licenses SET blocked=TRUE WHERE device_id=%s", (device,))
    with pytest.raises(HTTPException) as error:
        licensing.active_license(device)
    assert error.value.status_code == 403


def test_admin_endpoints_reject_wrong_key():
    with pytest.raises(HTTPException) as error:
        licensing.create(licensing.CreateLicense(duration_days=30), "wrong-key")
    assert error.value.status_code == 401
