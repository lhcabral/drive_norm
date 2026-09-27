from django.conf import settings
from django.db import models

from .defaults import DEFAULT_CONTENT


class LandingContent(models.Model):
    """Registro único com as seções da landing page personalizadas pelo admin.

    Seções ausentes em `overrides` usam o conteúdo padrão (`defaults.py`).
    """

    overrides = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        verbose_name = "Conteúdo da landing page"
        verbose_name_plural = "Conteúdo da landing page"

    def __str__(self):
        return "Conteúdo da landing page"

    @classmethod
    def load(cls) -> "LandingContent":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def customized_sections(self) -> list[str]:
        return [key for key in DEFAULT_CONTENT if key in self.overrides]
