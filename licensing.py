import os, hashlib, secrets, hmac
from datetime import datetime, timedelta, timezone
from typing import Optional
import psycopg
from psycopg.rows import dict_row
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

router = APIRouter()

def db():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise HTTPException(503, "License database is not configured")
    return psycopg.connect(url, row_factory=dict_row)

def init_db():
    if not os.getenv("DATABASE_URL"):
        return
    with db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS app_licenses (
            id BIGSERIAL PRIMARY KEY,
            code_hash TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL DEFAULT '',
            duration_days INTEGER NOT NULL CHECK(duration_days > 0),
            device_id TEXT UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            activated_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            blocked BOOLEAN NOT NULL DEFAULT FALSE,
            subscribed_leagues TEXT[] NOT NULL DEFAULT '{}'
        )""")
        conn.execute("ALTER TABLE app_licenses ADD COLUMN IF NOT EXISTS subscribed_leagues TEXT[] NOT NULL DEFAULT '{}'")
        conn.execute("ALTER TABLE app_licenses ADD COLUMN IF NOT EXISTS allow_all_matches BOOLEAN NOT NULL DEFAULT FALSE")
        conn.execute("""CREATE TABLE IF NOT EXISTS license_match_permissions (
            license_id BIGINT NOT NULL REFERENCES app_licenses(id) ON DELETE CASCADE,
            match_id TEXT NOT NULL, competition TEXT NOT NULL, match_title TEXT NOT NULL DEFAULT '',
            enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (license_id, match_id)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS match_prediction_permissions (
            match_id TEXT PRIMARY KEY,
            competition TEXT NOT NULL,
            match_title TEXT NOT NULL DEFAULT '',
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")

def admin_guard(key: Optional[str]):
    expected = os.getenv("ADMIN_API_KEY")
    if not expected:
        raise HTTPException(503, "Admin key is not configured")
    if not key or not hmac.compare_digest(key, expected):
        raise HTTPException(401, "Admin authentication required")

def active_license(device_id: str):
    if not device_id or len(device_id) > 128:
        raise HTTPException(401, "App installation is not registered")
    with db() as conn:
        row = conn.execute("SELECT id, expires_at, blocked, subscribed_leagues FROM app_licenses WHERE device_id=%s", (device_id,)).fetchone()
    now = datetime.now(timezone.utc)
    if not row or row["blocked"] or not row["expires_at"] or row["expires_at"] <= now:
        raise HTTPException(403, "License expired or inactive")
    return row

def require_license(x_device_id: Optional[str] = Header(default=None)):
    return active_license(x_device_id or "")

class Activation(BaseModel):
    code: str
    device_id: str

class CreateLicense(BaseModel):
    label: str = ""
    duration_days: int
    count: int = 1
    subscribed_leagues: list[str] = []

class LeagueUpdate(BaseModel):
    leagues: list[str]

class MatchPermission(BaseModel):
    match_id: str
    competition: str
    match_title: str = ""
    enabled: bool = True

class ExtendLicense(BaseModel):
    duration_days: int

class ResetDevice(BaseModel):
    confirm: bool = False

@router.post("/license/activate")
def activate(data: Activation):
    code, device = data.code.strip().upper(), data.device_id.strip()
    if len(code) < 12 or len(device) < 16 or len(device) > 128:
        raise HTTPException(400, "Invalid activation code or device")
    digest = hashlib.sha256(code.encode()).hexdigest()
    with db() as conn:
        row = conn.execute("SELECT * FROM app_licenses WHERE code_hash=%s FOR UPDATE", (digest,)).fetchone()
        if not row:
            raise HTTPException(404, "Activation code not found")
        if row["blocked"]:
            raise HTTPException(403, "This license has been blocked")
        if row["device_id"] and row["device_id"] != device:
            raise HTTPException(409, "This code is already linked to another device")
        now = datetime.now(timezone.utc)
        if row["device_id"] is None:
            expiry = now + timedelta(days=row["duration_days"])
            conn.execute("UPDATE app_licenses SET device_id=%s, activated_at=%s, expires_at=%s WHERE id=%s", (device, now, expiry, row["id"]))
        else:
            expiry = row["expires_at"]
            if not expiry or expiry <= now:
                raise HTTPException(403, "This license has expired; contact administrator")
    return {"active": True, "expires_at": expiry.isoformat()}

@router.get("/license/status")
def status(x_device_id: Optional[str] = Header(default=None)):
    row = active_license(x_device_id or "")
    return {"active": True, "expires_at": row["expires_at"].isoformat()}

@router.post("/admin/licenses")
def create(data: CreateLicense, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    if not 1 <= data.duration_days <= 3650 or not 1 <= data.count <= 100:
        raise HTTPException(400, "Days must be 1-3650; count must be 1-100")
    result = []
    with db() as conn:
        for _ in range(data.count):
            code = secrets.token_hex(8).upper()
            digest = hashlib.sha256(code.encode()).hexdigest()
            leagues = list(dict.fromkeys(str(x).strip()[:120] for x in data.subscribed_leagues if str(x).strip()))
            conn.execute("INSERT INTO app_licenses(code_hash,label,duration_days,subscribed_leagues) VALUES(%s,%s,%s,%s)", (digest, data.label.strip()[:120], data.duration_days, leagues))
            result.append({"code": code, "label": data.label, "duration_days": data.duration_days, "subscribed_leagues": leagues})
    return {"licenses": result}

@router.get("/admin/licenses")
def listing(x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    with db() as conn:
        rows = conn.execute("SELECT id,label,duration_days,device_id,created_at,activated_at,expires_at,blocked,subscribed_leagues,allow_all_matches FROM app_licenses ORDER BY id DESC LIMIT 500").fetchall()
    now, out = datetime.now(timezone.utc), []
    for row in rows:
        item = dict(row)
        item["status"] = "blocked" if item["blocked"] else ("pending" if not item["activated_at"] else ("active" if item["expires_at"] and item["expires_at"] > now else "expired"))
        for key in ("created_at", "activated_at", "expires_at"):
            item[key] = item[key].isoformat() if item[key] else None
        out.append(item)
    return {"licenses": out}

@router.put("/admin/licenses/{license_id}/leagues")
def update_leagues(license_id: int, data: LeagueUpdate, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    leagues = list(dict.fromkeys(str(x).strip()[:120] for x in data.leagues if str(x).strip()))
    if len(leagues) > 100:
        raise HTTPException(400, "Maximum 100 leagues")
    with db() as conn:
        result = conn.execute("UPDATE app_licenses SET subscribed_leagues=%s WHERE id=%s", (leagues, license_id))
        if result.rowcount == 0:
            raise HTTPException(404, "License not found")
    return {"success": True, "subscribed_leagues": leagues}

@router.get("/admin/match-permissions")
def get_match_permissions(x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    with db() as conn:
        rows = conn.execute("SELECT match_id,competition,match_title,enabled,updated_at FROM match_prediction_permissions ORDER BY updated_at DESC LIMIT 500").fetchall()
    return {"matches": [dict(row) for row in rows]}

@router.post("/admin/match-permissions")
def save_match_permission(data: MatchPermission, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    match_id, competition = data.match_id.strip()[:160], data.competition.strip()[:120]
    if not match_id or not competition:
        raise HTTPException(400, "Match ID and competition are required")
    with db() as conn:
        conn.execute("""INSERT INTO match_prediction_permissions(match_id,competition,match_title,enabled,updated_at)
            VALUES(%s,%s,%s,%s,NOW()) ON CONFLICT(match_id) DO UPDATE SET
            competition=EXCLUDED.competition,match_title=EXCLUDED.match_title,
            enabled=EXCLUDED.enabled,updated_at=NOW()""",
            (match_id, competition, data.match_title.strip()[:240], data.enabled))
    return {"success": True}

@router.get("/license/match-permissions")
def customer_match_permissions(x_device_id: Optional[str] = Header(default=None)):
    license = active_license(x_device_id or "")
    if license.get("allow_all_matches"):
        return {"allow_all_matches": True, "allowed_match_ids": []}
    with db() as conn:
        rows = conn.execute("SELECT match_id FROM license_match_permissions WHERE license_id=%s AND enabled=TRUE", (license["id"],)).fetchall()
    return {"allow_all_matches": False, "allowed_match_ids": [row["match_id"] for row in rows]}

@router.get("/admin/licenses/{license_id}/matches")
def admin_customer_matches(license_id: int, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    with db() as conn:
        customer = conn.execute("SELECT id,allow_all_matches FROM app_licenses WHERE id=%s", (license_id,)).fetchone()
        if not customer:
            raise HTTPException(404, "License not found")
        rows = conn.execute("SELECT match_id,competition,match_title,enabled FROM license_match_permissions WHERE license_id=%s ORDER BY updated_at DESC", (license_id,)).fetchall()
    return {"allow_all_matches": customer["allow_all_matches"], "matches": [dict(row) for row in rows]}

class CustomerMatchesUpdate(BaseModel):
    allow_all_matches: bool = False
    matches: list[MatchPermission] = []

@router.put("/admin/licenses/{license_id}/matches")
def update_customer_matches(license_id: int, data: CustomerMatchesUpdate, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    clean = {}
    for item in data.matches:
        mid, comp = item.match_id.strip()[:160], item.competition.strip()[:120]
        if not mid or not comp:
            raise HTTPException(400, "Every match needs match ID and competition")
        clean[mid] = (comp, item.match_title.strip()[:240], item.enabled)
    with db() as conn:
        if not conn.execute("SELECT id FROM app_licenses WHERE id=%s FOR UPDATE", (license_id,)).fetchone():
            raise HTTPException(404, "License not found")
        conn.execute("UPDATE app_licenses SET allow_all_matches=%s WHERE id=%s", (data.allow_all_matches, license_id))
        for mid, (comp, title, enabled) in clean.items():
            conn.execute("""INSERT INTO license_match_permissions(license_id,match_id,competition,match_title,enabled)
                VALUES(%s,%s,%s,%s,%s) ON CONFLICT(license_id,match_id) DO UPDATE SET
                competition=EXCLUDED.competition,match_title=EXCLUDED.match_title,enabled=EXCLUDED.enabled,updated_at=NOW()""",
                (license_id, mid, comp, title, enabled))
    return {"success": True, "allow_all_matches": data.allow_all_matches, "updated_matches": len(clean)}

def require_match_permission(license, match_id: str, competition: str):
    if not match_id or not competition:
        raise HTTPException(403, "Match identity is required for prediction")
    if license.get("allow_all_matches"):
        return
    with db() as conn:
        row = conn.execute("SELECT enabled,competition FROM license_match_permissions WHERE license_id=%s AND match_id=%s",
            (license["id"], match_id)).fetchone()
    if not row or not row["enabled"] or str(row["competition"]).strip().casefold() != str(competition).strip().casefold():
        raise HTTPException(403, "This match is not included in your subscription")

@router.post("/admin/licenses/{license_id}/extend")
def extend(license_id: int, data: ExtendLicense, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    if not 1 <= data.duration_days <= 3650:
        raise HTTPException(400, "Days must be 1-3650")
    with db() as conn:
        row = conn.execute("SELECT expires_at FROM app_licenses WHERE id=%s FOR UPDATE", (license_id,)).fetchone()
        if not row:
            raise HTTPException(404, "License not found")
        now = datetime.now(timezone.utc)
        base = row["expires_at"] if row["expires_at"] and row["expires_at"] > now else now
        expiry = base + timedelta(days=data.duration_days)
        conn.execute("UPDATE app_licenses SET expires_at=%s, blocked=FALSE WHERE id=%s", (expiry, license_id))
    return {"success": True, "expires_at": expiry.isoformat()}

def set_block(license_id: int, blocked: bool, key: Optional[str]):
    admin_guard(key)
    with db() as conn:
        result = conn.execute("UPDATE app_licenses SET blocked=%s WHERE id=%s", (blocked, license_id))
        if result.rowcount == 0:
            raise HTTPException(404, "License not found")
    return {"success": True}

@router.post("/admin/licenses/{license_id}/block")
def block(license_id: int, x_admin_key: Optional[str] = Header(default=None)):
    return set_block(license_id, True, x_admin_key)

@router.post("/admin/licenses/{license_id}/unblock")
def unblock(license_id: int, x_admin_key: Optional[str] = Header(default=None)):
    return set_block(license_id, False, x_admin_key)

@router.post("/admin/licenses/{license_id}/reset-device")
def reset_device(license_id: int, data: ResetDevice, x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    if not data.confirm:
        raise HTTPException(400, "Set confirm=true to reset device binding")
    with db() as conn:
        result = conn.execute("UPDATE app_licenses SET device_id=NULL, activated_at=NULL, expires_at=NULL WHERE id=%s", (license_id,))
        if result.rowcount == 0:
            raise HTTPException(404, "License not found")
    return {"success": True}

@router.get("/admin.js", include_in_schema=False)
def admin_javascript():
    return FileResponse(os.path.join(os.path.dirname(__file__), "admin.js"), media_type="application/javascript")

@router.get("/admin", response_class=HTMLResponse)
def admin_page():
    return HTMLResponse(ADMIN_HTML)

ADMIN_HTML = """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cricket AI License Admin</title><style>
body{font:15px Arial;background:#0a0f1a;color:#eef;padding:18px;max-width:950px;margin:auto}input,button{padding:10px;margin:4px;border-radius:6px}input{background:#111827;color:white;border:1px solid #456}button{background:#00d9b5;color:#06121a;font-weight:bold;cursor:pointer}.card{border:1px solid #334155;padding:12px;border-radius:9px;margin:12px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #334155;text-align:left;font-size:12px}
</style></head><body><h2>🏏 Cricket AI — License Admin</h2>
<div class="card">Admin key <input id="key" type="password"><button id="connectBtn" type="button">Connect</button><span id="connectionStatus" role="status" aria-live="polite" style="margin-left:8px;color:#fbbf24">Not connected</span></div>
<div class="card"><h3>Create customer code</h3><input id="label" placeholder="Customer name/phone"><input id="days" type="number" min="1" max="3650" value="30"><input id="count" type="number" min="1" max="100" value="1"><input id="leagues" placeholder="Subscribed leagues, comma-separated"><button onclick="createCodes()">Generate code(s)</button><div id="created"></div></div>
<div class="card"><h3>Match prediction permissions</h3><p>Match feed mein se Match ID aur exact competition title enter karein. Sirf enabled match aur customer ki subscribed league dono match hon to prediction chalegi.</p><input id="matchid" placeholder="Match ID"><input id="matchleague" placeholder="Exact competition / league"><input id="matchtitle" placeholder="Teams / match title"><button onclick="saveMatch(true)">Allow prediction</button><button onclick="saveMatch(false)">Disable prediction</button><button onclick="loadMatchPermissions()">Refresh permissions</button><div id="matchrows"></div></div><div class="card"><h3>Customer licenses</h3><button onclick="loadList()">Refresh</button><div style="overflow:auto"><table><thead><tr><th>ID</th><th>Customer</th><th>Days</th><th>Leagues</th><th>Status</th><th>Expiry</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div></div>
<script src="/admin.js" defer></script></body></html>"""
