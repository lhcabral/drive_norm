from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from payments.models import PaymentSettings
from wallet.models import LedgerEntry

User = get_user_model()


class BackofficeTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("adm", password="x12345", role=User.Role.ADMIN)
        self.client_user = User.objects.create_user(
            "cli", password="x12345", role=User.Role.CLIENT, full_name="Ana Cliente", phone="84999990000"
        )
        self.driver = User.objects.create_user("drv", password="x12345", role=User.Role.DRIVER)
        self.client.force_authenticate(self.admin)


class PermissionTests(BackofficeTestCase):
    def test_only_admin_can_access(self):
        urls = ["/api/admin/summary/", "/api/admin/clients/", "/api/admin/drivers/", "/api/admin/pix/"]
        for user in (self.client_user, self.driver):
            self.client.force_authenticate(user)
            for url in urls:
                with self.subTest(user=user.username, url=url):
                    self.assertEqual(self.client.get(url).status_code, 403)


class ClientTests(BackofficeTestCase):
    def test_list_and_search_clients(self):
        code = self.client_user.client_profile.code
        for term in ("Ana", code, "84999"):
            with self.subTest(term=term):
                results = self.client.get("/api/admin/clients/", {"search": term}).json()["results"]
                self.assertEqual([c["id"] for c in results], [self.client_user.id])
        results = self.client.get("/api/admin/clients/", {"search": "zzz"}).json()["results"]
        self.assertEqual(results, [])

    def test_client_detail_includes_history(self):
        data = self.client.get(f"/api/admin/clients/{self.client_user.id}/").json()
        self.assertEqual(data["code"], self.client_user.client_profile.code)
        for key in ("ledger", "rides", "payments", "stats"):
            self.assertIn(key, data)

    def test_edit_client_and_deactivate(self):
        response = self.client.patch(
            f"/api/admin/clients/{self.client_user.id}/",
            {"phone": "84911112222", "is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.phone, "84911112222")
        self.assertFalse(self.client_user.is_active)

    def test_credit_and_debit_wallet(self):
        url = f"/api/admin/clients/{self.client_user.id}/wallet/"
        response = self.client.post(url, {"operation": "credit", "amount": "50"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["balance"], "50.00")

        response = self.client.post(
            url, {"operation": "debit", "amount": "20", "description": "Estorno"}, format="json"
        )
        self.assertEqual(response.json()["balance"], "30.00")
        entry = LedgerEntry.objects.get(description="Estorno")
        self.assertEqual(entry.entry_type, LedgerEntry.EntryType.ADJUSTMENT)
        self.assertEqual(entry.created_by, self.admin)

        response = self.client.post(url, {"operation": "debit", "amount": "100"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.client_user.wallet.refresh_from_db()
        self.assertEqual(self.client_user.wallet.balance, Decimal("30.00"))


class PasswordTests(BackofficeTestCase):
    def test_set_password_manually_or_generated(self):
        url = f"/api/admin/users/{self.client_user.id}/password/"
        self.client.post(url, {"password": "nova123"}, format="json")
        self.client_user.refresh_from_db()
        self.assertTrue(self.client_user.check_password("nova123"))

        generated = self.client.post(url, {}, format="json").json()["password"]
        self.client_user.refresh_from_db()
        self.assertTrue(self.client_user.check_password(generated))

    def test_admin_password_rules(self):
        other_admin = User.objects.create_user("adm2", password="x12345", role=User.Role.ADMIN)
        response = self.client.post(f"/api/admin/users/{other_admin.id}/password/", {}, format="json")
        self.assertEqual(response.status_code, 200)

        root = User.objects.create_superuser("root", "", "x12345", role=User.Role.ADMIN)
        response = self.client.post(f"/api/admin/users/{root.id}/password/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        root.refresh_from_db()
        self.assertTrue(root.check_password("x12345"))

        self.client.force_authenticate(root)
        response = self.client.post(f"/api/admin/users/{root.id}/password/", {}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_send_reset_email_requires_email(self):
        url = f"/api/admin/users/{self.client_user.id}/password-email/"
        self.assertEqual(self.client.post(url).status_code, 400)
        self.client_user.email = "ana@exemplo.com"
        self.client_user.save()
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(mail.outbox[0].to, ["ana@exemplo.com"])


class DriverTests(BackofficeTestCase):
    def test_create_driver(self):
        response = self.client.post(
            "/api/admin/drivers/",
            {
                "username": "carlos",
                "password": "carro123",
                "full_name": "Carlos Motorista",
                "vehicle_info": "Onix branco ABC1D23",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["vehicle_info"], "Onix branco ABC1D23")
        driver = User.objects.get(username="carlos")
        self.assertEqual(driver.role, User.Role.DRIVER)
        self.assertTrue(driver.check_password("carro123"))

    def test_duplicate_username_rejected(self):
        response = self.client.post(
            "/api/admin/drivers/",
            {"username": "drv", "password": "carro123", "full_name": "Outro"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_update_driver_vehicle_and_status(self):
        response = self.client.patch(
            f"/api/admin/drivers/{self.driver.id}/",
            {"vehicle_info": "HB20 prata", "is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.driver_profile.vehicle_info, "HB20 prata")
        self.assertFalse(self.driver.is_active)


class AdminUserTests(BackofficeTestCase):
    def setUp(self):
        super().setUp()
        self.root = User.objects.create_superuser("root", "root@exemplo.com", "x12345", role=User.Role.ADMIN)

    def test_list_only_admins(self):
        results = self.client.get("/api/admin/admins/").json()["results"]
        self.assertEqual({a["username"] for a in results}, {"adm", "root"})
        by_name = {a["username"]: a for a in results}
        self.assertTrue(by_name["adm"]["is_self"])
        self.assertFalse(by_name["root"]["can_edit"])

    def test_create_admin(self):
        response = self.client.post(
            "/api/admin/admins/",
            {"username": "maria", "password": "senha123", "full_name": "Maria Admin", "email": "m@x.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        maria = User.objects.get(username="maria")
        self.assertEqual(maria.role, User.Role.ADMIN)
        self.assertFalse(maria.is_staff)
        self.assertTrue(maria.check_password("senha123"))
        self.assertFalse(hasattr(maria, "client_profile"))

    def test_only_superuser_grants_full_access(self):
        payload = {"username": "joao", "password": "senha123", "full_name": "João", "is_superuser": True}
        response = self.client.post("/api/admin/admins/", payload, format="json")
        self.assertEqual(response.status_code, 400)

        self.client.force_authenticate(self.root)
        response = self.client.post("/api/admin/admins/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        joao = User.objects.get(username="joao")
        self.assertTrue(joao.is_superuser and joao.is_staff)

    def test_edit_and_block_admin(self):
        other = User.objects.create_user("adm2", password="x12345", role=User.Role.ADMIN)
        response = self.client.patch(
            f"/api/admin/admins/{other.id}/", {"email": "novo@x.com", "is_active": False}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        other.refresh_from_db()
        self.assertEqual(other.email, "novo@x.com")
        self.assertFalse(other.is_active)

    def test_cannot_block_self_or_change_own_level(self):
        response = self.client.patch(f"/api/admin/admins/{self.admin.id}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 400)
        self.client.force_authenticate(self.root)
        response = self.client.patch(f"/api/admin/admins/{self.root.id}/", {"is_superuser": False}, format="json")
        self.assertEqual(response.status_code, 400)
        self.root.refresh_from_db()
        self.assertTrue(self.root.is_superuser)

    def test_regular_admin_cannot_touch_superuser(self):
        response = self.client.patch(f"/api/admin/admins/{self.root.id}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 403)
        self.root.refresh_from_db()
        self.assertTrue(self.root.is_active)

    def test_superuser_can_promote_and_demote(self):
        self.client.force_authenticate(self.root)
        url = f"/api/admin/admins/{self.admin.id}/"
        self.client.patch(url, {"is_superuser": True}, format="json")
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_superuser and self.admin.is_staff)
        self.client.patch(url, {"is_superuser": False}, format="json")
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.is_superuser or self.admin.is_staff)

    def test_clients_and_drivers_cannot_list_admins(self):
        for user in (self.client_user, self.driver):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/admin/admins/").status_code, 403)


@override_settings(MERCADOPAGO_ACCESS_TOKEN="", DEBUG=False)
class PixSettingsTests(BackofficeTestCase):
    def test_save_valid_token(self):
        ok = {"ok": True, "refused": False, "message": "Conectado à conta LOJA."}
        with mock.patch("backoffice.views.check_token", return_value=ok):
            response = self.client.put(
                "/api/admin/pix/", {"access_token": "APP_USR-abcdefgh-1234"}, format="json"
            )
        data = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["mode"], "mercadopago")
        self.assertEqual(data["source"], "panel")
        self.assertNotIn("abcdefgh-1234", data["token_preview"])
        self.assertEqual(PaymentSettings.load().mercadopago_access_token, "APP_USR-abcdefgh-1234")

    def test_refused_token_is_not_saved(self):
        refused = {"ok": False, "refused": True, "message": "Token recusado."}
        with mock.patch("backoffice.views.check_token", return_value=refused):
            response = self.client.put("/api/admin/pix/", {"access_token": "errado"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(PaymentSettings.load().mercadopago_access_token, "")

    def test_clear_token_disables_pix_in_production(self):
        PaymentSettings.objects.create(pk=1, mercadopago_access_token="APP_USR-x")
        response = self.client.put("/api/admin/pix/", {"access_token": ""}, format="json")
        self.assertEqual(response.json()["mode"], "disabled")
