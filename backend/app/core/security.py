from hashlib import sha256


def hash_password(password: str) -> str:
    # Demo-level хеширование; в production заменить на passlib/bcrypt.
    return sha256(password.encode("utf-8")).hexdigest()
