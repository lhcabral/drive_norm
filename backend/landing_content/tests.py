import copy
import io
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from .defaults import DEFAULT_CONTENT
from .models import LandingContent

User = get_user_model()


class LandingContentApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("adm", password="x12345", role=User.Role.ADMIN)
        self.driver = User.objects.create_user("drv", password="x12345", role=User.Role.DRIVER)

    def test_public_endpoint_returns_defaults_without_auth(self):
        response = self.client.get("/api/landing/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), DEFAULT_CONTENT)
        self.assertEqual(response["Access-Control-Allow-Origin"], "*")

    def test_admin_endpoints_require_admin(self):
        self.assertEqual(self.client.get("/api/landing/admin/").status_code, 401)
        self.client.force_authenticate(self.driver)
        self.assertEqual(self.client.get("/api/landing/admin/").status_code, 403)
        response = self.client.put("/api/landing/admin/sections/hero/", {}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_save_section_and_reset_to_default(self):
        self.client.force_authenticate(self.admin)
        hero = copy.deepcopy(DEFAULT_CONTENT["hero"])
        hero["tagline"] = "Nova chamada"

        response = self.client.put("/api/landing/admin/sections/hero/", hero, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["customized"], ["hero"])
        self.assertEqual(self.client.get("/api/landing/").json()["hero"]["tagline"], "Nova chamada")

        response = self.client.delete("/api/landing/admin/sections/hero/")
        self.assertEqual(response.json()["customized"], [])
        self.assertEqual(self.client.get("/api/landing/").json(), DEFAULT_CONTENT)

    def test_reset_all_sections(self):
        self.client.force_authenticate(self.admin)
        for section in ("hero", "faq"):
            data = copy.deepcopy(DEFAULT_CONTENT[section])
            data["title_highlight" if section == "faq" else "badge"] = "Alterado"
            self.client.put(f"/api/landing/admin/sections/{section}/", data, format="json")

        response = self.client.post("/api/landing/admin/reset/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["customized"], [])
        self.assertEqual(LandingContent.load().overrides, {})

    def test_partial_section_is_completed_with_defaults(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            "/api/landing/admin/sections/footer/", {"slogan": "Vamos juntos"}, format="json"
        )
        footer = response.json()["content"]["footer"]
        self.assertEqual(footer["slogan"], "Vamos juntos")
        self.assertEqual(footer["company"], DEFAULT_CONTENT["footer"]["company"])

    def test_rejects_invalid_values(self):
        self.client.force_authenticate(self.admin)
        cases = [
            ("general", {"app_url": "javascript:alert(1)"}),
            ("general", {"whatsapp_number": "84 9999-9999"}),
            ("hero", {"image": "javascript:alert(1)"}),
            ("hero", {"unknown": "x"}),
            ("how", {"steps": [{"icon": "rocket", "title": "a", "text": "b"}]}),
            ("examples", {"rides": ["dez"]}),
            ("offer", {"enabled": "sim"}),
        ]
        for section, payload in cases:
            with self.subTest(section=section, payload=payload):
                response = self.client.put(
                    f"/api/landing/admin/sections/{section}/", payload, format="json"
                )
                self.assertEqual(response.status_code, 400)
        self.assertEqual(LandingContent.load().overrides, {})

    def test_unknown_section_returns_404(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put("/api/landing/admin/sections/nope/", {}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_corrupted_stored_value_falls_back_to_default(self):
        obj = LandingContent.load()
        obj.overrides = {"hero": {"tagline": 123, "badge": "Ok"}}
        obj.save()
        hero = self.client.get("/api/landing/").json()["hero"]
        self.assertEqual(hero["tagline"], DEFAULT_CONTENT["hero"]["tagline"])
        self.assertEqual(hero["badge"], "Ok")


class LandingUploadTests(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        self.admin = User.objects.create_user("adm", password="x12345", role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)

    def _png(self):
        buffer = io.BytesIO()
        Image.new("RGB", (4, 4), "yellow").save(buffer, format="PNG")
        return SimpleUploadedFile("foto.png", buffer.getvalue(), content_type="image/png")

    def test_upload_image(self):
        with override_settings(MEDIA_ROOT=self.media, BACKEND_URL="https://api.exemplo.com/"):
            response = self.client.post("/api/landing/admin/upload/", {"file": self._png()})
        self.assertEqual(response.status_code, 201)
        self.assertRegex(response.json()["url"], r"^https://api\.exemplo\.com/media/landing/\w+\.png$")

    def test_rejects_non_image(self):
        fake = SimpleUploadedFile("x.png", b"<svg onload=alert(1)>", content_type="image/png")
        with override_settings(MEDIA_ROOT=self.media):
            response = self.client.post("/api/landing/admin/upload/", {"file": fake})
        self.assertEqual(response.status_code, 400)
