
#!/usr/bin/env python3
"""One-request-per-run feed snapshot generator; inference math mirrors existing main.py."""
import json, os
from datetime import datetime, timezone
from pathlib import Path
import joblib, numpy as np, pandas as pd, requests
# Support both direct script execution (python scripts/update_matches.py) and
# package execution/imports (python -m scripts.update_matches).
try:
    from scripts.prediction_formats import match_type, elo_win_probability, is_t10_format, binary_class_probabilities
except ModuleNotFoundError as exc:
    if exc.name != "scripts":
        raise
    from prediction_formats import match_type, elo_win_probability, is_t10_format, binary_class_probabilities
API_KEY=os.environ.get("RAPIDAPI_KEY")
try:
    from scripts.provider_fallbacks import fetch_cricketdata, fetch_highlightly, fetch_cricketdata_match_info
except ModuleNotFoundError as exc:
    if exc.name != "scripts":
        raise
    from provider_fallbacks import fetch_cricketdata, fetch_highlightly, fetch_cricketdata_match_info
MODELS=joblib.load("cricket_ensemble_modern.joblib")
ELO=joblib.load("latest_elo_ratings.joblib")
MAPPINGS=joblib.load("category_mappings.joblib")
TOSS_STATS=joblib.load("toss_stats.joblib")
HISTORY_PATH=Path("data/cricsheet_match_history_2024_2026.json")
if not HISTORY_PATH.exists(): raise SystemExit(f"Required historical data file missing: {HISTORY_PATH}")
HISTORY=json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
if not HISTORY: raise SystemExit("Historical data file is empty; refusing default-form predictions.")
DEFAULT_ELO=1500
TEAM_MAPPING={'Saint Lucia Kings':'St Lucia Kings','Northern Brave':'Northern Districts','Northern Brave Women':'Northern Districts Women','Central Hinds':'Central Districts Women','Sudurpaschim Royals':'Sudur Paschim Royals','Antigua & Barbuda Falcons':'Antigua and Barbuda Falcons','St Kitts & Nevis Patriots':'St Kitts and Nevis Patriots','Canterbury Kings':'Canterbury','Auckland Hearts':'Auckland Women','Canterbury Magicians':'Canterbury Women','Otago Sparks':'Otago Women','Wellington Blaze':'Wellington Women'}
def get_elo(name):
    if name in ELO: return ELO[name]
    for key in ELO:
        if key.lower()==name.lower(): return ELO[key]
    return DEFAULT_ELO
def get_toss_rates(venue, decision):
    v=str(venue).split(',')[0].strip()
    tot=TOSS_STATS['v_tw_tot'].get(v,0); win=TOSS_STATS['v_tw_wins'].get(v,0)
    tw=win/tot if tot>0 else 0.5
    if decision=='bat':
        dt=TOSS_STATS['v_bat_tot'].get(v,0); dw=TOSS_STATS['v_bat_wins'].get(v,0)
    else:
        dt=TOSS_STATS['v_fld_tot'].get(v,0); dw=TOSS_STATS['v_fld_wins'].get(v,0)
    return tw, (dw/dt if dt>0 else 0.5)
def _team_key(name):
    # Cricsheet often omits the Women suffix while the live feed includes it.
    value=str(name or "").casefold().replace("&","and")
    value=value.replace("women"," ").replace("(w)"," ")
    parts=value.split()
    if parts and parts[-1] == "w": parts=parts[:-1]
    return " ".join(parts)

def _history_format(value):
    s=str(value or "").upper()
    if s in {"T20","IT20"}: return "T20"
    if s in {"ODI","ODM"}: return "ODI"
    if s in {"TEST","MDM"}: return "Test"
    return s

def _fixture_gender(t1,t2):
    names=(str(t1)+" "+str(t2)).casefold()
    tokens=names.replace("(w)"," women").split()
    return "female" if ("women" in tokens or (tokens and tokens[-1] == "w")) else "male"

def _prior_matches(t1,t2,fmt,venue,gender,cutoff):
    a,b=_team_key(t1),_team_key(t2)
    target_format=_history_format(fmt)
    v=str(venue or "").split(",")[0].strip().casefold()
    found=[]
    for match in HISTORY:
        if not match.get("winner") or str(match.get("date","")) >= cutoff:
            continue
        if match.get("gender","male") != gender:
            continue
        if _history_format(match.get("match_type")) != target_format:
            continue
        names=match.get("teams") or []
        if len(names)!=2:
            continue
        keys=[_team_key(x) for x in names]
        if a in keys or b in keys:
            found.append(match)
    return sorted(found,key=lambda x:x.get("date",""),reverse=True),a,b,v

def _form_rate(matches, team_key, limit=5):
    played=matches[:limit]
    if not played:
        return 0.5
    wins=sum(1 for m in played if _team_key(m.get("winner"))==team_key)
    return float(wins/len(played))

def get_match_features(fmt,t1,t2,venue,cutoff=None,gender=None):
    cutoff=cutoff or datetime.now(timezone.utc).date().isoformat()
    gender=str(gender or _fixture_gender(t1,t2)).casefold()
    prior,a,b,v=_prior_matches(t1,t2,fmt,venue,gender,cutoff)
    t1_matches=[m for m in prior if a in [_team_key(x) for x in m.get("teams",[])]]
    t2_matches=[m for m in prior if b in [_team_key(x) for x in m.get("teams",[])]]
    h2h=[m for m in prior if {a,b}=={_team_key(x) for x in m.get("teams",[])}]
    venue_t1=[m for m in t1_matches if str(m.get("venue","")).split(",")[0].strip().casefold()==v]
    venue_t2=[m for m in t2_matches if str(m.get("venue","")).split(",")[0].strip().casefold()==v]
    h2h_recent=h2h[:10]
    h2h_ratio=(sum(1 for m in h2h_recent if _team_key(m.get("winner"))==a)/len(h2h_recent)) if h2h_recent else 0.5
    return (_form_rate(t1_matches,a),_form_rate(t2_matches,b),float(h2h_ratio),
            _form_rate(venue_t1,a),_form_rate(venue_t2,b))

def calculate_prediction(fmt,t1,t2,venue,toss_winner,toss_decision,gender='male',match_date=None):
    e1,e2=get_elo(t1),get_elo(t2); toss_t1=1 if toss_winner==t1 else 0
    # T10 has no dedicated training data/artifact in this repository. Keep it
    # out of the T20 ensemble and use a clearly disclosed Elo-only estimate.
    if is_t10_format(fmt) or str(fmt).strip().casefold() == "unknown":
        # Never route unsupported formats through the T20-trained ensemble.
        elo_p1=elo_win_probability(e1,e2)
        return elo_p1,1.0-elo_p1,True
    venue_clean=str(venue).split(',')[0].strip()
    form1,form2,h2h,venue1,venue2=get_match_features(fmt,t1,t2,venue_clean,cutoff=match_date,gender=gender)
    # Keep the exact 13-column training schema and its original order.
    row={'match_type':str(fmt),'team1':str(t1),'team2':str(t2),'venue':str(venue_clean),'toss_decision':str(toss_decision),
         'team1_elo':float(e1),'team2_elo':float(e2),'toss_win_team1':int(toss_t1),
         'team1_form':form1,'team2_form':form2,'h2h_team1_ratio':h2h,
         'venue_form_t1':venue1,'venue_form_t2':venue2}
    try:
        df=pd.DataFrame([row])
        for col in ['match_type','team1','team2','venue','toss_decision']:
            if df[col].iloc[0] not in MAPPINGS[col]: df[col]="__UNKNOWN__"
            cats=list(MAPPINGS[col])
            if "__UNKNOWN__" not in cats: cats.append("__UNKNOWN__")
            df[col]=pd.Categorical(df[col],categories=cats)

        # Each immutable artifact carries its own training feature schema.
        # The former code passed all 13 engineered columns to both models;
        # the LightGBM artifact was trained with 11 and rejected inference.
        def model_input(model, frame, label):
            names=getattr(model,"feature_names_",None)
            if names is None or len(names)==0:
                names=getattr(model,"feature_name_",None)
            if names is None or len(names)==0:
                method=getattr(model,"feature_name",None)
                names=method() if callable(method) else None
            if names is None or len(names)==0:
                raise ValueError(f"{label} artifact does not expose its training feature names")
            names=list(names)
            missing=[name for name in names if name not in frame.columns]
            if missing:
                raise ValueError(f"{label} requires unavailable trained features: {missing}")
            return frame.loc[:,names]

        cat_model=MODELS['cat']; lgb_model=MODELS['lgb']
        cat_frame=model_input(cat_model,df,"CatBoost")
        lgb_frame=model_input(lgb_model,df,"LightGBM")
        cat_p1,cat_p0=binary_class_probabilities(cat_model,cat_frame)
        lgb_p1,lgb_p0=binary_class_probabilities(lgb_model,lgb_frame)
        p1=(cat_p1+lgb_p1)/2.0
        p0=(cat_p0+lgb_p0)/2.0
        return float(p1),float(p0),False
    except Exception as exc:
        print(f"Fallback model inference: {type(exc).__name__}")
        exp=1/(1+10**((e2-e1)/400))
        return exp,1-exp,True

def _canonical_toss(item):
    winner = item.get("toss_winner") or item.get("tossWinner") or item.get("toss_won")
    decision = item.get("toss_decision") or item.get("tossDecision") or item.get("tossChoice")
    toss_obj = item.get("toss")
    if isinstance(toss_obj, dict):
        winner = winner or toss_obj.get("winner") or toss_obj.get("tossWinner")
        decision = decision or toss_obj.get("decision") or toss_obj.get("choice")
    elif isinstance(toss_obj, str):
        raw_toss = toss_obj.strip()
        for name in ((item.get("teama") or {}).get("name", ""),
                     (item.get("teamb") or {}).get("name", "")):
            if name and name.casefold() in raw_toss.casefold():
                winner = winner or name
        if "bat" in raw_toss.casefold(): decision = decision or "bat"
        elif "bowl" in raw_toss.casefold() or "field" in raw_toss.casefold():
            decision = decision or "field"
    winner = str(winner or "").strip()
    raw = str(decision or "").strip().casefold()
    if raw in {"bat", "batting", "elected to bat", "choose to bat"}: raw = "bat"
    elif raw in {"bowl", "bowling", "field", "fielding", "elected to field", "elected to bowl", "choose to bowl"}: raw = "field"
    else: raw = ""
    teams = [str((item.get(k) or {}).get("name") or "").strip() for k in ("teama", "teamb")]
    if winner and winner.casefold() not in {name.casefold() for name in teams if name}:
        winner = ""
    return {"winner": winner, "decision": raw} if winner and raw else None


def _merge_provider_enrichment(primary_items, cricketdata_items):
    """Merge unambiguous same-fixture score/team/toss details; preserve source names."""
    def key(item):
        names = [str((item.get(k) or {}).get("name") or "").strip().casefold()
                 for k in ("teama", "teamb")]
        if not all(names): return None
        return (tuple(sorted(names)), _history_format(item.get("format_str")))
    index = {}
    for candidate in cricketdata_items or []:
        index.setdefault(key(candidate), []).append(candidate)
    merged = 0
    for item in primary_items:
        matches = index.get(key(item), [])
        if len(matches) != 1: continue
        extra = matches[0]
        for field in ("score", "team_info", "scorecard", "toss_winner", "toss_decision"):
            if extra.get(field) not in (None, "", [], {}):
                item[field] = extra[field]
        item["cricketdata_enriched"] = True
        merged += 1
    return merged


def make_prediction(m):
    raw1=(m.get('teama') or {}).get('name') or ''; raw2=(m.get('teamb') or {}).get('name') or ''
    if not raw1 or not raw2: return None
    t1=TEAM_MAPPING.get(raw1,raw1); t2=TEAM_MAPPING.get(raw2,raw2)
    venue=(m.get('venue') or {}).get('name') or ''; fmt=match_type(m.get('format_str'))
    gender=_fixture_gender(t1,t2)
    match_date=datetime.fromtimestamp(int(m.get('timestamp_start') or 0),timezone.utc).date().isoformat() if m.get('timestamp_start') else datetime.now(timezone.utc).date().isoformat()
    p1s=[];p2s=[];fallback=False;post={}
    for side,winner in [('t1',t1),('t2',t2)]:
        for decision in ('bat','field'):
            p1,p2,fb=calculate_prediction(fmt,t1,t2,venue,winner,decision,gender=gender,match_date=match_date)
            p1s.append(p1);p2s.append(p2);fallback=fallback or fb
            post[f'{side}_{decision}']={t1:f'{p1*100:.2f}%',t2:f'{p2*100:.2f}%'}
    return {'pre':{t1:f'{np.mean(p1s)*100:.2f}%',t2:f'{np.mean(p2s)*100:.2f}%'},
            'post_toss':post,'actual_toss':_canonical_toss(m),'is_default':fallback}
def main():
    # Primary feed remains first choice. Secondary providers are called only
    # when the primary request is unavailable, malformed, or returns no fixtures.
    today=datetime.now(timezone.utc).date()
    start_date=today.isoformat()
    end_date=today.isoformat()
    date_range=start_date
    per_page=100
    items=[]
    cricketdata_items=None
    total_pages=0
    expected_total=0
    provider_name="Cricket Live Line Advance"
    primary_error=None

    if API_KEY:
        try:
            base_url='https://cricket-live-line-advance.p.rapidapi.com/matches'
            headers={'X-RapidAPI-Key':API_KEY,'X-RapidAPI-Host':'cricket-live-line-advance.p.rapidapi.com'}
            params={'date':date_range,'per_paged':per_page,'paged':1}
            r=requests.get(base_url,params=params,headers=headers,timeout=25)
            r.raise_for_status()
            payload=r.json()
            response=payload.get('response') if isinstance(payload,dict) else None
            first_items=response.get('items') if isinstance(response,dict) else None
            if not isinstance(first_items,list) or not first_items or not all(isinstance(item,dict) for item in first_items):
                raise ValueError('primary response missing a valid non-empty response.items list')
            total_pages=int(response.get('total_pages') or 1)
            expected_total=int(response.get('total_items') or len(first_items))
            if total_pages<1 or total_pages>2:
                raise ValueError(f'primary returned unsupported page count: {total_pages}')
            items=list(first_items)
            if total_pages==2:
                page2_params={'date':date_range,'per_paged':per_page,'paged':2}
                r2=requests.get(base_url,params=page2_params,headers=headers,timeout=25)
                r2.raise_for_status()
                payload2=r2.json()
                response2=payload2.get('response') if isinstance(payload2,dict) else None
                second_items=response2.get('items') if isinstance(response2,dict) else None
                if not isinstance(second_items,list) or not all(isinstance(item,dict) for item in second_items):
                    raise ValueError('primary page 2 missing a valid response.items list')
                if int(response2.get('total_pages') or 1)!=total_pages or int(response2.get('total_items') or expected_total)!=expected_total:
                    raise ValueError('primary pagination metadata changed between pages')
                items.extend(second_items)
            if len(items)!=expected_total:
                raise ValueError(f'primary incomplete feed: fetched {len(items)} of {expected_total}')
            match_ids=[str(item.get('match_id') or item.get('id') or item.get('matchId')) for item in items
                       if isinstance(item,dict) and (item.get('match_id') is not None or item.get('id') is not None or item.get('matchId') is not None)]
            if match_ids and (len(match_ids)!=len(items) or len(set(match_ids))!=len(match_ids)):
                raise ValueError('primary pages contain missing or duplicate match IDs')
            response=dict(response)
            provider_total_items=response.get('total_items',len(items))
            response['fetched_pages']=total_pages
            response['items']=items
        except (requests.RequestException, ValueError, TypeError, KeyError) as exc:
            primary_error=type(exc).__name__
            items=[]

    if not items:
        print(f"Primary feed unusable ({primary_error or 'RAPIDAPI_KEY missing'}); trying CricketData backup.")
        try:
            cricketdata_items=fetch_cricketdata()
            items=cricketdata_items
            provider_name="CricketData"
        except Exception as exc:
            print(f"CricketData backup unavailable: {type(exc).__name__}; trying Highlightly.")
            try:
                items=fetch_highlightly()
                provider_name="Highlightly"
            except Exception as highlightly_exc:
                raise SystemExit(
                    "All configured fixture providers are unusable. "
                    f"Primary={primary_error or 'not configured'}, "
                    f"CricketData={type(exc).__name__}, "
                    f"Highlightly={type(highlightly_exc).__name__}; prior snapshot left untouched."
                ) from highlightly_exc

    # Reuse one CricketData list request as both backup and optional enrichment.
    # At 30-minute cadence this is 48 list calls/day; at most one match-info
    # request per run keeps the documented 100-hit/day allowance protected.
    if provider_name == "Cricket Live Line Advance" and os.getenv("CRICKETDATA_API_KEY", "").strip():
        try:
            cricketdata_items = fetch_cricketdata()
            merged_count = _merge_provider_enrichment(items, cricketdata_items)
            print(f"CricketData enrichment: {merged_count} unambiguous fixture(s) matched.")
        except Exception as exc:
            print(f"CricketData enrichment unavailable: {type(exc).__name__}; primary feed retained.")

    if cricketdata_items:
        active = [x for x in cricketdata_items
                  if (x.get("provider_metadata") or {}).get("matchStarted")
                  and not _canonical_toss(x)]
        if active:
            candidate = active[0]
            try:
                detail = fetch_cricketdata_match_info(candidate.get("match_id"))
                detail_fixture = dict(candidate)
                detail_fixture["toss_winner"] = detail.get("tossWinner") or detail.get("toss_winner")
                detail_fixture["toss_decision"] = detail.get("tossChoice") or detail.get("tossDecision")
                detail_fixture["score"] = detail.get("score", detail_fixture.get("score"))
                detail_fixture["scorecard"] = detail.get("scorecard", detail_fixture.get("scorecard"))
                _merge_provider_enrichment(items, [detail_fixture])
                print("CricketData match-info enrichment: one active fixture checked.")
            except Exception as exc:
                print(f"CricketData match-info unavailable: {type(exc).__name__}; toss data not fabricated.")

    if not items:
        raise SystemExit('All providers returned zero usable fixtures; prior snapshot left untouched.')
    if provider_name != "Cricket Live Line Advance":
        total_pages=1
        provider_total_items=len(items)
        response={
            'items':items,
            'total_items':len(items),
            'total_pages':1,
            'fetched_pages':1,
            'provider':provider_name,
        }
    print(f"Fixture source selected: {provider_name} ({len(items)} normalized fixtures).")

    # Keep only formats/team levels represented by the trained prediction model.
    def is_untrained_fixture(item):
        fmt=str(item.get('format_str') or '').strip().lower()
        # Exclude List A and all Test/First-Class fixtures from the live feed.
        if fmt in {'list a', 'list-a', 'list a cricket'}:
            return True
        if 'test' in fmt or 'first class' in fmt or 'first-class' in fmt:
            return True
        # Do not infer team level from franchise/team names (e.g. "Lions",
        # "A", or "Youth"). Names are not reliable metadata and can exclude
        # legitimate franchise fixtures. Eligibility is determined by the
        # provider's explicit match-format fields above, not team-name text.
        return False

    raw_count=len(items)
    items=[item for item in items if not is_untrained_fixture(item)]
    if not items:
        raise SystemExit('All provider fixtures were excluded by training-eligibility filters; prior snapshot left untouched.')
    for item in items:
        pred=make_prediction(item)
        if pred: item['ai_prediction']=pred
    response['items']=items
    response['provider_total_items']=provider_total_items
    response['filtered_out_items']=raw_count-len(items)
    output={'updated_at':datetime.now(timezone.utc).isoformat(),
            'provider_date_start':start_date,'provider_date_end':end_date,
            'provider_total_items':provider_total_items,
            'provider':provider_name,
            'filtered_out_items':raw_count-len(items),
            'provider_total_pages':total_pages,'response':response}
    Path('data').mkdir(exist_ok=True)
    Path('data/matches.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Generated snapshot with {len(items)} eligible fixtures (filtered {raw_count-len(items)} of {raw_count} API fixtures) across {start_date} to {end_date} using {total_pages} provider page(s).')
if __name__=='__main__': main()
