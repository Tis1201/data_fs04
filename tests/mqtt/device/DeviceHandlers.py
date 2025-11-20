from __future__ import annotations

import json
from typing import Any, Dict

from loguru import logger

import jwt

def handle_response(device: Any, payload: str) -> None:
    """Handle messages on .../response for a Device instance.

    This is responsible for matching pending RPC requests and, for
    device.claim.confirm, persisting the claim state via the device's
    internal helper.
    """
    try:
        data = json.loads(payload)
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Failed to parse response payload: {e}")
        return

    req_id = data.get("requestId")
    if req_id and req_id in getattr(device, "pending_requests", {}):
        device.pending_requests[req_id]["response"] = data
        device.pending_requests[req_id]["event"].set()

    # Delegate full RPC envelope to an optional device-level callback so
    # business logic (e.g. claim handling) lives with the concrete
    # device client, not in this generic handler.
    callback = getattr(device, "on_rpc_response", None)
    if callable(callback):
        callback(data)


def handle_request(device: Any, client: Any, payload: str) -> None:
    """Handle messages on .../requests for a Device instance.

    Currently this is mostly a placeholder that logs the request structure,
    but keeping it here keeps the branching logic out of the Device class
    and allows future expansion.
    """
    try:
        data = json.loads(payload)
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Failed to parse request payload: {e}")
        return

    logger.debug(f"Received RPC request on device side: {data}")
    # If we ever need actual device-side RPC handling, we can branch here


def handle_notification(device: Any, payload: str) -> None:
    """Handle messages on .../notifications for a Device instance.

    Business-specific behavior (e.g. claim notification handling) is
    delegated to an optional callback on the device.
    """
    try:
        data = json.loads(payload)
        ticket = data.get("ticket")

        if ticket:
            # Decode ticket claims for debugging only; do not verify signature here.
            # The server verifies this ticket using its own signing key.
            claims = jwt.decode(
                ticket,
                options={"verify_signature": False, "verify_aud": False},
                algorithms=["RS256"],
            )
            # Expose claims dict to downstream handlers
            data["claims"] = claims
            

    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Failed to parse notification payload: {e}")
        return

    callback = getattr(device, "on_notification", None)
    if callable(callback):
        callback(data)
    else:
        logger.debug("Notification received but no on_claim_notification callback set")


class DeviceHandlers:

    """OO wrapper around the functional handlers for a Device instance."""

    def __init__(self, device: Any) -> None:
        self.device = device

    def handle_response(self, payload: str) -> None:
        handle_response(self.device, payload)

    def handle_request(self, client: Any, payload: str) -> None:
        handle_request(self.device, client, payload)

    def handle_notification(self, payload: str) -> None:
        handle_notification(self.device, payload)
