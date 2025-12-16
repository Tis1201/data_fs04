import json
from typing import Any, Dict, Optional

import jwt


def decode_jwt(token: str, *, verify: bool = False, key: Optional[str] = None) -> Dict[str, Any]:
    """Return decoded header and payload for a JWT.

    Args:
        token: The JWT string.
        verify: Whether to verify the signature. Defaults to False.
        key: Optional key for signature verification when verify is True.
    """
    header = jwt.get_unverified_header(token)

    if verify and key is None:
        raise ValueError("A verification key must be provided when verify=True")

    payload = jwt.decode(
        token,
        key if verify else None,
        algorithms=None if not verify else header.get("alg"),
        options={"verify_signature": verify},
    )

    return {"header": header, "payload": payload}


def pretty_print_jwt(token: str, *, verify: bool = False, key: Optional[str] = None) -> None:
    """Decode a JWT and pretty-print the header and payload."""
    decoded = decode_jwt(token, verify=verify, key=key)

    print("\n🔐 JWT Header:")
    print(json.dumps(decoded["header"], indent=2, sort_keys=True))

    print("\n📦 JWT Payload:")
    print(json.dumps(decoded["payload"], indent=2, sort_keys=True))


if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Decode and pretty-print a JWT")
    parser.add_argument("token", help="JWT string to decode")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify the token signature (requires --key)",
    )
    parser.add_argument(
        "--key",
        help="Verification key to use when --verify is provided",
    )

    args = parser.parse_args()

    try:
        pretty_print_jwt(args.token, verify=args.verify, key=args.key)
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to decode JWT: {exc}", file=sys.stderr)
        sys.exit(1)
