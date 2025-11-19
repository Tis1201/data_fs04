from __future__ import annotations

import json
from typing import Any, Dict

from loguru import logger


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

    # Persist claim result when we see a device.claim.confirm
    if data.get("op") == "device.claim.confirm" and data.get("result"):
        # Delegate to the device so the persistence logic stays encapsulated
        device._handle_claim_confirm_result(data["result"])  # type: ignore[attr-defined]


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

    For claim notifications, this publishes a device.claim.confirm RPC
    back to the server, including the deviceInfo built by the Device.
    """
    try:
        data = json.loads(payload)
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Failed to parse notification payload: {e}")
        return

    ticket = data.get("ticket")
    if not ticket:
        logger.warning("Claim notification missing ticket")
        return

    logger.info("Received claim notification, sending device.claim.confirm")

    confirm_params: Dict[str, Any] = {
        "ticket": ticket,
        "deviceInfo": device._build_device_info(),  # type: ignore[attr-defined]
    }

    import uuid

    request_id = str(uuid.uuid4())
    request_payload = {
        "requestId": request_id,
        "op": "device.claim.confirm",
        "params": confirm_params,
    }

    request_topic = f"device/{device.sub}/requests"  # type: ignore[attr-defined]
    device.client.publish(request_topic, json.dumps(request_payload), qos=1)  # type: ignore[attr-defined]
    logger.debug(f"Published device.claim.confirm to {request_topic}: {request_payload}")


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
