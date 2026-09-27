from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Payment, PaymentSettings

User = get_user_model()


@override_settings(MERCADOPAGO_ACCESS_TOKEN="")
class PixModeTests(APITestCase):
    def setUp(self):
        self.client_user = User.objects.create_user("cli", password="x12345", role=User.Role.CLIENT)
        self.client.force_authenticate(self.client_user)

    @override_settings(DEBUG=False)
    def test_pix_disabled_in_production_without_token(self):
        response = self.client.post("/api/payments/pix/", {"amount": "50"}, format="json")
        self.assertEqual(response.status_code, 503)

    @override_settings(DEBUG=True)
    def test_simulated_pix_can_be_approved_in_debug(self):
        payment = self.client.post("/api/payments/pix/", {"amount": "50"}, format="json").json()
        self.assertTrue(payment["simulated"])
        response = self.client.post(f"/api/payments/{payment['id']}/simulate-approve/")
        self.assertEqual(response.status_code, 200)
        self.client_user.wallet.refresh_from_db()
        self.assertEqual(self.client_user.wallet.balance, Decimal("50.00"))

    def test_simulation_blocked_outside_debug(self):
        payment = Payment.objects.create(
            user=self.client_user, amount=50, external_id="sim-x", idempotency_key="k1"
        )
        response = self.client.post(f"/api/payments/{payment.pk}/simulate-approve/")
        self.assertEqual(response.status_code, 400)
        webhook = self.client.post(
            "/api/payments/webhook/mercadopago/",
            {"type": "payment", "data": {"id": "sim-x"}, "force_approve": True},
            format="json",
        )
        self.assertEqual(webhook.status_code, 200)
        payment.refresh_from_db()
        self.assertFalse(payment.credited)

    def test_pending_payment_is_credited_when_mercadopago_confirms(self):
        PaymentSettings.objects.create(pk=1, mercadopago_access_token="APP_USR-123")
        payment = Payment.objects.create(
            user=self.client_user, amount=30, external_id="999", idempotency_key="k2"
        )
        with mock.patch("payments.mercadopago_client.fetch_payment_status", return_value="approved"):
            response = self.client.get(f"/api/payments/{payment.pk}/")
        self.assertEqual(response.json()["status"], "approved")
        self.client_user.wallet.refresh_from_db()
        self.assertEqual(self.client_user.wallet.balance, Decimal("30.00"))
