import os, hashlib, secrets, hmac
from datetime import datetime, timedelta, timezone
from typing import Optional
import psycopg
from psycopg.rows import dict_row
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse
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
            blocked BOOLEAN NOT NULL DEFAULT FALSE
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
        row = conn.execute("SELECT id, expires_at, blocked FROM app_licenses WHERE device_id=%s", (device_id,)).fetchone()
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

class ExtendLicense(BaseModel):
    duration_days: int

class ResetDevice(BaseModel):
    confirm: bool = False

@router.post("/license/activate")
def activate(data: Activation):
    code, device = data.code.strip().upper(), data.device_id.strip()
    if len(code) < 8 or len(device) < 16 or len(device) > 128:
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
            code = secrets.token_hex(5).upper()
            digest = hashlib.sha256(code.encode()).hexdigest()
            conn.execute("INSERT INTO app_licenses(code_hash,label,duration_days) VALUES(%s,%s,%s)", (digest, data.label.strip()[:120], data.duration_days))
            result.append({"code": code, "label": data.label, "duration_days": data.duration_days})
    return {"licenses": result}

@router.get("/admin/licenses")
def listing(x_admin_key: Optional[str] = Header(default=None)):
    admin_guard(x_admin_key)
    with db() as conn:
        rows = conn.execute("SELECT id,label,duration_days,device_id,created_at,activated_at,expires_at,blocked FROM app_licenses ORDER BY id DESC LIMIT 500").fetchall()
    now, out = datetime.now(timezone.utc), []
    for row in rows:
        item = dict(row)
        item["status"] = "blocked" if item["blocked"] else ("pending" if not item["activated_at"] else ("active" if item["expires_at"] and item["expires_at"] > now else "expired"))
        for key in ("created_at", "activated_at", "expires_at"):
            item[key] = item[key].isoformat() if item[key] else None
        out.append(item)
    return {"licenses": out}

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

@router.get("/admin", response_class=HTMLResponse)
def admin_page():
    return HTMLResponse(ADMIN_HTML)

ADMIN_HTML = """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cricket AI License Admin</title><style>
body{font:15px Arial;background:#0a0f1a;color:#eef;padding:18px;max-width:950px;margin:auto}input,button{padding:10px;margin:4px;border-radius:6px}input{background:#111827;color:white;border:1px solid #456}button{background:#00d9b5;color:#06121a;font-weight:bold;cursor:pointer}.card{border:1px solid #334155;padding:12px;border-radius:9px;margin:12px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #334155;text-align:left;font-size:12px}
</style></head><body><h2>🏏 Cricket AI — License Admin</h2>
<div class="card">Admin key <input id="key" type="password"><button onclick="saveKey()">Connect</button></div>
<div class="card"><h3>Create customer code</h3><input id="label" placeholder="Customer name/phone"><input id="days" type="number" min="1" max="3650" value="30"><input id="count" type="number" min="1" max="100" value="1"><button onclick="createCodes()">Generate code(s)</button><div id="created"></div></div>
<div class="card"><h3>Customer licenses</h3><button onclick="loadList()">Refresh</button><div style="overflow:auto"><table><thead><tr><th>ID</th><th>Customer</th><th>Days</th><th>Status</th><th>Expiry</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div></div>
<script>
let k="";function headers(){return {"Content-Type":"application/json","X-Admin-Key":k}}
async function api(url,opts={}){let r=await fetch(url,{...opts,headers:{...headers(),...(opts.headers||{})}});let j=await r.json();if(!r.ok)throw Error(j.detail||"Request failed");return j}
function saveKey(){k=document.getElementById("key").value;loadList()}
async function createCodes(){try{let j=await api("/admin/licenses",{method:"POST",body:JSON.stringify({label:document.getElementById("label").value,duration_days:+document.getElementById("days").value,count:+document.getElementById("count").value})});document.getElementById("created").innerHTML=j.licenses.map(x=>"<p><b>"+x.code+"</b> — "+x.duration_days+" days</p>").join("");loadList()}catch(e){alert(e.message)}}
async function action(id,a){try{if(a==="extend"){let d=prompt("Additional days?");if(!d)return;await api("/admin/licenses/"+id+"/extend",{method:"POST",body:JSON.stringify({duration_days:+d})})}else if(a==="reset-device"){if(!confirm("Reset device binding? Code becomes unused and starts a fresh term on next activation."))return;await api("/admin/licenses/"+id+"/reset-device",{method:"POST",body:JSON.stringify({confirm:true})})}else await api("/admin/licenses/"+id+"/"+a,{method:"POST"});loadList()}catch(e){alert(e.message)}}
async function loadList(){try{let j=await api("/admin/licenses");document.getElementById("rows").innerHTML=j.licenses.map(x=>"<tr><td>"+x.id+"</td><td>"+(x.label||"—")+"</td><td>"+x.duration_days+"</td><td>"+x.status+"</td><td>"+(x.expires_at||"—")+"</td><td><button onclick='action("+x.id+",\"extend\")'>Extend</button><button onclick='action("+x.id+",\""+(x.blocked?"unblock":"block")+"\")'>"+(x.blocked?"Unblock":"Block")+"</button><button onclick='action("+x.id+",\"reset-device\")'>Reset</button></td></tr>").join("")}catch(e){document.getElementById("rows").innerHTML="<tr><td>"+e.message+"</td></tr>"}}
</script></body></html>"""
