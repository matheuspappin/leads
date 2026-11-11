import os
import jwt

token_anon = os.getenv("SUPABASE_ANON_TOKEN")
token_service = os.getenv("SUPABASE_SERVICE_TOKEN")

secrets_to_try = [
    os.getenv("SUPABASE_SECRET_KEY"),
    os.getenv("SUPABASE_SECRET_KEY", "").replace("sb_secret_", ""),
    f"sb_publishable_{os.getenv(\"SUPABASE_PUBLISHABLE_KEY\")}",
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
]

for secret in secrets_to_try:
    try:
        decoded = jwt.decode(token_anon, secret, algorithms=["HS256"], options={"verify_aud": False})
        print(f"SUCCESS! Secret is: {secret}")
        print(decoded)
        break
    except Exception as e:
        print(f"Failed with {secret}: {e}")

