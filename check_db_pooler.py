import os
import psycopg2

def check_db():
    passwords = [
        os.getenv("SUPABASE_SECRET_KEY"),
        os.getenv("SUPABASE_SERVICE_KEY"),
        os.getenv("SUPABASE_PUBLISHABLE_KEY"),
        f"sb_publishable_{os.getenv(\"SUPABASE_PUBLISHABLE_KEY\")}"
    ]
    
    for pwd in passwords:
        try:
            print(f"Trying password: {pwd[:10]}... on port 6543 (IPv4 pooler)")
            conn = psycopg2.connect(
                host="aws-0-sa-east-1.pooler.supabase.com", # Let's try common regions if needed, or the direct host
                database="postgres",
                user="postgres.qttrknfhxdgfaadcsswd",
                password=pwd,
                port=6543,
                connect_timeout=5
            )
            print(f"SUCCESS with password: {pwd}")
            conn.close()
            return
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == '__main__':
    check_db()

