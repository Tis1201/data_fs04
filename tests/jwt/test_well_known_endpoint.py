from jwt import decode, PyJWKClient
from pprint import pprint
from dotenv import load_dotenv
import os

load_dotenv()

token = os.getenv("SAMPLE_DEVICE_JWT_TOKEN")
jwks_url = "http://localhost:5173/.well-known/jwks.json"

jwk_client = PyJWKClient(jwks_url)
signing_key = jwk_client.get_signing_key_from_jwt(token)

decoded = decode(
    token,
    signing_key.key,
    algorithms=["RS256"],
    issuer="fs04"  # must match your `iss` claim
)

pprint(decoded)
