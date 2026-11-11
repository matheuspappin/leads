import os
import psycopg2
import sys

def check_db():
    passwords = [
        os.getenv("SUPABASE_SECRET_KEY"),
        os.getenv("SUPABASE_SERVICE_KEY"),
        os.getenv("SUPABASE_PUBLISHABLE_KEY"),
        f"sb_publishable_{os.getenv(\"SUPABASE_PUBLISHABLE_KEY\")}"
    ]
    
    for pwd in passwords:
        try:
            print(f"Trying password: {pwd[:10]}...")
            conn = psycopg2.connect(
                host="db.qttrknfhxdgfaadcsswd.supabase.co",
                database="postgres",
                user="postgres",
                password=pwd,
                port=5432,
                connect_timeout=5
            )
            print(f"SUCCESS with password: {pwd}")
            conn.close()
            return
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == '__main__':
    check_db()

