"""Cliente Mercado Pago com fallback simulado para desenvolvimento."""

from __future__ import annotations

import base64
import io
import uuid

import requests
from django.conf import settings


def create_pix_charge(payment) -> dict:
    from .models import PixNotConfigured, mercadopago_token, pix_mode

    mode = pix_mode()
    if mode == "disabled":
        raise PixNotConfigured("O PIX ainda não foi configurado. Fale com o suporte.")
    if mode == "simulated":
        return _simulate_pix(payment)
    return _mercadopago_pix(payment, mercadopago_token())


def _simulate_pix(payment) -> dict:
    import qrcode

    payload = (
        f"00020126580014BR.GOV.BCB.PIX0136{payment.idempotency_key}"
        f"520400005303986540{payment.amount:.2f}5802BR5925DRIVE NORM SIMULADO6009SAO PAULO62070503***6304ABCD"
    )
    img = qrcode.make(payload)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode()
    return {
        "external_id": f"sim-{payment.idempotency_key}",
        "qr_code": payload,
        "qr_code_base64": b64,
        "ticket_url": f"{settings.FRONTEND_URL}/recarregar?payment={payment.pk}",
    }


def _mercadopago_pix(payment, token: str) -> dict:
    import mercadopago

    sdk = mercadopago.SDK(token)
    request_options = mercadopago.config.RequestOptions()
    request_options.custom_headers = {"X-Idempotency-Key": payment.idempotency_key}

    body = {
        "transaction_amount": float(payment.amount),
        "description": f"Recarga Drive Norm #{payment.pk}",
        "payment_method_id": "pix",
        "payer": {
            "email": payment.user.email or f"user{payment.user_id}@drivenorm.local",
            "first_name": payment.user.display_name or payment.user.username,
        },
        "notification_url": f"{settings.BACKEND_URL}/api/payments/webhook/mercadopago/",
        "external_reference": str(payment.pk),
    }
    result = sdk.payment().create(body, request_options)
    response = result.get("response") or {}
    if result.get("status") not in (200, 201):
        raise RuntimeError(f"Erro Mercado Pago: {response}")

    poi = (response.get("point_of_interaction") or {}).get("transaction_data") or {}
    return {
        "external_id": str(response.get("id") or uuid.uuid4()),
        "qr_code": poi.get("qr_code") or "",
        "qr_code_base64": poi.get("qr_code_base64") or "",
        "ticket_url": poi.get("ticket_url") or "",
    }


def fetch_payment_status(external_id: str) -> str | None:
    from .models import mercadopago_token

    token = mercadopago_token()
    if not token or external_id.startswith("sim-"):
        return None
    import mercadopago

    sdk = mercadopago.SDK(token)
    result = sdk.payment().get(external_id)
    response = result.get("response") or {}
    return response.get("status")


def check_token(token: str) -> dict:
    """Valida o token consultando a conta no Mercado Pago."""
    try:
        response = requests.get(
            "https://api.mercadopago.com/users/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except requests.RequestException:
        return {
            "ok": False,
            "refused": False,
            "message": "Não foi possível falar com o Mercado Pago agora. Tente testar novamente.",
        }
    if response.status_code != 200:
        return {
            "ok": False,
            "refused": True,
            "message": "Token recusado pelo Mercado Pago. Confira se copiou o Access Token correto.",
        }
    data = response.json()
    account = data.get("nickname") or data.get("email") or str(data.get("id", ""))
    return {"ok": True, "refused": False, "message": f"Conectado à conta {account}."}
