import base64
import hashlib
import hmac
import secrets

PASSWORD_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        PASSWORD_ITERATIONS,
    )
    return "$".join(
        (
            "pbkdf2_sha256",
            str(PASSWORD_ITERATIONS),
            base64.urlsafe_b64encode(salt).decode(),
            base64.urlsafe_b64encode(password_hash).decode(),
        )
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, encoded_salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(encoded_salt)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(
            base64.urlsafe_b64encode(actual).decode(),
            expected,
        )
    except (ValueError, TypeError):
        return False


def create_session_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
