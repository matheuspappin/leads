import sys
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix get_supabase
content = content.replace(
'''def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_KEY."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)''',
'''def get_supabase(token: str = None) -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase não configurado. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_KEY."
        )
    from supabase import ClientOptions
    if token:
        options = ClientOptions(headers={"Authorization": f"Bearer {token}"})
        return create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
    return create_client(SUPABASE_URL, SUPABASE_KEY)'''
)

# Fix get_user_id_from_token
content = content.replace('return user_id', 'return (user_id, token)')
content = content.replace('def get_user_id_from_token(authorization: str = Header(None)) -> str:', 'def get_user_id_from_token(authorization: str = Header(None)) -> tuple:')

# Replace route dependencies and sb = get_supabase()
content = re.sub(r'async def get_settings\(user_id: str = Depends\(get_user_id_from_token\)\):\s+sb = get_supabase\(\)', 'async def get_settings(auth_data: tuple = Depends(get_user_id_from_token)):\n    user_id, token = auth_data\n    sb = get_supabase(token)', content)

content = re.sub(r'async def save_settings\(req: SettingsRequest, user_id: str = Depends\(get_user_id_from_token\)\):\s+sb = get_supabase\(\)', 'async def save_settings(req: SettingsRequest, auth_data: tuple = Depends(get_user_id_from_token)):\n    user_id, token = auth_data\n    sb = get_supabase(token)', content)

content = re.sub(r'async def search_leads\(req: SearchRequest, user_id: str = Depends\(get_user_id_from_token\)\):\s+sb = get_supabase\(\)', 'async def search_leads(req: SearchRequest, auth_data: tuple = Depends(get_user_id_from_token)):\n    user_id, token = auth_data\n    sb = get_supabase(token)', content)

content = re.sub(r'async def get_history\(user_id: str = Depends\(get_user_id_from_token\)\):\s+sb = get_supabase\(\)', 'async def get_history(auth_data: tuple = Depends(get_user_id_from_token)):\n    user_id, token = auth_data\n    sb = get_supabase(token)', content)

content = re.sub(r'async def get_search_leads\(search_id: int, user_id: str = Depends\(get_user_id_from_token\)\):\s+sb = get_supabase\(\)', 'async def get_search_leads(search_id: int, auth_data: tuple = Depends(get_user_id_from_token)):\n    user_id, token = auth_data\n    sb = get_supabase(token)', content)

content = re.sub(r'async def export_csv\(search_id: int, user_id: str = Depends\(get_user_id_from_token\)\):\s+sb = get_supabase\(\)', 'async def export_csv(search_id: int, auth_data: tuple = Depends(get_user_id_from_token)):\n    user_id, token = auth_data\n    sb = get_supabase(token)', content)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
