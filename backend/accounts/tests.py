import re

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterTests(APITestCase):
    def test_public_register_always_creates_client(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "joao", "password": "segredo1", "full_name": "João", "role": "driver"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="joao")
        self.assertEqual(user.role, User.Role.CLIENT)
        self.assertTrue(hasattr(user, "client_profile"))


class PasswordRecoveryTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            "maria", email="maria@exemplo.com", password="antiga1", role=User.Role.CLIENT
        )

    def _reset_link_params(self):
        body = mail.outbox[-1].body
        return dict(re.findall(r"[?&](uid|token)=([^&\s]+)", body))

    def test_forgot_sends_email_with_link_and_reset_changes_password(self):
        response = self.client.post(
            "/api/auth/password/forgot/", {"identifier": "MARIA@exemplo.com"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["maria@exemplo.com"])

        params = self._reset_link_params()
        response = self.client.post(
            "/api/auth/password/reset/", {**params, "password": "nova123"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("nova123"))

        response = self.client.post(
            "/api/auth/password/reset/", {**params, "password": "outra123"}, format="json"
        )
        self.assertEqual(response.status_code, 400, "o link só pode ser usado uma vez")

    def test_forgot_does_not_reveal_unknown_accounts(self):
        known = self.client.post("/api/auth/password/forgot/", {"identifier": "maria"}, format="json")
        unknown = self.client.post("/api/auth/password/forgot/", {"identifier": "ninguem"}, format="json")
        self.assertEqual(known.json(), unknown.json())
        self.assertEqual(len(mail.outbox), 1)

    def test_reset_with_invalid_token(self):
        response = self.client.post(
            "/api/auth/password/reset/",
            {"uid": "MQ", "token": "invalido", "password": "nova123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
