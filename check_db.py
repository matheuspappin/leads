import psycopg2
import sys

def check_db():
    try:
        # Try different connection strings
        conn = psycopg2.connect(
            host="db.qttrknfhxdgfaadcsswd.supabase.co",
            database="postgres",
            user="postgres",
            password="uis4k44gYMgkTXIxnRng8Q_LYJPY2nw",
            port=5432
        )
        print("Connected with plain user")
        conn.close()
        return
    except Exception as e:
        print(f"Error 1: {e}")

    try:
        conn = psycopg2.connect(
            host="db.qttrknfhxdgfaadcsswd.supabase.co",
            database="postgres",
            user="postgres.qttrknfhxdgfaadcsswd",
            password="uis4k44gYMgkTXIxnRng8Q_LYJPY2nw",
            port=5432
        )
        print("Connected with project user")
        
        # Let's try to read the jwt secret if it's stored in some settings or vault
        cur = conn.cursor()
        cur.execute("SELECT current_setting('app.settings.jwt_secret', true);")
        res = cur.fetchone()
        print(f"JWT Secret from app.settings: {res}")
        
        cur.execute("SHOW pgrst.jwt_secret;")
        res = cur.fetchone()
        print(f"JWT Secret from pgrst.jwt_secret: {res}")
        
        conn.close()
        return
    except Exception as e:
        print(f"Error 2: {e}")

if __name__ == '__main__':
    check_db()
