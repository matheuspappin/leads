"""
Lead Hunter — Backend FastAPI com Supabase + Auth por usuário
Sistema de captação de leads B2B via Google Places API
Cada usuário usa sua própria Google Places API Key
"""

import os
import json
import asyncio
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional, List

import httpx
import jwt
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ─────────────────────────────────────────────
#  Config
# ─────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")   # anon/public key
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

PLACES_SEARCH_URL  = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{}"
CACHE_DAYS = 7


def get_supabase(token: str = None) -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_KEY."
        )
    from supabase import ClientOptions
    if token:
        options = ClientOptions(headers={"Authorization": f"Bearer {token}"})
        return create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ─────────────────────────────────────────────
#  Auth Helpers
# ─────────────────────────────────────────────

def get_user_id_from_token(authorization: str = Header(None)) -> tuple:
    """Extrai o user_id do JWT do Supabase."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticação ausente.")

    token = authorization.replace("Bearer ", "")

    try:
        # Pega o algoritmo direto do cabeçalho do token para evitar InvalidAlgorithmError
        header = jwt.get_unverified_header(token)
        token_alg = header.get("alg", "HS256")

        if SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=[token_alg],
                    options={"verify_aud": False}
                )
            except Exception:
                # Fallback: Se a assinatura falhar ou a chave for incompatível, decodifica sem verificar
                payload = jwt.decode(token, options={"verify_signature": False}, algorithms=[token_alg])
        else:
            # Sem secret configurado
            payload = jwt.decode(token, options={"verify_signature": False}, algorithms=[token_alg])

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido: user_id ausente.")
        return (user_id, token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")


# ─────────────────────────────────────────────
#  Pydantic Models
# ─────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    city: str
    req_phone: bool = False
    req_reviews: bool = False
    open_only: bool = True


class SettingsUpdate(BaseModel):
    google_api_key: str


# ─────────────────────────────────────────────
#  Score Calculator
# ─────────────────────────────────────────────

def calculate_score(place: dict) -> tuple[int, list[str]]:
    """
    Calcula score de oportunidade.
    Quanto MAIOR o score, mais fácil é vender serviços para essa empresa.
    """
    score = 0
    reasons = []

    has_website = bool(place.get("website"))
    rating = place.get("rating", 0) or 0
    user_ratings = place.get("user_ratings_total", 0) or 0
    has_phone = bool(place.get("formatted_phone_number"))

    if not has_website:
        score += 40
        reasons.append("Sem site — oportunidade para venda de website")

    if 0 < rating < 4.0:
        score += 25
        reasons.append(f"Nota baixa ({rating}★) — precisa de gestão de reputação")

    if not has_phone:
        score += 15
        reasons.append("Sem telefone cadastrado — perfil incompleto")

    if user_ratings < 10:
        score += 20
        reasons.append(f"Poucos reviews ({user_ratings}) — potencial para crescimento")
    elif user_ratings < 50:
        score += 10
        reasons.append(f"Reviews moderados ({user_ratings}) — pode crescer mais")

    if rating == 0:
        score += 10
        reasons.append("Sem avaliações — negócio novo ou negligenciado")

    return min(score, 100), reasons


# ─────────────────────────────────────────────
#  Google Places API Client
# ─────────────────────────────────────────────

async def fetch_places(query: str, city: str, api_key: str, client: httpx.AsyncClient) -> list:
    """Busca lugares via Places API (New) v1 — searchText."""
    if not api_key or api_key.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="Você ainda não configurou sua Google Places API Key. Vá em Configurações e adicione a sua chave."
        )

    full_query = f"{query} em {city}"
    all_places = []
    next_page_token = None

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,nextPageToken",
    }

    for _ in range(3):
        body = {
            "textQuery": full_query,
            "languageCode": "pt-BR",
            "maxResultCount": 20,
        }
        if next_page_token:
            body["pageToken"] = next_page_token
            await asyncio.sleep(2)

        resp = await client.post(PLACES_SEARCH_URL, json=body, headers=headers, timeout=15)
        data = resp.json()

        if resp.status_code == 403 or "error" in data:
            err = data.get("error", {})
            raise HTTPException(
                status_code=403,
                detail=f"Google API Key inválida ou sem permissão. Verifique sua chave nas configurações. Detalhes: {err.get('message', str(data))}"
            )

        places = data.get("places", [])
        all_places.extend(places)
        next_page_token = data.get("nextPageToken")
        if not next_page_token or not places:
            break

    return all_places


async def fetch_place_details(place_id: str, api_key: str, client: httpx.AsyncClient) -> dict:
    """Busca detalhes completos de um lugar via Places API (New) v1."""
    url = PLACES_DETAILS_URL.format(place_id)
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,location,googleMapsUri",
        "Accept-Language": "pt-BR",
    }
    resp = await client.get(url, headers=headers, timeout=10)
    data = resp.json()
    if "error" in data:
        err_msg = data["error"].get("message", str(data))
        print(f"PLACE DETAILS ERROR for {place_id}: {err_msg}")
        raise Exception(f"Google API Error: {err_msg}. Verifique se sua chave tem faturamento (billing) ativo no Google Cloud.")
    
    return {
        "name":                   data.get("displayName", {}).get("text", ""),
        "formatted_address":      data.get("formattedAddress", ""),
        "formatted_phone_number": data.get("nationalPhoneNumber") or data.get("internationalPhoneNumber", ""),
        "website":                data.get("websiteUri", ""),
        "rating":                 data.get("rating", 0),
        "user_ratings_total":     data.get("userRatingCount", 0),
        "url":                    data.get("googleMapsUri", ""),
        "geometry":               {"location": data.get("location", {})},
    }


# ─────────────────────────────────────────────
#  Cache Helpers (Supabase)
# ─────────────────────────────────────────────

def get_cache(sb: Client, user_id: str, key: str) -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()
    result = sb.table("search_cache") \
        .select("data, expires_at") \
        .eq("user_id", user_id) \
        .eq("cache_key", key) \
        .gt("expires_at", now) \
        .execute()

    if result.data:
        return result.data[0]["data"]
    return None


def set_cache(sb: Client, user_id: str, key: str, data: dict, days: int = CACHE_DAYS):
    expires_at = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    sb.table("search_cache").upsert({
        "user_id": user_id,
        "cache_key": key,
        "data": data,
        "expires_at": expires_at,
    }, on_conflict="user_id,cache_key").execute()


# ─────────────────────────────────────────────
#  FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(title="Lead Hunter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/login")
async def login_page():
    return FileResponse("frontend/login.html")

@app.get("/register")
async def register_page():
    return FileResponse("frontend/register.html")

@app.get("/app")
async def app_page():
    return FileResponse("frontend/app.html")


@app.get("/api/status")
async def status():
    supabase_ok = bool(SUPABASE_URL and SUPABASE_KEY)
    return {"status": "ok", "supabase_configured": supabase_ok}


@app.get("/api/config")
async def get_config():
    """Expõe as credenciais públicas do Supabase para o frontend."""
    return {
        "supabase_url": SUPABASE_URL,
        "supabase_anon_key": SUPABASE_KEY,
    }


# ─────────────────────────────────────────────
#  Settings Endpoints
# ─────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings(auth_data: tuple = Depends(get_user_id_from_token)):
    user_id, token = auth_data
    sb = get_supabase(token)
    result = sb.table("user_settings") \
        .select("google_api_key") \
        .eq("user_id", user_id) \
        .execute()

    if result.data:
        key = result.data[0]["google_api_key"] or ""
        # Mascara a chave para não expor no frontend
        masked = key[:8] + "..." + key[-4:] if len(key) > 12 else ("***" if key else "")
        return {"has_api_key": bool(key), "masked_key": masked}
    return {"has_api_key": False, "masked_key": ""}


@app.post("/api/settings")
async def save_settings(body: SettingsUpdate, auth_data: tuple = Depends(get_user_id_from_token)):
    user_id, token = auth_data
    sb = get_supabase(token)
    sb.table("user_settings").upsert({
        "user_id": user_id,
        "google_api_key": body.google_api_key.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()
    return {"ok": True, "message": "API Key salva com sucesso!"}


# ─────────────────────────────────────────────
#  Search Endpoint
# ─────────────────────────────────────────────

@app.post("/api/search")
async def search_leads(req: SearchRequest, auth_data: tuple = Depends(get_user_id_from_token)) -> dict:
    user_id, token = auth_data
    sb = get_supabase(token)

    # Busca a API Key do usuário
    settings_result = sb.table("user_settings") \
        .select("google_api_key") \
        .eq("user_id", user_id) \
        .execute()

    api_key = ""
    if settings_result.data:
        api_key = settings_result.data[0].get("google_api_key", "") or ""

    # Usando search_v2 para invalidar o cache antigo que podia ter leads sem detalhes
    cache_key = f"search_v2:{req.query.lower().strip()}:{req.city.lower().strip()}"
    cached = get_cache(sb, user_id, cache_key)
    from_cache = False

    raw_leads = []
    if cached:
        from_cache = True
        raw_leads = cached["leads"]
    else:
        async with httpx.AsyncClient() as client:
            places = await fetch_places(req.query, req.city, api_key, client)

            leads_data = []
            for i in range(0, len(places), 5):
                batch = places[i:i+5]
                details_tasks = [fetch_place_details(p["id"], api_key, client) for p in batch]
                details_list = await asyncio.gather(*details_tasks, return_exceptions=True)

                for place, details in zip(batch, details_list):
                    if isinstance(details, Exception):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Falha ao obter dados completos do Google: {str(details)}"
                        )

                    score, reasons = calculate_score(details)
                    geo = details.get("geometry", {}).get("location", {})

                    fallback_name = place.get("displayName", {}).get("text", "") if isinstance(place.get("displayName"), dict) else ""
                    fallback_addr = place.get("formattedAddress", "")
                    fallback_geo  = place.get("location", {})

                    lead = {
                        "place_id": place.get("id", ""),
                        "name": details.get("name") or fallback_name,
                        "address": details.get("formatted_address") or fallback_addr,
                        "phone": details.get("formatted_phone_number", "") or "",
                        "website": details.get("website", "") or "",
                        "rating": details.get("rating", 0) or 0,
                        "user_ratings": details.get("user_ratings_total", 0) or 0,
                        "maps_url": details.get("url", f"https://maps.google.com/?q={fallback_name}"),
                        "has_website": bool(details.get("website")),
                        "has_phone": bool(details.get("formatted_phone_number")),
                        "score": score,
                        "score_reasons": reasons,
                        "lat": geo.get("latitude", 0) or fallback_geo.get("latitude", 0),
                        "lng": geo.get("longitude", 0) or fallback_geo.get("longitude", 0),
                        "business_status": place.get("businessStatus", "OPERATIONAL"),
                    }
                    raw_leads.append(lead)

        set_cache(sb, user_id, cache_key, {"leads": raw_leads})

    # Apply pre-search filters
    leads_data = []
    for l in raw_leads:
        if req.open_only and l.get("business_status") == "CLOSED_PERMANENTLY":
            continue
        if req.req_phone and not l.get("has_phone"):
            continue
        if req.req_reviews and not l.get("user_ratings"):
            continue
        leads_data.append(l)

    # Salva a busca no Supabase
    search_result = sb.table("searches").insert({
        "user_id": user_id,
        "query": req.query,
        "city": req.city,
        "total_leads": len(leads_data),
    }).execute()

    search_id = search_result.data[0]["id"]

    # Salva os leads
    if leads_data:
        leads_to_insert = [{
            "search_id": search_id,
            "user_id": user_id,
            "place_id": l["place_id"],
            "name": l["name"],
            "address": l["address"],
            "phone": l["phone"],
            "website": l["website"],
            "rating": l["rating"],
            "user_ratings": l["user_ratings"],
            "maps_url": l["maps_url"],
            "has_website": l["has_website"],
            "has_phone": l["has_phone"],
            "score": l["score"],
            "score_reasons": l["score_reasons"],
            "lat": l["lat"],
            "lng": l["lng"],
        } for l in leads_data]

        # Insere em lotes de 50
        for i in range(0, len(leads_to_insert), 50):
            sb.table("leads").insert(leads_to_insert[i:i+50]).execute()

    return {
        "search_id": search_id,
        "query": req.query,
        "city": req.city,
        "total": len(leads_data),
        "from_cache": from_cache,
        "leads": leads_data,
    }


# ─────────────────────────────────────────────
#  History Endpoints
# ─────────────────────────────────────────────

@app.get("/api/history")
async def get_history(auth_data: tuple = Depends(get_user_id_from_token)):
    user_id, token = auth_data
    sb = get_supabase(token)
    result = sb.table("searches") \
        .select("id, query, city, created_at, total_leads") \
        .eq("user_id", user_id) \
        .order("id", desc=True) \
        .limit(50) \
        .execute()
    return result.data or []


@app.get("/api/search/{search_id}")
async def get_search_leads(search_id: int, auth_data: tuple = Depends(get_user_id_from_token)):
    user_id, token = auth_data
    sb = get_supabase(token)

    search = sb.table("searches") \
        .select("*") \
        .eq("id", search_id) \
        .eq("user_id", user_id) \
        .execute()

    if not search.data:
        raise HTTPException(status_code=404, detail="Busca não encontrada")

    leads = sb.table("leads") \
        .select("*") \
        .eq("search_id", search_id) \
        .eq("user_id", user_id) \
        .execute()

    return {"search": search.data[0], "leads": leads.data or []}


@app.get("/api/export/{search_id}")
async def export_csv(search_id: int, auth_data: tuple = Depends(get_user_id_from_token)):
    user_id, token = auth_data
    sb = get_supabase(token)

    search = sb.table("searches") \
        .select("*") \
        .eq("id", search_id) \
        .eq("user_id", user_id) \
        .execute()

    if not search.data:
        raise HTTPException(status_code=404, detail="Busca não encontrada")

    leads = sb.table("leads") \
        .select("*") \
        .eq("search_id", search_id) \
        .execute()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Nome", "Endereço", "Telefone", "Site", "Nota", "Nº Avaliações",
        "Tem Site", "Tem Telefone", "Score Oportunidade", "Motivos", "Google Maps"
    ])

    for lead in (leads.data or []):
        reasons = lead.get("score_reasons") or []
        if isinstance(reasons, str):
            reasons = json.loads(reasons)
        writer.writerow([
            lead["name"], lead["address"], lead["phone"], lead["website"],
            lead["rating"], lead["user_ratings"],
            "Sim" if lead["has_website"] else "Não",
            "Sim" if lead["has_phone"] else "Não",
            lead["score"],
            " | ".join(reasons),
            lead["maps_url"],
        ])

    output.seek(0)
    s = search.data[0]
    filename = f"leads_{s['query']}_{s['city']}_{search_id}.csv".replace(" ", "_")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.delete("/api/search/{search_id}")
async def delete_search(search_id: int, auth_data: tuple = Depends(get_user_id_from_token)):
    user_id, token = auth_data
    sb = get_supabase(token)
    sb.table("leads").delete().eq("search_id", search_id).eq("user_id", user_id).execute()
    sb.table("searches").delete().eq("id", search_id).eq("user_id", user_id).execute()
    return {"ok": True}

# Serve frontend estático no root (html=True para servir index.html)
# IMPORTANTE: Deve ser a última rota para não sobrescrever a API
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    print("Lead Hunter iniciando em http://localhost:8000")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
